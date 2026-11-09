import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Store, HttpError } from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const DB_FILE = process.env.DB_FILE ?? join(__dirname, '..', 'data', 'db.json');

const STATUSES = ['livre', 'trabalhando', 'pausa', 'reuniao', 'externo'];
const PRIORITIES = ['baixa', 'media', 'alta', 'urgente'];
const STAGES = ['entrada', 'andamento', 'revisao', 'concluida'];

const store = new Store(DB_FILE);
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---------- utilitários ----------
const now = () => new Date().toISOString();
const findTask = (db, id) => {
  const t = db.tasks.find((x) => x.id === id);
  if (!t) throw new HttpError(404, 'Tarefa não encontrada');
  return t;
};
const findMember = (db, id) => {
  const m = db.members.find((x) => x.id === id);
  if (!m) throw new HttpError(404, 'Colaborador não encontrado');
  return m;
};
const log = (task, text, memberId = null, kind = 'sistema') =>
  task.updates.push({ id: Store.id('u'), memberId, text, at: now(), kind });

/** Quem estava focado na tarefa volta a ficar livre. */
const releaseFocus = (db, taskId, onlyMemberId = null) => {
  for (const m of db.members) {
    if (m.currentTaskId !== taskId) continue;
    if (onlyMemberId && m.id !== onlyMemberId) continue;
    m.currentTaskId = null;
    if (m.status === 'trabalhando') {
      m.status = 'livre';
      m.statusSince = now();
    }
  }
};

const pickTaskFields = (body, partial) => {
  const out = {};
  if (!partial || 'title' in body) {
    const title = String(body.title ?? '').trim();
    if (!title) throw new HttpError(400, 'Informe o título da tarefa');
    out.title = title.slice(0, 160);
  }
  for (const k of ['description', 'client', 'requester']) {
    if (k in body) out[k] = String(body[k] ?? '').slice(0, 4000);
  }
  if ('priority' in body) {
    if (!PRIORITIES.includes(body.priority)) throw new HttpError(400, 'Prioridade inválida');
    out.priority = body.priority;
  }
  if ('dueDate' in body) {
    if (body.dueDate && Number.isNaN(Date.parse(body.dueDate))) throw new HttpError(400, 'Prazo inválido');
    out.dueDate = body.dueDate || null;
  }
  return out;
};

const handle = (fn) => async (req, res) => {
  try {
    const result = await fn(req, res);
    if (!res.headersSent) res.json(result ?? { ok: true });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: err.message ?? 'Erro inesperado' });
  }
};

// ---------- estado + tempo real (SSE) ----------
app.get('/api/state', handle(() => store.snapshot()));

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const send = (data) => res.write(`event: state\ndata: ${JSON.stringify(data)}\n\n`);
  send(store.snapshot());
  const off = store.onChange(send);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    off();
    clearInterval(ping);
  });
});

// ---------- colaboradores ----------
app.post('/api/members', handle((req) =>
  store.mutate((db) => {
    const name = String(req.body.name ?? '').trim();
    if (!name) throw new HttpError(400, 'Informe o nome');
    const member = {
      id: Store.id('m'),
      name: name.slice(0, 80),
      role: String(req.body.role ?? '').slice(0, 80),
      avatar: Number.isInteger(req.body.avatar) ? req.body.avatar % 6 : db.members.length % 6,
      status: 'livre', statusNote: '', statusUntil: null, statusSince: now(), currentTaskId: null,
    };
    db.members.push(member);
    return member;
  }),
));

app.patch('/api/members/:id', handle((req) =>
  store.mutate((db) => {
    const m = findMember(db, req.params.id);
    if ('name' in req.body) {
      const name = String(req.body.name).trim();
      if (!name) throw new HttpError(400, 'Informe o nome');
      m.name = name.slice(0, 80);
    }
    if ('role' in req.body) m.role = String(req.body.role).slice(0, 80);
    if ('avatar' in req.body) m.avatar = Number(req.body.avatar) % 6;
    return m;
  }),
));

app.delete('/api/members/:id', handle((req) =>
  store.mutate((db) => {
    findMember(db, req.params.id);
    db.members = db.members.filter((m) => m.id !== req.params.id);
    for (const t of db.tasks) {
      t.assignees = t.assignees.filter((a) => a !== req.params.id);
      if (t.stage === 'andamento' && t.assignees.length === 0) t.stage = 'entrada';
    }
  }),
));

app.patch('/api/members/:id/status', handle((req) =>
  store.mutate((db) => {
    const m = findMember(db, req.params.id);
    const { status, note, until, currentTaskId } = req.body;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Status inválido');

    let focus = null;
    if (status === 'trabalhando') {
      focus = currentTaskId ?? m.currentTaskId;
      if (!focus) throw new HttpError(400, 'Escolha em qual tarefa você está trabalhando');
      const t = findTask(db, focus);
      if (!t.assignees.includes(m.id)) throw new HttpError(400, 'Você não está nesta tarefa');
      if (t.stage !== 'andamento') throw new HttpError(400, 'A tarefa não está em andamento');
    }

    if (m.status !== status) m.statusSince = now();
    m.status = status;
    m.statusNote = String(note ?? '').slice(0, 140);
    m.statusUntil = until || null;
    // Pausa e reunião mantêm a tarefa em foco para quando voltar.
    if (status === 'trabalhando') m.currentTaskId = focus;
    if (status === 'livre') m.currentTaskId = null;
    return m;
  }),
));

// ---------- tarefas ----------
app.post('/api/tasks', handle((req) =>
  store.mutate((db) => {
    const fields = pickTaskFields(req.body, false);
    const task = {
      id: Store.id('t'),
      code: `CH-${db.seq++}`,
      description: '', client: '', requester: '', priority: 'media', dueDate: null,
      ...fields,
      assignees: [], stage: 'entrada', updates: [], reviewNote: '',
      createdAt: now(), finishedAt: null, completedAt: null,
    };
    log(task, 'Chamado aberto');
    db.tasks.push(task);
    return task;
  }),
));

app.patch('/api/tasks/:id', handle((req) =>
  store.mutate((db) => {
    const t = findTask(db, req.params.id);
    Object.assign(t, pickTaskFields(req.body, true));
    return t;
  }),
));

app.delete('/api/tasks/:id', handle((req) =>
  store.mutate((db) => {
    findTask(db, req.params.id);
    releaseFocus(db, req.params.id);
    db.tasks = db.tasks.filter((t) => t.id !== req.params.id);
  }),
));

/** Arrastar a tarefa para um colaborador. */
app.post('/api/tasks/:id/assign', handle((req) =>
  store.mutate((db) => {
    const t = findTask(db, req.params.id);
    const m = findMember(db, req.body.memberId);
    if (t.stage === 'concluida') throw new HttpError(400, 'Tarefa já concluída');
    if (t.stage === 'revisao') throw new HttpError(400, 'Tarefa em revisão. Devolva-a antes de delegar');
    if (!t.assignees.includes(m.id)) {
      t.assignees.push(m.id);
      log(t, `Delegada para ${m.name}`);
    }
    t.stage = 'andamento';
    return t;
  }),
));

app.post('/api/tasks/:id/unassign', handle((req) =>
  store.mutate((db) => {
    const t = findTask(db, req.params.id);
    const m = findMember(db, req.body.memberId);
    t.assignees = t.assignees.filter((a) => a !== m.id);
    releaseFocus(db, t.id, m.id);
    log(t, `${m.name} saiu da tarefa`);
    if (t.assignees.length === 0 && t.stage === 'andamento') t.stage = 'entrada';
    return t;
  }),
));

app.post('/api/tasks/:id/updates', handle((req) =>
  store.mutate((db) => {
    const t = findTask(db, req.params.id);
    const text = String(req.body.text ?? '').trim();
    if (!text) throw new HttpError(400, 'Escreva a atualização');
    if (req.body.memberId) findMember(db, req.body.memberId);
    log(t, text.slice(0, 2000), req.body.memberId ?? null, 'nota');
    return t;
  }),
));

/** Colaborador concluiu: vai para revisão. */
app.post('/api/tasks/:id/finish', handle((req) =>
  store.mutate((db) => {
    const t = findTask(db, req.params.id);
    if (t.stage !== 'andamento') throw new HttpError(400, 'Só tarefas em andamento podem ir para revisão');
    const m = req.body.memberId ? findMember(db, req.body.memberId) : null;
    t.stage = 'revisao';
    t.finishedAt = now();
    t.reviewNote = '';
    if (req.body.note) log(t, String(req.body.note).slice(0, 2000), m?.id ?? null, 'nota');
    log(t, `${m ? m.name : 'Equipe'} enviou para revisão`);
    releaseFocus(db, t.id);
    return t;
  }),
));

app.post('/api/tasks/:id/approve', handle((req) =>
  store.mutate((db) => {
    const t = findTask(db, req.params.id);
    if (t.stage !== 'revisao') throw new HttpError(400, 'A tarefa não está em revisão');
    t.stage = 'concluida';
    t.completedAt = now();
    log(t, 'Revisão aprovada. Tarefa concluída');
    return t;
  }),
));

app.post('/api/tasks/:id/return', handle((req) =>
  store.mutate((db) => {
    const t = findTask(db, req.params.id);
    if (t.stage !== 'revisao' && t.stage !== 'concluida') throw new HttpError(400, 'Nada para devolver');
    const note = String(req.body.note ?? '').trim();
    t.stage = t.assignees.length ? 'andamento' : 'entrada';
    t.reviewNote = note;
    t.completedAt = null;
    log(t, note ? `Devolvida: ${note}` : 'Devolvida para ajustes');
    return t;
  }),
));

app.post('/api/reset', handle(() => {
  store.reset();
  return store.snapshot();
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ---------- front-end compilado (opcional) ----------
const web = join(__dirname, '..', '..', 'frontend', 'dist', 'frontend', 'browser');
if (existsSync(web)) {
  app.use(express.static(web));
  app.get('/{*path}', (_req, res) => res.sendFile(join(web, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`API do Painel da Equipe em http://localhost:${PORT}`);
  if (existsSync(web)) console.log('Servindo o front-end compilado no mesmo endereço.');
});

export { STAGES };

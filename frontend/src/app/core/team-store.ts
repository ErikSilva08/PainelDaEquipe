import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppState, Member, MemberStatus, PRIORITY_META, Priority, Task } from './models';

const API = '/api';

/**
 * Estado global da equipe. O servidor envia o estado completo via
 * Server-Sent Events sempre que algo muda, então todas as telas abertas
 * (quadro, tela do colaborador, escritório) ficam sincronizadas.
 */
@Injectable({ providedIn: 'root' })
export class TeamStore implements OnDestroy {
  private http = inject(HttpClient);
  private source?: EventSource;
  private retry?: ReturnType<typeof setTimeout>;

  readonly members = signal<Member[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly loaded = signal(false);
  readonly online = signal(false);
  readonly toast = signal<{ text: string; error: boolean } | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly memberMap = computed(() => new Map(this.members().map((m) => [m.id, m])));
  readonly taskMap = computed(() => new Map(this.tasks().map((t) => [t.id, t])));

  readonly inbox = computed(() => this.sortByUrgency(this.tasks().filter((t) => t.stage === 'entrada')));
  readonly review = computed(() => this.sortByUrgency(this.tasks().filter((t) => t.stage === 'revisao')));
  readonly done = computed(() =>
    this.tasks()
      .filter((t) => t.stage === 'concluida')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
  );

  constructor() {
    this.connect();
  }

  ngOnDestroy() {
    this.source?.close();
    clearTimeout(this.retry);
  }

  private connect() {
    this.source?.close();
    const es = new EventSource(`${API}/events`);
    this.source = es;
    es.addEventListener('state', (ev) => {
      this.apply(JSON.parse((ev as MessageEvent).data));
      this.online.set(true);
    });
    es.onerror = () => {
      this.online.set(false);
      es.close();
      clearTimeout(this.retry);
      this.retry = setTimeout(() => this.connect(), 3000);
    };
  }

  private apply(state: AppState) {
    this.members.set(state.members);
    this.tasks.set(state.tasks);
    this.loaded.set(true);
  }

  // ---------- consultas ----------
  tasksOf(memberId: string, stages: Task['stage'][] = ['andamento', 'revisao']) {
    return this.sortByUrgency(
      this.tasks().filter((t) => t.assignees.includes(memberId) && stages.includes(t.stage)),
    );
  }

  sortByUrgency(list: Task[]) {
    const due = (t: Task) => (t.dueDate ? Date.parse(t.dueDate) : Number.MAX_SAFE_INTEGER);
    return [...list].sort(
      (a, b) =>
        due(a) - due(b) || PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight,
    );
  }

  // ---------- comandos ----------
  createTask(data: Partial<Task>) {
    return this.call<Task>('POST', '/tasks', data, 'Chamado criado');
  }
  updateTask(id: string, data: Partial<Task>) {
    return this.call<Task>('PATCH', `/tasks/${id}`, data, 'Alterações salvas');
  }
  deleteTask(id: string) {
    return this.call('DELETE', `/tasks/${id}`, undefined, 'Chamado excluído');
  }
  assign(taskId: string, memberId: string) {
    const name = this.memberMap().get(memberId)?.name.split(' ')[0];
    return this.call<Task>('POST', `/tasks/${taskId}/assign`, { memberId }, `Delegada para ${name}`);
  }
  unassign(taskId: string, memberId: string) {
    return this.call<Task>('POST', `/tasks/${taskId}/unassign`, { memberId });
  }
  addUpdate(taskId: string, text: string, memberId: string | null) {
    return this.call<Task>('POST', `/tasks/${taskId}/updates`, { text, memberId }, 'Atualização publicada');
  }
  finish(taskId: string, memberId: string | null, note = '') {
    return this.call<Task>('POST', `/tasks/${taskId}/finish`, { memberId, note }, 'Enviada para revisão');
  }
  approve(taskId: string) {
    return this.call<Task>('POST', `/tasks/${taskId}/approve`, {}, 'Tarefa concluída');
  }
  returnTask(taskId: string, note: string) {
    return this.call<Task>('POST', `/tasks/${taskId}/return`, { note }, 'Devolvida para ajustes');
  }
  setStatus(
    memberId: string,
    status: MemberStatus,
    opts: { note?: string; until?: string | null; currentTaskId?: string | null } = {},
  ) {
    return this.call<Member>('PATCH', `/members/${memberId}/status`, { status, ...opts });
  }
  createMember(data: Partial<Member>) {
    return this.call<Member>('POST', '/members', data, 'Colaborador adicionado');
  }
  updateMember(id: string, data: Partial<Member>) {
    return this.call<Member>('PATCH', `/members/${id}`, data, 'Colaborador atualizado');
  }
  deleteMember(id: string) {
    return this.call('DELETE', `/members/${id}`, undefined, 'Colaborador removido');
  }

  notify(text: string, error = false) {
    this.toast.set({ text, error });
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), error ? 4500 : 2200);
  }

  private async call<T = unknown>(method: string, path: string, body?: unknown, success?: string) {
    try {
      const res = await firstValueFrom(this.http.request<T>(method, API + path, { body }));
      if (success) this.notify(success);
      return res;
    } catch (err) {
      const msg =
        err instanceof HttpErrorResponse
          ? (err.error?.error ?? (err.status === 0 ? 'Servidor indisponível. Verifique se o backend está rodando.' : err.message))
          : 'Erro inesperado';
      this.notify(msg, true);
      return null;
    }
  }
}

export const PRIORITIES: Priority[] = ['urgente', 'alta', 'media', 'baixa'];

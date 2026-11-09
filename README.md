# Painel da Equipe

Aplicação web (desktop e celular) para organizar chamados e compromissos da equipe:
quem está fazendo o quê, qual o prazo e para quem é a entrega.

- **Frontend:** Angular 21 (standalone, signals, zoneless) + Angular CDK (arrastar e soltar)
- **Backend:** Node.js + Express 5 em JavaScript puro, dados em arquivo JSON, tempo real por Server-Sent Events
- **Escritório pixel:** sprites do [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) (MIT), renderizados em canvas

## Como rodar

Requisitos: Node.js 20.19 ou mais novo (ou 22.12+, ou 24+). Confira com `node -v`.

### Backend e front juntos (um comando)

Na pasta `painel-equipe`, no PowerShell:

```powershell
npm run setup
npm run dev
```

- `npm run setup` instala as dependências da raiz, do backend e do frontend (só na primeira vez).
- `npm run dev` sobe a API (porta 3000) e o site (porta 4200) no mesmo terminal. Abra `http://localhost:4200`.
  Para parar os dois, use `Ctrl+C`.

### Produção (um só servidor)

```powershell
npm run setup
npm run prod
```

Abra `http://localhost:3000`. O backend serve a API e o front compilado no mesmo endereço.
Variáveis opcionais: `PORT` e `DB_FILE`.

### Separado (opcional)

```powershell
npm run dev:api
npm run dev:web
```

(cada um em um terminal)

## Como funciona

### Quadro (delegação por arrasto)
Não é um kanban de colunas por status. O centro do quadro é a **equipe**:

1. **Entrada**: chamados novos, ordenados por prazo e prioridade.
2. **Arraste o chamado até a pessoa** para delegar. Para colocar mais gente na mesma tarefa, abra o chamado e use *Delegar para…*
   Arrastar de uma pessoa para outra transfere a tarefa; arrastar de volta para a Entrada tira a pessoa.
3. Quando o colaborador clica em **Finalizei**, a tarefa vai para **Revisão** (ou arraste até lá).
4. Na revisão: **Aprovar e concluir** (ou arraste para Concluídas) ou **Devolver** com o que precisa ajustar. A observação aparece em vermelho no card.

No celular o quadro vira abas (Entrada, Equipe, Revisão) e a delegação é feita pelo diálogo do chamado.

### Tela de cada colaborador (`/membro/:id`)
- **Trabalhar nesta**: marca a tarefa em foco (o personagem senta na mesa e o PC liga).
- **Atualizar**: publica o andamento na linha do tempo do chamado.
- **Pausa / Reunião / Reunião externa**: com motivo e horário de volta. **Voltei** retoma a tarefa em foco.
- **Finalizei · enviar para revisão**.

### Escritório pixel (`/escritorio`)
| Status          | Onde o personagem fica                  |
|-----------------|------------------------------------------|
| Trabalhando     | Na própria mesa, digitando               |
| Disponível      | Andando pela área de trabalho            |
| Em reunião      | Sala de reunião                          |
| Em pausa        | Sala de descanso                         |
| Reunião externa | Sai pela porta e aparece em "Fora do escritório" |

Passe o mouse para ver a atividade, o cliente e o prazo; clique para abrir a tela da pessoa.
São 12 mesas; a ordem dos colaboradores define a mesa de cada um.

Todas as telas abertas se atualizam sozinhas quando alguém muda algo.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/state` | Colaboradores e tarefas |
| GET | `/api/events` | Stream SSE com o estado a cada mudança |
| POST/PATCH/DELETE | `/api/tasks[/:id]` | CRUD de chamados |
| POST | `/api/tasks/:id/assign` `{ memberId }` | Delegar |
| POST | `/api/tasks/:id/unassign` `{ memberId }` | Tirar da tarefa |
| POST | `/api/tasks/:id/updates` `{ text, memberId }` | Atualização |
| POST | `/api/tasks/:id/finish` | Enviar para revisão |
| POST | `/api/tasks/:id/approve` | Concluir |
| POST | `/api/tasks/:id/return` `{ note }` | Devolver / reabrir |
| POST/PATCH/DELETE | `/api/members[/:id]` | CRUD de colaboradores |
| PATCH | `/api/members/:id/status` `{ status, note, until, currentTaskId }` | Status |
| POST | `/api/reset` | Restaura os dados de exemplo |

Status: `livre`, `trabalhando`, `pausa`, `reuniao`, `externo`.
Para apagar os dados de exemplo, exclua `backend/data/db.json` (ele é recriado) ou cadastre a equipe real e remova os exemplos pela tela Equipe.

## Estrutura

```
backend/src/server.js      rotas e regras do fluxo
backend/src/store.js       persistência JSON + notificação de mudanças
backend/src/seed.js        dados de exemplo
frontend/src/app/core      modelos, store (signals + SSE), datas
frontend/src/app/ui        avatar, card de tarefa, diálogo do chamado
frontend/src/app/pages     quadro, tela do membro, equipe, escritório
frontend/src/app/pages/office/office-map.ts     planta do escritório (salas, mesas, móveis)
frontend/src/app/pages/office/office-engine.ts  motor do canvas (caminhada, animação, hover)
frontend/public/pixel      sprites do Pixel Agents
```

Os componentes visuais (botão, input, badge, card, dialog) seguem o padrão do shadcn/ui escritos em SCSS puro
para manter o bundle leve. Se quiser os componentes oficiais, o port do shadcn para Angular é o
[spartan-ng](https://spartan.ng).

## Próximos passos sugeridos
- Login por colaborador (hoje qualquer pessoa pode abrir qualquer tela)
- Banco de dados (SQLite/Postgres) no lugar do JSON
- Notificação quando um chamado chega ou volta da revisão

## Créditos
Personagens, pisos e móveis: [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents), licença MIT
(cópia em `frontend/public/pixel/LICENSE-pixel-agents.txt`). Personagens baseados no
[Metro City pack de JIK-A-4](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack).

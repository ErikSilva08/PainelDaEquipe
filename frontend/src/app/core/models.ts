export type MemberStatus = 'livre' | 'trabalhando' | 'pausa' | 'reuniao' | 'externo';
export type Priority = 'baixa' | 'media' | 'alta' | 'urgente';
export type Stage = 'entrada' | 'andamento' | 'revisao' | 'concluida';

export interface Member {
  id: string;
  name: string;
  role: string;
  avatar: number;
  status: MemberStatus;
  statusNote: string;
  statusUntil: string | null;
  statusSince: string;
  currentTaskId: string | null;
}

export interface TaskUpdate {
  id: string;
  memberId: string | null;
  text: string;
  at: string;
  kind: 'nota' | 'sistema';
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string;
  client: string;
  requester: string;
  priority: Priority;
  dueDate: string | null;
  assignees: string[];
  stage: Stage;
  updates: TaskUpdate[];
  reviewNote: string;
  createdAt: string;
  finishedAt: string | null;
  completedAt: string | null;
}

export interface AppState {
  members: Member[];
  tasks: Task[];
}

export const STATUS_META: Record<MemberStatus, { label: string; verb: string; color: string }> = {
  livre: { label: 'Disponível', verb: 'Disponível', color: 'var(--st-livre)' },
  trabalhando: { label: 'Trabalhando', verb: 'Trabalhando em', color: 'var(--st-trabalhando)' },
  pausa: { label: 'Em pausa', verb: 'Pausa', color: 'var(--st-pausa)' },
  reuniao: { label: 'Em reunião', verb: 'Reunião', color: 'var(--st-reuniao)' },
  externo: { label: 'Reunião externa', verb: 'Fora do escritório', color: 'var(--st-externo)' },
};

export const PRIORITY_META: Record<Priority, { label: string; color: string; weight: number }> = {
  baixa: { label: 'Baixa', color: 'var(--pr-baixa)', weight: 0 },
  media: { label: 'Média', color: 'var(--pr-media)', weight: 1 },
  alta: { label: 'Alta', color: 'var(--pr-alta)', weight: 2 },
  urgente: { label: 'Urgente', color: 'var(--pr-urgente)', weight: 3 },
};

export const STAGE_LABEL: Record<Stage, string> = {
  entrada: 'Entrada',
  andamento: 'Em andamento',
  revisao: 'Em revisão',
  concluida: 'Concluída',
};

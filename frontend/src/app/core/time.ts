import { Injectable, signal } from '@angular/core';

/** Relógio compartilhado: atualiza a cada 30s para os prazos "vence em..." */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(Date.now());
  constructor() {
    setInterval(() => this.now.set(Date.now()), 30_000);
  }
}

const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pad = (n: number) => String(n).padStart(2, '0');

export function hhmm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayDiff(a: Date, b: Date) {
  const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((x - y) / 86_400_000);
}

export type DueTone = 'late' | 'soon' | 'ok' | 'none';

export function dueInfo(iso: string | null, now: number): { label: string; tone: DueTone } {
  if (!iso) return { label: 'Sem prazo', tone: 'none' };
  const d = new Date(iso);
  const diffMin = Math.round((d.getTime() - now) / 60_000);
  const days = dayDiff(d, new Date(now));

  if (diffMin < 0) {
    const late = -diffMin;
    const txt = late < 60 ? `${late} min` : late < 1440 ? `${Math.round(late / 60)} h` : `${Math.round(late / 1440)} d`;
    return { label: `Atrasada há ${txt}`, tone: 'late' };
  }
  let label: string;
  if (days === 0) label = diffMin < 60 ? `Vence em ${diffMin} min` : `Hoje, ${hhmm(d)}`;
  else if (days === 1) label = `Amanhã, ${hhmm(d)}`;
  else if (days < 7) label = `${WEEK[d.getDay()]}, ${hhmm(d)}`;
  else label = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return { label, tone: diffMin <= 240 ? 'soon' : 'ok' };
}

export function sinceLabel(iso: string | null, now: number) {
  if (!iso) return '';
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)} h`;
  return `há ${Math.floor(min / 1440)} d`;
}

export function dateTimeLabel(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hhmm(d)}`;
}

/** ISO -> valor para <input type="datetime-local"> */
export function toLocalInput(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hhmm(d)}`;
}
export function fromLocalInput(v: string) {
  return v ? new Date(v).toISOString() : null;
}
/** "HH:mm" de hoje -> ISO */
export function todayAt(v: string) {
  if (!v) return null;
  const [h, m] = v.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TaskDialog {
  /** id da tarefa aberta, 'new' para criar, null fechado */
  readonly current = signal<string | null>(null);
  /** colaborador em nome de quem as atualizações são publicadas */
  readonly actingAs = signal<string | null>(null);

  open(taskId: string, actingAs: string | null = null) {
    this.actingAs.set(actingAs);
    this.current.set(taskId);
  }
  create() {
    this.actingAs.set(null);
    this.current.set('new');
  }
  close() {
    this.current.set(null);
  }
}

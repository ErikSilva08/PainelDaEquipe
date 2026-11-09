import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Member, STATUS_META, Task } from '../../core/models';
import { TeamStore } from '../../core/team-store';
import { Clock, hhmm } from '../../core/time';
import { Avatar } from '../../ui/avatar';
import { TaskCard } from '../../ui/task-card';
import { TaskDialog } from '../../ui/task-dialog.service';

type Zone =
  | { kind: 'inbox' }
  | { kind: 'member'; id: string }
  | { kind: 'review' }
  | { kind: 'done' };

@Component({
  selector: 'app-board',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, TaskCard, Avatar, RouterLink],
  templateUrl: './board.html',
  styleUrl: './board.scss',
})
export class Board {
  protected store = inject(TeamStore);
  protected dialog = inject(TaskDialog);
  private clock = inject(Clock);

  protected readonly statusMeta = STATUS_META;
  protected readonly zInbox: Zone = { kind: 'inbox' };
  protected readonly zReview: Zone = { kind: 'review' };
  protected readonly zDone: Zone = { kind: 'done' };
  private memberZones = new Map<string, Zone>();

  /** aba ativa no celular */
  protected tab = signal<'entrada' | 'equipe' | 'revisao'>('equipe');
  protected filter = signal('');
  protected showAllDone = signal(false);

  protected inbox = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const list = this.store.inbox();
    return q
      ? list.filter((t) => `${t.code} ${t.title} ${t.client} ${t.requester}`.toLowerCase().includes(q))
      : list;
  });
  protected doneList = computed(() => this.store.done().slice(0, this.showAllDone() ? 50 : 5));

  protected stats = computed(() => {
    const now = this.clock.now();
    const open = this.store.tasks().filter((t) => t.stage !== 'concluida');
    return {
      open: open.length,
      late: open.filter((t) => t.stage !== 'revisao' && t.dueDate && Date.parse(t.dueDate) < now).length,
      free: this.store.members().filter((m) => m.status === 'livre').length,
    };
  });

  protected zoneOf(m: Member): Zone {
    let z = this.memberZones.get(m.id);
    if (!z) {
      z = { kind: 'member', id: m.id };
      this.memberZones.set(m.id, z);
    }
    return z;
  }

  protected activeTasks(m: Member) {
    return this.store.tasksOf(m.id, ['andamento']);
  }
  protected inReview(m: Member) {
    return this.store.tasks().filter((t) => t.stage === 'revisao' && t.assignees.includes(m.id)).length;
  }
  protected statusLine(m: Member) {
    if (m.status === 'trabalhando') return this.store.taskMap().get(m.currentTaskId ?? '')?.code ?? '';
    const until = m.statusUntil ? ` até ${hhmm(new Date(m.statusUntil))}` : '';
    return (m.statusNote || '') + until;
  }

  protected open(t: Task) {
    this.dialog.open(t.id);
  }

  // ---------- arrastar e soltar ----------
  protected canEnterMember = (drag: CdkDrag<Task>) => drag.data.stage === 'entrada' || drag.data.stage === 'andamento';
  protected canEnterInbox = (drag: CdkDrag<Task>) => drag.data.stage === 'andamento';
  protected canEnterReview = (drag: CdkDrag<Task>) => drag.data.stage === 'andamento';
  protected canEnterDone = (drag: CdkDrag<Task>) => drag.data.stage === 'revisao';

  protected async drop(ev: CdkDragDrop<Zone, Zone, Task>) {
    const task = ev.item.data;
    const from = ev.previousContainer.data;
    const to = ev.container.data;
    if (from === to) return;

    switch (to.kind) {
      case 'member':
        if (!task.assignees.includes(to.id)) await this.store.assign(task.id, to.id);
        // arrastar de uma pessoa para outra transfere a tarefa
        if (from.kind === 'member' && from.id !== to.id) await this.store.unassign(task.id, from.id);
        break;
      case 'inbox':
        if (from.kind === 'member') await this.store.unassign(task.id, from.id);
        break;
      case 'review':
        await this.store.finish(task.id, from.kind === 'member' ? from.id : null);
        break;
      case 'done':
        await this.store.approve(task.id);
        break;
    }
  }
}

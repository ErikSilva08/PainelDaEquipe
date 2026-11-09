import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PRIORITY_META, Priority, STAGE_LABEL, Task } from '../core/models';
import { PRIORITIES, TeamStore } from '../core/team-store';
import { Clock, dateTimeLabel, dueInfo, fromLocalInput, sinceLabel, toLocalInput } from '../core/time';
import { Avatar } from './avatar';
import { TaskDialog } from './task-dialog.service';

interface Draft {
  title: string;
  description: string;
  client: string;
  requester: string;
  priority: Priority;
  due: string;
}

@Component({
  selector: 'app-task-dialog',
  imports: [FormsModule, Avatar],
  templateUrl: './task-dialog.html',
  styleUrl: './task-dialog.scss',
})
export class TaskDialogHost {
  protected store = inject(TeamStore);
  protected dialog = inject(TaskDialog);
  private clock = inject(Clock);
  private el = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly priorities = PRIORITIES;
  protected readonly prioMeta = PRIORITY_META;
  protected readonly stageLabel = STAGE_LABEL;
  protected readonly dateTime = dateTimeLabel;

  protected editing = signal(false);
  protected draft: Draft = this.emptyDraft();
  protected updateText = '';
  protected returnNote = '';
  protected returning = signal(false);
  protected author = signal<string | null>(null);

  protected isNew = computed(() => this.dialog.current() === 'new');
  protected task = computed(() => {
    const id = this.dialog.current();
    return id && id !== 'new' ? (this.store.taskMap().get(id) ?? null) : null;
  });
  protected due = computed(() => dueInfo(this.task()?.dueDate ?? null, this.clock.now()));
  protected assignees = computed(() =>
    (this.task()?.assignees ?? []).map((id) => this.store.memberMap().get(id)).filter((m) => !!m),
  );
  protected available = computed(() => {
    const t = this.task();
    return this.store.members().filter((m) => !t?.assignees.includes(m.id));
  });
  protected timeline = computed(() => [...(this.task()?.updates ?? [])].reverse());
  protected canDelegate = computed(() => {
    const s = this.task()?.stage;
    return s === 'entrada' || s === 'andamento';
  });

  constructor() {
    effect(() => {
      const id = this.dialog.current();
      const dlg = this.el().nativeElement;
      if (id) {
        this.returning.set(false);
        this.updateText = '';
        this.returnNote = '';
        this.author.set(this.dialog.actingAs());
        if (id === 'new') {
          this.draft = this.emptyDraft();
          this.editing.set(true);
        } else {
          this.editing.set(false);
        }
        if (!dlg.open) dlg.showModal();
      } else if (dlg.open) {
        dlg.close();
      }
    });
    // tarefa excluída por outra pessoa enquanto o diálogo estava aberto
    effect(() => {
      const id = this.dialog.current();
      if (id && id !== 'new' && this.store.loaded() && !this.store.taskMap().has(id)) this.dialog.close();
    });
  }

  protected memberName(id: string | null) {
    return id ? (this.store.memberMap().get(id)?.name ?? 'Ex-colaborador') : '';
  }
  protected memberAvatar(id: string | null) {
    return id ? (this.store.memberMap().get(id)?.avatar ?? 0) : 0;
  }
  protected since(iso: string) {
    return sinceLabel(iso, this.clock.now());
  }

  protected startEdit(t: Task) {
    this.draft = {
      title: t.title,
      description: t.description,
      client: t.client,
      requester: t.requester,
      priority: t.priority,
      due: toLocalInput(t.dueDate),
    };
    this.editing.set(true);
  }

  protected async save() {
    const d = this.draft;
    const payload = {
      title: d.title,
      description: d.description,
      client: d.client,
      requester: d.requester,
      priority: d.priority,
      dueDate: fromLocalInput(d.due),
    };
    if (this.isNew()) {
      const created = await this.store.createTask(payload);
      if (created) this.dialog.close();
    } else if (this.task()) {
      const ok = await this.store.updateTask(this.task()!.id, payload);
      if (ok) this.editing.set(false);
    }
  }

  protected cancelEdit() {
    if (this.isNew()) this.dialog.close();
    else this.editing.set(false);
  }

  protected async remove(t: Task) {
    if (!confirm(`Excluir o chamado ${t.code}? Essa ação não pode ser desfeita.`)) return;
    await this.store.deleteTask(t.id);
  }

  protected assign(t: Task, memberId: string) {
    if (memberId) this.store.assign(t.id, memberId);
  }

  protected async publish(t: Task) {
    const text = this.updateText.trim();
    if (!text) return;
    const ok = await this.store.addUpdate(t.id, text, this.author());
    if (ok) this.updateText = '';
  }

  protected finish(t: Task) {
    this.store.finish(t.id, this.author());
  }

  protected async sendBack(t: Task) {
    const ok = await this.store.returnTask(t.id, this.returnNote.trim());
    if (ok) this.returning.set(false);
  }

  protected onNativeClose() {
    // ESC ou clique fora fecha o <dialog> nativo; sincroniza o sinal
    if (this.dialog.current()) this.dialog.close();
  }

  protected backdrop(ev: MouseEvent) {
    if (ev.target === this.el().nativeElement) this.dialog.close();
  }

  private emptyDraft(): Draft {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return { title: '', description: '', client: '', requester: '', priority: 'media', due: toLocalInput(d.toISOString()) };
  }
}

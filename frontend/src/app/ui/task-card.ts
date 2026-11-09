import { Component, computed, inject, input, output } from '@angular/core';
import { PRIORITY_META, Task } from '../core/models';
import { TeamStore } from '../core/team-store';
import { Clock, dueInfo } from '../core/time';
import { Avatar } from './avatar';

@Component({
  selector: 'app-task-card',
  imports: [Avatar],
  template: `
    <button type="button" class="card task" [class.compact]="compact()" [class.focus]="focused()"
            (click)="open.emit(task())" [attr.aria-label]="'Abrir ' + task().title">
      <span class="prio" [style.background]="prio().color" [title]="'Prioridade ' + prio().label"></span>
      <span class="top">
        <span class="code">{{ task().code }}</span>
        @if (task().priority === 'urgente' || task().priority === 'alta') {
          <span class="badge" [style.color]="prio().color">{{ prio().label }}</span>
        }
        <span class="grow"></span>
        <span class="due" [attr.data-tone]="due().tone">{{ due().label }}</span>
      </span>
      <span class="title">{{ task().title }}</span>
      @if (!compact()) {
        <span class="bottom">
          <span class="client truncate">{{ task().client || 'Sem cliente' }}</span>
          <span class="people">
            @for (m of people(); track m.id) {
              <app-avatar [avatar]="m.avatar" [size]="22" [title]="m.name" />
            }
          </span>
        </span>
      }
      @if (task().reviewNote && task().stage === 'andamento') {
        <span class="returned">Devolvida: {{ task().reviewNote }}</span>
      }
    </button>
  `,
  styles: `
    :host { display: block; }
    .task {
      position: relative; width: 100%;
      display: grid; gap: 6px; padding: 10px 12px 10px 14px;
      text-align: left; cursor: grab; overflow: hidden;
      transition: border-color .15s;
      &:hover { border-color: var(--line-strong); }
      &.focus { border-color: var(--st-trabalhando); box-shadow: 0 0 0 1px var(--st-trabalhando) inset; }
      &.compact { padding: 8px 10px 8px 13px; gap: 3px; }
    }
    .prio { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
    .top { display: flex; align-items: center; gap: 6px; min-height: 20px; }
    .code { font-size: .74rem; font-weight: 600; color: var(--faint); letter-spacing: .02em; }
    .badge { height: 19px; padding: 0 6px; background: transparent; border: 1px solid currentColor; }
    .due { font-size: .76rem; font-weight: 600; color: var(--muted); white-space: nowrap; }
    .due[data-tone='late'] { color: var(--danger); }
    .due[data-tone='soon'] { color: var(--pr-alta); }
    .title { font-weight: 600; font-size: .9rem; line-height: 1.3; }
    .compact .title { font-size: .85rem; font-weight: 550; }
    .bottom { display: flex; align-items: center; gap: 8px; }
    .client { flex: 1; font-size: .8rem; color: var(--muted); }
    .people { display: flex; }
    .people app-avatar + app-avatar { margin-left: -6px; }
    .returned {
      font-size: .78rem; color: var(--danger); background: var(--danger-soft);
      padding: 4px 8px; border-radius: 6px;
    }
  `,
})
export class TaskCard {
  private store = inject(TeamStore);
  private clock = inject(Clock);
  task = input.required<Task>();
  compact = input(false);
  focused = input(false);
  open = output<Task>();

  prio = computed(() => PRIORITY_META[this.task().priority]);
  due = computed(() =>
    this.task().stage === 'concluida'
      ? { label: 'Concluída', tone: 'none' as const }
      : dueInfo(this.task().dueDate, this.clock.now()),
  );
  people = computed(() =>
    this.task().assignees.map((id) => this.store.memberMap().get(id)).filter((m) => !!m),
  );
}

import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MemberStatus, PRIORITY_META, STATUS_META, Task } from '../../core/models';
import { TeamStore } from '../../core/team-store';
import { Clock, dueInfo, hhmm, sinceLabel, todayAt } from '../../core/time';
import { Avatar } from '../../ui/avatar';
import { TaskDialog } from '../../ui/task-dialog.service';

type AwayStatus = 'pausa' | 'reuniao' | 'externo';

@Component({
  selector: 'app-member',
  imports: [Avatar, FormsModule, RouterLink],
  templateUrl: './member.html',
  styleUrl: './member.scss',
})
export class MemberPage {
  protected store = inject(TeamStore);
  private dialog = inject(TaskDialog);
  private clock = inject(Clock);
  private router = inject(Router);

  id = input.required<string>();

  protected readonly statusMeta = STATUS_META;
  protected readonly prioMeta = PRIORITY_META;
  protected readonly awayOptions: { key: AwayStatus; label: string; place: string; hint: string }[] = [
    { key: 'pausa', label: 'Pausa', place: 'Ex.: almoço, café', hint: 'Seu personagem vai para a sala de descanso do escritório.' },
    { key: 'reuniao', label: 'Reunião', place: 'Ex.: daily, alinhamento com o cliente', hint: 'Seu personagem vai para a sala de reunião do escritório.' },
    { key: 'externo', label: 'Reunião externa', place: 'Ex.: visita técnica no cliente', hint: 'Seu personagem sai do escritório e você aparece como fora até voltar.' },
  ];

  protected member = computed(() => this.store.memberMap().get(this.id()) ?? null);
  protected mine = computed(() => this.store.tasksOf(this.id(), ['andamento']));
  protected waiting = computed(() => this.store.tasksOf(this.id(), ['revisao']));
  protected focusTask = computed(() => this.store.taskMap().get(this.member()?.currentTaskId ?? '') ?? null);

  /** formulário de ausência aberto */
  protected away = signal<AwayStatus | null>(null);
  protected awayNote = '';
  protected awayUntil = '';
  /** id da tarefa com o campo de atualização aberto */
  protected writing = signal<string | null>(null);
  protected updateText = '';

  constructor() {
    effect(() => {
      // trocar de colaborador fecha formulários abertos
      this.id();
      this.away.set(null);
      this.writing.set(null);
    });
  }

  protected due(t: Task) {
    return dueInfo(t.dueDate, this.clock.now());
  }
  protected since(iso: string) {
    return sinceLabel(iso, this.clock.now());
  }
  protected hour(iso: string) {
    return hhmm(new Date(iso));
  }
  protected lastUpdate(t: Task) {
    return [...t.updates].reverse().find((u) => u.kind === 'nota') ?? null;
  }

  protected switchTo(id: string) {
    this.router.navigate(['/membro', id]);
  }

  protected openAway(key: AwayStatus) {
    const m = this.member();
    this.away.set(this.away() === key ? null : key);
    this.awayNote = m?.status === key ? m.statusNote : '';
    this.awayUntil = m?.status === key && m.statusUntil ? hhmm(new Date(m.statusUntil)) : '';
  }

  protected async confirmAway() {
    const key = this.away();
    if (!key) return;
    const ok = await this.store.setStatus(this.id(), key, { note: this.awayNote.trim(), until: todayAt(this.awayUntil) });
    if (ok) this.away.set(null);
  }

  protected async back() {
    // volta para a tarefa em foco, se houver
    const m = this.member();
    const focus = m?.currentTaskId && this.mine().some((t) => t.id === m.currentTaskId) ? m.currentTaskId : null;
    await this.setStatus(focus ? 'trabalhando' : 'livre', focus);
  }

  protected setStatus(status: MemberStatus, taskId: string | null = null) {
    this.away.set(null);
    return this.store.setStatus(this.id(), status, { currentTaskId: taskId });
  }

  protected startWriting(t: Task) {
    this.updateText = '';
    this.writing.set(this.writing() === t.id ? null : t.id);
  }

  protected async publish(t: Task) {
    const text = this.updateText.trim();
    if (!text) return;
    const ok = await this.store.addUpdate(t.id, text, this.id());
    if (ok) this.writing.set(null);
  }

  protected finish(t: Task) {
    this.store.finish(t.id, this.id());
  }

  protected details(t: Task) {
    this.dialog.open(t.id, this.id());
  }
}

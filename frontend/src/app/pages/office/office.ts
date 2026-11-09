import { AfterViewInit, Component, ElementRef, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Member, MemberStatus, STATUS_META } from '../../core/models';
import { TeamStore } from '../../core/team-store';
import { Clock, dueInfo, hhmm, sinceLabel } from '../../core/time';
import { Avatar } from '../../ui/avatar';
import { OfficeAgent, OfficeEngine } from './office-engine';
import { COLS, T } from './office-map';

/** mesmas cores dos tokens --st-* (o canvas não lê variáveis CSS) */
const STATUS_HEX: Record<MemberStatus, string> = {
  livre: '#8b93a1',
  trabalhando: '#16936a',
  pausa: '#c98303',
  reuniao: '#7448d0',
  externo: '#c23c6a',
};

@Component({
  selector: 'app-office',
  imports: [Avatar, RouterLink],
  templateUrl: './office.html',
  styleUrl: './office.scss',
})
export class Office implements AfterViewInit, OnDestroy {
  protected store = inject(TeamStore);
  private clock = inject(Clock);
  private router = inject(Router);
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private stageRef = viewChild.required<ElementRef<HTMLDivElement>>('stage');

  protected readonly statusMeta = STATUS_META;
  protected readonly legend: MemberStatus[] = ['trabalhando', 'livre', 'reuniao', 'pausa', 'externo'];
  private engine?: OfficeEngine;
  private follow = 0;

  /** zoom do mapa: 1 = pequeno ... 4 = grande. Cada passo aumenta 0,5. */
  protected readonly minZoom = 1;
  protected readonly maxZoom = 4;
  protected zoom = signal(this.initialZoom());
  protected zoomPct = computed(() => Math.round(this.zoom() * 50));

  protected failed = signal(false);
  protected hoverId = signal<string | null>(null);
  protected tip = signal<{ x: number; y: number; below: boolean } | null>(null);

  protected hovered = computed(() => this.store.memberMap().get(this.hoverId() ?? '') ?? null);
  protected away = computed(() => this.store.members().filter((m) => m.status === 'externo'));
  protected counts = computed(() => {
    const c: Record<MemberStatus, number> = { livre: 0, trabalhando: 0, pausa: 0, reuniao: 0, externo: 0 };
    for (const m of this.store.members()) c[m.status]++;
    return c;
  });

  private agents = computed<OfficeAgent[]>(() =>
    this.store.members().map((m, i) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar,
      status: m.status,
      desk: i,
      color: STATUS_HEX[m.status],
    })),
  );

  constructor() {
    effect(() => {
      const list = this.agents();
      if (this.engine?.ready) this.engine.setAgents(list);
    });
    effect(() => {
      const z = this.zoom();
      this.engine?.resize(COLS * T * z);
      try { localStorage.setItem('office-zoom', String(z)); } catch { /* sem armazenamento */ }
    });
  }

  private initialZoom() {
    try {
      const saved = Number(localStorage.getItem('office-zoom'));
      if (saved >= 1 && saved <= 4) return saved;
    } catch { /* sem armazenamento */ }
    // padrão: mapa menor que a tela inteira (celular um pouco menor ainda)
    return window.innerWidth < 760 ? 1.5 : 2;
  }

  protected zoomBy(step: number) {
    this.zoom.update((z) => Math.min(this.maxZoom, Math.max(this.minZoom, z + step)));
  }

  async ngAfterViewInit() {
    const canvas = this.canvasRef().nativeElement;
    const engine = new OfficeEngine(canvas);
    this.engine = engine;
    engine.resize(COLS * T * this.zoom());
    try {
      await Promise.all([engine.load(), document.fonts?.load('10px Silkscreen').catch(() => null)]);
    } catch {
      this.failed.set(true);
      return;
    }
    engine.setAgents(this.agents());
    engine.start();
    // mantém o tooltip acompanhando quem está andando
    const loop = () => {
      this.placeTip();
      this.follow = requestAnimationFrame(loop);
    };
    this.follow = requestAnimationFrame(loop);
  }

  ngOnDestroy() {
    this.engine?.stop();
    cancelAnimationFrame(this.follow);
  }

  protected jump(part: 0 | 1) {
    const stage = this.stageRef().nativeElement;
    stage.scrollTo({ left: part === 0 ? 0 : stage.scrollWidth, behavior: 'smooth' });
  }

  protected onMove(ev: PointerEvent) {
    if (!this.engine || ev.pointerType === 'touch') return;
    const id = this.engine.hitTest(ev.offsetX, ev.offsetY);
    this.setHover(id);
    this.canvasRef().nativeElement.style.cursor = id ? 'pointer' : 'default';
  }

  protected onLeave(ev: PointerEvent) {
    if (ev.pointerType !== 'touch') this.setHover(null);
  }

  protected onTap(ev: MouseEvent) {
    if (!this.engine) return;
    const id = this.engine.hitTest(ev.offsetX, ev.offsetY);
    // mouse: clique abre a tela; toque: primeiro toque mostra o cartão
    const isTouch = (ev as PointerEvent).pointerType === 'touch';
    if (id && !isTouch) this.router.navigate(['/membro', id]);
    else this.setHover(id);
  }

  private setHover(id: string | null) {
    if (this.hoverId() === id) return;
    this.hoverId.set(id);
    if (this.engine) this.engine.hovered = id;
    this.placeTip();
  }

  private placeTip() {
    const id = this.hoverId();
    const a = id && this.engine?.anchorOf(id);
    if (!a) {
      if (this.tip()) this.tip.set(null);
      return;
    }
    const below = a.y < 150;
    const cur = this.tip();
    const y = below ? a.y + 70 : a.y;
    if (!cur || Math.abs(cur.x - a.x) > 0.5 || Math.abs(cur.y - y) > 0.5 || cur.below !== below) {
      this.tip.set({ x: a.x, y, below });
    }
  }

  // ---------- dados do cartão ----------
  protected taskOf(m: Member) {
    return this.store.taskMap().get(m.currentTaskId ?? '') ?? null;
  }
  protected openCount(m: Member) {
    return this.store.tasksOf(m.id, ['andamento']).length;
  }
  protected due(iso: string | null) {
    return dueInfo(iso, this.clock.now());
  }
  protected since(iso: string) {
    return sinceLabel(iso, this.clock.now());
  }
  protected hour(iso: string) {
    return hhmm(new Date(iso));
  }
}
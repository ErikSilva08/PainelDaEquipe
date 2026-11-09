import {
  BREAK_SEATS, COLS, DESKS, DIV, DOOR, DOOR_EXIT, Dir, FURNITURE, MEETING_SEATS, ROWS, Seat, T,
  buildWalkable, findPath, roomAt,
} from './office-map';
import { MemberStatus } from '../../core/models';

/** Dados que o componente passa para o motor a cada mudança de estado. */
export interface OfficeAgent {
  id: string;
  name: string;
  avatar: number;
  status: MemberStatus;
  desk: number;
  /** cor do status (hex) */
  color: string;
}

type Mode = 'walk' | 'sit' | 'stand' | 'gone';

interface Char {
  agent: OfficeAgent;
  x: number; // centro, px do mundo
  y: number; // pés, px do mundo
  col: number;
  row: number;
  dir: Dir;
  mode: Mode;
  path: { col: number; row: number }[];
  goal: Seat | null;
  goalKey: string;
  anim: number;
  idleUntil: number;
}

const WALK_SPEED = 46; // px/s
const FURNITURE_FILES = [
  'BIN', 'BOOKSHELF', 'CACTUS', 'CLOCK', 'COFFEE', 'COFFEE_TABLE', 'CUSHIONED_BENCH',
  'CUSHIONED_CHAIR_BACK', 'CUSHIONED_CHAIR_FRONT', 'CUSHIONED_CHAIR_SIDE', 'DESK_FRONT',
  'DOUBLE_BOOKSHELF', 'HANGING_PLANT', 'LARGE_PAINTING', 'LARGE_PLANT', 'PC_FRONT_OFF',
  'PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3', 'PLANT', 'PLANT_2', 'POT', 'SMALL_PAINTING',
  'SMALL_PAINTING_2', 'SMALL_TABLE_FRONT', 'SOFA_BACK', 'SOFA_FRONT', 'SOFA_SIDE', 'TABLE_FRONT',
  'WHITEBOARD',
];

const COLORS = {
  void: '#1b2130',
  wallTop: '#262e40',
  wallFace: '#3d4a66',
  wallFaceDark: '#33405a',
  wallEdge: '#151a26',
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    img.src = src;
  });
}

/** Colorize estilo Photoshop: tile em escala de cinza -> matiz/saturação. */
function colorizeTile(img: HTMLImageElement, hue: number, sat: number, lift = 0) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.min(1, Math.max(0, d[i] / 255 + lift));
    const [r, g, b] = hslToRgb(hue / 360, sat, l);
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

export class OfficeEngine {
  private ctx: CanvasRenderingContext2D;
  private chars = new Map<string, Char>();
  private grid = buildWalkable();
  private wanderTiles: { col: number; row: number }[] = [];
  private img = new Map<string, HTMLImageElement>();
  private chars_img: HTMLImageElement[] = [];
  private floors = new Map<string, HTMLCanvasElement>();
  private raf = 0;
  private last = 0;
  private clock = 0;
  private scale = 2;
  private dpr = 1;
  private reducedMotion = false;
  hovered: string | null = null;
  ready = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    const seatKeys = new Set(
      [...DESKS.map((d) => d.seat), ...MEETING_SEATS, ...BREAK_SEATS].map((s) => `${s.col},${s.row}`),
    );
    for (let r = 2; r < ROWS - 1; r++)
      for (let c = 1; c < DIV; c++)
        if (this.grid[r][c] && !seatKeys.has(`${c},${r}`) && roomAt(c, r) === 'work') this.wanderTiles.push({ col: c, row: r });
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  async load(base = 'pixel') {
    const [chars, furniture, floors] = await Promise.all([
      Promise.all([0, 1, 2, 3, 4, 5].map((i) => loadImage(`${base}/characters/char_${i}.png`))),
      Promise.all(FURNITURE_FILES.map((f) => loadImage(`${base}/furniture/${f}.png`).then((im) => [f, im] as const))),
      Promise.all([6, 3, 7].map((i) => loadImage(`${base}/floors/floor_${i}.png`))),
    ]);
    this.chars_img = chars;
    for (const [k, im] of furniture) this.img.set(k, im);
    this.floors.set('work', colorizeTile(floors[0], 28, 0.42, -0.12));
    this.floors.set('meeting', colorizeTile(floors[1], 214, 0.32, -0.02));
    this.floors.set('break', colorizeTile(floors[2], 160, 0.18, 0.08));
    this.ready = true;
  }

  // ---------- estado vindo do app ----------
  setAgents(agents: OfficeAgent[]) {
    const seen = new Set<string>();
    const meetingOrder = agents.filter((a) => a.status === 'reuniao');
    const breakOrder = agents.filter((a) => a.status === 'pausa');

    for (const a of agents) {
      seen.add(a.id);
      let ch = this.chars.get(a.id);
      const goal = this.goalFor(a, meetingOrder.indexOf(a), breakOrder.indexOf(a));
      if (!ch) {
        // primeira aparição: já nasce no lugar certo
        const spot = goal.seat ?? this.randomWander();
        ch = {
          agent: a, col: spot.col, row: spot.row, x: spot.col * T + T / 2, y: (spot.row + 1) * T - 1,
          dir: goal.seat?.face ?? 'down', mode: 'stand', path: [], goal: goal.seat, goalKey: goal.key,
          anim: Math.random() * 10, idleUntil: 0,
        };
        if (a.status === 'externo') ch.mode = 'gone';
        else if (goal.seat?.sit) ch.mode = 'sit';
        this.chars.set(a.id, ch);
        continue;
      }
      const prevStatus = ch.agent.status;
      ch.agent = a;
      if (goal.key === ch.goalKey) continue;
      ch.goalKey = goal.key;
      ch.goal = goal.seat;
      if (prevStatus === 'externo' && ch.mode === 'gone') {
        // volta pela porta
        ch.col = DOOR.col; ch.row = DOOR.row;
        ch.x = DOOR.col * T + T / 2; ch.y = (DOOR.row + 1) * T - 1;
        ch.mode = 'stand';
      }
      if (a.status === 'externo') this.walkTo(ch, DOOR);
      else if (goal.seat) this.walkTo(ch, goal.seat);
      else { ch.idleUntil = 0; ch.path = []; if (ch.mode === 'sit') ch.mode = 'stand'; }
    }
    for (const id of [...this.chars.keys()]) if (!seen.has(id)) this.chars.delete(id);
  }

  private goalFor(a: OfficeAgent, meetIdx: number, breakIdx: number): { seat: Seat | null; key: string } {
    switch (a.status) {
      case 'trabalhando': {
        const desk = DESKS[a.desk % DESKS.length];
        return { seat: desk.seat, key: `desk${a.desk}` };
      }
      case 'reuniao':
        return { seat: MEETING_SEATS[meetIdx % MEETING_SEATS.length], key: `meet${meetIdx}` };
      case 'pausa':
        return { seat: BREAK_SEATS[breakIdx % BREAK_SEATS.length], key: `break${breakIdx}` };
      case 'externo':
        return { seat: null, key: 'out' };
      default:
        return { seat: null, key: 'free' };
    }
  }

  private randomWander() {
    return this.wanderTiles[Math.floor(Math.random() * this.wanderTiles.length)];
  }

  private walkTo(ch: Char, target: { col: number; row: number }) {
    ch.path = findPath(this.grid, { col: ch.col, row: ch.row }, target);
    if (!ch.path.length && (ch.col !== target.col || ch.row !== target.row)) {
      // sem caminho (não deveria acontecer): teletransporta
      ch.col = target.col; ch.row = target.row;
      ch.x = target.col * T + T / 2; ch.y = (target.row + 1) * T - 1;
    }
    ch.mode = 'walk';
  }

  // ---------- loop ----------
  start() {
    const tick = (ts: number) => {
      const dt = this.last ? Math.min(0.05, (ts - this.last) / 1000) : 0;
      this.last = ts;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  private update(dt: number) {
    this.clock += dt;
    for (const ch of this.chars.values()) {
      ch.anim += dt;
      if (ch.mode === 'gone') continue;

      if (ch.mode === 'walk') {
        const next = ch.path[0];
        if (!next) {
          this.arrive(ch);
          continue;
        }
        const tx = next.col * T + T / 2;
        const ty = (next.row + 1) * T - 1;
        const dx = tx - ch.x, dy = ty - ch.y;
        const dist = Math.hypot(dx, dy);
        const step = WALK_SPEED * dt * (this.reducedMotion ? 3 : 1);
        if (Math.abs(dx) > Math.abs(dy)) ch.dir = dx > 0 ? 'right' : 'left';
        else if (dy !== 0) ch.dir = dy > 0 ? 'down' : 'up';
        if (dist <= step) {
          ch.x = tx; ch.y = ty; ch.col = next.col; ch.row = next.row;
          ch.path.shift();
        } else {
          ch.x += (dx / dist) * step;
          ch.y += (dy / dist) * step;
        }
        continue;
      }

      // disponível: passeia pela área de trabalho
      if (ch.agent.status === 'livre' && this.clock > ch.idleUntil) {
        if (ch.idleUntil === 0) {
          ch.idleUntil = this.clock + 1 + Math.random() * 4;
          continue;
        }
        this.walkTo(ch, this.randomWander());
      }
    }
  }

  private arrive(ch: Char) {
    if (ch.agent.status === 'externo') {
      ch.mode = 'gone';
      return;
    }
    if (ch.goal && ch.col === ch.goal.col && ch.row === ch.goal.row) {
      ch.dir = ch.goal.face;
      ch.mode = ch.goal.sit ? 'sit' : 'stand';
      return;
    }
    ch.mode = 'stand';
    ch.dir = 'down';
    ch.idleUntil = this.clock + 3 + Math.random() * 6;
  }

  // ---------- desenho ----------
  resize(cssWidth: number) {
    this.dpr = window.devicePixelRatio || 1;
    this.scale = cssWidth / (COLS * T);
    const cssHeight = ROWS * T * this.scale;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);
  }

  private draw() {
    if (!this.ready) return;
    const ctx = this.ctx;
    const s = this.scale * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);

    this.drawFloorsAndWalls(ctx);
    this.drawRoomLabels(ctx);

    // decoração plana (paredes) primeiro
    for (const f of FURNITURE) if (f.flat) this.drawFurniture(ctx, f);

    // entidades ordenadas por profundidade
    const items: { z: number; draw: () => void }[] = [];
    for (const f of FURNITURE) if (!f.flat) items.push({ z: f.z, draw: () => this.drawFurniture(ctx, f) });
    for (const ch of this.chars.values()) {
      if (ch.mode === 'gone') continue;
      items.push({ z: ch.y + (ch.mode === 'sit' ? 0.5 : 0), draw: () => this.drawChar(ctx, ch) });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.draw();

    // etiquetas em resolução de tela
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const ch of this.chars.values()) if (ch.mode !== 'gone') this.drawTag(ctx, ch);
  }

  private drawFloorsAndWalls(ctx: CanvasRenderingContext2D) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const room = roomAt(c, r);
        const x = c * T, y = r * T;
        if (room === 'work' || room === 'meeting' || room === 'break') {
          // porta inferior e passagens usam o piso da área de trabalho
          ctx.drawImage(this.floors.get(room)!, x, y);
        } else if (room === 'wall') {
          // face da parede (2 tiles de altura) nas paredes horizontais
          const faceBelow = roomAt(c, r + 1) !== 'wall' && roomAt(c, r + 1) !== 'void' && r < ROWS - 1;
          const isHorizontalFace = (r === 1 || r === 11) && c !== 0 && c !== COLS - 1 && c !== DIV;
          if (isHorizontalFace || (faceBelow && r !== 19 && c !== DIV && c !== 0 && c !== COLS - 1)) {
            ctx.fillStyle = COLORS.wallFace;
            ctx.fillRect(x, y, T, T);
            ctx.fillStyle = COLORS.wallFaceDark;
            ctx.fillRect(x, y + T - 3, T, 3);
          } else {
            ctx.fillStyle = COLORS.wallTop;
            ctx.fillRect(x, y, T, T);
          }
        }
      }
    }
    // rodapé escuro sob as faces das paredes e contornos
    ctx.fillStyle = COLORS.wallEdge;
    ctx.fillRect(T, 2 * T - 1, (DIV - 1) * T, 1);
    ctx.fillRect((DIV + 1) * T, 2 * T - 1, 10 * T, 1);
    ctx.fillRect((DIV + 1) * T, 12 * T - 1, 10 * T, 1);
    // sombra da parede sobre o piso
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(T, 2 * T, (DIV - 1) * T, 3);
    ctx.fillRect((DIV + 1) * T, 2 * T, 10 * T, 3);
    ctx.fillRect((DIV + 1) * T, 12 * T, 10 * T, 3);
    // tapete da porta
    ctx.fillStyle = '#7a3b35';
    ctx.fillRect(DOOR.col * T + 2, DOOR.row * T + 2, 2 * T - 4, T - 4);
    ctx.fillStyle = '#93504a';
    ctx.fillRect(DOOR.col * T + 4, DOOR.row * T + 4, 2 * T - 8, T - 8);
  }

  private drawRoomLabels(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = '6px Silkscreen, monospace';
    ctx.textAlign = 'center';
    const tag = (text: string, x: number, y: number) => {
      const w = ctx.measureText(text).width + 6;
      ctx.fillStyle = 'rgba(23,32,46,0.55)';
      ctx.fillRect(Math.round(x - w / 2), y - 6, Math.round(w), 9);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y - 1);
    };
    tag('SALA DE REUNIÃO', (DIV + 5.5) * T, 9 * T + 9);
    tag('DESCANSO', (DIV + 5.5) * T, 18 * T + 9);
    tag('SAÍDA', (DOOR.col + 1) * T, DOOR_EXIT.row * T + 10);
    ctx.restore();
  }

  private drawFurniture(ctx: CanvasRenderingContext2D, f: (typeof FURNITURE)[number]) {
    let key = f.sprite;
    if (key === 'PC') {
      const owner = [...this.chars.values()].find(
        (c) => c.agent.desk === f.pcOf && c.agent.status === 'trabalhando' && c.mode === 'sit',
      );
      key = owner ? `PC_FRONT_ON_${1 + (Math.floor(this.clock * 4) % 3)}` : 'PC_FRONT_OFF';
    }
    const im = this.img.get(key);
    if (!im) return;
    if (f.mirror) {
      ctx.save();
      ctx.translate(f.x + im.width, f.y);
      ctx.scale(-1, 1);
      ctx.drawImage(im, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(im, f.x, f.y);
    }
  }

  private frameFor(ch: Char): { row: number; frame: number; flip: boolean } {
    const flip = ch.dir === 'left';
    const row = ch.dir === 'down' ? 0 : ch.dir === 'up' ? 1 : 2;
    const t = this.reducedMotion ? 0 : ch.anim;
    if (ch.mode === 'walk') return { row, frame: [0, 1, 2, 1][Math.floor(t * 8) % 4], flip };
    if (ch.mode === 'sit') {
      if (ch.agent.status === 'trabalhando') return { row, frame: 3 + (Math.floor(t * 6) % 2), flip };
      if (ch.agent.status === 'reuniao') return { row, frame: 5 + (Math.floor(t * 1.2) % 2), flip };
      return { row, frame: 1, flip };
    }
    return { row, frame: 1, flip };
  }

  private drawChar(ctx: CanvasRenderingContext2D, ch: Char) {
    const sheet = this.chars_img[ch.agent.avatar % 6];
    const { row, frame, flip } = this.frameFor(ch);
    const sitting = ch.mode === 'sit';
    const top = Math.round(ch.y - 31 + (sitting ? -3 : 0));
    const left = Math.round(ch.x - 8);

    // sombra / destaque
    ctx.fillStyle = this.hovered === ch.agent.id ? ch.agent.color : 'rgba(0,0,0,0.22)';
    ctx.globalAlpha = this.hovered === ch.agent.id ? 0.55 : 1;
    ctx.beginPath();
    ctx.ellipse(ch.x, ch.y - 1, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (flip) {
      ctx.save();
      ctx.translate(left + 16, top);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frame * 16, row * 32, 16, 32, 0, 0, 16, 32);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, frame * 16, row * 32, 16, 32, left, top, 16, 32);
    }
  }

  private drawTag(ctx: CanvasRenderingContext2D, ch: Char) {
    const s = this.scale;
    const sitting = ch.mode === 'sit';
    const cx = ch.x * s;
    const headY = (ch.y - 31 + (sitting ? -3 : 0)) * s;
    const first = ch.agent.name.split(' ')[0];
    const fs = Math.max(9, Math.round(4.6 * s));
    ctx.font = `${fs}px Silkscreen, monospace`;
    const w = ctx.measureText(first).width + fs * 1.6;
    const h = fs + 6;
    const x = Math.round(cx - w / 2);
    const y = Math.round(headY - h + 3 * s);
    const hovered = this.hovered === ch.agent.id;

    ctx.globalAlpha = hovered ? 1 : 0.92;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = ch.agent.color;
    ctx.fillRect(x, y, Math.max(3, fs * 0.45), h);
    ctx.fillStyle = '#17202e';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(first, x + fs * 0.9, y + h / 2 + 1);
    ctx.globalAlpha = 1;
  }

  // ---------- interação ----------
  /** coordenadas em px CSS relativas ao canvas */
  hitTest(x: number, y: number): string | null {
    const s = this.scale;
    let best: { id: string; z: number } | null = null;
    for (const ch of this.chars.values()) {
      if (ch.mode === 'gone') continue;
      const top = (ch.y - 36) * s;
      const left = (ch.x - 8) * s;
      if (x >= left && x <= left + 16 * s && y >= top && y <= ch.y * s + 2) {
        if (!best || ch.y > best.z) best = { id: ch.agent.id, z: ch.y };
      }
    }
    return best?.id ?? null;
  }

  /** posição (px CSS) acima da cabeça do personagem, para o tooltip */
  anchorOf(id: string): { x: number; y: number } | null {
    const ch = this.chars.get(id);
    if (!ch || ch.mode === 'gone') return null;
    return { x: ch.x * this.scale, y: (ch.y - 34) * this.scale };
  }
}
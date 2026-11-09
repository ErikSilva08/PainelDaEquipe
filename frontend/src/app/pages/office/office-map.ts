/**
 * Planta do escritório pixel (em tiles de 16px).
 * Sprites: pixel-agents (MIT) — github.com/pixel-agents-hq/pixel-agents
 *
 *  col: 0 ........ DIV ............ COLS-1
 *  row 0-1  parede superior (face)
 *       2-18 ÁREA DE TRABALHO (mesas) | 2-9   SALA DE REUNIÃO
 *                                     | 10-11 parede
 *                                     | 12-18 SALA DE DESCANSO
 *  row 19   parede inferior com porta (saída para reunião externa)
 *
 * Para mudar o tamanho da sala de trabalho, altere só DIV (e as posições das
 * mesas em DESK_COLS / DESK_ROWS). As salas laterais acompanham sozinhas.
 */

export const T = 16;
/** Coluna da parede que separa a sala de trabalho das salas laterais. */
export const DIV = 11;
/** Deslocamento das salas laterais (desenhadas originalmente para DIV = 20). */
const DX = DIV - 20;
export const COLS = DIV + 12;
export const ROWS = 20;

export type Dir = 'down' | 'up' | 'right' | 'left';
export type RoomId = 'work' | 'meeting' | 'break' | 'wall' | 'void';

export interface Seat {
  col: number;
  row: number;
  face: Dir;
  /** sentado (true) ou em pé (false) */
  sit: boolean;
}

export interface Furniture {
  sprite: string;
  /** canto superior esquerdo em pixels do mundo */
  x: number;
  y: number;
  /** y usado para ordenar profundidade (base visual) */
  z: number;
  mirror?: boolean;
  /** tiles bloqueados para caminhar */
  block?: { col: number; row: number; w: number; h: number };
  /** desenhado antes dos personagens (decoração de parede/piso) */
  flat?: boolean;
  /** PC ligado/desligado por mesa */
  pcOf?: number;
}

export interface DeskSlot {
  seat: Seat;
}

export const DOOR = { col: 5, row: 19 };
export const DOOR_EXIT = { col: 5, row: 18 };

// ---------- salas ----------
export function roomAt(col: number, row: number): RoomId {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 'void';
  if (row <= 1) return 'wall';
  if (row === 19) return col === DOOR.col || col === DOOR.col + 1 ? 'work' : 'wall';
  if (col === 0 || col === COLS - 1) return 'wall';
  if (col === DIV) return row === 5 || row === 6 || row === 15 || row === 16 ? 'work' : 'wall';
  if (col < DIV) return 'work';
  if (row === 10 || row === 11) return 'wall';
  return row < 10 ? 'meeting' : 'break';
}

// ---------- mesas de trabalho: colunas x linhas = quantidade de lugares ----------
const DESK_COLS = [3, 7];
const DESK_ROWS = [6, 11];

export const DESKS: DeskSlot[] = [];
const deskFurniture: Furniture[] = [];
DESK_ROWS.forEach((r) => {
  DESK_COLS.forEach((c) => {
    const i = DESKS.length;
    DESKS.push({ seat: { col: c + 1, row: r + 2, face: 'up', sit: true } });
    deskFurniture.push(
      { sprite: 'DESK_FRONT', x: c * T, y: r * T, z: (r + 2) * T - 2, block: { col: c, row: r, w: 3, h: 2 } },
      { sprite: 'PC', x: (c + 1) * T, y: r * T - 14, z: (r + 2) * T - 1, pcOf: i },
      { sprite: 'CUSHIONED_BENCH', x: (c + 1) * T, y: (r + 2) * T + 3, z: (r + 2) * T + 2 },
    );
  });
});

// ---------- sala de reunião ----------
const MEETING_SEATS_RAW: Seat[] = [
  { col: 24, row: 3, face: 'down', sit: true },
  { col: 26, row: 3, face: 'down', sit: true },
  { col: 23, row: 5, face: 'right', sit: true },
  { col: 27, row: 5, face: 'left', sit: true },
  { col: 23, row: 6, face: 'right', sit: true },
  { col: 27, row: 6, face: 'left', sit: true },
  { col: 24, row: 8, face: 'up', sit: true },
  { col: 26, row: 8, face: 'up', sit: true },
  { col: 25, row: 3, face: 'down', sit: true },
  { col: 25, row: 8, face: 'up', sit: true },
  { col: 22, row: 8, face: 'up', sit: false },
  { col: 28, row: 8, face: 'up', sit: false },
];

// ---------- sala de descanso ----------
const BREAK_SEATS_RAW: Seat[] = [
  { col: 24, row: 13, face: 'down', sit: true },
  { col: 25, row: 13, face: 'down', sit: true },
  { col: 23, row: 14, face: 'right', sit: true },
  { col: 26, row: 14, face: 'left', sit: true },
  { col: 23, row: 15, face: 'right', sit: true },
  { col: 26, row: 15, face: 'left', sit: true },
  { col: 24, row: 17, face: 'up', sit: true },
  { col: 25, row: 17, face: 'up', sit: true },
  { col: 29, row: 14, face: 'up', sit: false },
  { col: 28, row: 16, face: 'up', sit: false },
  { col: 22, row: 17, face: 'right', sit: false },
  { col: 29, row: 17, face: 'left', sit: false },
];

const shiftSeat = (s: Seat): Seat => ({ ...s, col: s.col + DX });
export const MEETING_SEATS = MEETING_SEATS_RAW.map(shiftSeat);
export const BREAK_SEATS = BREAK_SEATS_RAW.map(shiftSeat);

const px = (c: number) => c * T;

const RAW_FURNITURE: Furniture[] = [
  ...deskFurniture,

  // decoração da parede da área de trabalho
  { sprite: 'DOUBLE_BOOKSHELF', x: px(1), y: 0, z: 0, flat: true },
  { sprite: 'CLOCK', x: px(3) + 8, y: 2, z: 0, flat: true },
  { sprite: 'BOOKSHELF', x: px(5), y: 12, z: 0, flat: true },
  { sprite: 'LARGE_PAINTING', x: px(7), y: 0, z: 0, flat: true },
  { sprite: 'LARGE_PLANT', x: px(9), y: px(1), z: px(4), block: { col: 9, row: 2, w: 2, h: 2 } },
  { sprite: 'PLANT', x: px(1), y: px(17), z: px(19), block: { col: 1, row: 18, w: 1, h: 1 } },
  { sprite: 'CACTUS', x: px(3), y: px(17), z: px(19), block: { col: 3, row: 18, w: 1, h: 1 } },
  { sprite: 'PLANT_2', x: px(8), y: px(17), z: px(19), block: { col: 8, row: 18, w: 1, h: 1 } },
  { sprite: 'BIN', x: px(10), y: px(18), z: px(19), block: { col: 10, row: 18, w: 1, h: 1 } },

  // sala de reunião
  { sprite: 'WHITEBOARD', x: px(24) + 8, y: 6, z: 0, flat: true },
  { sprite: 'SMALL_PAINTING', x: px(22), y: 2, z: 0, flat: true },
  { sprite: 'SMALL_PAINTING_2', x: px(28), y: 2, z: 0, flat: true },
  { sprite: 'TABLE_FRONT', x: px(24), y: px(4), z: px(8) - 1, block: { col: 24, row: 4, w: 3, h: 4 } },
  { sprite: 'CUSHIONED_CHAIR_FRONT', x: px(24), y: px(3) + 2, z: px(4) - 3 },
  { sprite: 'CUSHIONED_CHAIR_FRONT', x: px(25), y: px(3) + 2, z: px(4) - 3 },
  { sprite: 'CUSHIONED_CHAIR_FRONT', x: px(26), y: px(3) + 2, z: px(4) - 3 },
  { sprite: 'CUSHIONED_CHAIR_SIDE', x: px(23), y: px(5), z: px(6) - 3 },
  { sprite: 'CUSHIONED_CHAIR_SIDE', x: px(23), y: px(6), z: px(7) - 3 },
  { sprite: 'CUSHIONED_CHAIR_SIDE', x: px(27), y: px(5), z: px(6) - 3, mirror: true },
  { sprite: 'CUSHIONED_CHAIR_SIDE', x: px(27), y: px(6), z: px(7) - 3, mirror: true },
  { sprite: 'CUSHIONED_CHAIR_BACK', x: px(24), y: px(8) + 3, z: px(9) + 2 },
  { sprite: 'CUSHIONED_CHAIR_BACK', x: px(25), y: px(8) + 3, z: px(9) + 2 },
  { sprite: 'CUSHIONED_CHAIR_BACK', x: px(26), y: px(8) + 3, z: px(9) + 2 },
  { sprite: 'PLANT', x: px(21), y: px(1), z: px(3), block: { col: 21, row: 2, w: 1, h: 1 } },
  { sprite: 'PLANT_2', x: px(30), y: px(1), z: px(3), block: { col: 30, row: 2, w: 1, h: 1 } },

  // sala de descanso
  { sprite: 'LARGE_PAINTING', x: px(23) + 8, y: px(10), z: 0, flat: true },
  { sprite: 'HANGING_PLANT', x: px(21), y: px(10) + 4, z: 0, flat: true },
  { sprite: 'HANGING_PLANT', x: px(29), y: px(10) + 4, z: 0, flat: true },
  { sprite: 'SOFA_FRONT', x: px(24), y: px(13), z: px(14) - 4 },
  { sprite: 'SOFA_SIDE', x: px(23), y: px(14), z: px(16) - 4 },
  { sprite: 'SOFA_SIDE', x: px(26), y: px(14), z: px(16) - 4, mirror: true },
  { sprite: 'COFFEE_TABLE', x: px(24), y: px(14), z: px(16) - 6, block: { col: 24, row: 14, w: 2, h: 2 } },
  { sprite: 'COFFEE', x: px(24) + 9, y: px(14) + 6, z: px(16) - 5 },
  { sprite: 'SOFA_BACK', x: px(24), y: px(17) - 2, z: px(18) + 1 },
  { sprite: 'SMALL_TABLE_FRONT', x: px(28), y: px(12), z: px(14) - 1, block: { col: 28, row: 12, w: 2, h: 2 } },
  { sprite: 'COFFEE', x: px(28) + 4, y: px(12) + 4, z: px(14) },
  { sprite: 'COFFEE', x: px(29) + 2, y: px(12) + 6, z: px(14) },
  { sprite: 'LARGE_PLANT', x: px(29), y: px(16) - 4, z: px(19), block: { col: 29, row: 18, w: 2, h: 1 } },
  { sprite: 'POT', x: px(21), y: px(18), z: px(19), block: { col: 21, row: 18, w: 1, h: 1 } },
];

/** Móveis das salas laterais (x >= coluna 21 no desenho original) acompanham o DIV. */
export const FURNITURE: Furniture[] = RAW_FURNITURE.map((f) =>
  f.x >= 21 * T
    ? { ...f, x: f.x + DX * T, block: f.block && { ...f.block, col: f.block.col + DX } }
    : f,
);

// ---------- grade de caminhada ----------
export function buildWalkable(): boolean[][] {
  const grid: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    grid.push([]);
    for (let c = 0; c < COLS; c++) {
      const room = roomAt(c, r);
      grid[r].push(room === 'work' || room === 'meeting' || room === 'break');
    }
  }
  for (const f of FURNITURE) {
    if (!f.block) continue;
    for (let r = f.block.row; r < f.block.row + f.block.h; r++)
      for (let c = f.block.col; c < f.block.col + f.block.w; c++) if (grid[r]?.[c] !== undefined) grid[r][c] = false;
  }
  return grid;
}

/** BFS em 4 direções. Retorna a lista de tiles (sem o inicial) ou [] se não houver caminho. */
export function findPath(grid: boolean[][], from: { col: number; row: number }, to: { col: number; row: number }) {
  if (from.col === to.col && from.row === to.row) return [];
  const key = (c: number, r: number) => r * COLS + c;
  const prev = new Map<number, number>();
  const queue: [number, number][] = [[from.col, from.row]];
  prev.set(key(from.col, from.row), -1);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    if (c === to.col && r === to.row) break;
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      const k = key(nc, nr);
      if (prev.has(k)) continue;
      const isTarget = nc === to.col && nr === to.row;
      if (!isTarget && !grid[nr]?.[nc]) continue;
      prev.set(k, key(c, r));
      queue.push([nc, nr]);
    }
  }
  const end = key(to.col, to.row);
  if (!prev.has(end)) return [];
  const path: { col: number; row: number }[] = [];
  for (let k = end; k !== key(from.col, from.row); k = prev.get(k)!) {
    path.unshift({ col: k % COLS, row: Math.floor(k / COLS) });
  }
  return path;
}
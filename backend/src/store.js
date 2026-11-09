// Armazenamento simples em arquivo JSON.
// Leve e sem dependências: ideal para equipes pequenas. Para escalar,
// troque as funções load/save por um banco (SQLite, Postgres, Mongo...).
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createSeed } from './seed.js';

export class Store {
  constructor(file) {
    this.file = file;
    this.listeners = new Set();
    this.data = this.#load();
  }

  #load() {
    if (!existsSync(this.file)) {
      mkdirSync(dirname(this.file), { recursive: true });
      const seed = createSeed();
      writeFileSync(this.file, JSON.stringify(seed, null, 2));
      return seed;
    }
    return JSON.parse(readFileSync(this.file, 'utf8'));
  }

  #save() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.file);
    for (const fn of this.listeners) fn(this.data);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot() {
    return this.data;
  }

  /** Executa uma mutação e persiste. Lança HttpError para erros de validação. */
  mutate(fn) {
    const result = fn(this.data);
    this.#save();
    return result;
  }

  reset() {
    this.data = createSeed();
    this.#save();
  }

  static id(prefix) {
    return `${prefix}_${randomUUID().slice(0, 8)}`;
  }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

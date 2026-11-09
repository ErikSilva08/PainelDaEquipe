import { Component, computed, input } from '@angular/core';
import { MemberStatus, STATUS_META } from '../core/models';

/** Retrato do personagem pixel (quadro parado, de frente) recortado da sprite sheet. */
@Component({
  selector: 'app-avatar',
  template: `
    <span class="frame" [style.--s]="size() / 22" [style.width.px]="size()" [style.height.px]="size()">
      <span class="sprite" [style.background-image]="url()"></span>
      @if (status(); as st) {
        <span class="status" [style.background]="color()" [title]="label()"></span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; flex: none; }
    .frame {
      position: relative; display: block;
      border-radius: 30%;
      background: #e6ebf2;
      overflow: visible;
    }
    .sprite {
      position: absolute; inset: 0;
      border-radius: inherit; overflow: hidden;
      background-repeat: no-repeat;
      /* sheet 112x32*3; quadro 1 da linha "baixo", recorte do rosto/tronco */
      background-size: calc(112px * var(--s)) calc(96px * var(--s));
      background-position: calc(-13px * var(--s)) calc(-6px * var(--s));
      image-rendering: pixelated;
    }
    .status {
      position: absolute; right: -2px; bottom: -2px;
      width: 32%; height: 32%; min-width: 9px; min-height: 9px;
      border-radius: 50%; border: 2px solid var(--surface);
    }
  `,
})
export class Avatar {
  avatar = input.required<number>();
  size = input(32);
  status = input<MemberStatus | null>(null);
  url = computed(() => `url(pixel/characters/char_${this.avatar() % 6}.png)`);
  color = computed(() => (this.status() ? STATUS_META[this.status()!].color : ''));
  label = computed(() => (this.status() ? STATUS_META[this.status()!].label : ''));
}

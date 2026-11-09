import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Member, STATUS_META } from '../../core/models';
import { TeamStore } from '../../core/team-store';
import { Avatar } from '../../ui/avatar';

@Component({
  selector: 'app-team',
  imports: [FormsModule, RouterLink, Avatar],
  template: `
    <div class="wrap">
      <div>
        <h1>Equipe</h1>
        <p class="muted">Cada pessoa ganha uma tela própria e um personagem no escritório pixel.</p>
      </div>

      <form class="card add" (ngSubmit)="save()">
        <h2>{{ editing() ? 'Editar colaborador' : 'Adicionar colaborador' }}</h2>
        <div class="form-grid">
          <label class="field"><span class="label">Nome</span>
            <input class="input" name="name" [(ngModel)]="name" required maxlength="80" placeholder="Nome e sobrenome" />
          </label>
          <label class="field"><span class="label">Função</span>
            <input class="input" name="role" [(ngModel)]="role" maxlength="80" placeholder="Ex.: Suporte, Dev back-end" />
          </label>
          <div class="field full">
            <span class="label">Personagem</span>
            <div class="avatars" role="radiogroup" aria-label="Personagem">
              @for (a of avatars; track a) {
                <button type="button" role="radio" [attr.aria-checked]="avatar === a" [class.on]="avatar === a"
                        (click)="avatar = a" [attr.aria-label]="'Personagem ' + (a + 1)">
                  <app-avatar [avatar]="a" [size]="40" />
                </button>
              }
            </div>
          </div>
        </div>
        <div class="row end">
          @if (editing()) { <button type="button" class="btn outline" (click)="reset()">Cancelar</button> }
          <button class="btn" type="submit" [disabled]="!name.trim()">{{ editing() ? 'Salvar' : 'Adicionar' }}</button>
        </div>
      </form>

      <ul class="list">
        @for (m of store.members(); track m.id) {
          <li class="card item">
            <app-avatar [avatar]="m.avatar" [size]="40" [status]="m.status" />
            <div class="grow">
              <a [routerLink]="['/membro', m.id]" class="nm">{{ m.name }}</a>
              <p class="small muted">{{ m.role || 'Sem função' }} · {{ meta[m.status].label }} · {{ load(m) }} em andamento</p>
            </div>
            <a class="btn outline sm" [routerLink]="['/membro', m.id]">Abrir tela</a>
            <button class="btn ghost sm" (click)="edit(m)">Editar</button>
            <button class="btn ghost sm danger-txt" (click)="remove(m)">Remover</button>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host { display: block; padding: 18px 20px 40px; }
    .wrap { max-width: 860px; margin: 0 auto; display: grid; gap: 18px; }
    .add { padding: 18px; display: grid; gap: 14px; }
    .avatars { display: flex; gap: 8px; flex-wrap: wrap; }
    .avatars button {
      padding: 4px; border-radius: 12px; border: 2px solid transparent; background: none; cursor: pointer;
      &.on { border-color: var(--primary); background: var(--primary-soft); }
    }
    .end { justify-content: flex-end; }
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; flex-wrap: wrap; }
    .nm { font-weight: 650; text-decoration: none; &:hover { text-decoration: underline; } }
    .danger-txt { color: var(--danger); }
  `,
})
export class Team {
  protected store = inject(TeamStore);
  protected readonly meta = STATUS_META;
  protected readonly avatars = [0, 1, 2, 3, 4, 5];
  protected editing = signal<string | null>(null);
  protected name = '';
  protected role = '';
  protected avatar = 0;

  protected load(m: Member) {
    return this.store.tasksOf(m.id, ['andamento']).length;
  }

  protected edit(m: Member) {
    this.editing.set(m.id);
    this.name = m.name;
    this.role = m.role;
    this.avatar = m.avatar;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected reset() {
    this.editing.set(null);
    this.name = '';
    this.role = '';
    this.avatar = this.store.members().length % 6;
  }

  protected async save() {
    const data = { name: this.name, role: this.role, avatar: this.avatar };
    const id = this.editing();
    const ok = id ? await this.store.updateMember(id, data) : await this.store.createMember(data);
    if (ok) this.reset();
  }

  protected async remove(m: Member) {
    if (!confirm(`Remover ${m.name} da equipe? As tarefas dela voltam para a entrada se ficarem sem responsável.`)) return;
    await this.store.deleteMember(m.id);
  }
}

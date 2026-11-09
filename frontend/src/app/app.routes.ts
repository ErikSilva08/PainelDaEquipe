import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/board/board').then((m) => m.Board), title: 'Quadro · Painel da Equipe' },
  { path: 'escritorio', loadComponent: () => import('./pages/office/office').then((m) => m.Office), title: 'Escritório · Painel da Equipe' },
  { path: 'equipe', loadComponent: () => import('./pages/team/team').then((m) => m.Team), title: 'Equipe · Painel da Equipe' },
  { path: 'membro/:id', loadComponent: () => import('./pages/member/member').then((m) => m.MemberPage), title: 'Minhas atividades · Painel da Equipe' },
  { path: '**', redirectTo: '' },
];

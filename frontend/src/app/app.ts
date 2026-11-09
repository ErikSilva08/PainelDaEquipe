import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TeamStore } from './core/team-store';
import { TaskDialog } from './ui/task-dialog.service';
import { TaskDialogHost } from './ui/task-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TaskDialogHost],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected store = inject(TeamStore);
  protected dialog = inject(TaskDialog);
}

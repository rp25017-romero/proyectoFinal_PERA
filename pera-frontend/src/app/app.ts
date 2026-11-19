import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Api } from './services/expedientes';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html'
})
export class App {
  protected router = inject(Router);
  private api = inject(Api);
  protected error = signal('');

  protected async salir() {
    this.error.set('');
    try {
      await this.api.pedir('logout', {});
      await this.router.navigateByUrl('/login');
    } catch (e) { this.error.set((e as Error).message); }
  }
}

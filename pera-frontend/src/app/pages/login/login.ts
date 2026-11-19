import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api } from '../../services/expedientes';

@Component({ imports: [FormsModule], templateUrl: './login.html' })
export class Login {
  private api = inject(Api);
  private router = inject(Router);
  correo = '';
  clave = '';
  error = signal('');
  enviando = signal(false);

  async ingresar() {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.error.set('');
    try {
      await this.api.pedir('login', { correo: this.correo, clave: this.clave });
      this.clave = '';
      await this.router.navigateByUrl('/estudiantes');
    } catch (e) { this.error.set((e as Error).message); }
    finally { this.enviando.set(false); }
  }
}

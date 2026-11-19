import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Docente } from '../../services/expedientes';

@Component({ imports: [FormsModule, RouterLink], templateUrl: './docentes.html' })
export class Docentes implements OnInit {
  private api = inject(Api);
  lista = signal<Docente[]>([]);
  ocupado = signal(false);
  error = signal('');
  mensaje = signal('');
  id = signal<number | null>(null);
  datos = { codigo: '', nombre: '', correo: '', activo: true };

  async ngOnInit() {
    this.ocupado.set(true);
    try { this.lista.set(await this.api.pedir<Docente[]>('docentes')); }
    catch (e) { this.error.set((e as Error).message); }
    finally { this.ocupado.set(false); }
  }

  editar(d?: Docente) {
    this.id.set(d?.id_docente ?? null);
    this.datos = { codigo: d?.codigo ?? '', nombre: d?.nombre ?? '', correo: d?.correo ?? '', activo: d?.activo ?? true };
    this.error.set('');
    this.mensaje.set('');
  }

  async guardar() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      const id = this.id();
      await this.api.pedir(id ? 'docentes/' + id : 'docentes', this.datos);
      this.editar();
      this.mensaje.set(id ? 'Cambios guardados.' : 'Docente registrado.');
      this.lista.set(await this.api.pedir<Docente[]>('docentes'));
    } catch (e) { this.error.set((e as Error).message); }
    finally { this.ocupado.set(false); }
  }
}

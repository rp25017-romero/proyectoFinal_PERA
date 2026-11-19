import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, Docente, Expediente, TutorAsignado } from '../../services/expedientes';

interface FilaAsignacion { id_docente: number | null; area: string }

@Component({ imports: [FormsModule, RouterLink], templateUrl: './asignacion-tutores.html' })
export class AsignacionTutores implements OnInit {
  private api = inject(Api);
  readonly carnet = inject(ActivatedRoute).snapshot.paramMap.get('carnet') ?? '';
  private ruta = 'expedientes/' + encodeURIComponent(this.carnet);
  estudiante = signal<Expediente | null>(null);
  docentes = signal<Docente[]>([]);
  filas: FilaAsignacion[] = [{ id_docente: null, area: '' }];
  ocupado = signal(false);
  error = signal('');
  mensaje = signal('');

  async ngOnInit() {
    this.ocupado.set(true);
    try {
      this.estudiante.set(await this.api.pedir<Expediente>(this.ruta));
      this.docentes.set(await this.api.pedir<Docente[]>('docentes'));
    } catch (e) { this.error.set((e as Error).message); }
    finally { this.ocupado.set(false); }
  }

  async guardar() {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      await this.api.pedir(this.ruta + '/tutores', { asignaciones: this.filas });
      this.filas = [{ id_docente: null, area: '' }];
      this.mensaje.set('Asignaciones guardadas en el expediente.');
      this.estudiante.set(await this.api.pedir<Expediente>(this.ruta));
    } catch (e) { this.error.set((e as Error).message); }
    finally { this.ocupado.set(false); }
  }

  async retirar(t: TutorAsignado) {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      await this.api.pedir(this.ruta + '/tutores/' + t.id_asignacion + '/retirar', {});
      this.mensaje.set('Asignación retirada.');
      this.estudiante.set(await this.api.pedir<Expediente>(this.ruta));
    } catch (e) { this.error.set((e as Error).message); }
    finally { this.ocupado.set(false); }
  }
}

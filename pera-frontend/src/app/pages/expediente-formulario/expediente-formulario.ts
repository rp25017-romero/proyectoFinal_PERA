import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, Carrera } from '../../services/expedientes';

@Component({ imports: [FormsModule, RouterLink], templateUrl: './expediente-formulario.html' })
export class ExpedienteFormulario implements OnInit {
  private api = inject(Api);
  private router = inject(Router);
  carreras = signal<Carrera[]>([]);
  guardando = signal(false);
  error = signal('');
  datos = { carnet: '', nombre: '', id_carrera: null as number | null, cum: null as number | null };

  async ngOnInit() {
    try {
      this.carreras.set(await this.api.pedir<Carrera[]>('carreras'));
      if (!this.carreras().length) this.error.set('Cargue el catálogo de carreras antes de registrar estudiantes.');
    } catch (e) { this.error.set((e as Error).message); }
  }

  async guardar() {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');
    try {
      const creado = await this.api.pedir<{ carnet: string }>('expedientes', this.datos);
      await this.router.navigate(['/expedientes', creado.carnet]);
    } catch (e) { this.error.set((e as Error).message); }
    finally { this.guardando.set(false); }
  }
}

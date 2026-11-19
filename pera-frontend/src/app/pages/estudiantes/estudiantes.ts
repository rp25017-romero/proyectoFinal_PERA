import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, Carrera, Fila, Lista, RolPersonal, Sesion } from '../../services/expedientes';

@Component({ imports: [FormsModule, RouterLink], templateUrl: './estudiantes.html' })
export class Estudiantes implements OnInit {
  private api = inject(Api);
  carnet = '';
  carrera = '';
  private filtros = { carnet: '', carrera: '' };
  carreras = signal<Carrera[]>([]);
  rol = signal<RolPersonal | null>(null);
  readonly nombres = { administracion: 'Administración Académica', jefatura: 'Jefatura de Departamento', coordinacion: 'Coordinación PERA' };
  filas = signal<Fila[]>([]);
  pagina = signal(1);
  hayMas = signal(false);
  cargando = signal(true);
  error = signal('');

  async ngOnInit() {
    try {
      const { rol } = await this.api.pedir<Sesion>('sesion');
      if (rol === 'docente' || rol === 'estudiante') return;
      this.rol.set(rol);
      this.carreras.set(await this.api.pedir<Carrera[]>('carreras'));
      await this.buscar();
    } catch (e) { this.error.set((e as Error).message); this.cargando.set(false); }
  }

  buscar() {
    this.filtros = { carnet: this.carnet, carrera: this.carrera };
    return this.cargar(1);
  }

  async cargar(pagina: number) {
    this.cargando.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams({ ...this.filtros, pagina: String(pagina) });
      const datos = await this.api.pedir<Lista>('expedientes?' + params);
      this.filas.set(datos.registros);
      this.hayMas.set(datos.hayMas);
      this.pagina.set(pagina);
    } catch (e) { this.error.set((e as Error).message); }
    finally { this.cargando.set(false); }
  }
}

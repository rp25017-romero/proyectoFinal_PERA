import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, Sesion } from '../../services/expedientes';
import { Cita, fechaActual, OpcionAgenda } from '../../services/agenda';

@Component({ imports: [FormsModule, RouterLink], templateUrl: './sesion-formulario.html' })
export class SesionFormulario implements OnInit {
  private api = inject(Api);
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);
  readonly id = this.ruta.snapshot.paramMap.get('id');
  private version?: number;
  yo = 0;
  opciones = signal<OpcionAgenda[]>([]);
  listo = signal(false);
  enviando = signal(false);
  confirmar = signal(false);
  error = signal('');
  carnet = ''; fecha = this.ruta.snapshot.queryParamMap.get('fecha') || fechaActual();
  inicio = ''; fin = ''; modalidad = 'Presencial'; ubicacion = '';
  seleccion: number[] = [];

  get tutores() { return this.opciones().find(e=>e.carnet===this.carnet)?.tutores ?? []; }

  async ngOnInit() {
    try {
      const cuenta = await this.api.pedir<Sesion>('sesion');
      this.yo = cuenta.id_docente!;
      this.seleccion = [this.yo];
      this.opciones.set(await this.api.pedir<OpcionAgenda[]>('agenda/opciones'));
      if (this.id) {
        const c = await this.api.pedir<Cita>('agenda/'+this.id);
        if (c.cancelada || c.organizador !== this.yo) throw Error('Esta sesión no está disponible para edición.');
        this.carnet=c.carnet; this.fecha=c.fecha; this.inicio=c.hora_inicio; this.fin=c.hora_fin;
        this.modalidad=c.modalidad; this.ubicacion=c.ubicacion; this.version=c.version;
        this.seleccion=c.tutores.map(t=>t.id_docente).filter(id=>this.tutores.some(t=>t.id_docente===id));
      }
      this.listo.set(true);
    } catch(e) { this.error.set((e as Error).message); }
  }

  marcar(id: number, seleccionado: boolean) {
    this.seleccion = seleccionado ? [...this.seleccion,id] : this.seleccion.filter(t=>t!==id);
  }

  async guardar(cancelar=false) {
    if (this.enviando()) return;
    this.enviando.set(true); this.error.set('');
    try {
      const ruta = this.id ? 'agenda/'+this.id : 'agenda';
      await this.api.pedir(ruta+(cancelar?'/cancelar':''), cancelar ? {version:this.version} : {
        carnet:this.carnet,fecha:this.fecha,hora_inicio:this.inicio,hora_fin:this.fin,modalidad:this.modalidad,
        ubicacion:this.ubicacion,tutores:this.seleccion,version:this.version
      });
      await this.router.navigate(['/calendario'],{queryParams:{fecha:this.fecha}});
    } catch(e) { this.error.set((e as Error).message); }
    finally { this.enviando.set(false); }
  }
}

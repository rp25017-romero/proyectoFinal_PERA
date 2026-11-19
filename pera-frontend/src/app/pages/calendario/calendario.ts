import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, Sesion } from '../../services/expedientes';
import { Cita, fechaActual } from '../../services/agenda';

@Component({ imports: [RouterLink], templateUrl: './calendario.html', styleUrl: './calendario.scss' })
export class Calendario implements OnInit {
  private api = inject(Api);
  private ruta = inject(ActivatedRoute);
  private solicitud = 0;
  readonly hoy = fechaActual();
  readonly dias = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
  readonly mes = signal(this.hoy.slice(0,7));
  readonly dia = signal('');
  readonly citas = signal<Cita[]>([]);
  readonly cuenta = signal<Sesion | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly visibles = computed(() => this.citas().filter(c => !this.dia() || c.fecha === this.dia()));
  readonly titulo = computed(() => this.primero().toLocaleDateString('es-SV',{ month:'long', year:'numeric' }));
  readonly casillas = computed(() => {
    const primero = this.primero();
    const inicio = (primero.getDay()+6)%7;
    const fin = new Date(primero.getFullYear(), primero.getMonth()+1, 0).getDate();
    return Array.from({length:inicio+fin}, (_,i) => {
      const numero = i-inicio+1;
      const fecha = this.mes()+'-'+String(numero).padStart(2,'0');
      return numero < 1 ? null : { numero, fecha, cantidad: this.citas().filter(c=>c.fecha===fecha && !c.cancelada).length };
    });
  });

  private primero() { return new Date(this.mes()+'-01T12:00:00'); }

  async ngOnInit() {
    const fecha = this.ruta.snapshot.queryParamMap.get('fecha');
    if (fecha && /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(fecha)) {
      this.mes.set(fecha.slice(0,7)); this.dia.set(fecha);
    }
    try { this.cuenta.set(await this.api.pedir<Sesion>('sesion')); await this.cargar(); }
    catch(e) { this.error.set((e as Error).message); this.cargando.set(false); }
  }

  async cambiar(delta: number) {
    const fecha = this.primero();
    fecha.setMonth(fecha.getMonth()+delta);
    this.mes.set(fecha.getFullYear()+'-'+String(fecha.getMonth()+1).padStart(2,'0'));
    this.dia.set('');
    await this.cargar();
  }

  async cargar() {
    const numero = ++this.solicitud;
    this.error.set(''); this.cargando.set(true); this.citas.set([]);
    try {
      const citas = await this.api.pedir<Cita[]>('agenda?mes='+this.mes());
      if (numero === this.solicitud) this.citas.set(citas);
    } catch(e) { if (numero === this.solicitud) this.error.set((e as Error).message); }
    finally { if (numero === this.solicitud) this.cargando.set(false); }
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, Expediente } from '../../services/expedientes';

@Component({ imports: [RouterLink, DecimalPipe], templateUrl: './expediente-detalle.html' })
export class ExpedienteDetalle implements OnInit {
  private api = inject(Api);
  private ruta = inject(ActivatedRoute);
  estudiante = signal<Expediente | null>(null);
  error = signal('');

  async ngOnInit() {
    const carnet = this.ruta.snapshot.paramMap.get('carnet') ?? '';
    try { this.estudiante.set(await this.api.pedir<Expediente>('expedientes/' + encodeURIComponent(carnet))); }
    catch (e) { this.error.set((e as Error).message); }
  }
}

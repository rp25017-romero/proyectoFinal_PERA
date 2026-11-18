import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

export interface Carrera { id_carrera: number; nombre: string }
export interface Fila { carnet: string; nombre: string; carrera: string; estado_pera: string }
export interface Expediente extends Fila { departamento: string; cum: number; limite_uv: number | null }
export interface Lista { registros: Fila[]; hayMas: boolean }

@Injectable({ providedIn: 'root' })
export class Api {
  private router = inject(Router);

  async pedir<T>(ruta: string, datos?: object): Promise<T> {
    let respuesta: Response;
    try {
      respuesta = await fetch('/api/' + ruta, datos === undefined ? {} : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PERA': 'web' },
        body: JSON.stringify(datos)
      });
    } catch {
      throw Error('No se pudo conectar con el servidor.');
    }
    if (respuesta.status === 401 && ruta !== 'login') {
      await this.router.navigateByUrl('/login');
    }
    const contenido = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw Error(contenido.mensaje ?? 'El servidor no está disponible.');
    return contenido as T;
  }
}

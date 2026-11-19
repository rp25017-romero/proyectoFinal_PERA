import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { Cita } from './agenda';

export interface Carrera { id_carrera: number; nombre: string }
export interface Fila { carnet: string; nombre: string; carrera: string; estado_pera: string }
export type RolPersonal = 'administracion' | 'jefatura' | 'coordinacion';
export type Rol = RolPersonal | 'docente' | 'estudiante';
export interface Sesion { rol: Rol; id_docente?: number | null }
export interface Docente { id_docente: number; nombre: string; codigo: string; correo: string; departamento: string; activo: boolean }
export interface TutorAsignado { id_asignacion: number; id_docente: number; nombre: string; codigo: string; activo: boolean; area: string }
export interface Expediente extends Fila { departamento: string; cum: number; limite_uv: number | null; tutores: TutorAsignado[]; sesiones: Cita[] }
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

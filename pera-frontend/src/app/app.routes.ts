import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Api, Rol, Sesion } from './services/expedientes';
import { Calendario } from './pages/calendario/calendario';
import { SesionFormulario } from './pages/sesion-formulario/sesion-formulario';
import { Docentes } from './pages/docentes/docentes';
import { AsignacionTutores } from './pages/asignacion-tutores/asignacion-tutores';
import { Login } from './pages/login/login';
import { Estudiantes } from './pages/estudiantes/estudiantes';
import { ExpedienteFormulario } from './pages/expediente-formulario/expediente-formulario';
import { ExpedienteDetalle } from './pages/expediente-detalle/expediente-detalle';

function requiereRol(...roles: Rol[]): CanActivateFn {
  return async () => {
    const api = inject(Api);
    const router = inject(Router);
    try {
      const sesion = await api.pedir<Sesion>('sesion');
      return roles.includes(sesion.rol) || router.parseUrl(['docente','estudiante'].includes(sesion.rol) ? '/calendario' : '/estudiantes');
    } catch { return router.parseUrl('/login'); }
  };
}

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'calendario', component: Calendario, canActivate: [requiereRol('docente','estudiante')] },
  { path: 'sesiones/nueva', component: SesionFormulario, canActivate: [requiereRol('docente')] },
  { path: 'sesiones/:id/editar', component: SesionFormulario, canActivate: [requiereRol('docente')] },
  { path: 'estudiantes', component: Estudiantes, canActivate: [requiereRol('administracion','jefatura','coordinacion')] },
  { path: 'docentes', component: Docentes, canActivate: [requiereRol('jefatura')] },
  { path: 'expedientes/nuevo', component: ExpedienteFormulario, canActivate: [requiereRol('administracion')] },
  { path: 'expedientes/:carnet/asignacion-tutores', component: AsignacionTutores, canActivate: [requiereRol('coordinacion')] },
  { path: 'expedientes/:carnet', component: ExpedienteDetalle, canActivate: [requiereRol('administracion','jefatura','coordinacion')] },
  { path: '', pathMatch: 'full', redirectTo: 'estudiantes' },
  { path: '**', redirectTo: 'estudiantes' }
];

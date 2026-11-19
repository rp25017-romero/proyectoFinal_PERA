import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Api, RolPersonal, Sesion } from './services/expedientes';
import { Docentes } from './pages/docentes/docentes';
import { AsignacionTutores } from './pages/asignacion-tutores/asignacion-tutores';
import { Login } from './pages/login/login';
import { Estudiantes } from './pages/estudiantes/estudiantes';
import { ExpedienteFormulario } from './pages/expediente-formulario/expediente-formulario';
import { ExpedienteDetalle } from './pages/expediente-detalle/expediente-detalle';

function requiereRol(rol: RolPersonal): CanActivateFn {
  return async () => {
    const api = inject(Api);
    const router = inject(Router);
    try {
      const sesion = await api.pedir<Sesion>('sesion');
      return sesion.rol === rol || router.parseUrl('/estudiantes');
    } catch { return router.parseUrl('/login'); }
  };
}

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'estudiantes', component: Estudiantes },
  { path: 'docentes', component: Docentes, canActivate: [requiereRol('jefatura')] },
  { path: 'expedientes/nuevo', component: ExpedienteFormulario, canActivate: [requiereRol('administracion')] },
  { path: 'expedientes/:carnet/asignacion-tutores', component: AsignacionTutores, canActivate: [requiereRol('coordinacion')] },
  { path: 'expedientes/:carnet', component: ExpedienteDetalle },
  { path: '', pathMatch: 'full', redirectTo: 'estudiantes' },
  { path: '**', redirectTo: 'estudiantes' }
];

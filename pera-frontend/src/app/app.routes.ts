import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Estudiantes } from './pages/estudiantes/estudiantes';
import { ExpedienteFormulario } from './pages/expediente-formulario/expediente-formulario';
import { ExpedienteDetalle } from './pages/expediente-detalle/expediente-detalle';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'estudiantes', component: Estudiantes },
  { path: 'expedientes/nuevo', component: ExpedienteFormulario },
  { path: 'expedientes/:carnet', component: ExpedienteDetalle },
  { path: '', pathMatch: 'full', redirectTo: 'estudiantes' },
  { path: '**', redirectTo: 'estudiantes' }
];

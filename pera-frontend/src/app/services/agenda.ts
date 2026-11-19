export interface TutorAgenda { id_docente: number; nombre: string }
export interface OpcionAgenda { carnet: string; nombre: string; tutores: TutorAgenda[] }
export interface Cita {
  id_sesion: number; carnet: string; estudiante: string; organizador: number;
  fecha: string; hora_inicio: string; hora_fin: string; modalidad: string; ubicacion: string;
  tutores: TutorAgenda[]; cancelada: boolean; version: number;
}

export function fechaActual() {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find(p => p.type === tipo)?.value;
  return valor('year') + '-' + valor('month') + '-' + valor('day');
}

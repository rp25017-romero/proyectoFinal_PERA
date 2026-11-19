import { errorHttp, exigirRol } from './tutores.mjs';

export async function opcionesAgenda(db, usuario) {
  exigirRol(usuario, 'docente');
  const { rows } = await db.query(
    `WITH disponibles AS (
       SELECT DISTINCT a.carnet, d.id_docente, d.nombre
       FROM asignaciones_tutoria a JOIN docentes d USING(id_docente)
       WHERE d.activo AND a.retirado_en IS NULL
     )
     SELECT e.carnet,e.nombre,jsonb_agg(jsonb_build_object('id_docente',d.id_docente,'nombre',d.nombre)
       ORDER BY d.nombre,d.id_docente) AS tutores
     FROM estudiantes e JOIN carreras c USING(id_carrera) JOIN disponibles d USING(carnet)
     JOIN docentes titular ON titular.id_docente=$1 AND titular.id_departamento=c.id_departamento
     WHERE EXISTS (SELECT 1 FROM disponibles propio WHERE propio.carnet=e.carnet AND propio.id_docente=$1)
     GROUP BY e.carnet ORDER BY e.nombre,e.carnet`, [usuario.id_docente]);
  return rows;
}

const acceso = `(v.carnet=$1 OR EXISTS (SELECT 1 FROM participantes_sesion p
  WHERE p.id_sesion=v.id_sesion AND p.id_docente=$2))`;

export async function consultarAgenda(db, usuario, mes, id) {
  const claves = [usuario.rol === 'estudiante' ? usuario.carnet_estudiante : null,
    usuario.rol === 'docente' ? usuario.id_docente : null];
  if (id) {
    const { rows: [sesion] } = await db.query(
      'SELECT v.* FROM vista_sesiones v WHERE ' + acceso + ' AND v.id_sesion=$3', [...claves,id]);
    if (!sesion) throw errorHttp(404, 'Sesión no encontrada en su calendario.');
    return sesion;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw errorHttp(400, 'Seleccione un mes válido.');
  const { rows } = await db.query('SELECT v.* FROM vista_sesiones v WHERE ' + acceso +
    " AND left(v.fecha,7)=$3 ORDER BY v.fecha,v.hora_inicio,v.id_sesion", [...claves, mes]);
  return rows;
}

function validar(datos, docente) {
  const { fecha, hora_inicio, hora_fin, modalidad, ubicacion, carnet, tutores } = datos;
  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  const fechaUTC = new Date(typeof fecha === 'string' ? fecha + 'T00:00:00Z' : NaN);
  if (typeof fecha !== 'string' || typeof hora_inicio !== 'string' || typeof hora_fin !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha.startsWith('0000') || isNaN(fechaUTC.getTime()) ||
      fechaUTC.toISOString().slice(0,10) !== fecha || !hora.test(hora_inicio) || !hora.test(hora_fin) || hora_inicio >= hora_fin)
    throw errorHttp(400, 'Revise la fecha y el horario. La hora de fin debe ser posterior al inicio.');
  if (!['Presencial','Virtual'].includes(modalidad) || typeof ubicacion !== 'string' || !ubicacion.trim() || ubicacion.trim().length > 300)
    throw errorHttp(400, 'Indique la modalidad y el lugar o enlace de la tutoría.');
  if (modalidad === 'Virtual') {
    let enlace;
    try { enlace = new URL(ubicacion.trim()); } catch {}
    if (!enlace || !['https:', 'http:'].includes(enlace.protocol)) throw errorHttp(400, 'Ingrese un enlace de reunión válido.');
  }
  if (typeof carnet !== 'string' || !/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(carnet) ||
      !Array.isArray(tutores) || !tutores.includes(docente) || new Set(tutores).size !== tutores.length ||
      tutores.some(id => !Number.isInteger(id) || id < 1 || id > 2147483647))
    throw errorHttp(400, 'Seleccione el estudiante y los tutores, incluyendo al organizador.');
}

export async function guardarSesion(db, usuario, id, datos, cancelar) {
  exigirRol(usuario, 'docente');
  if (!cancelar) validar(datos, usuario.id_docente);
  const tx = await db.connect();
  try {
    await tx.query('BEGIN');
    if (id) {
      const { rows: [anterior] } = await tx.query(
        'SELECT * FROM sesiones_tutoria WHERE id_sesion=$1 AND organizador=$2 FOR UPDATE', [id,usuario.id_docente]);
      if (!anterior) throw errorHttp(404, 'Sesión no encontrada para este organizador.');
      if (anterior.cancelada || anterior.version !== datos.version)
        throw errorHttp(409, 'La sesión cambió. Vuelva a abrirla desde el calendario.');
      if (!cancelar && anterior.carnet !== datos.carnet) throw errorHttp(400, 'El estudiante de la sesión debe conservarse.');
    }
    if (cancelar) {
      await tx.query('UPDATE sesiones_tutoria SET cancelada=true,version=version+1 WHERE id_sesion=$1', [id]);
    } else {
      const activos = await tx.query(
        `SELECT a.id_docente FROM asignaciones_tutoria a JOIN docentes d USING(id_docente)
         JOIN estudiantes e USING(carnet) JOIN carreras c USING(id_carrera)
         JOIN docentes titular ON titular.id_docente=$3 AND titular.id_departamento=c.id_departamento
         WHERE a.carnet=$1 AND a.retirado_en IS NULL AND d.activo AND a.id_docente=ANY($2::int[])
         ORDER BY a.id_docente,a.id_asignacion FOR SHARE OF a,d,titular,e,c`, [datos.carnet,datos.tutores,usuario.id_docente]);
      if (new Set(activos.rows.map(a => a.id_docente)).size !== datos.tutores.length)
        throw errorHttp(403, 'Verifique que cada tutor esté activo y asignado al estudiante de su departamento.');
      const valores = [datos.fecha+' '+datos.hora_inicio, datos.fecha+' '+datos.hora_fin, datos.modalidad, datos.ubicacion.trim()];
      if (id) {
        await tx.query('DELETE FROM participantes_sesion WHERE id_sesion=$1', [id]);
        await tx.query('UPDATE sesiones_tutoria SET inicio=$1,fin=$2,modalidad=$3,ubicacion=$4,version=version+1 WHERE id_sesion=$5',
          [...valores,id]);
      } else {
        const { rows } = await tx.query(
          'INSERT INTO sesiones_tutoria(inicio,fin,modalidad,ubicacion,carnet,organizador) VALUES($1,$2,$3,$4,$5,$6) RETURNING id_sesion',
          [...valores,datos.carnet,usuario.id_docente]);
        id = rows[0].id_sesion;
      }
      await tx.query('INSERT INTO participantes_sesion(id_sesion,id_docente) SELECT $1,d FROM unnest($2::int[]) AS d ORDER BY d', [id,datos.tutores]);
    }
    await tx.query('COMMIT');
    return { id_sesion: Number(id) };
  } catch (e) {
    await tx.query('ROLLBACK');
    if (e.code === '23P01') throw errorHttp(409, e.constraint === 'horario_alumno'
      ? 'El estudiante ya tiene una sesión en ese horario.' : 'Uno de los tutores ya tiene una sesión en ese horario.');
    if (e.code === '40P01') throw errorHttp(409, 'Otra reserva se tramita al mismo tiempo. Actualice y vuelva a intentar.');
    throw e;
  } finally { tx.release(); }
}

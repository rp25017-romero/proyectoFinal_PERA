export function errorHttp(estado, mensaje) {
  return Object.assign(new Error(mensaje), { estado });
}

export function exigirRol(usuario, rol) {
  if (usuario.rol !== rol || (rol === 'jefatura' && !usuario.id_departamento))
    throw errorHttp(403, 'Su cuenta no tiene permiso para esta operación.');
}

function texto(valor, maximo) {
  return typeof valor === 'string' && valor.trim().length > 0 && valor.trim().length <= maximo;
}

export async function listarDocentes(db, usuario) {
  if (!['jefatura', 'coordinacion'].includes(usuario.rol)) throw errorHttp(403, 'Permisos insuficientes.');
  const { rows } = await db.query(
    `SELECT t.id_docente, t.codigo, t.nombre, t.correo, t.activo, d.nombre AS departamento
     FROM docentes t JOIN departamentos d USING (id_departamento)
     WHERE CASE WHEN $1 = 'jefatura' THEN t.id_departamento = $2 ELSE t.activo END
     ORDER BY t.nombre, t.codigo`, [usuario.rol, usuario.id_departamento]);
  return rows;
}

export async function guardarDocente(db, usuario, id, datos) {
  exigirRol(usuario, 'jefatura');
  if (!texto(datos.codigo, 20) || !/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(datos.codigo.trim().toUpperCase()) ||
      !texto(datos.nombre, 120) || !texto(datos.correo, 254) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim()))
    throw errorHttp(400, 'Revise el código, nombre y correo del docente.');
  if (id && typeof datos.activo !== 'boolean') throw errorHttp(400, 'Indique el estado del docente.');
  const valores = [datos.codigo.trim().toUpperCase(), datos.nombre.trim(), datos.correo.trim().toLowerCase(), usuario.id_departamento];
  try {
    const resultado = id
      ? await db.query(`UPDATE docentes SET codigo=$1, nombre=$2, correo=$3, activo=$5
                        WHERE id_departamento=$4 AND id_docente=$6 RETURNING id_docente`, [...valores, datos.activo, id])
      : await db.query(`INSERT INTO docentes (codigo,nombre,correo,id_departamento)
                        VALUES ($1,$2,$3,$4) RETURNING id_docente`, valores);
    if (!resultado.rowCount) throw errorHttp(404, 'Docente no encontrado en su departamento.');
    return resultado.rows[0];
  } catch (e) {
    if (e.code === '23505') throw errorHttp(409, 'Ese código o correo ya está registrado.');
    throw e;
  }
}

export async function tutoresDelExpediente(db, carnet) {
  const { rows } = await db.query(
    `SELECT a.id_asignacion, d.id_docente, d.codigo, d.nombre, d.activo, a.area
     FROM asignaciones_tutoria a JOIN docentes d USING (id_docente)
     WHERE a.carnet=$1 AND a.retirado_en IS NULL ORDER BY d.nombre, a.area`, [carnet]);
  return rows;
}

export async function asignarTutores(db, usuario, carnet, asignaciones) {
  exigirRol(usuario, 'coordinacion');
  if (!Array.isArray(asignaciones) || !asignaciones.length || asignaciones.some(a =>
      !a || !Number.isInteger(a.id_docente) || a.id_docente < 1 || a.id_docente > 2147483647 || !texto(a.area, 120)))
    throw errorHttp(400, 'Seleccione el docente y escriba el área de cada asignación.');
  const conexion = await db.connect();
  try {
    await conexion.query('BEGIN');
    if (!(await conexion.query('SELECT 1 FROM estudiantes WHERE carnet=$1 FOR KEY SHARE', [carnet])).rowCount)
      throw errorHttp(404, 'El expediente no existe.');
    const ids = [...new Set(asignaciones.map(a => a.id_docente))];
    const activos = await conexion.query(
      'SELECT id_docente FROM docentes WHERE id_docente=ANY($1::int[]) AND activo ORDER BY id_docente FOR SHARE', [ids]);
    if (activos.rowCount !== ids.length) throw errorHttp(409, 'Uno de los docentes ya no está disponible.');
    await conexion.query(
      `INSERT INTO asignaciones_tutoria (carnet,id_docente,area,asignado_por)
       SELECT $1, id_docente, trim(area), $2 FROM jsonb_to_recordset($3::jsonb) AS a(id_docente int, area text)
       ORDER BY id_docente, lower(trim(area))`, [carnet, usuario.id_usuario, JSON.stringify(asignaciones)]);
    await conexion.query('COMMIT');
  } catch (e) {
    await conexion.query('ROLLBACK');
    if (e.code === '23505') throw errorHttp(409, 'Ya existe esa combinación de docente y área para el estudiante.');
    throw e;
  } finally { conexion.release(); }
}

export async function retirarTutor(db, usuario, carnet, id) {
  exigirRol(usuario, 'coordinacion');
  const resultado = await db.query(
    `UPDATE asignaciones_tutoria SET retirado_por=$1, retirado_en=now()
     WHERE carnet=$2 AND id_asignacion=$3 AND retirado_en IS NULL`, [usuario.id_usuario, carnet, id]);
  if (!resultado.rowCount) throw errorHttp(404, 'La asignación ya no está vigente.');
}

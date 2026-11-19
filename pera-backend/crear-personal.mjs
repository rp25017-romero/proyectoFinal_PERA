import { randomBytes } from 'node:crypto';
import { db } from './db.mjs';
import { crearHash } from './claves.mjs';

const correo = (process.argv[2] ?? '').trim().toLowerCase();
const rol = process.argv[3] ?? 'administracion';
try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw Error('Indique un correo válido.');
  if (!['administracion', 'jefatura', 'coordinacion','docente','estudiante'].includes(rol)) throw Error('Rol inválido.');
  let departamento = null;
  let docente = null;
  let carnet = null;
  const codigo = (process.argv[4] ?? '').trim().toUpperCase();
  if (rol === 'docente') {
    const { rows: [perfil] } = await db.query('SELECT id_docente FROM docentes WHERE codigo=$1 AND activo', [codigo]);
    if (!perfil) throw Error('Indique el código de un docente activo.');
    docente = perfil.id_docente;
  }
  if (rol === 'estudiante') {
    if (!(await db.query('SELECT 1 FROM estudiantes WHERE carnet=$1',[codigo])).rowCount) throw Error('Indique un carné registrado.');
    carnet = codigo;
  }
  if (rol === 'jefatura') {
    const resultado = await db.query('SELECT id_departamento FROM departamentos WHERE nombre = $1', [process.argv[4] ?? '']);
    if (!resultado.rowCount) throw Error('Indique el nombre exacto de un departamento existente.');
    departamento = resultado.rows[0].id_departamento;
  }
  const clave = randomBytes(18).toString('base64url');
  const resultado = await db.query(
    'INSERT INTO usuarios (correo, clave_hash, rol, id_departamento, id_docente, carnet_estudiante) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING',
    [correo, await crearHash(clave), rol, departamento, docente, carnet]
  );
  if (!resultado.rowCount) throw Error('El correo o el perfil ya tiene una cuenta.');
  console.log('Cuenta creada para ' + correo + '\nContraseña: ' + clave);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

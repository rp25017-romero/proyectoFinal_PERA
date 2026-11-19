import { randomBytes } from 'node:crypto';
import { db } from './db.mjs';
import { crearHash } from './claves.mjs';

const correo = (process.argv[2] ?? '').trim().toLowerCase();
const rol = process.argv[3] ?? 'administracion';
try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw Error('Indique un correo válido.');
  if (!['administracion', 'jefatura', 'coordinacion'].includes(rol)) throw Error('Rol de personal inválido.');
  let departamento = null;
  if (rol === 'jefatura') {
    const resultado = await db.query('SELECT id_departamento FROM departamentos WHERE nombre = $1', [process.argv[4] ?? '']);
    if (!resultado.rowCount) throw Error('Indique el nombre exacto de un departamento existente.');
    departamento = resultado.rows[0].id_departamento;
  }
  const clave = randomBytes(18).toString('base64url');
  const resultado = await db.query(
    'INSERT INTO usuarios (correo, clave_hash, rol, id_departamento) VALUES ($1,$2,$3,$4) ON CONFLICT (correo) DO NOTHING',
    [correo, await crearHash(clave), rol, departamento]
  );
  if (!resultado.rowCount) throw Error('Ya existe una cuenta con ese correo.');
  console.log('Cuenta creada para ' + correo + '\nContraseña: ' + clave);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

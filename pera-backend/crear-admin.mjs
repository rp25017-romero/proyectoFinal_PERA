import { randomBytes } from 'node:crypto';
import { db } from './db.mjs';
import { crearHash } from './claves.mjs';

const correo = (process.argv[2] ?? '').trim().toLowerCase();
try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw Error('Indique un correo válido.');
  const clave = randomBytes(18).toString('base64url');
  const resultado = await db.query(
    "INSERT INTO usuarios (correo, clave_hash, rol) VALUES ($1, $2, 'administracion') ON CONFLICT (correo) DO NOTHING",
    [correo, await crearHash(clave)]
  );
  if (!resultado.rowCount) throw Error('Ya existe una cuenta con ese correo.');
  console.log('Cuenta creada para ' + correo + '\nContraseña: ' + clave);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

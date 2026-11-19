import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derivar = promisify(scrypt);

export async function crearHash(clave) {
  const sal = randomBytes(16).toString('hex');
  const resultado = await derivar(clave, sal, 64);
  return sal + ':' + resultado.toString('hex');
}

export async function verificarClave(clave, almacenado) {
  const [sal, hex] = almacenado.split(':');
  const esperado = Buffer.from(hex, 'hex');
  const resultado = await derivar(clave, sal, 64);
  return esperado.length === resultado.length && timingSafeEqual(esperado, resultado);
}

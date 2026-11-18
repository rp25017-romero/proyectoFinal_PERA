import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { verificarClave } from './claves.mjs';
import { validarExpediente } from './validacion.mjs';

function errorHttp(estado, mensaje) {
  return Object.assign(new Error(mensaje), { estado });
}

async function leerJson(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    throw errorHttp(415, 'Se requiere contenido JSON.');
  let bytes = 0;
  const partes = [];
  for await (const parte of req) {
    bytes += parte.length;
    if (bytes > 8192) throw errorHttp(413, 'El formulario es demasiado grande.');
    partes.push(parte);
  }
  try {
    const datos = JSON.parse(Buffer.concat(partes).toString('utf8'));
    if (datos && typeof datos === 'object' && !Array.isArray(datos)) return datos;
  } catch {}
  throw errorHttp(400, 'El formulario debe contener un objeto JSON válido.');
}

function responder(res, estado, datos) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(datos));
}

const huella = token => createHash('sha256').update(token).digest('hex');
function cookieSesion(token, segundos) {
  const segura = process.env.COOKIE_SEGURA === 'true' ? '; Secure' : '';
  return 'pera_sesion=' + token + '; Max-Age=' + segundos + '; Path=/api; HttpOnly; SameSite=Strict' + segura;
}

export function crearServidor(db) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const ruta = url.pathname;
      const metodo = req.method;
      if (metodo === 'POST' && req.headers['x-pera'] !== 'web')
        throw errorHttp(403, 'Solicitud de formulario no permitida.');

      if (metodo === 'POST' && ruta === '/api/login') {
        const { correo, clave } = await leerJson(req);
        if (typeof correo !== 'string' || typeof clave !== 'string' || !clave || clave.length > 256)
          throw errorHttp(400, 'Ingrese su correo y contraseña.');
        const { rows: [usuario] } = await db.query(
          'SELECT id_usuario, clave_hash, rol FROM usuarios WHERE correo = $1 AND activo', [correo.trim().toLowerCase()]
        );
        if (!usuario || !await verificarClave(clave, usuario.clave_hash))
          throw errorHttp(401, 'Correo o contraseña incorrectos.');
        if (usuario.rol !== 'administracion') throw errorHttp(403, 'Este módulo requiere Administración Académica.');
        const token = randomBytes(32).toString('hex');
        await db.query('DELETE FROM sesiones_acceso WHERE expira_en <= now()');
        await db.query("INSERT INTO sesiones_acceso VALUES ($1, $2, now() + interval '8 hours')",
          [huella(token), usuario.id_usuario]);
        res.setHeader('Set-Cookie', cookieSesion(token, 28800));
        return responder(res, 200, { rol: usuario.rol });
      }

      const token = req.headers.cookie?.match(/(?:^|;\s*)pera_sesion=([0-9a-f]{64})(?:;|$)/)?.[1];
      if (!token) throw errorHttp(401, 'Inicie sesión para continuar.');
      const { rows: [usuario] } = await db.query(
        `SELECT u.id_usuario, u.rol FROM sesiones_acceso s JOIN usuarios u USING (id_usuario)
         WHERE s.token_hash = $1 AND s.expira_en > now() AND u.activo`, [huella(token)]
      );
      if (!usuario) throw errorHttp(401, 'La sesión ha caducado. Ingrese de nuevo.');
      if (metodo === 'POST' && ruta === '/api/logout') {
        await db.query('DELETE FROM sesiones_acceso WHERE token_hash = $1', [huella(token)]);
        res.setHeader('Set-Cookie', cookieSesion('', 0));
        return responder(res, 200, {});
      }
      if (usuario.rol !== 'administracion') throw errorHttp(403, 'Permisos insuficientes.');
      if (metodo === 'GET' && ruta === '/api/sesion') return responder(res, 200, { rol: usuario.rol });
      if (metodo === 'GET' && ruta === '/api/carreras') {
        const { rows } = await db.query('SELECT id_carrera, nombre FROM carreras ORDER BY nombre, id_carrera');
        return responder(res, 200, rows);
      }
      if (metodo === 'GET' && ruta === '/api/expedientes') {
        const buscar = (url.searchParams.get('carnet') ?? '').trim().toUpperCase();
        const pagina = Number(url.searchParams.get('pagina') ?? '1');
        const carrera = url.searchParams.get('carrera') || null;
        if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1000000)
          throw errorHttp(400, 'Página inválida.');
        const { rows } = await db.query(
          `SELECT carnet, nombre, carrera, estado_pera FROM vista_expedientes
           WHERE strpos(carnet, $1) > 0 AND ($2::text IS NULL OR carrera = $2)
           ORDER BY carnet LIMIT 26 OFFSET $3`, [buscar, carrera, (pagina - 1) * 25]
        );
        return responder(res, 200, { registros: rows.slice(0, 25), hayMas: rows.length > 25 });
      }
      if (metodo === 'POST' && ruta === '/api/expedientes') {
        const datos = await leerJson(req);
        const problema = validarExpediente(datos);
        if (problema) throw errorHttp(400, problema);
        const carnet = datos.carnet.trim().toUpperCase();
        await db.query(
          'INSERT INTO estudiantes (carnet, nombre, id_carrera, cum_actual, creado_por) VALUES ($1,$2,$3,$4,$5)',
          [carnet, datos.nombre.trim(), datos.id_carrera, datos.cum, usuario.id_usuario]
        );
        return responder(res, 201, { carnet });
      }
      const detalle = ruta.match(/^\/api\/expedientes\/([A-Z0-9-]{1,20})$/i);
      if (metodo === 'GET' && detalle) {
        const { rows: [estudiante] } = await db.query('SELECT * FROM vista_expedientes WHERE carnet = $1',
          [detalle[1].toUpperCase()]);
        if (!estudiante) throw errorHttp(404, 'El expediente no existe.');
        return responder(res, 200, estudiante);
      }
      throw errorHttp(404, 'Ruta no encontrada.');
    } catch (error) {
      if (error.code === '23505') return responder(res, 409, { mensaje: 'Ya existe un expediente con ese carné.' });
      if (error.code === '23503') return responder(res, 400, { mensaje: 'Revise la carrera seleccionada.' });
      if (!error.estado) console.error('Error interno en la API', error.code ?? error.name);
      responder(res, error.estado ?? 500, { mensaje: error.estado ? error.message : 'No se pudo completar la operación.' });
    }
  });
}

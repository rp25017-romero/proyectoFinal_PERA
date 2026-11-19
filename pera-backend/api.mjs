import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { verificarClave } from './claves.mjs';
import { validarExpediente } from './validacion.mjs';
import { consultarAgenda, guardarSesion, opcionesAgenda } from './agenda.mjs';

import { asignarTutores, errorHttp, exigirRol, guardarDocente, listarDocentes, retirarTutor, tutoresDelExpediente } from './tutores.mjs';

const rolesPersonal = ['administracion', 'jefatura', 'coordinacion'];

function comprobarAcceso(usuario) {
  if (usuario.rol === 'docente' && usuario.docente_activo) return;
  if (usuario.rol === 'estudiante' && usuario.carnet_estudiante) return;
  if (!rolesPersonal.includes(usuario.rol)) throw errorHttp(403, 'La cuenta requiere un perfil activo y vinculado.');
  if (usuario.rol === 'jefatura') exigirRol(usuario, 'jefatura');
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
          `SELECT u.*, d.activo AS docente_activo FROM usuarios u LEFT JOIN docentes d USING(id_docente)
           WHERE u.correo=$1 AND u.activo`, [correo.trim().toLowerCase()]
        );
        if (!usuario || !await verificarClave(clave, usuario.clave_hash))
          throw errorHttp(401, 'Correo o contraseña incorrectos.');
        comprobarAcceso(usuario);
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
        `SELECT u.id_usuario,u.rol,u.id_departamento,u.id_docente,u.carnet_estudiante,d.activo AS docente_activo
         FROM sesiones_acceso s JOIN usuarios u USING (id_usuario) LEFT JOIN docentes d ON d.id_docente=u.id_docente
         WHERE s.token_hash = $1 AND s.expira_en > now() AND u.activo`, [huella(token)]
      );
      if (!usuario) throw errorHttp(401, 'La sesión ha caducado. Ingrese de nuevo.');
      if (metodo === 'POST' && ruta === '/api/logout') {
        await db.query('DELETE FROM sesiones_acceso WHERE token_hash = $1', [huella(token)]);
        res.setHeader('Set-Cookie', cookieSesion('', 0));
        return responder(res, 200, {});
      }
      comprobarAcceso(usuario);
      if (metodo === 'GET' && ruta === '/api/sesion') return responder(res, 200, { rol: usuario.rol, id_docente: usuario.id_docente });
      if (ruta.startsWith('/api/agenda')) {
        if (!['docente','estudiante'].includes(usuario.rol)) throw errorHttp(403, 'Acceso exclusivo de los participantes.');
        if (metodo === 'GET' && ruta === '/api/agenda/opciones') return responder(res,200,await opcionesAgenda(db,usuario));
        const cita = ruta.match(/^\/api\/agenda(?:\/([1-9]\d{0,9})(\/cancelar)?)?$/);
        if (cita && Number(cita[1]) > 2147483647) throw errorHttp(404, 'Sesión no encontrada.');
        if (cita && metodo === 'GET' && !cita[2])
          return responder(res,200,await consultarAgenda(db,usuario,url.searchParams.get('mes'),cita[1]));
        if (cita && metodo === 'POST') {
          exigirRol(usuario,'docente');
          const guardado = await guardarSesion(db,usuario,cita[1],await leerJson(req),Boolean(cita[2]));
          return responder(res,cita[1] ? 200 : 201,guardado);
        }
        throw errorHttp(404, 'Ruta de calendario no encontrada.');
      }
      if (!rolesPersonal.includes(usuario.rol)) throw errorHttp(403, 'Permisos insuficientes.');
      const departamento = usuario.rol === 'jefatura' ? usuario.id_departamento : null;
      if (metodo === 'GET' && ruta === '/api/docentes') return responder(res, 200, await listarDocentes(db, usuario));
      const docente = ruta.match(/^\/api\/docentes\/(\d{1,9})$/);
      if (metodo === 'POST' && (ruta === '/api/docentes' || docente)) {
        exigirRol(usuario, 'jefatura');
        const guardado = await guardarDocente(db, usuario, docente?.[1], await leerJson(req));
        return responder(res, docente ? 200 : 201, guardado);
      }
      const tutores = ruta.match(/^\/api\/expedientes\/([A-Z0-9-]{1,20})\/tutores(?:\/(\d{1,9})\/retirar)?$/i);
      if (metodo === 'POST' && tutores) {
        exigirRol(usuario, 'coordinacion');
        const carnet = tutores[1].toUpperCase();
        if (tutores[2]) {
          await retirarTutor(db, usuario, carnet, tutores[2]);
        } else {
          const datos = await leerJson(req);
          await asignarTutores(db, usuario, carnet, datos.asignaciones);
        }
        return responder(res, tutores[2] ? 200 : 201, {});
      }
      if (metodo === 'GET' && ruta === '/api/carreras') {
        const { rows } = await db.query('SELECT id_carrera, nombre FROM carreras WHERE ($1::int IS NULL OR id_departamento=$1) ORDER BY nombre, id_carrera', [departamento]);
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
             AND ($4::int IS NULL OR departamento=(SELECT nombre FROM departamentos WHERE id_departamento=$4))
           ORDER BY carnet LIMIT 26 OFFSET $3`, [buscar, carrera, (pagina - 1) * 25, departamento]
        );
        return responder(res, 200, { registros: rows.slice(0, 25), hayMas: rows.length > 25 });
      }
      if (metodo === 'POST' && ruta === '/api/expedientes') {
        exigirRol(usuario, 'administracion');
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
        const { rows: [estudiante] } = await db.query(
          `SELECT * FROM vista_expedientes WHERE carnet=$1 AND
           ($2::int IS NULL OR departamento=(SELECT nombre FROM departamentos WHERE id_departamento=$2))`,
          [detalle[1].toUpperCase(), departamento]);
        if (!estudiante) throw errorHttp(404, 'El expediente no existe.');
        const tutoresAsignados = await tutoresDelExpediente(db, estudiante.carnet);
        const sesiones = await db.query('SELECT * FROM vista_sesiones WHERE carnet=$1 ORDER BY fecha DESC,hora_inicio DESC,id_sesion DESC', [estudiante.carnet]);
        return responder(res, 200, { ...estudiante, tutores: tutoresAsignados, sesiones: sesiones.rows });
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

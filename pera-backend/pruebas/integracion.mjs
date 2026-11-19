import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { crearHash } from '../claves.mjs';
import { crearServidor } from '../api.mjs';
import { probarAgenda } from './agenda.mjs';

test('alta, consulta, regla de UV, duplicados y permisos contra PostgreSQL', async t => {
  const admin = new pg.Client();
  await admin.connect();
  const esquema = 'prueba_' + randomUUID().replaceAll('-', '');
  const pool = new pg.Pool({ options: '-c search_path=' + esquema + ',public' });
  let creado = false;
  t.after(async () => {
    await pool.end();
    try { if (creado) await admin.query('DROP SCHEMA ' + esquema + ' CASCADE'); }
    finally { await admin.end(); }
  });
  await admin.query('CREATE SCHEMA ' + esquema);
  creado = true;
  for (const archivo of ['001_expedientes.sql', '002_docentes_tutores.sql', '003_sesiones_calendario.sql', 'demo_expedientes.sql']) {
    const sql = await readFile(join(process.env.PERA_SQL_DIR || '/sql', archivo), 'utf8');
    await pool.query(sql.replace(/^\\set[^\n]*\n/m, ''));
  }
  const hash = await crearHash('contraseña efímera');
  await pool.query(`INSERT INTO usuarios (correo, clave_hash, rol) VALUES
    ('admin@example.test', $1, 'administracion'), ('tutor@example.test', $1, 'docente')`, [hash]);
  const api = crearServidor(pool);
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  try {
    const base = 'http://127.0.0.1:' + api.address().port + '/api/';
    let cookie = '';
    const post = (path, body) => fetch(base + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-PERA': 'web', cookie },
      body: JSON.stringify(body)
    });
    const get = path => fetch(base + path, { headers: { cookie } });
    assert.equal((await get('expedientes')).status, 401);
    assert.equal((await post('login', { correo: 'tutor@example.test', clave: 'contraseña efímera' })).status, 403);
    const login = await post('login', { correo: 'admin@example.test', clave: 'contraseña efímera' });
    assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    const [carrera] = await (await get('carreras')).json();
    const datos = { carnet: 'test-01', nombre: 'Estudiante de prueba', id_carrera: carrera.id_carrera, cum: 6.5 };
    assert.equal((await post('expedientes', datos)).status, 201);
    assert.equal((await post('expedientes', { ...datos, carnet: 'TEST-01' })).status, 409);
    assert.equal((await post('expedientes', { ...datos, carnet: 'TEST-02', cum: 6.51 })).status, 201);
    assert.equal((await (await get('expedientes/TEST-01')).json()).limite_uv, 12);
    assert.equal((await (await get('expedientes/TEST-02')).json()).limite_uv, null);
    const lista = await (await get('expedientes?carnet=test-01')).json();
    assert.deepEqual(lista.registros.map(r => r.carnet), ['TEST-01']);
    const adminCookie = cookie;
    async function acceder(correo) {
      const respuesta = await post('login', { correo, clave: 'contraseña efímera' });
      assert.equal(respuesta.status, 200);
      cookie = respuesta.headers.get('set-cookie').split(';')[0];
    }
    const { rows: [otro] } = await pool.query("INSERT INTO departamentos(nombre) VALUES ('Otra unidad') RETURNING id_departamento");
    const { rows: [propio] } = await pool.query('SELECT id_departamento FROM carreras WHERE id_carrera=$1', [carrera.id_carrera]);
    await pool.query(`INSERT INTO usuarios(correo, clave_hash, rol, id_departamento) VALUES
      ('jefe@example.test',$1,'jefatura',$2), ('otro@example.test',$1,'jefatura',$3),
      ('coord@example.test',$1,'coordinacion',NULL)`, [hash, propio.id_departamento, otro.id_departamento]);
    const ficha = codigo => ({ codigo, nombre: 'Docente ' + codigo, correo: codigo + '@example.test', activo: true });
    let primerId;
    let segundoId;
    await t.test('Jefatura registra y edita únicamente los docentes de su departamento', async () => {
      assert.equal((await post('docentes', ficha('A'))).status, 403);
      await acceder('jefe@example.test');
      const a = await post('docentes', ficha('A'));
      assert.equal(a.status, 201);
      primerId = (await a.json()).id_docente;
      const b = await post('docentes', ficha('B'));
      assert.equal(b.status, 201);
      segundoId = (await b.json()).id_docente;
      assert.equal((await post('docentes', ficha('A'))).status, 409);
      assert.equal((await post('expedientes', datos)).status, 403);
      await acceder('otro@example.test');
      assert.deepEqual(await (await get('docentes')).json(), []);
      assert.deepEqual((await (await get('expedientes')).json()).registros, []);
      assert.equal((await get('expedientes/TEST-01')).status, 404);
      assert.equal((await post('docentes/' + primerId, ficha('A'))).status, 404);
      await acceder('jefe@example.test');
      assert.equal((await post('docentes/' + primerId, { ...ficha('A'), nombre: 'Docente editado' })).status, 200);
    });
    await t.test('Coordinación asigna dos áreas, los duplicados revierten el lote y se conserva el historial', async () => {
      const ruta = 'expedientes/TEST-01/tutores';
      const asignar = (...asignaciones) => post(ruta, { asignaciones });
      const a = { id_docente: primerId, area: 'Cálculo' };
      const b = { id_docente: segundoId, area: 'Programación' };
      assert.equal((await asignar(a)).status, 403);
      await acceder('coord@example.test');
      assert.equal((await post('docentes', ficha('C'))).status, 403);
      assert.equal((await asignar(a,b)).status, 201);
      assert.equal((await asignar({ ...b, area: 'Física' }, { ...a, area: 'cálculo' })).status, 409);
      cookie = adminCookie;
      const { tutores } = await (await get('expedientes/TEST-01')).json();
      assert.deepEqual(tutores.map(x => x.area).sort(), ['Cálculo', 'Programación']);
      const idAsignacion = tutores.find(x => x.id_docente === primerId).id_asignacion;
      await acceder('jefe@example.test');
      assert.equal((await post('docentes/' + primerId, { ...ficha('A'), activo: false })).status, 200);
      await acceder('coord@example.test');
      assert.deepEqual((await (await get('docentes')).json()).map(d => d.id_docente), [segundoId]);
      assert.equal((await asignar({ ...a, area: 'Física' })).status, 409);
      assert.equal((await post(ruta + '/' + idAsignacion + '/retirar', {})).status, 200);
      assert.equal((await (await get('expedientes/TEST-01')).json()).tutores.length, 1);
      assert.equal((await pool.query('SELECT 1 FROM asignaciones_tutoria WHERE id_asignacion=$1 AND retirado_por IS NOT NULL', [idAsignacion])).rowCount, 1);
      await acceder('jefe@example.test');
      assert.equal((await post('docentes/' + primerId, ficha('A'))).status, 200);
      await acceder('coord@example.test');
      assert.equal((await asignar(a)).status, 201);
    });
    await t.test('Calendario personal, programación compartida y conflictos simultáneos', async () => {
      await probarAgenda({ pool, hash, primerId, segundoId, post, get, acceder });
    });
    cookie = adminCookie;
    assert.equal((await post('logout', {})).status, 200);
    assert.equal((await get('expedientes')).status, 401);
  } finally { await new Promise(resolve => api.close(resolve)); }
});

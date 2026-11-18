import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { crearHash } from '../claves.mjs';
import { crearServidor } from '../api.mjs';

test('alta, consulta, regla de UV, duplicados y permisos contra PostgreSQL', async t => {
  const admin = new pg.Client();
  await admin.connect();
  const esquema = 'prueba_' + randomUUID().replaceAll('-', '');
  const pool = new pg.Pool({ options: '-c search_path=' + esquema });
  let creado = false;
  t.after(async () => {
    await pool.end();
    try { if (creado) await admin.query('DROP SCHEMA ' + esquema + ' CASCADE'); }
    finally { await admin.end(); }
  });
  await admin.query('CREATE SCHEMA ' + esquema);
  creado = true;
  for (const archivo of ['001_expedientes.sql', 'demo_expedientes.sql']) {
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
    assert.equal((await post('logout', {})).status, 200);
    assert.equal((await get('expedientes')).status, 401);
  } finally { await new Promise(resolve => api.close(resolve)); }
});

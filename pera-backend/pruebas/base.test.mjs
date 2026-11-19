import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearHash, verificarClave } from '../claves.mjs';
import { validarExpediente } from '../validacion.mjs';
import { crearServidor } from '../api.mjs';

const valido = { carnet: 'test-01', nombre: 'Estudiante de prueba', id_carrera: 1, cum: 6.5 };

test('acepta CUM 6.50 y los extremos 0 y 10', () => {
  for (const cum of [0, 6.50, 10]) assert.equal(validarExpediente({ ...valido, cum }), null);
});

test('rechaza carné, nombre, carrera y CUM inválidos', () => {
  for (const cambio of [{ carnet: ' ' }, { nombre: ' ' }, { id_carrera: 0 }, { cum: null },
    { cum: 10.01 }, { cum: -1 }, { cum: 6.501 }, { cum: '6.50' }]) {
    assert.ok(validarExpediente({ ...valido, ...cambio }));
  }
});

test('las contraseñas usan sal y distinguen credenciales incorrectas', async () => {
  const hash = await crearHash('solo para esta prueba');
  assert.notEqual(hash, await crearHash('solo para esta prueba'));
  assert.equal(await verificarClave('solo para esta prueba', hash), true);
  assert.equal(await verificarClave('otra', hash), false);
});

test('la API protege la lectura y el alta antes de consultar la BD', async () => {
  const api = crearServidor({ query: () => assert.fail('Consulta inesperada') });
  function solicitar(method, headers = {}) {
    return new Promise(resolve => {
      let estado;
      api.emit('request', { method, headers, url: '/api/expedientes' }, {
        writeHead(codigo) { estado = codigo; },
        end() { resolve(estado); }
      });
    });
  }
  assert.equal(await solicitar('GET'), 401);
  assert.equal(await solicitar('POST'), 403);
  assert.equal(await solicitar('POST', { 'x-pera': 'web' }), 401);
});

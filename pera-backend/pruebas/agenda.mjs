import assert from 'node:assert/strict';

export async function probarAgenda({ pool, hash, primerId, segundoId, post, get, acceder }) {
  await acceder('jefe@example.test');
  const nuevo = await post('docentes', { codigo:'C', nombre:'Docente C', correo:'c@example.test', activo:true });
  assert.equal(nuevo.status, 201);
  const tercero = (await nuevo.json()).id_docente;
  await acceder('coord@example.test');
  const asignaciones = [segundoId, tercero].map(id_docente => ({ id_docente, area:'Cálculo' }));
  assert.equal((await post('expedientes/TEST-02/tutores', { asignaciones })).status, 201);

  await pool.query(`INSERT INTO usuarios(correo,clave_hash,rol,id_docente,carnet_estudiante) VALUES
    ('a@example.test',$1,'docente',$2,NULL),('b@example.test',$1,'docente',$3,NULL),
    ('c@example.test',$1,'docente',$4,NULL),('uno@example.test',$1,'estudiante',NULL,'TEST-01'),
    ('dos@example.test',$1,'estudiante',NULL,'TEST-02')`, [hash,primerId,segundoId,tercero]);

  const mes = 'agenda?mes=2030-05';
  const cita = { carnet:'TEST-01', fecha:'2030-05-10', hora_inicio:'09:00', hora_fin:'10:00',
    modalidad:'Presencial', ubicacion:'Aula 1', tutores:[primerId,segundoId] };
  await acceder('a@example.test');
  assert.deepEqual((await (await get('agenda/opciones')).json()).map(e => e.carnet), ['TEST-01']);
  assert.equal((await post('agenda', { ...cita, fecha:'2030-02-30' })).status, 400);
  assert.equal((await post('agenda', { ...cita, hora_fin:'09:00' })).status, 400);
  assert.equal((await post('agenda', { ...cita, modalidad:'Virtual' })).status, 400);
  assert.equal((await post('agenda', { ...cita, tutores:[primerId,tercero] })).status, 403);
  const guardada = await post('agenda', cita);
  assert.equal(guardada.status, 201);
  const id = (await guardada.json()).id_sesion;
  const ruta = 'agenda/' + id;
  await acceder('uno@example.test');
  assert.deepEqual((await (await get(mes)).json()).map(s => s.id_sesion), [id]);
  assert.equal((await post('agenda', cita)).status, 403);
  assert.equal((await get('expedientes/TEST-01')).status, 403);
  await acceder('dos@example.test');
  assert.deepEqual(await (await get(mes)).json(), []);
  assert.equal((await get(ruta)).status, 404);
  await acceder('b@example.test');
  const compartida = await (await get(ruta)).json();
  assert.deepEqual(compartida.tutores.map(d => d.id_docente).sort(), [primerId,segundoId].sort());
  assert.equal((await post(ruta + '/cancelar', {version:1})).status, 404);
  assert.equal((await post(ruta, {...cita,version:1})).status, 404);

  await acceder('c@example.test');
  const otra = { ...cita, carnet:'TEST-02', hora_inicio:'09:30', hora_fin:'10:30', tutores:[tercero,segundoId] };
  assert.equal((await post('agenda', otra)).status, 409);
  assert.equal((await post('agenda', { ...otra,tutores:[tercero] })).status, 201);
  await acceder('a@example.test');
  const siguiente = { ...cita, hora_inicio:'10:00', hora_fin:'11:00' };
  assert.equal((await post('agenda', siguiente)).status, 201);
  assert.equal((await post(ruta, { ...cita,hora_inicio:'10:15',hora_fin:'10:45',version:1 })).status, 409);
  const anterior = await (await get(ruta)).json();
  assert.equal(anterior.hora_inicio,'09:00');
  assert.equal(anterior.tutores.length,2);
  assert.equal((await post(ruta, {...cita,modalidad:'Virtual',ubicacion:'https://example.test/reunion',version:1})).status, 200);
  assert.equal((await post(ruta + '/cancelar', {version:1})).status, 409);
  assert.equal((await post(ruta + '/cancelar', {version:2})).status, 200);
  const simultaneas = await Promise.all([post('agenda',cita),post('agenda',cita)]);
  assert.deepEqual(simultaneas.map(r => r.status).sort(), [201,409]);
  const individual = { ...cita, fecha:'2030-05-11', tutores:[primerId] };
  assert.equal((await post('agenda',individual)).status, 201);
  await acceder('b@example.test');
  assert.equal((await post('agenda', { ...individual,tutores:[segundoId] })).status, 409);
  const compartido = { ...cita, fecha:'2030-05-12' };
  const dosEstudiantes = await Promise.all([
    post('agenda',compartido),
    post('agenda',{ ...compartido,carnet:'TEST-02',tutores:[segundoId,tercero] })
  ]);
  assert.deepEqual(dosEstudiantes.map(r => r.status).sort(), [201,409]);
  await acceder('admin@example.test');
  const detalle = await (await get('expedientes/TEST-01')).json();
  assert.equal(detalle.sesiones.filter(s => s.fecha === cita.fecha).length,3);
  assert.equal(detalle.sesiones.find(s => s.id_sesion === id).cancelada,true);
}

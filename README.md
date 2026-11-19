# PERA · Gestión de tutorías y refuerzo académico

Administración Académica registra y consulta expedientes. Jefatura administra los docentes de su departamento y Coordinación asigna tutores y áreas de refuerzo a cada estudiante. La interfaz Angular se comunica con una API de Node.js y PostgreSQL 17.

## Ejecutar en la computadora

Requisitos de desarrollo: Docker Desktop con contenedores Linux y Node.js 24 con npm. Los siguientes comandos parten de la raíz del repositorio.

1. Cree el archivo local `infra/.env` con una línea `POSTGRES_PASSWORD=su_clave_local`. Sustituya el ejemplo por una contraseña propia. Si ya creó el volumen con la configuración original, use su contraseña anterior.
2. Inicie los servicios y aplique el esquema. Los scripts se pueden repetir y conservan los expedientes existentes.

```powershell
cd infra
docker compose up -d --build --wait
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/001_expedientes.sql
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/002_docentes_tutores.sql
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/003_sesiones_calendario.sql
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/demo_expedientes.sql
docker compose exec api node crear-admin.mjs admin@example.test
```

El último comando crea la cuenta local y muestra una contraseña aleatoria una sola vez. Para un segundo arranque basta con `docker compose up -d`. El script de demostración agrega una carrera y el único ejemplo de UV documentado (CUM 6.50 admite 12 UV). Un CUM sin regla aparece como **Pendiente de regla**. Los intervalos oficiales y el umbral para alertas deben confirmarse antes de usar el módulo con datos reales.

3. Desde `infra`, inicie Angular.

```powershell
cd ../pera-frontend
npm ci
npm start
```

Abra [la aplicación local](http://localhost:4200). Angular reenvía `/api` al puerto 3000. PostgreSQL usa el puerto local 5433. Las credenciales de la base permanecen en el servidor.

## Comprobar el recorrido

1. Entre con la cuenta creada y pulse **Registrar expediente**.
2. Use los datos ficticios `TEST-01`, `Estudiante de prueba`, la carrera de demostración y CUM `6.50`. Al guardar se abre el detalle con **12 UV**.
3. Recargue el navegador, vuelva al listado y busque `test-01`. Abra el detalle desde el carné.
4. Intente registrar el mismo carné en minúsculas. La aplicación debe avisar del duplicado y conservar un solo expediente.
5. Cierre la sesión. El servidor exige autenticación para leer o registrar expedientes.

## Activar y probar docentes y tutores

Si ya tiene funcionando el módulo de expedientes, conserve la base y su cuenta de Administración. Desde `infra` aplique la migración y reconstruya la API. Cree las dos cuentas de prueba una sola vez. Cada comando de creación muestra una contraseña aleatoria para ese usuario.

```powershell
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/002_docentes_tutores.sql
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/003_sesiones_calendario.sql
docker compose up -d --build --wait api
docker compose exec api node crear-personal.mjs jefatura@example.test jefatura "Ingeniería y Arquitectura"
docker compose exec api node crear-personal.mjs coordinacion@example.test coordinacion
```

1. Entre como Jefatura y abra **Administrar docentes** desde el listado de estudiantes. Registre dos docentes ficticios, cada uno con código y correo propios. Puede editar sus datos o desmarcar **Activo para nuevas asignaciones**. Las asignaciones anteriores conservan el nombre y muestran que el docente está inactivo.
2. Entre como Coordinación, busque `TEST-01`, abra el expediente y pulse **Asignar tutores**. Seleccione el primer docente y escriba *Cálculo*. Pulse **Agregar otro tutor**, seleccione el segundo y escriba *Programación*. Guarde las dos asignaciones.
3. Vuelva a entrar como Administración y consulte el expediente. Deben aparecer ambos docentes con sus áreas después de recargar. Coordinación puede retirar una asignación, conservando su fecha y responsable en la base.

## Programar sesión y consultar el calendario

Si su instalación ya tiene docentes y tutores, ejecute desde `infra`:

```powershell
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/003_sesiones_calendario.sql
docker compose up -d --build --wait api
```

Para la primera prueba, use el código de un docente activo que Coordinación haya asignado al expediente y el carné de ese estudiante. Los siguientes comandos muestran las contraseñas de las nuevas cuentas una sola vez. Sustituya `DOC-01` y `TEST-01` por los códigos que registró su equipo.

```powershell
docker compose exec api node crear-personal.mjs tutor@example.test docente DOC-01
docker compose exec api node crear-personal.mjs estudiante@example.test estudiante TEST-01
```

1. Ingrese como docente. En **Mi calendario de tutorías**, pulse **Programar sesión**, elija el estudiante y, si corresponde, otros tutores asignados. Indique fecha, hora de inicio y fin en horario de El Salvador, modalidad y aula o enlace.
2. Guarde y recargue el calendario. El estudiante y los docentes participantes podrán ver la tutoría al ingresar con sus propias cuentas. Use las flechas para cambiar de mes o seleccione un día para filtrar la lista.
3. El docente organizador puede modificar o cancelar la sesión. El sistema rechaza horarios que se superponen para el estudiante o cualquiera de los tutores. Se permite que una tutoría empiece justo cuando termina otra.
4. Al cancelar se libera el horario. La tutoría queda identificada como cancelada en el calendario y en el expediente.

## Pruebas

Desde `infra`, con ambos servicios activos:

```powershell
docker compose exec -T api node --test pruebas/base.test.mjs pruebas/integracion.mjs
```

La prueba de integración aplica las migraciones y los datos de demostración en un esquema aislado. Comprueba expedientes, límites de UV, sesiones, permisos por departamento, edición de docentes, asignaciones múltiples, duplicados y bajas. El esquema de prueba se elimina al terminar.

Desde `pera-frontend`:

```powershell
npm run build
npm test -- --watch=false
```

## Organización

- `pera-frontend/src/app/pages` contiene las pantallas. La comunicación HTTP se centraliza en `services/expedientes.ts`.
- `pera-backend` contiene la sesión, los permisos y la API. La cuenta de desarrollo se genera desde la consola.
- `database` contiene el esquema, la vista de consulta y la función de cálculo de UV.
- `infra` contiene el entorno local de Docker Compose. El despliegue público y los demás roles y procesos PERA corresponden a las siguientes entregas.

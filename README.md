# PERA · Gestión de tutorías y refuerzo académico

Primer módulo del equipo para Administración Académica. Permite iniciar sesión, registrar un expediente, buscar por carné, filtrar por carrera y consultar el detalle. El frontend conserva Angular y los estilos globales del proyecto. La API de Node.js valida las solicitudes y usa PostgreSQL 17.

## Ejecutar en la computadora

Requisitos de desarrollo: Docker Desktop con contenedores Linux y Node.js 24 con npm. Los siguientes comandos parten de la raíz del repositorio.

1. Cree el archivo local `infra/.env` con una línea `POSTGRES_PASSWORD=su_clave_local`. Sustituya el ejemplo por una contraseña propia. Si ya creó el volumen con la configuración original, use su contraseña anterior.
2. Inicie los servicios y aplique el esquema. Los scripts se pueden repetir y conservan los expedientes existentes.

```powershell
cd infra
docker compose up -d --build --wait
docker compose exec -T postgres psql -U pera_user -d pera_db -f /sql/001_expedientes.sql
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
5. Cierre la sesión. El servidor exige autenticación para leer o registrar expedientes. En esta primera entrega el módulo está habilitado para Administración Académica.

## Pruebas

Desde `infra`, con ambos servicios activos:

```powershell
docker compose exec -T api node --test pruebas/base.test.mjs pruebas/integracion.mjs
```

La prueba de integración usa un esquema aislado, aplica los dos scripts, comprueba el alta y el duplicado por HTTP, consulta los límites de UV y verifica el cierre de sesión. El esquema de prueba se elimina al terminar.

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

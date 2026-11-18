\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS departamentos (
    id_departamento integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS carreras (
    id_carrera integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_departamento integer NOT NULL REFERENCES departamentos,
    nombre text NOT NULL,
    UNIQUE (id_departamento, nombre)
);

CREATE TABLE IF NOT EXISTS roles (
    codigo text PRIMARY KEY
);
INSERT INTO roles VALUES ('administracion'), ('coordinacion'), ('jefatura'), ('docente'), ('estudiante')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correo text NOT NULL UNIQUE CHECK (correo = lower(trim(correo))),
    clave_hash text NOT NULL,
    rol text NOT NULL REFERENCES roles(codigo),
    activo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sesiones_acceso (
    token_hash text PRIMARY KEY,
    id_usuario integer NOT NULL REFERENCES usuarios ON DELETE CASCADE,
    expira_en timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS reglas_uv (
    id_regla integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cum_min numeric(4,2) NOT NULL,
    cum_max numeric(4,2) NOT NULL,
    uv_max smallint NOT NULL CHECK (uv_max IN (8, 12, 16)),
    CHECK (cum_min >= 0 AND cum_max <= 10 AND cum_min <= cum_max),
    EXCLUDE USING gist (numrange(cum_min, cum_max, '[]') WITH &&)
);

CREATE OR REPLACE FUNCTION fn_calcular_limite_uv(valor numeric)
RETURNS smallint LANGUAGE sql STABLE AS $$
    SELECT uv_max FROM reglas_uv WHERE valor BETWEEN cum_min AND cum_max
$$;

CREATE TABLE IF NOT EXISTS estudiantes (
    carnet varchar(20) PRIMARY KEY CHECK (carnet ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
    nombre varchar(120) NOT NULL CHECK (length(trim(nombre)) > 0),
    id_carrera integer NOT NULL REFERENCES carreras,
    cum_actual numeric(4,2) NOT NULL CHECK (cum_actual BETWEEN 0 AND 10),
    estado_pera text NOT NULL DEFAULT 'En curso'
        CHECK (estado_pera IN ('En curso', 'Aprobado', 'Reprobado')),
    creado_por integer NOT NULL REFERENCES usuarios,
    creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW vista_expedientes AS
SELECT e.carnet, e.nombre, c.nombre AS carrera, d.nombre AS departamento,
       e.cum_actual::float8 AS cum, fn_calcular_limite_uv(e.cum_actual) AS limite_uv,
       e.estado_pera, e.creado_en
FROM estudiantes e
JOIN carreras c USING (id_carrera)
JOIN departamentos d USING (id_departamento);

COMMIT;

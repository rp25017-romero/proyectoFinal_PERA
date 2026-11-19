\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_departamento integer REFERENCES departamentos;
CREATE TABLE IF NOT EXISTS docentes (
    id_docente integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo varchar(20) NOT NULL UNIQUE CHECK (codigo ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
    nombre varchar(120) NOT NULL CHECK (length(trim(nombre)) > 0),
    correo varchar(254) NOT NULL UNIQUE CHECK (correo = lower(trim(correo))),
    id_departamento integer NOT NULL REFERENCES departamentos,
    activo boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS asignaciones_tutoria (
    id_asignacion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    carnet varchar(20) NOT NULL REFERENCES estudiantes,
    id_docente integer NOT NULL REFERENCES docentes,
    area varchar(120) NOT NULL CHECK (length(trim(area)) > 0),
    asignado_por integer NOT NULL REFERENCES usuarios,
    asignado_en timestamptz NOT NULL DEFAULT now(),
    retirado_por integer REFERENCES usuarios,
    retirado_en timestamptz,
    CHECK ((retirado_por IS NULL) = (retirado_en IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS asignacion_vigente
    ON asignaciones_tutoria (carnet, id_docente, lower(area)) WHERE retirado_en IS NULL;
COMMIT;

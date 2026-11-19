\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_docente integer UNIQUE REFERENCES docentes;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS carnet_estudiante varchar(20) UNIQUE REFERENCES estudiantes;

-- Horarios civiles de El Salvador. Los intervalos [inicio, fin) permiten sesiones consecutivas.
CREATE TABLE IF NOT EXISTS sesiones_tutoria (
    id_sesion integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    carnet varchar(20) NOT NULL REFERENCES estudiantes,
    organizador integer NOT NULL REFERENCES docentes,
    inicio timestamp NOT NULL,
    fin timestamp NOT NULL,
    modalidad text NOT NULL CHECK (modalidad IN ('Presencial','Virtual')),
    ubicacion varchar(300) NOT NULL CHECK (length(trim(ubicacion)) > 0),
    cancelada boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1,
    CHECK (inicio < fin AND inicio::date = fin::date),
    UNIQUE (id_sesion, inicio, fin, cancelada),
    CONSTRAINT horario_alumno EXCLUDE USING gist
        (carnet WITH =, tsrange(inicio,fin,'[)') WITH &&) WHERE (NOT cancelada)
);

CREATE TABLE IF NOT EXISTS participantes_sesion (
    id_sesion integer NOT NULL,
    id_docente integer NOT NULL REFERENCES docentes,
    inicio timestamp NOT NULL,
    fin timestamp NOT NULL,
    cancelada boolean NOT NULL,
    PRIMARY KEY (id_sesion, id_docente),
    FOREIGN KEY (id_sesion,inicio,fin,cancelada) REFERENCES sesiones_tutoria(id_sesion,inicio,fin,cancelada)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT horario_tutor EXCLUDE USING gist
        (id_docente WITH =, tsrange(inicio,fin,'[)') WITH &&) WHERE (NOT cancelada)
);

CREATE OR REPLACE FUNCTION fn_horario_participante() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    SELECT s.inicio,s.fin,s.cancelada INTO STRICT NEW.inicio,NEW.fin,NEW.cancelada
    FROM sesiones_tutoria s WHERE s.id_sesion=NEW.id_sesion;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER trg_validar_horario_docente BEFORE INSERT ON participantes_sesion
    FOR EACH ROW EXECUTE FUNCTION fn_horario_participante();

CREATE OR REPLACE VIEW vista_sesiones AS
SELECT s.id_sesion,s.carnet,e.nombre AS estudiante,s.organizador,s.modalidad,s.ubicacion,s.cancelada,s.version,
       to_char(s.inicio,'YYYY-MM-DD') AS fecha,to_char(s.inicio,'HH24:MI') AS hora_inicio,
       to_char(s.fin,'HH24:MI') AS hora_fin,
       (SELECT jsonb_agg(jsonb_build_object('id_docente',d.id_docente,'nombre',d.nombre) ORDER BY d.nombre,d.id_docente)
        FROM participantes_sesion p JOIN docentes d USING (id_docente) WHERE p.id_sesion=s.id_sesion) AS tutores
FROM sesiones_tutoria s JOIN estudiantes e USING (carnet);
COMMIT;

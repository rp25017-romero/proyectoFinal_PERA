\set ON_ERROR_STOP on
-- Datos para una instalación de demostración.
BEGIN;
INSERT INTO departamentos (nombre) VALUES ('Ingeniería y Arquitectura') ON CONFLICT DO NOTHING;
INSERT INTO carreras (nombre, id_departamento)
SELECT 'Ingeniería de Sistemas Informáticos', id_departamento
FROM departamentos WHERE nombre = 'Ingeniería y Arquitectura'
ON CONFLICT DO NOTHING;

-- Únicamente el valor documentado. Los intervalos oficiales se cargarán por separado.
INSERT INTO reglas_uv (cum_min, cum_max, uv_max)
SELECT 6.50, 6.50, 12 WHERE fn_calcular_limite_uv(6.50) IS NULL;
COMMIT;

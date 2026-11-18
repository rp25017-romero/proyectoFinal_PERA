export function validarExpediente(datos) {
  const { carnet, nombre, id_carrera, cum } = datos;
  if (typeof carnet !== 'string' || !/^[A-Z0-9][A-Z0-9-]{0,19}$/.test(carnet.trim().toUpperCase()))
    return 'Ingrese un carné válido de hasta 20 caracteres.';
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 120)
    return 'Ingrese el nombre del estudiante (máximo 120 caracteres).';
  if (!Number.isInteger(id_carrera) || id_carrera < 1 || id_carrera > 2147483647)
    return 'Seleccione una carrera válida.';
  if (typeof cum !== 'number' || !Number.isFinite(cum) || cum < 0 || cum > 10 ||
      !/^\d+(\.\d{1,2})?$/.test(String(cum)))
    return 'Ingrese un CUM entre 0 y 10, con hasta dos decimales.';
  return null;
}

/**
 * Estimador de costo - version 1 (heuristica).
 *
 * Esto NO es un modelo de IA entrenado todavia: es una regla de negocio
 * transparente que sirve de placeholder funcional para la US-05.
 * Cuando se conecte un modelo real (por ejemplo, clasificando la
 * descripcion y las fotos del problema), esta funcion es el unico
 * lugar que hay que reemplazar - el resto de la app solo llama a
 * estimarCosto() y no le importa como se calcula el numero.
 */
function estimarCosto({ tarifaBase, urgencia, descripcion }) {
  let multiplicador = 1;

  if (urgencia === 'urgente') multiplicador += 0.4;
  if (urgencia === 'baja') multiplicador -= 0.1;

  const longitudDescripcion = (descripcion || '').length;
  if (longitudDescripcion > 200) multiplicador += 0.2; // problema descrito como mas complejo
  else if (longitudDescripcion < 30) multiplicador -= 0.05; // problema simple

  const costo = Math.max(tarifaBase * multiplicador, tarifaBase * 0.5);

  return {
    costo_estimado: Math.round(costo / 50) * 50, // redondeado a multiplos de 50
    detalle: 'Estimacion heuristica basada en categoria, urgencia y complejidad descrita. No sustituye una cotizacion final del tecnico.',
  };
}

module.exports = { estimarCosto };

// Reglas de alerta de temperatura. Sin dependencias del navegador para poder probarlas en Node.

export const AJUSTES_POR_DEFECTO = Object.freeze({
  nombreTecnico: '',
  umbralPrecaucion: 50, // °C: desde este valor se marca en amarillo
  umbralCritico: 70, // °C: desde este valor se marca en rojo
  margenSobreAmbiente: null, // °C sobre la T° ambiente que también marca precaución (vacío = no se usa)
  urlNube: '', // URL de la aplicación web de Google Apps Script (termina en /exec)
  claveNube: '', // clave compartida con el script; se guarda solo en el dispositivo, nunca en el código
});

export const ESTADOS = Object.freeze({
  normal: { id: 'normal', etiqueta: 'Normal' },
  precaucion: { id: 'precaucion', etiqueta: 'Precaución' },
  critico: { id: 'critico', etiqueta: 'Crítico' },
});

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Devuelve el estado de una lectura o null si no hay valor.
 * @param {number|null} valor temperatura medida en °C
 * @param {number|null} ambiente temperatura ambiente en °C
 * @param {typeof AJUSTES_POR_DEFECTO} ajustes
 */
export function estadoTemperatura(valor, ambiente, ajustes) {
  if (!esNumero(valor)) return null;
  if (esNumero(ajustes.umbralCritico) && valor >= ajustes.umbralCritico) return ESTADOS.critico;
  if (esNumero(ajustes.umbralPrecaucion) && valor >= ajustes.umbralPrecaucion) return ESTADOS.precaucion;
  if (esNumero(ajustes.margenSobreAmbiente) && esNumero(ambiente) && valor - ambiente >= ajustes.margenSobreAmbiente) {
    return ESTADOS.precaucion;
  }
  return ESTADOS.normal;
}

/** Cuenta lecturas por estado para un registro completo. */
export function resumenRegistro(registro, estacion, ajustes) {
  const resumen = { total: 0, medidas: 0, normal: 0, precaucion: 0, critico: 0, maxima: null };
  for (const seccion of estacion.secciones) {
    for (const polea of seccion.poleas) {
      resumen.total++;
      const valor = registro.lecturas[polea.celda];
      const estado = estadoTemperatura(valor, registro.temperaturaAmbiente, ajustes);
      if (!estado) continue;
      resumen.medidas++;
      resumen[estado.id]++;
      if (resumen.maxima === null || valor > resumen.maxima.valor) {
        resumen.maxima = { valor, nombre: polea.nombre, seccion: seccion.titulo };
      }
    }
  }
  return resumen;
}

/** Valida que los umbrales tengan sentido antes de guardarlos. Devuelve lista de errores. */
export function validarAjustes(a) {
  const errores = [];
  if (!esNumero(a.umbralPrecaucion)) errores.push('Ingresa el umbral de precaución.');
  if (!esNumero(a.umbralCritico)) errores.push('Ingresa el umbral crítico.');
  if (esNumero(a.umbralPrecaucion) && esNumero(a.umbralCritico) && a.umbralCritico <= a.umbralPrecaucion) {
    errores.push('El umbral crítico debe ser mayor que el de precaución.');
  }
  if (a.margenSobreAmbiente !== null && (!esNumero(a.margenSobreAmbiente) || a.margenSobreAmbiente <= 0)) {
    errores.push('El margen sobre ambiente debe ser un número mayor que 0, o quedar vacío.');
  }
  return errores;
}

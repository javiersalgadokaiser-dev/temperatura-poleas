// Arma el contenido que se envía a Google Sheets. Sin dependencias del navegador (se prueba en Node).
// El orden de las columnas debe coincidir con google-apps-script/Codigo.gs.
import { estadoTemperatura, resumenRegistro } from './alertas.js';

const PREFIJO_URL = 'https://script.google.com/';

/** Valida la URL de la aplicación web de Apps Script. Devuelve un mensaje de error o ''. */
export function validarUrlNube(url) {
  if (!url) return '';
  if (!url.startsWith(PREFIJO_URL)) return 'La URL debe comenzar con https://script.google.com/';
  if (!/\/exec$/.test(url)) return 'Usa la URL de la "aplicación web": termina en /exec (no la del editor).';
  return '';
}

export const nubeConfigurada = (ajustes) => !!(ajustes.urlNube && ajustes.claveNube && !validarUrlNube(ajustes.urlNube));

export function construirEnvio(registro, estacion, ajustes) {
  const r = resumenRegistro(registro, estacion, ajustes);
  const mediciones = [];
  for (const seccion of estacion.secciones) {
    for (const polea of seccion.poleas) {
      const valor = registro.lecturas[polea.celda];
      if (typeof valor !== 'number') continue;
      const estado = estadoTemperatura(valor, registro.temperaturaAmbiente, ajustes);
      mediciones.push([
        registro.id, registro.fecha, registro.hora, estacion.nombre, registro.nombre,
        seccion.titulo, polea.nombre, polea.celda, valor, estado?.etiqueta ?? '',
      ]);
    }
  }
  return {
    accion: 'guardar',
    clave: ajustes.claveNube,
    registro: [
      registro.id, registro.fecha, registro.hora, estacion.nombre, registro.nombre,
      registro.temperaturaAmbiente ?? '', registro.velocidad ?? '',
      r.medidas, r.total, r.precaucion, r.critico,
      r.maxima?.valor ?? '', r.maxima ? `${r.maxima.seccion} · ${r.maxima.nombre}` : '',
      registro.observaciones || '',
    ],
    mediciones,
  };
}

/** Codifica la configuración de la nube para compartirla por enlace entre los equipos del equipo de trabajo. */
export function codificarConfiguracion({ urlNube, claveNube }) {
  const json = JSON.stringify({ u: urlNube, k: claveNube });
  const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodificarConfiguracion(codigo) {
  const base64 = codigo.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const { u, k } = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof u !== 'string' || typeof k !== 'string' || validarUrlNube(u)) throw new Error('El enlace de configuración no es válido.');
  return { urlNube: u, claveNube: k };
}

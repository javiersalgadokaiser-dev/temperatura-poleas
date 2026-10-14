// Envío de registros a Google Sheets (Apps Script) con cola: si no hay señal, se reintenta después.
import { ESTACIONES } from './estaciones.js';
import { registros as repo } from './db.js';
import { construirEnvio, nubeConfigurada } from '../logica/nube.js';

const TIEMPO_MAXIMO_MS = 30000;

/** POST a la aplicación web. Se usa text/plain para evitar la petición previa CORS que Apps Script no admite. */
export async function llamarNube(url, cuerpo) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_MAXIMO_MS);
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(cuerpo),
      redirect: 'follow',
      signal: control.signal,
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Google no respondió a tiempo.' : 'Sin conexión con Google.');
  } finally {
    clearTimeout(temporizador);
  }
  if (!respuesta.ok) throw new Error(`Google respondió con error ${respuesta.status}.`);
  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error('Respuesta inesperada. Revisa que la implementación tenga acceso "Cualquier usuario".');
  }
  if (!datos.ok) throw new Error(datos.error || 'Google rechazó el envío.');
  return datos;
}

export const probarConexion = (ajustes) => llamarNube(ajustes.urlNube, { accion: 'ping', clave: ajustes.claveNube });

/** Registros finalizados que nunca se enviaron o que cambiaron después de enviarse. */
export const estaPendiente = (r) => r.estado === 'completo' && (r.pendienteNube || !r.enviadoNubeEn);

export async function pendientesDeEnvio() {
  return (await repo.listar()).filter(estaPendiente);
}

let enCurso = null;

/**
 * Envía todos los pendientes. Nunca lanza error: devuelve un resumen.
 * Si ya hay un envío en curso, devuelve ese mismo.
 */
export function sincronizar(ajustes) {
  if (!nubeConfigurada(ajustes)) return Promise.resolve({ configurada: false, enviados: 0, fallidos: 0, error: null });
  enCurso ??= (async () => {
    const resultado = { configurada: true, enviados: 0, fallidos: 0, error: null };
    for (const registro of await pendientesDeEnvio()) {
      const estacion = ESTACIONES.find((e) => e.id === registro.estacionId);
      if (!estacion) continue;
      try {
        const marcaEnvio = registro.actualizadoEn;
        await llamarNube(ajustes.urlNube, construirEnvio(registro, estacion, ajustes));
        // Si el técnico editó el registro mientras se enviaba, queda pendiente para el próximo envío
        const actual = await repo.obtener(registro.id);
        if (actual && actual.actualizadoEn === marcaEnvio) {
          actual.pendienteNube = false;
          actual.enviadoNubeEn = new Date().toISOString();
          await repo.guardar(actual, { conservarFecha: true });
        }
        resultado.enviados++;
      } catch (e) {
        resultado.fallidos++;
        resultado.error = e.message;
        if (/conexión|a tiempo/.test(e.message)) break; // sin señal: no tiene sentido seguir intentando
      }
    }
    return resultado;
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

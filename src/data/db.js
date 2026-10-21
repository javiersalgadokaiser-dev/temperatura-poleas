// Repositorio local con IndexedDB: los registros quedan guardados en el dispositivo y funcionan sin conexión.
import { AJUSTES_POR_DEFECTO } from '../logica/alertas.js';

const NOMBRE_BD = 'temperatura-poleas';
const VERSION_BD = 1;
let conexion = null;

function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((resolve, reject) => {
    const peticion = indexedDB.open(NOMBRE_BD, VERSION_BD);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      const registros = bd.createObjectStore('registros', { keyPath: 'id' });
      registros.createIndex('estacion', 'estacionId');
      bd.createObjectStore('ajustes');
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(new Error('No se pudo abrir la base de datos local.'));
    peticion.onblocked = () => reject(new Error('Cierra otras pestañas de la app y vuelve a intentarlo.'));
  });
  return conexion;
}

/** Ejecuta una operación dentro de una transacción y devuelve su resultado como promesa. */
async function operar(almacen, modo, accion) {
  const bd = await abrir();
  return new Promise((resolve, reject) => {
    const tx = bd.transaction(almacen, modo);
    const peticion = accion(tx.objectStore(almacen));
    tx.oncomplete = () => resolve(peticion?.result);
    tx.onerror = () => reject(tx.error || new Error('Error al acceder a los datos locales.'));
    tx.onabort = () => reject(tx.error || new Error('La operación fue cancelada (¿espacio insuficiente?).'));
  });
}

export const nuevoId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const registros = {
  async listar() {
    const todos = (await operar('registros', 'readonly', (s) => s.getAll())) || [];
    // Más recientes primero
    return todos.sort((a, b) => `${b.fecha}${b.hora}${b.actualizadoEn}`.localeCompare(`${a.fecha}${a.hora}${a.actualizadoEn}`));
  },
  obtener: (id) => operar('registros', 'readonly', (s) => s.get(id)),
  /** conservarFecha: para cambios internos (p. ej. marcar como enviado) que no son ediciones del técnico. */
  guardar(registro, { conservarFecha = false } = {}) {
    if (!conservarFecha || !registro.actualizadoEn) registro.actualizadoEn = new Date().toISOString();
    return operar('registros', 'readwrite', (s) => s.put(registro));
  },
  eliminar: (id) => operar('registros', 'readwrite', (s) => s.delete(id)),
  async importar(lista) {
    return operar('registros', 'readwrite', (s) => {
      lista.forEach((r) => s.put(r));
    });
  },
};

export const ajustes = {
  async obtener() {
    const guardados = await operar('ajustes', 'readonly', (s) => s.get('principal'));
    return { ...AJUSTES_POR_DEFECTO, ...(guardados || {}) };
  },
  guardar: (valores) => operar('ajustes', 'readwrite', (s) => s.put(valores, 'principal')),
};

/** Caché de datos descargados (p. ej. el historial de Google Sheets) para verlos sin conexión. */
export const cache = {
  obtener: (clave) => operar('ajustes', 'readonly', (s) => s.get(`cache:${clave}`)),
  guardar: (clave, valor) => operar('ajustes', 'readwrite', (s) => s.put(valor, `cache:${clave}`)),
};

/** Pide al navegador que no borre los datos automáticamente cuando falte espacio. */
export async function solicitarAlmacenamientoPersistente() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* No es crítico: algunos navegadores no lo soportan */
  }
}

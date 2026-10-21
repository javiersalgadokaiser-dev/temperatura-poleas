// Utilidades de interfaz compartidas por las vistas.

/** Escapa texto para insertarlo de forma segura en HTML. */
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const horaActual = () => new Date().toTimeString().slice(0, 5);

/** Convierte "45,5" o "45.5" en número; devuelve null si está vacío y NaN si no es válido. */
export function leerNumero(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  if (t === '') return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export const formatoTemp = (v) => (typeof v === 'number' ? `${v.toLocaleString('es-CL', { maximumFractionDigits: 1 })} °C` : '—');

export function debounce(fn, ms) {
  let t;
  const envuelta = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  envuelta.ahora = (...args) => {
    clearTimeout(t);
    return fn(...args);
  };
  return envuelta;
}

/** Mensaje breve en la parte inferior. Acepta una acción opcional {texto, alPulsar}. */
export function aviso(mensaje, { tipo = 'info', accion = null, duracion = 3500 } = {}) {
  const zona = $('#avisos');
  const el = document.createElement('div');
  el.className = `aviso aviso--${tipo}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span>${esc(mensaje)}</span>`;
  if (accion) {
    const boton = document.createElement('button');
    boton.className = 'boton boton--texto';
    boton.textContent = accion.texto;
    boton.addEventListener('click', () => {
      el.remove();
      accion.alPulsar();
    });
    el.append(boton);
  }
  zona.append(el);
  if (duracion) setTimeout(() => el.remove(), duracion);
}

/**
 * Diálogo modal dentro de la página (el visor no permite confirm()).
 * @param {{titulo:string, cuerpo:string, botones:{texto:string, valor:any, estilo?:string}[]}} opciones
 * @returns {Promise<any>} valor del botón pulsado, o null si se cierra
 */
export function dialogo({ titulo, cuerpo, botones }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialogo';
    d.innerHTML = `
      <h2 class="dialogo__titulo">${esc(titulo)}</h2>
      <div class="dialogo__cuerpo">${cuerpo}</div>
      <div class="dialogo__acciones"></div>`;
    const acciones = $('.dialogo__acciones', d);
    botones.forEach((b) => {
      const boton = document.createElement('button');
      boton.className = `boton ${b.estilo || 'boton--texto'}`;
      boton.textContent = b.texto;
      boton.addEventListener('click', () => {
        resolve(b.valor);
        d.close();
      });
      acciones.append(boton);
    });
    d.addEventListener('cancel', () => resolve(null));
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
  });
}

export const confirmar = (titulo, cuerpo, textoSi = 'Aceptar', peligro = false) =>
  dialogo({
    titulo,
    cuerpo: `<p>${esc(cuerpo)}</p>`,
    botones: [
      { texto: 'Cancelar', valor: false },
      { texto: textoSi, valor: true, estilo: peligro ? 'boton--peligro' : 'boton--relleno' },
    ],
  });

/** Descarga un archivo generado en el navegador. */
export function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const puedeCompartirArchivos = (archivo) => !!navigator.canShare?.({ files: [archivo] });

/**
 * Ofrece descargar o compartir (WhatsApp, correo, etc.) un archivo ya generado.
 * Se hace en un diálogo para que "Compartir" se ejecute con un toque reciente del usuario.
 */
export async function entregarArchivo(blob, nombre, titulo = 'Archivo listo') {
  const archivo = new File([blob], nombre, { type: blob.type });
  const compartir = puedeCompartirArchivos(archivo);
  const eleccion = await dialogo({
    titulo,
    cuerpo: `<p class="archivo-listo">📄 ${esc(nombre)}</p>`,
    botones: [
      { texto: 'Cerrar', valor: null },
      ...(compartir ? [{ texto: 'Compartir', valor: 'compartir', estilo: 'boton--tonal' }] : []),
      { texto: 'Descargar', valor: 'descargar', estilo: 'boton--relleno' },
    ],
  });
  if (eleccion === 'descargar') descargar(blob, nombre);
  if (eleccion === 'compartir') {
    try {
      await navigator.share({ files: [archivo], title: nombre });
    } catch (e) {
      if (e.name !== 'AbortError') aviso('No se pudo compartir. Usa "Descargar".', { tipo: 'error' });
    }
  }
}

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const blobExcel = (buffer) => new Blob([buffer], { type: TIPO_XLSX });

const cargasEnCurso = new Map();
/** Carga una librería de vendor/ solo cuando se necesita y devuelve la variable global que define. */
function cargarLibreria(src, global, mensajeError) {
  if (window[global]) return Promise.resolve(window[global]);
  if (!cargasEnCurso.has(src)) {
    cargasEnCurso.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(window[global]);
      s.onerror = () => {
        cargasEnCurso.delete(src);
        s.remove();
        reject(new Error(mensajeError));
      };
      document.head.append(s);
    }));
  }
  return cargasEnCurso.get(src);
}

/** ExcelJS pesa ~1 MB: se carga al exportar. */
export const cargarExcelJS = () =>
  cargarLibreria('vendor/exceljs.min.js', 'ExcelJS', 'No se pudo cargar el generador de Excel. Abre la app con conexión una vez para guardarlo.');

/** Chart.js: se carga al abrir la pestaña de gráficos. */
export const cargarChartJS = () =>
  cargarLibreria('vendor/chart.umd.min.js', 'Chart', 'No se pudo cargar la librería de gráficos. Abre la app con conexión una vez para guardarla.');

let plantillaCache = null;
export async function obtenerPlantilla() {
  if (plantillaCache) return plantillaCache;
  const r = await fetch('plantilla/registro-temperatura.xlsx');
  if (!r.ok) throw new Error('No se encontró la plantilla Excel.');
  plantillaCache = await r.arrayBuffer();
  return plantillaCache;
}

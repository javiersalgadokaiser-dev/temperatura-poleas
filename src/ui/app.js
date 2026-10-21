// Punto de entrada: enrutador por hash, navegación inferior y registro del service worker.
import { solicitarAlmacenamientoPersistente } from '../data/db.js';
import { app } from './estado.js';
import { $, $$, aviso, esc } from './utilidades.js';
import { vistaInicio } from './vista-inicio.js';
import { vistaRegistro, vistaNuevoRegistro } from './vista-registro.js';
import { vistaHistorial } from './vista-historial.js';
import { vistaAjustes, vistaConfigurarNube } from './vista-ajustes.js';
import { vistaGraficos } from './vista-graficos.js';

const RUTAS = [
  { patron: /^\/$/, vista: vistaInicio, seccion: 'inicio' },
  { patron: /^\/nuevo\/(\w+)$/, vista: vistaNuevoRegistro, seccion: 'inicio' },
  { patron: /^\/registro\/([\w-]+)$/, vista: vistaRegistro, seccion: 'historial' },
  { patron: /^\/historial$/, vista: vistaHistorial, seccion: 'historial' },
  { patron: /^\/graficos$/, vista: vistaGraficos, seccion: 'graficos' },
  { patron: /^\/ajustes$/, vista: vistaAjustes, seccion: 'ajustes' },
  { patron: /^\/configurar\/([\w-]+)$/, vista: vistaConfigurarNube, seccion: 'ajustes' },
];

let limpiarVistaAnterior = null;
let navegacionActual = 0;

async function enrutar() {
  const ruta = location.hash.slice(1) || '/';
  const coincidencia = RUTAS.map((r) => ({ r, m: ruta.match(r.patron) })).find((x) => x.m);
  const navegacion = ++navegacionActual;

  const limpiar = limpiarVistaAnterior;
  limpiarVistaAnterior = null;
  if (typeof limpiar === 'function') await limpiar();
  if (navegacion !== navegacionActual) return; // el usuario ya navegó a otra pantalla

  if (!coincidencia) {
    app.navegar('/', { reemplazar: true });
    return;
  }
  $$('.nav__item').forEach((a) => a.toggleAttribute('aria-current', a.dataset.seccion === coincidencia.r.seccion));
  // El formulario de registro usa toda la pantalla, sin barra inferior
  document.body.classList.toggle('sin-nav', coincidencia.r.patron.source.includes('registro'));

  // Cada pantalla dibuja en su propio contenedor: si termina de cargar cuando el usuario ya se fue,
  // escribe en un elemento desconectado y no pisa la pantalla nueva.
  const vista = $('#vista');
  const contenedor = document.createElement('div');
  vista.replaceChildren(contenedor);
  vista.setAttribute('aria-busy', 'true');
  window.scrollTo(0, 0);
  try {
    const limpieza = await coincidencia.r.vista(contenedor, ...coincidencia.m.slice(1));
    if (navegacion === navegacionActual) limpiarVistaAnterior = limpieza;
    else if (typeof limpieza === 'function') await limpieza(); // pantalla abandonada mientras cargaba
  } catch (e) {
    console.error(e);
    if (navegacion !== navegacionActual) return;
    contenedor.innerHTML = `
      <section class="pagina">
        <div class="vacio" role="alert">
          <p><strong>Algo salió mal.</strong></p>
          <p>${esc(e.message)}</p>
          <a class="boton boton--relleno" href="#/">Volver al inicio</a>
        </div>
      </section>`;
  } finally {
    if (navegacion === navegacionActual) vista.removeAttribute('aria-busy');
  }
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // En la primera visita no hay controlador previo: ese cambio no es una "actualización"
  const habiaVersionAnterior = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker no registrado:', e));
  let recargando = false;
  // Cuando se instala una versión nueva de la app, se ofrece recargar (los datos ya están guardados)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando || !habiaVersionAnterior) return;
    aviso('Hay una nueva versión de la app.', {
      duracion: 0,
      accion: { texto: 'Actualizar', alPulsar: () => { recargando = true; location.reload(); } },
    });
  });
}

async function iniciar() {
  try {
    await app.recargarAjustes();
  } catch (e) {
    $('#vista').innerHTML = `<section class="pagina"><div class="vacio" role="alert">
      <p><strong>No se puede guardar información en este navegador.</strong></p>
      <p>${esc(e.message)} Revisa que no estés en modo incógnito.</p></div></section>`;
    return;
  }
  solicitarAlmacenamientoPersistente();
  window.addEventListener('hashchange', enrutar);
  await enrutar();
  registrarServiceWorker();

  // Envío automático a Google Sheets: al abrir, al recuperar la señal y al volver a la app
  app.sincronizar();
  window.addEventListener('online', () => app.sincronizar());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && app.sincronizar());
}

iniciar();

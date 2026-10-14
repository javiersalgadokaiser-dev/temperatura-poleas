// Ajustes: técnico por defecto, umbrales de alerta y respaldo de datos.
import { registros as repo } from '../data/db.js';
import { probarConexion, pendientesDeEnvio } from '../data/nube.js';
import { AJUSTES_POR_DEFECTO, validarAjustes } from '../logica/alertas.js';
import { validarUrlNube, nubeConfigurada, codificarConfiguracion, decodificarConfiguracion } from '../logica/nube.js';
import { app } from './estado.js';
import { $, esc, aviso, leerNumero, descargar, hoyISO, confirmar, dialogo } from './utilidades.js';

const numero = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : '');

export async function vistaAjustes(contenedor) {
  const a = app.ajustes;
  contenedor.innerHTML = `
    <section class="pagina">
      <header class="encabezado">
        <h1 class="encabezado__titulo">Ajustes</h1>
      </header>

      <form id="form-ajustes" class="tarjeta" novalidate>
        <h2 class="tarjeta__titulo">Técnico</h2>
        <div class="campo">
          <label for="a-nombre">Nombre por defecto en nuevos registros</label>
          <input id="a-nombre" name="nombreTecnico" type="text" autocomplete="name" value="${esc(a.nombreTecnico)}">
        </div>

        <h2 class="tarjeta__titulo">Alertas de temperatura</h2>
        <div class="rejilla">
          <div class="campo">
            <label for="a-precaucion"><span class="punto punto--precaucion" aria-hidden="true"></span>Precaución desde</label>
            <div class="campo__entrada">
              <input id="a-precaucion" name="umbralPrecaucion" type="text" inputmode="decimal" value="${numero(a.umbralPrecaucion)}">
              <span class="unidad" aria-hidden="true">°C</span>
            </div>
          </div>
          <div class="campo">
            <label for="a-critico"><span class="punto punto--critico" aria-hidden="true"></span>Crítico desde</label>
            <div class="campo__entrada">
              <input id="a-critico" name="umbralCritico" type="text" inputmode="decimal" value="${numero(a.umbralCritico)}">
              <span class="unidad" aria-hidden="true">°C</span>
            </div>
          </div>
          <div class="campo">
            <label for="a-margen">Precaución si supera al ambiente en</label>
            <div class="campo__entrada">
              <input id="a-margen" name="margenSobreAmbiente" type="text" inputmode="decimal" placeholder="Opcional" value="${numero(a.margenSobreAmbiente)}">
              <span class="unidad" aria-hidden="true">°C</span>
            </div>
          </div>
        </div>
        <p class="ayuda">Ejemplo: con margen de 30 °C y ambiente de 10 °C, una polea a 40 °C se marca en precaución.</p>
        <div id="errores-ajustes" class="campo__error" role="alert"></div>
        <div class="acciones">
          <button type="button" class="boton boton--texto" id="btn-restablecer">Valores por defecto</button>
          <button type="submit" class="boton boton--relleno">Guardar ajustes</button>
        </div>
      </form>

      <form id="form-nube" class="tarjeta" novalidate>
        <h2 class="tarjeta__titulo">Copia en Google Sheets</h2>
        <p class="ayuda">Cada registro finalizado se envía a tu planilla de Google. Si no hay señal, queda en cola y se envía solo al volver la conexión.</p>
        <div class="campo">
          <label for="n-url">URL de la aplicación web (termina en /exec)</label>
          <input id="n-url" name="urlNube" type="text" inputmode="url" autocomplete="off" spellcheck="false"
            placeholder="https://script.google.com/macros/s/…/exec" value="${esc(a.urlNube)}">
        </div>
        <div class="campo">
          <label for="n-clave">Clave</label>
          <input id="n-clave" name="claveNube" type="password" autocomplete="off" value="${esc(a.claveNube)}">
        </div>
        <p id="estado-nube" class="ayuda" aria-live="polite"></p>
        <div id="errores-nube" class="campo__error" role="alert"></div>
        <div class="acciones">
          <button type="button" class="boton boton--texto" id="btn-compartir-config" ${nubeConfigurada(a) ? '' : 'hidden'}>Compartir configuración</button>
          <button type="submit" class="boton boton--relleno">Guardar y probar</button>
        </div>
      </form>

      <section class="tarjeta">
        <h2 class="tarjeta__titulo">Respaldo de datos</h2>
        <p class="ayuda">Los registros se guardan solo en este equipo. Descarga un respaldo periódicamente o para pasar los datos a otro dispositivo.</p>
        <div class="acciones">
          <label class="boton boton--texto" for="archivo-respaldo">Restaurar respaldo</label>
          <input id="archivo-respaldo" type="file" accept="application/json,.json" class="oculto-visual">
          <button type="button" class="boton boton--tonal" id="btn-respaldo">Descargar respaldo</button>
        </div>
      </section>

      <p class="ayuda version">Temperatura poleas · v1.1.0</p>
    </section>`;

  const form = $('#form-ajustes', contenedor);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const datos = new FormData(form);
    const nuevos = {
      nombreTecnico: String(datos.get('nombreTecnico') || '').trim(),
      umbralPrecaucion: leerNumero(datos.get('umbralPrecaucion')),
      umbralCritico: leerNumero(datos.get('umbralCritico')),
      margenSobreAmbiente: leerNumero(datos.get('margenSobreAmbiente')),
    };
    const errores = validarAjustes(nuevos);
    $('#errores-ajustes', contenedor).innerHTML = errores.map(esc).join('<br>');
    if (errores.length) return;
    try {
      await app.guardarAjustes(nuevos);
      aviso('Ajustes guardados.');
    } catch (e) {
      aviso(`No se pudieron guardar: ${e.message}`, { tipo: 'error' });
    }
  });

  $('#btn-restablecer', contenedor).addEventListener('click', () => {
    form.umbralPrecaucion.value = numero(AJUSTES_POR_DEFECTO.umbralPrecaucion);
    form.umbralCritico.value = numero(AJUSTES_POR_DEFECTO.umbralCritico);
    form.margenSobreAmbiente.value = '';
    aviso('Valores restablecidos. Pulsa "Guardar ajustes" para aplicarlos.');
  });

  // ---------- Google Sheets ----------
  const formNube = $('#form-nube', contenedor);
  const estadoNube = $('#estado-nube', contenedor);
  const pintarEstadoNube = async () => {
    if (!nubeConfigurada(app.ajustes)) {
      estadoNube.textContent = 'Sin configurar: los registros quedan solo en este equipo.';
      return;
    }
    const n = (await pendientesDeEnvio()).length;
    estadoNube.textContent = n ? `Configurada · ${n} registro${n > 1 ? 's' : ''} pendiente${n > 1 ? 's' : ''} de envío.` : 'Configurada · todo enviado.';
  };
  pintarEstadoNube();
  const alActualizarNube = () => pintarEstadoNube();
  document.addEventListener('nube:actualizada', alActualizarNube);

  formNube.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const urlNube = formNube.urlNube.value.trim();
    const claveNube = formNube.claveNube.value.trim();
    const errores = [];
    const errorUrl = validarUrlNube(urlNube);
    if (errorUrl) errores.push(errorUrl);
    if (urlNube && !claveNube) errores.push('Escribe la clave que pusiste en el script de Google.');
    $('#errores-nube', contenedor).innerHTML = errores.map(esc).join('<br>');
    if (errores.length) return;

    const boton = formNube.querySelector('[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Probando…';
    try {
      await app.guardarAjustes({ urlNube, claveNube });
      $('#btn-compartir-config', contenedor).hidden = !nubeConfigurada(app.ajustes);
      if (!urlNube) {
        aviso('Copia en Google Sheets desactivada.');
        return;
      }
      const r = await probarConexion(app.ajustes);
      aviso(`Conectado con la planilla "${r.planilla}".`);
      await app.sincronizar({ silencioso: false });
    } catch (e) {
      $('#errores-nube', contenedor).textContent = `Guardado, pero la prueba falló: ${e.message}`;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Guardar y probar';
      pintarEstadoNube();
    }
  });

  $('#btn-compartir-config', contenedor).addEventListener('click', async () => {
    const enlace = `${location.origin}${location.pathname}#/configurar/${codificarConfiguracion(app.ajustes)}`;
    const ok = await confirmar(
      'Compartir configuración',
      'Se generará un enlace para configurar Google Sheets en otro teléfono con un toque. El enlace incluye la clave: compártelo solo con tu equipo.',
      'Continuar',
    );
    if (!ok) return;
    const eleccion = await dialogo({
      titulo: 'Enlace de configuración',
      cuerpo: `<p class="enlace-config">${esc(enlace)}</p>`,
      botones: [
        { texto: 'Cerrar', valor: null },
        ...(navigator.share ? [{ texto: 'Compartir', valor: 'compartir', estilo: 'boton--tonal' }] : []),
        { texto: 'Copiar', valor: 'copiar', estilo: 'boton--relleno' },
      ],
    });
    try {
      if (eleccion === 'copiar') {
        await navigator.clipboard.writeText(enlace);
        aviso('Enlace copiado.');
      } else if (eleccion === 'compartir') {
        await navigator.share({ title: 'Configuración Temperatura poleas', url: enlace });
      }
    } catch (e) {
      if (e.name !== 'AbortError') aviso('No se pudo copiar. Mantén presionado el enlace para copiarlo.', { tipo: 'error' });
    }
  });

  $('#btn-respaldo', contenedor).addEventListener('click', async () => {
    const respaldo = { app: 'temperatura-poleas', version: 1, creado: new Date().toISOString(), ajustes: app.ajustes, registros: await repo.listar() };
    descargar(new Blob([JSON.stringify(respaldo, null, 2)], { type: 'application/json' }), `respaldo-temperatura-poleas-${hoyISO()}.json`);
  });

  $('#archivo-respaldo', contenedor).addEventListener('change', async (ev) => {
    const archivo = ev.target.files[0];
    ev.target.value = '';
    if (!archivo) return;
    try {
      const datos = JSON.parse(await archivo.text());
      if (datos.app !== 'temperatura-poleas' || !Array.isArray(datos.registros)) throw new Error('El archivo no es un respaldo de esta app.');
      const validos = datos.registros.filter((r) => r && r.id && r.estacionId && typeof r.lecturas === 'object');
      const ok = await confirmar('Restaurar respaldo', `Se importarán ${validos.length} registros. Los que tengan el mismo identificador se reemplazarán.`, 'Importar');
      if (!ok) return;
      await repo.importar(validos);
      aviso(`${validos.length} registros importados.`);
    } catch (e) {
      aviso(e instanceof SyntaxError ? 'El archivo está dañado o no es JSON.' : e.message, { tipo: 'error', duracion: 6000 });
    }
  });

  return () => document.removeEventListener('nube:actualizada', alActualizarNube);
}

/** Abre un enlace de configuración compartido (#/configurar/<código>) y lo aplica tras confirmar. */
export async function vistaConfigurarNube(contenedor, codigo) {
  let config;
  try {
    config = decodificarConfiguracion(codigo);
  } catch {
    aviso('El enlace de configuración no es válido o está incompleto.', { tipo: 'error', duracion: 6000 });
    return app.navegar('/ajustes', { reemplazar: true });
  }
  const ok = await confirmar(
    'Configurar Google Sheets',
    'Este enlace activa el envío de los registros de este teléfono a la planilla de Google de tu equipo. ¿Aplicar?',
    'Aplicar',
  );
  if (ok) {
    await app.guardarAjustes(config);
    aviso('Configuración aplicada.');
    app.sincronizar();
  }
  app.navegar('/ajustes', { reemplazar: true });
}

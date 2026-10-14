// Formulario de registro: datos generales + temperatura de cada polea, con autoguardado.
import { registros as repo, nuevoId } from '../data/db.js';
import { estadoTemperatura, resumenRegistro } from '../logica/alertas.js';
import { crearExcelRegistro, nombreArchivoRegistro, fechaLegible } from '../logica/exportar-excel.js';
import { app } from './estado.js';
import {
  $, $$, esc, aviso, debounce, dialogo, confirmar, leerNumero, formatoTemp, hoyISO, horaActual,
  cargarExcelJS, obtenerPlantilla, blobExcel, entregarArchivo,
} from './utilidades.js';
import { estacionPorId, totalPuntos } from './componentes.js';

const RANGO = { min: -40, max: 250 }; // °C aceptados para evitar errores de tipeo
const VELOCIDADES = [3, 4, 5];

/** Crea un registro nuevo (o propone continuar un borrador de hoy) y redirige al formulario. */
export async function vistaNuevoRegistro(contenedor, estacionId) {
  const estacion = estacionPorId(estacionId);
  if (!estacion) throw new Error('La estación no existe.');

  const borrador = (await repo.listar()).find(
    (r) => r.estacionId === estacionId && r.estado !== 'completo' && r.fecha === hoyISO(),
  );
  if (borrador) {
    const eleccion = await dialogo({
      titulo: `Borrador de ${estacion.nombre}`,
      cuerpo: `<p>Ya tienes un registro de hoy sin finalizar (${esc(borrador.hora)}). ¿Quieres continuarlo?</p>`,
      botones: [
        { texto: 'Crear otro', valor: 'nuevo' },
        { texto: 'Continuar', valor: 'continuar', estilo: 'boton--relleno' },
      ],
    });
    if (eleccion === 'continuar') return app.navegar(`/registro/${borrador.id}`, { reemplazar: true });
    if (eleccion === null) return app.navegar('/', { reemplazar: true });
  }

  const registro = {
    id: nuevoId(),
    estacionId,
    nombre: app.ajustes.nombreTecnico || '',
    fecha: hoyISO(),
    hora: horaActual(),
    temperaturaAmbiente: null,
    velocidad: null,
    lecturas: {},
    observaciones: '',
    estado: 'borrador',
    creadoEn: new Date().toISOString(),
  };
  await repo.guardar(registro);
  app.navegar(`/registro/${registro.id}`, { reemplazar: true });
}

export async function vistaRegistro(contenedor, id) {
  const registro = await repo.obtener(id);
  if (!registro) throw new Error('No se encontró el registro. Puede que haya sido eliminado.');
  const estacion = estacionPorId(registro.estacionId);
  const ajustes = app.ajustes;
  const total = totalPuntos(estacion);

  contenedor.innerHTML = plantillaFormulario(registro, estacion, total);
  const form = $('#form-registro', contenedor);
  const estadoGuardado = $('#estado-guardado', contenedor);

  // ---------- Guardado automático ----------
  let pendiente = false;
  const guardar = debounce(async () => {
    try {
      await repo.guardar(registro);
      pendiente = false;
      estadoGuardado.textContent = `Guardado ${new Date().toTimeString().slice(0, 5)}`;
    } catch (e) {
      estadoGuardado.textContent = 'Sin guardar';
      aviso(`No se pudo guardar: ${e.message}`, { tipo: 'error', duracion: 6000 });
    }
  }, 500);
  const marcarCambio = () => {
    pendiente = true;
    // Un registro ya finalizado que se corrige debe volver a enviarse a Google Sheets
    if (registro.estado === 'completo') registro.pendienteNube = true;
    estadoGuardado.textContent = 'Guardando…';
    guardar();
  };
  const guardarYa = () => (pendiente ? guardar.ahora() : Promise.resolve());
  const alOcultar = () => document.visibilityState === 'hidden' && guardarYa();
  document.addEventListener('visibilitychange', alOcultar);

  // ---------- Pintar estado de cada lectura ----------
  const pintarLectura = (celda) => {
    const fila = $(`.medicion[data-celda="${celda}"]`, form);
    const estado = estadoTemperatura(registro.lecturas[celda], registro.temperaturaAmbiente, ajustes);
    fila.dataset.estado = estado?.id ?? 'vacio';
    $('.medicion__estado', fila).textContent = estado && estado.id !== 'normal' ? estado.etiqueta : '';
  };
  const actualizarProgreso = () => {
    const r = resumenRegistro(registro, estacion, ajustes);
    $('#progreso-texto', contenedor).textContent = `${r.medidas} de ${total}`;
    $('#progreso-barra', contenedor).value = r.medidas;
    $('#progreso-alertas', contenedor).innerHTML =
      (r.critico ? `<span class="chip chip--critico">${r.critico} crítica${r.critico > 1 ? 's' : ''}</span>` : '') +
      (r.precaucion ? `<span class="chip chip--precaucion">${r.precaucion} precaución</span>` : '');
    $$('.seccion', form).forEach((sec) => {
      const celdas = $$('.medicion', sec).map((m) => m.dataset.celda);
      const hechas = celdas.filter((c) => typeof registro.lecturas[c] === 'number').length;
      $('.seccion__contador', sec).textContent = `${hechas}/${celdas.length}`;
      sec.classList.toggle('seccion--completa', hechas === celdas.length);
    });
  };
  Object.keys(registro.lecturas).forEach(pintarLectura);
  actualizarProgreso();

  // ---------- Validación de campos numéricos ----------
  const validarNumero = (input) => {
    const valor = leerNumero(input.value);
    const error = $(`#${input.id}-error`, form);
    let mensaje = '';
    if (Number.isNaN(valor)) mensaje = 'Ingresa solo números (ej. 45,5)';
    else if (valor !== null && (valor < RANGO.min || valor > RANGO.max)) mensaje = `Fuera de rango (${RANGO.min} a ${RANGO.max} °C)`;
    input.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
    if (error) error.textContent = mensaje;
    return mensaje ? undefined : valor;
  };

  form.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.lectura) {
      const valor = validarNumero(el);
      if (valor === undefined) return;
      if (valor === null) delete registro.lecturas[el.dataset.lectura];
      else registro.lecturas[el.dataset.lectura] = valor;
      pintarLectura(el.dataset.lectura);
      actualizarProgreso();
    } else if (el.name === 'temperaturaAmbiente') {
      const valor = validarNumero(el);
      if (valor === undefined) return;
      registro.temperaturaAmbiente = valor;
      // El margen sobre ambiente puede cambiar el estado de todas las lecturas
      Object.keys(registro.lecturas).forEach(pintarLectura);
      actualizarProgreso();
    } else if (el.name === 'velocidad') {
      registro.velocidad = Number(el.value);
    } else if (['nombre', 'fecha', 'hora', 'observaciones'].includes(el.name)) {
      registro[el.name] = el.value;
    } else return;
    marcarCambio();
  });

  // Enter pasa a la siguiente medición (más rápido en terreno)
  form.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.target.tagName !== 'INPUT') return;
    ev.preventDefault();
    const campos = $$('input[data-salto]', form);
    const siguiente = campos[campos.indexOf(ev.target) + 1];
    if (siguiente) {
      siguiente.closest('details')?.setAttribute('open', '');
      siguiente.focus();
      siguiente.select?.();
    } else {
      $('#observaciones', form).focus();
    }
  });
  form.addEventListener('submit', (ev) => ev.preventDefault());

  // ---------- Acciones ----------
  $('#btn-volver', contenedor).addEventListener('click', async () => {
    await guardarYa();
    if (history.length > 1) history.back();
    else app.navegar('/');
  });

  $('#btn-eliminar', contenedor).addEventListener('click', async () => {
    const nota = registro.enviadoNubeEn ? ' La copia ya enviada a Google Sheets se mantiene.' : '';
    const ok = await confirmar('¿Eliminar registro?', `Se borrará de este equipo el registro de ${estacion.nombre} del ${fechaLegible(registro.fecha)}. No se puede deshacer.${nota}`, 'Eliminar', true);
    if (!ok) return;
    pendiente = false;
    await repo.eliminar(registro.id);
    aviso('Registro eliminado.');
    app.navegar('/', { reemplazar: true });
  });

  const exportar = async () => {
    const boton = $('#btn-exportar', contenedor);
    boton.disabled = true;
    boton.textContent = 'Generando…';
    try {
      await guardarYa();
      const [ExcelJS, plantilla] = await Promise.all([cargarExcelJS(), obtenerPlantilla()]);
      const buffer = await crearExcelRegistro(ExcelJS, plantilla, registro, estacion, ajustes);
      await entregarArchivo(blobExcel(buffer), nombreArchivoRegistro(registro, estacion), 'Excel listo');
    } catch (e) {
      console.error(e);
      aviso(e.message || 'No se pudo generar el Excel.', { tipo: 'error', duracion: 6000 });
    } finally {
      boton.disabled = false;
      boton.textContent = 'Exportar Excel';
    }
  };
  $('#btn-exportar', contenedor).addEventListener('click', exportar);

  $('#btn-finalizar', contenedor).addEventListener('click', async () => {
    const faltan = [];
    if (!registro.nombre?.trim()) faltan.push('Nombre');
    if (!registro.fecha) faltan.push('Fecha');
    if (!registro.hora) faltan.push('Hora');
    if (faltan.length) {
      aviso(`Completa: ${faltan.join(', ')}.`, { tipo: 'error' });
      $(`[name="${faltan[0] === 'Nombre' ? 'nombre' : faltan[0].toLowerCase()}"]`, form).focus();
      return;
    }
    if ($$('[aria-invalid="true"]', form).length) {
      aviso('Hay valores no válidos marcados en rojo.', { tipo: 'error' });
      $('[aria-invalid="true"]', form).focus();
      return;
    }
    const r = resumenRegistro(registro, estacion, ajustes);
    const advertencias = [];
    if (r.medidas < r.total) advertencias.push(`Faltan ${r.total - r.medidas} de ${r.total} lecturas.`);
    if (registro.temperaturaAmbiente === null) advertencias.push('Falta la temperatura ambiente.');
    if (!registro.velocidad) advertencias.push('Falta la velocidad del sistema.');
    if (advertencias.length) {
      const ok = await dialogo({
        titulo: 'Registro incompleto',
        cuerpo: `<ul>${advertencias.map((a) => `<li>${esc(a)}</li>`).join('')}</ul><p>¿Finalizar de todas formas?</p>`,
        botones: [
          { texto: 'Seguir editando', valor: false },
          { texto: 'Finalizar', valor: true, estilo: 'boton--relleno' },
        ],
      });
      if (!ok) return;
    }
    registro.estado = 'completo';
    marcarCambio();
    await guardarYa();
    // Envío a Google Sheets en segundo plano; si no hay señal queda en cola
    app.sincronizar({ silencioso: false });

    const criticas = [];
    for (const s of estacion.secciones) {
      for (const p of s.poleas) {
        const est = estadoTemperatura(registro.lecturas[p.celda], registro.temperaturaAmbiente, ajustes);
        if (est?.id === 'critico') criticas.push(`${s.titulo}: ${p.nombre} — ${formatoTemp(registro.lecturas[p.celda])}`);
      }
    }
    const eleccion = await dialogo({
      titulo: 'Registro finalizado',
      cuerpo: `
        <p>${r.medidas} lecturas · ${r.normal} normal${r.normal === 1 ? '' : 'es'} · ${r.precaucion} en precaución · ${r.critico} crítica${r.critico === 1 ? '' : 's'}.</p>
        ${criticas.length ? `<p><strong>Revisar con prioridad:</strong></p><ul class="lista-criticas">${criticas.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}`,
      botones: [
        { texto: 'Volver al inicio', valor: 'inicio' },
        { texto: 'Exportar Excel', valor: 'exportar', estilo: 'boton--relleno' },
      ],
    });
    if (eleccion === 'exportar') await exportar();
    else if (eleccion === 'inicio') app.navegar('/');
  });

  // Limpieza al salir de la vista: guardar lo pendiente y soltar listeners globales
  return async () => {
    document.removeEventListener('visibilitychange', alOcultar);
    const habiaCambios = pendiente;
    await guardarYa();
    if (habiaCambios && registro.estado === 'completo') app.sincronizar();
  };
}

function campoNumero({ id, nombre, etiqueta, valor, extra = '' }) {
  return `
    <div class="campo">
      <label for="${id}">${esc(etiqueta)}</label>
      <div class="campo__entrada">
        <input id="${id}" name="${nombre}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next"
          value="${valor ?? ''}" aria-describedby="${id}-error" ${extra}>
        <span class="unidad" aria-hidden="true">°C</span>
      </div>
      <span class="campo__error" id="${id}-error" aria-live="polite"></span>
    </div>`;
}

function plantillaFormulario(registro, estacion, total) {
  const numero = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : '');
  return `
    <header class="barra-superior">
      <button class="boton-icono" id="btn-volver" aria-label="Volver">‹</button>
      <div class="barra-superior__titulo">
        <h1>${esc(estacion.nombre)}</h1>
        <span id="estado-guardado" class="barra-superior__sub" aria-live="polite">${registro.estado === 'completo' ? 'Finalizado' : 'Borrador'}</span>
      </div>
      <button class="boton-icono boton-icono--peligro" id="btn-eliminar" aria-label="Eliminar registro">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Zm4 2v8h2v-8h-2Zm4 0v8h2v-8h-2Z"/></svg>
      </button>
    </header>

    <form id="form-registro" class="pagina formulario" novalidate autocomplete="off">
      <section class="tarjeta">
        <h2 class="tarjeta__titulo">General</h2>
        <div class="rejilla">
          <div class="campo">
            <label for="f-nombre">Nombre</label>
            <input id="f-nombre" name="nombre" type="text" autocomplete="name" enterkeyhint="next" value="${esc(registro.nombre)}" required>
          </div>
          <div class="campo">
            <label for="f-fecha">Fecha</label>
            <input id="f-fecha" name="fecha" type="date" value="${esc(registro.fecha)}" required>
          </div>
          <div class="campo">
            <label for="f-hora">Hora</label>
            <input id="f-hora" name="hora" type="time" value="${esc(registro.hora)}" required>
          </div>
          ${campoNumero({ id: 'f-ambiente', nombre: 'temperaturaAmbiente', etiqueta: 'Temperatura ambiente', valor: numero(registro.temperaturaAmbiente), extra: 'data-salto' })}
        </div>
        <fieldset class="segmentado">
          <legend>Velocidad del sistema</legend>
          ${VELOCIDADES.map((v) => `
            <label class="segmentado__opcion">
              <input type="radio" name="velocidad" value="${v}" ${registro.velocidad === v ? 'checked' : ''}>
              <span>${v} m/s</span>
            </label>`).join('')}
        </fieldset>
      </section>

      ${estacion.secciones.map((s, i) => `
        <details class="tarjeta seccion" open>
          <summary class="seccion__cabecera">
            <h2 class="tarjeta__titulo">${esc(s.titulo)}</h2>
            <span class="seccion__contador">0/${s.poleas.length}</span>
          </summary>
          <div class="rejilla">
            ${s.poleas.map((p) => `
              <div class="medicion" data-celda="${p.celda}" data-estado="vacio">
                <div class="medicion__cabecera">
                  <label for="m-${p.celda}">${esc(p.nombre)}</label>
                  <span class="medicion__estado" id="m-${p.celda}-estado"></span>
                </div>
                <div class="campo__entrada">
                  <input id="m-${p.celda}" data-lectura="${p.celda}" data-salto type="text" inputmode="decimal"
                    autocomplete="off" enterkeyhint="next" value="${numero(registro.lecturas[p.celda])}"
                    aria-describedby="m-${p.celda}-error m-${p.celda}-estado">
                  <span class="unidad" aria-hidden="true">°C</span>
                </div>
                <span class="campo__error" id="m-${p.celda}-error" aria-live="polite"></span>
              </div>`).join('')}
          </div>
        </details>`).join('')}

      <section class="tarjeta">
        <label class="tarjeta__titulo" for="observaciones">Observaciones</label>
        <textarea id="observaciones" name="observaciones" rows="3" placeholder="Ruidos, vibraciones, lubricación…">${esc(registro.observaciones)}</textarea>
      </section>
    </form>

    <footer class="barra-inferior">
      <div class="progreso">
        <label for="progreso-barra"><span id="progreso-texto">0 de ${total}</span> lecturas</label>
        <progress id="progreso-barra" max="${total}" value="0"></progress>
        <span id="progreso-alertas" class="progreso__alertas"></span>
      </div>
      <div class="barra-inferior__acciones">
        <button type="button" class="boton boton--tonal" id="btn-exportar">Exportar Excel</button>
        <button type="button" class="boton boton--relleno" id="btn-finalizar">Finalizar</button>
      </div>
    </footer>`;
}

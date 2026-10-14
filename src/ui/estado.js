// Estado compartido entre vistas (ajustes en memoria, navegación y envío a la nube).
import { ajustes as repoAjustes } from '../data/db.js';
import { sincronizar } from '../data/nube.js';
import { aviso } from './utilidades.js';

export const app = {
  ajustes: null,
  async recargarAjustes() {
    this.ajustes = await repoAjustes.obtener();
    return this.ajustes;
  },
  async guardarAjustes(cambios) {
    await repoAjustes.guardar({ ...this.ajustes, ...cambios });
    return this.recargarAjustes();
  },
  navegar(ruta, { reemplazar = false } = {}) {
    if (reemplazar) location.replace(`#${ruta}`);
    else location.hash = ruta;
  },
  /**
   * Envía a Google Sheets los registros pendientes.
   * silencioso: solo avisa si se envió algo (para envíos automáticos en segundo plano).
   */
  async sincronizar({ silencioso = true } = {}) {
    if (!navigator.onLine && silencioso) return null;
    const r = await sincronizar(this.ajustes);
    if (!r.configurada) return r;
    if (r.enviados) aviso(`${r.enviados} registro${r.enviados > 1 ? 's' : ''} enviado${r.enviados > 1 ? 's' : ''} a Google Sheets.`);
    if (r.fallidos) {
      const sinSenal = /conexión|a tiempo/.test(r.error);
      // Sin señal es normal en terreno: en envíos automáticos no se molesta al técnico
      if (!silencioso || !sinSenal) {
        aviso(
          sinSenal ? 'Sin señal: se enviará a Google Sheets cuando vuelva la conexión.' : `No se pudo enviar a Google Sheets: ${r.error}`,
          { tipo: sinSenal ? 'info' : 'error', duracion: 7000 },
        );
      }
    }
    document.dispatchEvent(new CustomEvent('nube:actualizada', { detail: r }));
    return r;
  },
};

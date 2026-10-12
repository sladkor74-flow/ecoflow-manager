// DOVE SI RISOLVE UN ALERT (migliorie dell'11/10/2026).
//
// Nella pagina Alert & Controllo ogni alert mostrava il codice del modulo
// («primarie_rete») e i pulsanti Risolto e Ignora, ma non diceva dove la cosa si
// corregge: si andava a cercare il modulo a mano. Ora ogni riga ha «si corregge
// in ...» col collegamento: i target dei raccoglitori all'Andamento di Target &
// Status dell'anno, le date e le tratte al modulo dei movimenti, le verifiche
// dei report alle Verifiche, i file del caricamento al Caricamento Dati.
//
// Pura e senza import: la prova la carica con node (prove/dashboardPagina.mjs).

const MODULI = {
  primarie_rete: { link: '/primarie-rete', nome: 'Terminati Rete' },
  primarie_aci: { link: '/primarie-aci', nome: 'Terminati ACI' },
  secondarie: { link: '/secondarie', nome: 'Secondarie' },
  terziarie: { link: '/terziarie', nome: 'Terziarie' },
  extra_raccolta: { link: '/extra-raccolta', nome: 'Extra Raccolta' },
  assegnati: { link: '/assegnati', nome: 'Assegnati Rete' },
  giacenze: { link: '/giacenze', nome: 'Giacenze' },
  verifiche: { link: '/verifiche', nome: 'Verifiche' },
  manutenzione: { link: '/caricamento-dati', nome: 'Caricamento Dati' },
};
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Il nome leggibile del modulo di un alert: «Terminati Rete», non «primarie_rete». */
export const nomeModuloAlert = (modulo) => (MODULI[modulo] ? MODULI[modulo].nome : String(modulo || '').replace(/_/g, ' '));

/**
 * Dove si corregge un alert: { link, nome } o null se non si sa.
 * Un avviso dei target dei raccoglitori (entity_type TargetMensile, record_id
 * raccoglitore|regione|mese|anno) porta all'Andamento dell'anno del suo mese.
 */
export function doveSiRisolve(a) {
  if (!a) return null;
  if (a.entity_type === 'TargetMensile') {
    const parti = String(a.record_id || '').split('|');
    const anno = Number(parti[parti.length - 1]);
    const mese = parti[parti.length - 2];
    if (anno && MESI.includes(mese)) return { link: `/target-status?tab=andamento&anno=${anno}`, nome: `Target & Status, Andamento ${anno}` };
    return { link: '/target-status?tab=andamento', nome: 'Target & Status, Andamento' };
  }
  if (a.entity_type === 'VerificaReport') return { link: '/verifiche', nome: 'Verifiche' };
  if (a.entity_type === 'UploadLog') return { link: '/caricamento-dati', nome: 'Caricamento Dati' };
  return MODULI[a.modulo] || null;
}

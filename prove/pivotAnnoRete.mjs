// Le due pivot dell'anno della scheda Rete sono lo stesso raccolto letto dai due
// capi: una parte dal raccoglitore, l'altra dall'impianto. Devono dire gli stessi
// numeri, altrimenti e' il gestionale che si contraddice da solo - ed e' quello
// che l'utente ha segnalato il 05/10/2026 («Irigom su ottobre non ha le stesse
// quantita' su tutte le pivot»). npm run prove
import { calcolaPivot, MESI } from '../base44/shared/reportMensile.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// Un formulario terminato: il periodo lo da' sempre la fine del trasporto.
let n = 0;
const riga = (trasportatore, destinazione, provincia, mese, kg, extra = {}) => ({
  id_ordine: 'O' + (++n), stato: 'terminato',
  trasporto_finito_il: `2026-${String(mese + 1).padStart(2, '0')}-15T10:00:00Z`,
  trasportatore, destinazione, provincia, peso_effettivo: kg,
  prodotto: 'P - fino a 35 kg', classe: 'P', tipo_destinazione: 'imp', ...extra,
});

// Ottobre di Irigom, come in pagina: tre raccoglitori diversi, un impianto solo.
const archivio = [
  riga('SMOCO S.R.L.', 'Irigom S.r.l.', 'CS', 9, 15660),
  riga('PNEUSERVICE CONVERSANO SRL', 'Irigom S.r.l.', 'BA', 9, 3520),
  riga('SMOCO S.R.L.', 'Irigom S.r.l.', 'BA', 9, 16240),
  riga('LOGISTICA & PNEUMATICI SRL', 'T-CYCLE INDUSTRIES SRL', 'NA', 9, 4220),
  riga('SMOCO S.R.L.', 'Irigom S.r.l.', 'CS', 4, 20000),
  // una riga di autodemolizione finita nell'archivio di rete: non e' rete
  riga('SMOCO S.R.L.', 'Irigom S.r.l.', 'CS', 9, 99000, { prodotto: 'PFU Autodemolizione', classe: 'PFU Autodemolizione' }),
  // un terminato senza fine trasporto non sta in nessun periodo
  { id_ordine: 'X', stato: 'terminato', trasportatore: 'SMOCO S.R.L.', destinazione: 'Irigom S.r.l.', provincia: 'CS', peso_effettivo: 50000, classe: 'P' },
];

const daRaccoglitore = calcolaPivot('raccoltaAnno', archivio, 2026, '');
const daImpianto = calcolaPivot('impiantiAnno', archivio, 2026, '');

// Le foglie della pivot per raccoglitore sono le destinazioni: si sommano per
// nome e per mese, ed e' quello che la pivot per impianto dice in una riga sola.
const perDestinazione = (nodo, dentro = new Map(), livello = 0) => {
  for (const f of nodo.figli || []) {
    if (!f.figli) {
      const m = dentro.get(f.etichetta) || {};
      for (const [col, v] of Object.entries(f.valori)) m[col] = Math.round(((m[col] || 0) + v.peso) * 1000) / 1000;
      dentro.set(f.etichetta, m);
    } else perDestinazione(f, dentro, livello + 1);
  }
  return dentro;
};
const sommate = perDestinazione(daRaccoglitore.radice);
const dirette = new Map((daImpianto.radice.figli || []).map(f => [
  f.etichetta,
  Object.fromEntries(Object.entries(f.valori).map(([c, v]) => [c, Math.round(v.peso * 1000) / 1000])),
]));

verifica('le due pivot hanno gli stessi impianti',
  JSON.stringify([...sommate.keys()].sort()) === JSON.stringify([...dirette.keys()].sort()),
  JSON.stringify([[...sommate.keys()], [...dirette.keys()]]));
for (const [impianto, mesi] of dirette) {
  verifica(`${impianto}: stessi numeri in tutt'e due le pivot`,
    JSON.stringify(mesi) === JSON.stringify(sommate.get(impianto)),
    JSON.stringify([mesi, sommate.get(impianto)]));
}
verifica('e lo stesso totale', daRaccoglitore.radice.totali.peso === daImpianto.radice.totali.peso
  && Math.round(daImpianto.radice.totali.peso * 100) / 100 === 59.64,
  String(daImpianto.radice.totali.peso));

// Il caso vero: a ottobre Irigom fa 35,42 t, e la somma delle tre righe della
// pivot per raccoglitore fa lo stesso numero.
const ott = MESI[9];
verifica('Irigom a ottobre fa 35,42 t da tutt\'e due le parti',
  dirette.get('Irigom S.r.l.')[ott] === 35.42 && sommate.get('Irigom S.r.l.')[ott] === 35.42,
  JSON.stringify([dirette.get('Irigom S.r.l.'), sommate.get('Irigom S.r.l.')]));

// Rete, ACI ed extra raccolta non si sommano mai: le 99 t di autodemolizione
// restano fuori da tutt'e due, e senza la fine trasporto non si entra.
verifica('l\'autodemolizione nell\'archivio di rete non entra nel totale di rete',
  !JSON.stringify([...dirette.values()]).includes('99') && daImpianto.radice.totali.peso < 99,
  String(daImpianto.radice.totali.peso));
verifica('un terminato senza fine trasporto non sta in nessun mese',
  daRaccoglitore.righeLette === 5, String(daRaccoglitore.righeLette));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

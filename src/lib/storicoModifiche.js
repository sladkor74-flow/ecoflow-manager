// LO STORICO DELLE MODIFICHE, COME SI LEGGE A VIDEO (11/10/2026).
//
// Le righe di ModificaDato sono una per campo; a video si raccontano una per
// scrittura: «11/10/2026 14:32 · Mario Rossi — target di rete: 1.050,00 t →
// 1.200,00 t · perche': revisione di giugno». I numeri all'italiana come nel
// resto del gestionale (tonnellate con due decimali, tre se i chili non sono
// tondi; chili interi; euro con due), e un valore che mancava si scrive «—»,
// non zero. La regola di che cosa si traccia sta in src/lib/campiTracciati.js.
// Prove: prove/storicoModifiche.mjs.
import { formatTonnellate, formatKg, dataServer } from '@/lib/utils';
import { cifreItaliane } from '@/lib/formatoSoldi';
import { campoTracciato, nomeCampo, valoreDelTesto, differenzeJson } from '@/lib/campiTracciati';

const MANCA = '—';

// I codici che l'archivio scrive e la pagina dice a parole.
const PAROLE = {
  non_attivo: 'non attivo', attivo: 'attivo', imp: 'impianto', stoc: 'stoccaggio',
  euro_tonnellata: '€/t', euro_viaggio: '€/viaggio', non_dovuta: 'non dovuta', solo_metalli: 'solo metalli ferrosi',
};

const giornoIt = (v) => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : String(v || ''); };

/** Il valore di un campo come si legge: con la sua unita', all'italiana, «—» se mancava. */
export function testoValore(entita, campo, unita, testo) {
  const v = valoreDelTesto(unita, testo);
  if (v === null || v === undefined || v === '') {
    // Il ruolo vuoto di un target e' l'impianto, non un dato mancante.
    if (campo === 'ruolo') return 'impianto';
    return MANCA;
  }
  const spec = campoTracciato(entita, campo) || {};
  if (typeof v === 'number') {
    if (unita === 'kg') return spec.mostra === 't' ? `${formatTonnellate(v / 1000)} t` : `${formatKg(v)} kg`;
    if (unita === 't') return `${formatTonnellate(v)} t`;
    if (unita === '€') return `${cifreItaliane(v, 2, 2)} €`;
    if (String(unita).startsWith('€/')) return `${cifreItaliane(v, 2, 4)} ${unita}`;
    return cifreItaliane(v, 0, 3);
  }
  if (unita === 'si_no') return v ? 'sì' : 'no';
  if (unita === 'giorno') return giornoIt(v);
  if (campo === 'ruolo' && v === 'stoccaggio') return 'piazzale';
  return PAROLE[v] || String(v);
}

// Un numero dentro una tabella della commessa, con l'unita' della sua colonna
// (differenzeJson la prende da campiTracciati): tonnellate come nel resto del
// gestionale, prezzi in €/t, la ripartizione per classe in percentuale come la
// scrive la scheda (30%, non 0,3). Senza unita' (il criterio di una voce della
// passiva) all'italiana, senza zeri inutili. Revisione delle migliorie,
// 11/10/2026: prima la percentuale compariva come frazione.
const testoInTabella = (v, unita = '') => {
  if (v === null || v === undefined || v === '') return MANCA;
  const n = Number(v);
  if (!(typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(n)))) return String(v);
  if (unita === 't') return `${formatTonnellate(n)} t`;
  if (unita === '%') return `${cifreItaliane(n, 0, 2)}%`;
  if (String(unita).startsWith('€')) return `${cifreItaliane(n, 2, 4)} ${unita}`;
  return cifreItaliane(n, 0, 3);
};

const elencoIt = (voci) => (voci.length > 1 ? `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}` : voci[0] || '');

// Le righe di una tabella aggiunte o tolte senza nessun valore (differenzeJson
// le da' col solo nome) si dicono insieme: «righe Campania, Puglia e Sicilia
// aggiunte, ancora senza valori». Prima, dalla scheda di una commessa nuova,
// a video compariva il JSON intero di ogni regione (revisione delle migliorie,
// 11/10/2026).
function righeSenzaValori(diff) {
  const parti = [];
  const aggiunte = diff.filter(d => d.riga === 'aggiunta').map(d => d.voce);
  const tolte = diff.filter(d => d.riga === 'tolta').map(d => d.voce);
  if (aggiunte.length) parti.push(aggiunte.length === 1 ? `riga ${aggiunte[0]} aggiunta, ancora senza valori` : `righe ${elencoIt(aggiunte)} aggiunte, ancora senza valori`);
  if (tolte.length) parti.push(tolte.length === 1 ? `riga ${tolte[0]} tolta, non aveva valori` : `righe ${elencoIt(tolte)} tolte, non avevano valori`);
  return parti;
}

/** Una riga di ModificaDato in parole: «target di rete: 1.050,00 t → 1.200,00 t». */
export function testoModifica(riga) {
  const r = riga || {};
  if (!r.campo) return r.operazione === 'delete' ? 'record eliminato' : 'record creato';
  const nome = nomeCampo(r.entita, r.campo);
  if (r.unita === 'json') {
    const diff = differenzeJson(r.prima, r.dopo, campoTracciato(r.entita, r.campo));
    if (!diff.length) return `${nome}: riscritto senza differenze`;
    const tutte = [
      ...diff.filter(d => !d.riga).map(d => `${d.voce ? `${d.voce} ` : ''}${testoInTabella(d.prima, d.unita)} → ${testoInTabella(d.dopo, d.unita)}`),
      ...righeSenzaValori(diff),
    ];
    return `${nome}: ${tutte.slice(0, 6).join('; ')}${tutte.length > 6 ? `; e altre ${tutte.length - 6}` : ''}`;
  }
  const prima = testoValore(r.entita, r.campo, r.unita, r.prima);
  const dopo = testoValore(r.entita, r.campo, r.unita, r.dopo);
  if (r.operazione === 'create') return `${nome}: ${dopo}`;
  if (r.operazione === 'delete') return `${nome} era ${prima}`;
  return `${nome}: ${prima} → ${dopo}`;
}

const ORA_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** L'istante di una modifica, sul giorno e sull'ora di Roma: «11/10/2026 14:32». */
export function quandoIt(il) {
  const d = dataServer(il);
  if (!d || Number.isNaN(d.getTime())) return '';
  return ORA_ROMA.format(d).replace(',', '');
}

const OPERAZIONI = { create: 'Inserito', update: 'Modificato', delete: 'Eliminato' };

/**
 * Le righe raccolte per scrittura (stesso istante, stesso utente, stessa
 * operazione), dalla piu' recente: { chiave, quando, utente, operazione,
 * azione, origine, motivo, voci }.
 */
export function scrittureDelloStorico(righe) {
  const gruppi = new Map();
  for (const r of righe || []) {
    if (!r) continue;
    const chiave = `${r.il || r.created_date || ''}|${r.utente || ''}|${r.operazione || ''}|${r.record_id || ''}`;
    if (!gruppi.has(chiave)) {
      gruppi.set(chiave, {
        chiave, il: r.il || r.created_date || '', quando: quandoIt(r.il || r.created_date), utente: r.utente || '',
        operazione: r.operazione || 'update', azione: OPERAZIONI[r.operazione] || 'Modificato',
        origine: r.origine || '', motivo: r.motivo || '', etichetta: r.etichetta || '', voci: [],
      });
    }
    gruppi.get(chiave).voci.push(testoModifica(r));
  }
  return [...gruppi.values()].sort((a, b) => String(b.il).localeCompare(String(a.il)));
}

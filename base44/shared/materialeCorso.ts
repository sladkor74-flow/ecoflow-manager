// Materiale del corso per responsabile tecnico gestione rifiuti (dispense e, in
// seguito, trascrizioni delle videolezioni). Il testo e' diviso in parti; una
// elaborazione pianificata ne fa, poche alla volta, schede di studio (sintesi,
// concetti, norme citate, punti da verificare). L'Assistente usa le schede
// pertinenti alla domanda, trovate per parole chiave: nessun costo in piu' per le
// parti non pertinenti.

const PAROLE_VUOTE = new Set(('il lo la i gli le un una uno di del dello della dei degli delle a al allo alla ai agli alle da dal dallo dalla dai dagli dalle ' +
  'in nel nello nella nei negli nelle con su sul sullo sulla sui sugli sulle per tra fra e ed o od ma se che chi cui non piu come quando quale quali quanto ' +
  'quanti sono essere ha hanno ho hai deve devono puo possono fare fatto questo questa questi queste quello quella quelli quelle anche solo sempre ' +
  'cosa ci si ne mi ti vi del art articolo comma').split(' '));

/** Parole significative di un testo: minuscole, senza accenti, radice di 6 lettere. */
export function paroleSignificative(testo) {
  const out = new Set();
  const pulito = String(testo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const p of pulito.split(/[^a-z0-9]+/)) {
    if (!p || PAROLE_VUOTE.has(p)) continue;
    if (/^\d+$/.test(p)) { if (p.length >= 2) out.add(p); continue; }
    if (p.length < 3) continue;
    out.add(p.slice(0, 6));
  }
  return out;
}

const elenco = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/**
 * Schede del corso pertinenti a una domanda.
 * Restituisce { testo, fonti } da aggiungere al prompt; testo vuoto se non ce ne sono.
 */
export async function materialePertinente(base44, domanda, massimo = 4) {
  const cercate = paroleSignificative(domanda);
  if (!cercate.size) return { testo: '', fonti: [] };
  const schede = [];
  for (let skip = 0; skip < 20000; skip += 1000) {
    const pagina = await base44.asServiceRole.entities.MaterialeCorso.filter({ stato: 'elaborato' }, 'ordine', 1000, skip,
      ['categoria', 'modulo', 'fonte_file', 'anno_materiale', 'parte', 'parti_totali', 'sintesi', 'concetti_json', 'riferimenti_json', 'da_verificare_json', 'parole_chiave', 'tipo', 'aggiornamenti_json', 'aggiornata_il']);
    schede.push(...pagina);
    if (pagina.length < 1000) break;
  }
  const punteggio = (s) => {
    const chiave = paroleSignificative(s.parole_chiave);
    const corpo = paroleSignificative(`${s.modulo} ${s.sintesi}`);
    let p = 0;
    for (const w of cercate) {
      if (chiave.has(w)) p += 3;
      else if (corpo.has(w)) p += 1;
    }
    return p;
  };
  const scelte = schede
    .map(s => ({ s, p: punteggio(s) }))
    .filter(x => x.p >= Math.min(4, cercate.size + 1))
    .sort((a, b) => b.p - a.p)
    .slice(0, massimo)
    .map(x => x.s);
  if (!scelte.length) return { testo: '', fonti: [] };

  const blocchi = scelte.map((s, i) => [
    `[C${i + 1}] ${s.categoria} — ${s.modulo} (${s.tipo === 'videolezione' ? 'videolezione' : 'dispensa'}${s.anno_materiale ? ` ${s.anno_materiale}` : ''}, parte ${s.parte}/${s.parti_totali || '?'})`,
    `Sintesi: ${s.sintesi}`,
    elenco(s.concetti_json).length ? `Concetti: ${elenco(s.concetti_json).join('; ')}` : '',
    elenco(s.riferimenti_json).length ? `Norme citate: ${elenco(s.riferimenti_json).map(r => [r.norma, r.articolo, r.tema].filter(Boolean).join(' ')).join('; ')}` : '',
    elenco(s.da_verificare_json).length ? `Da verificare perche' forse superato: ${elenco(s.da_verificare_json).join('; ')}` : '',
    elenco(s.aggiornamenti_json).length
      ? `Aggiornamenti alle norme vigenti (controllo del ${String(s.aggiornata_il || '').slice(0, 10)}): ${elenco(s.aggiornamenti_json).map(a => `${a.punto} -> oggi: ${a.oggi}${a.fonte ? ` (${a.fonte})` : ''}`).join('; ')}`
      : '',
  ].filter(Boolean).join('\n'));

  return {
    testo: blocchi.join('\n\n'),
    fonti: scelte.map(s => `Corso RT, ${s.categoria} — ${s.modulo}, parte ${s.parte}`),
  };
}

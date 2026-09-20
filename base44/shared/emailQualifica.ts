// Il promemoria della qualifica fornitori, scritto come un documento ordinato.
//
// Prima era testo semplice: la posta lo mostra come HTML, gli a capo spariscono
// e centoventi segnalazioni diventano un muro unico. Ora e' HTML, diviso per
// urgenza e non per fornitore: chi legge vede subito cosa e' scaduto, cosa sta
// per scadere e cosa manca, con una tabella per ciascuna cosa.
//
// Le tabelle hanno stili in riga perche' la posta elettronica ignora i fogli di
// stile, e i colori sono quelli del gestionale.

const C = {
  scuro: '#0f4c5c', bordo: '#d6dee2', zebra: '#f7fafb', testo: '#1e293b', grigio: '#6e7882',
  rosso: '#b91c1c', ambra: '#b45309', cielo: '#0369a1', fondoRosso: '#fef2f2', fondoAmbra: '#fffbeb',
};

// Ordine di lettura: prima cio' che e' gia' un danno, poi cio' che lo diventera'.
export const SEZIONI = [
  { stato: 'scaduto', titolo: 'Documenti scaduti', colore: C.rosso, spiega: 'Non sono piu' + '’' + ' validi: vanno richiesti subito.' },
  { stato: 'non_conforme', titolo: 'Documenti non conformi', colore: C.rosso, spiega: 'Ci sono, ma cosi' + '’' + ' non si possono accettare.' },
  { stato: 'in_scadenza', titolo: 'Documenti in scadenza', colore: C.ambra, spiega: 'Ancora validi: conviene chiedere il rinnovo adesso.' },
  { stato: 'mancante', titolo: 'Documenti mai ricevuti', colore: C.ambra, spiega: 'Non sono mai stati caricati.' },
  { stato: 'da_verificare', titolo: 'Documenti da verificare', colore: C.cielo, spiega: 'La lettura automatica non basta: serve un controllo a mano.' },
];

const ETICHETTE = Object.fromEntries(SEZIONI.map(s => [s.stato, s.titolo]));

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function dataIt(d) {
  const s = String(d || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
}

// Quando il documento scade, detto come lo direbbe una persona
export function quando(e) {
  if (e.stato === 'scaduto') return e.scadenza ? 'scaduto il ' + dataIt(e.scadenza) + (e.giorni != null ? ', ' + Math.abs(e.giorni) + ' giorni fa' : '') : 'scaduto';
  if (e.stato === 'in_scadenza') {
    if (e.giorni === 0) return 'scade oggi';
    if (e.giorni === 1) return 'scade domani, ' + dataIt(e.scadenza);
    return 'scade fra ' + e.giorni + ' giorni, il ' + dataIt(e.scadenza);
  }
  return e.scadenza ? 'scadenza ' + dataIt(e.scadenza) : '';
}

// Il motivo, in breve: i problemi bloccanti se ci sono, altrimenti il primo.
export function motivo(e) {
  const p = Array.isArray(e.problemi) ? e.problemi : [];
  const gravi = p.filter(x => x && x.gravita === 'bloccante');
  const scelti = (gravi.length ? gravi : p).slice(0, 2).map(x => String(x.messaggio || '').trim()).filter(Boolean);
  return scelti.join(' ');
}

const cella = (testo, stile) => '<td style="padding:7px 10px;border-bottom:1px solid ' + C.bordo + ';' + (stile || '') + '">' + testo + '</td>';

function tabella(sezione, righe) {
  const out = [];
  out.push('<h3 style="margin:22px 0 2px;font-size:15px;color:' + sezione.colore + '">' + esc(sezione.titolo) + ' (' + righe.length + ')</h3>');
  out.push('<p style="margin:0 0 8px;font-size:12px;color:' + C.grigio + '">' + esc(sezione.spiega) + '</p>');
  out.push('<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px">');
  out.push('<tr style="background:' + C.scuro + ';color:#fff;text-align:left">'
    + '<th style="padding:7px 10px;font-weight:600">Fornitore</th>'
    + '<th style="padding:7px 10px;font-weight:600">Documento</th>'
    + '<th style="padding:7px 10px;font-weight:600">Situazione</th></tr>');
  righe.forEach((e, i) => {
    const sfondo = i % 2 ? 'background:' + C.zebra + ';' : '';
    const dettaglio = [quando(e), motivo(e)].filter(Boolean).join(' &middot; ');
    out.push('<tr>'
      + cella(esc(e.soggetto), sfondo + 'font-weight:600')
      + cella(esc(e.tipo), sfondo)
      + cella(esc(dettaglio) || '&mdash;', sfondo + 'color:' + C.grigio)
      + '</tr>');
  });
  out.push('</table>');
  return out.join('\n');
}

function riquadro(titolo, righe, colore, fondo) {
  return '<div style="margin:22px 0;padding:12px 14px;border:1px solid ' + colore + ';background:' + fondo + ';border-radius:8px">'
    + '<div style="font-weight:600;color:' + colore + ';font-size:14px">' + esc(titolo) + '</div>'
    + '<ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:' + C.testo + '">'
    + righe.map(r => '<li style="margin:3px 0">' + esc(r) + '</li>').join('')
    + '</ul></div>';
}

/**
 * Il corpo del promemoria in HTML e l'oggetto.
 * eventi: quelli di eventiDaSegnalare; anomalie: quelle di anomalieCatalogo.
 */
export function emailQualifica({ anno, oggi, eventi, riepilogo, anomalie, completo, indirizzo }) {
  const lista = Array.isArray(eventi) ? eventi : [];
  const errori = (anomalie || []).filter(a => a.gravita === 'errore');

  const conta = (stato) => lista.filter(e => e.stato === stato).length;
  const parti = SEZIONI.map(s => (conta(s.stato) ? conta(s.stato) + ' ' + s.titolo.replace('Documenti ', '').toLowerCase() : null)).filter(Boolean);
  if (errori.length) parti.push(errori.length + (errori.length === 1 ? ' documento senza destinatario' : ' documenti senza destinatario'));
  const oggetto = 'Qualifica fornitori ' + anno + ': ' + (parti.join(', ') || 'nessuna novita');

  const h = [];
  h.push('<div style="font-family:Arial,Helvetica,sans-serif;color:' + C.testo + ';max-width:760px">');
  h.push('<div style="background:' + C.scuro + ';color:#fff;padding:14px 16px;border-radius:8px 8px 0 0">');
  h.push('<div style="font-size:11px;letter-spacing:.06em;opacity:.85">SMOCO S.r.l. &middot; COMMESSA ECOTYRE</div>');
  h.push('<div style="font-size:19px;font-weight:700;margin-top:2px">Qualifica fornitori ' + esc(anno) + '</div>');
  h.push('<div style="font-size:12px;opacity:.85;margin-top:2px">Situazione al ' + dataIt(oggi) + (completo ? ' &middot; quadro completo' : ' &middot; solo le novita') + '</div>');
  h.push('</div>');
  h.push('<div style="border:1px solid ' + C.bordo + ';border-top:none;border-radius:0 0 8px 8px;padding:16px">');

  if (riepilogo) {
    const voci = [
      ['Soggetti da qualificare', riepilogo.soggetti],
      ['Qualificati', riepilogo.qualificati],
      ['Da completare', riepilogo.da_completare],
      ['Con documenti scaduti o non conformi', riepilogo.critici],
    ];
    h.push('<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px">');
    h.push('<tr>' + voci.map(([k, v]) => '<td style="padding:8px 10px;border:1px solid ' + C.bordo + ';background:' + C.zebra + '">'
      + '<div style="font-size:11px;color:' + C.grigio + '">' + esc(k) + '</div>'
      + '<div style="font-size:18px;font-weight:700;color:' + C.scuro + '">' + esc(v ?? 0) + '</div></td>').join('') + '</tr>');
    h.push('</table>');
  }

  if (lista.length === 0 && errori.length === 0) {
    h.push('<p style="font-size:14px;margin:18px 0">Non c' + '’' + 'e' + '’' + ' niente da richiedere o da rinnovare.</p>');
  }

  for (const sezione of SEZIONI) {
    const righe = lista.filter(e => e.stato === sezione.stato)
      .sort((a, b) => (a.giorni ?? 99999) - (b.giorni ?? 99999) || String(a.soggetto).localeCompare(String(b.soggetto), 'it'));
    if (righe.length) h.push(tabella(sezione, righe));
  }

  if (errori.length) {
    h.push(riquadro('Documenti che non verranno mai chiesti a nessuno', errori.map(a => a.messaggio), C.rosso, C.fondoRosso));
  }

  const testi = lista.filter(e => e.richiesta).slice(0, 5);
  if (testi.length) {
    h.push('<h3 style="margin:22px 0 6px;font-size:15px;color:' + C.scuro + '">Testi pronti da inoltrare al fornitore</h3>');
    for (const e of testi) {
      h.push('<div style="margin:0 0 8px;padding:10px 12px;border-left:3px solid ' + C.scuro + ';background:' + C.zebra + ';font-size:13px">'
        + '<div style="font-weight:600">' + esc(e.soggetto) + ' &middot; ' + esc(e.tipo) + '</div>'
        + '<div style="color:' + C.grigio + ';margin-top:3px">' + esc(e.richiesta) + '</div></div>');
    }
    const altri = lista.filter(e => e.richiesta).length - testi.length;
    if (altri > 0) h.push('<p style="font-size:12px;color:' + C.grigio + ';margin:0">Gli altri ' + altri + ' testi sono nel modulo, sulla scheda di ciascun fornitore.</p>');
  }

  h.push('<p style="margin:22px 0 0;font-size:12px;color:' + C.grigio + ';border-top:1px solid ' + C.bordo + ';padding-top:10px">'
    + 'Per caricare i documenti apri il modulo Qualifica Fornitori del gestionale'
    + (indirizzo ? ': <a href="' + esc(indirizzo) + '" style="color:' + C.scuro + '">' + esc(indirizzo) + '</a>' : '.')
    + '</p>');
  h.push('</div></div>');

  return { oggetto, html: h.join('\n'), etichette: ETICHETTE };
}

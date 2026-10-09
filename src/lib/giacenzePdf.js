// Le sezioni PDF delle schede di Giacenze (06/10/2026).
//
// Una funzione per scheda: costruisce gli argomenti di esportaSezioniPdf con i
// dati che la scheda ha a video in quel momento. I numeri sono GREZZI - la
// formattazione la fa il `tipo` della colonna - e le tonnellate si passano in
// tonnellate, con tipo 't', mai in euro: un valore di riepilogo senza `tipo`
// verrebbe scritto in euro (esportaTabella.js).
//
// Rete, ACI ed extra raccolta restano colonne separate e non si sommano mai.

const ruolo = (r) => (r.tipo_destinazione === 'imp' ? 'Impianto' : 'Stoccaggio');
const comune = (anno, titolo) => ({
  nomeFile: `giacenze-${titolo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${anno}`,
  intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
  titolo: `Giacenze · ${titolo}`,
  sottotitolo: `Anno ${anno}`,
  // Le note di queste schede spiegano come si leggono i numeri: non sono
  // «anomalie da guardare prima di pagare», che e' il titolo che arriva dalla
  // fatturazione (09/10/2026).
  titoloNote: 'Come si leggono questi numeri',
});

const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
/** 'AAAA-MM' -> 'Gen 2026'; senza mese il carico non si colloca, e si dice. */
const nomeMese = (m) => {
  if (!m) return 'senza fine trasporto';
  const i = Number(String(m).slice(5, 7)) - 1;
  return `${MESI_BREVI[i] || m} ${String(m).slice(0, 4)}`;
};
const giornoItaliano = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');

/** Scheda Situazione: giacenza a portale, per classe, e che cosa resta da dichiarare. */
export function situazionePdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Situazione'),
    riepilogo: [
      { etichetta: 'Giacenza rete a portale', valore: totali.giacenza_portale_t, tipo: 't' },
      { etichetta: 'Giacenza ACI', valore: totali.giacenza_aci_t, tipo: 't' },
      { etichetta: 'In attesa di dichiarazione', valore: totali.in_attesa_dichiarazione_t, tipo: 't' },
      { etichetta: 'Dichiarato nell’anno', valore: totali.dichiarato_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Siti',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Giacenza rete', tipo: 't', peso: 1 },
        { titolo: 'P (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'M (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G1 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G2 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'ACI (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'In attesa dich.', tipo: 't', peso: 1 },
        { titolo: 'Ordini da dich.', tipo: 'intero', peso: 0.8 },
        { titolo: 'Dichiarato', tipo: 't', peso: 1 },
      ],
      righe: righe.map(r => ({
        celle: [
          r.sito, ruolo(r), r.giacenza_portale_t,
          (r.giacenza_classi_kg || {}).P, (r.giacenza_classi_kg || {}).M,
          (r.giacenza_classi_kg || {}).G1, (r.giacenza_classi_kg || {}).G2, (r.giacenza_classi_kg || {}).ACI,
          r.in_attesa_dichiarazione_t, r.ordini_da_dichiarare, r.dichiarato_t,
        ],
      })),
    }],
    note: ['La giacenza di un impianto e’ la fotografia del portale; quella di un piazzale e’ l’ancora dell’anno piu’ tutti i movimenti finiti dopo. Rete, ACI ed extra raccolta non si sommano mai.'],
  };
}

/**
 * Scheda Da dichiarare: gli ordini che il portale aspetta ancora, con i filtri
 * che si hanno davanti in quel momento.
 *
 * Le righe sono TUTTE quelle del filtro, non la pagina a video (09/10/2026): il
 * totale sotto una tabella che ne mostra cento era proprio la lettura che ha
 * fatto credere che ottobre non fosse contato. Per lo stesso motivo il PDF si
 * apre con il conto per mese, che fa da riscontro alla giacenza dell'impianto.
 */
export function daDichiararePdf(anno, dati, filtri = {}) {
  const righe = dati.righe || [];
  const perMese = dati.per_mese || [];
  const date = dati.date_da_sistemare || { n: 0, kg: 0 };
  const scelte = [
    filtri.sito ? `Sito: ${filtri.sito}` : 'Tutti i siti',
    filtri.ruolo === 'imp' ? 'solo i carichi da dichiarare come impianto'
      : filtri.ruolo === 'stoc' ? 'solo i carichi passati dal piazzale e gia’ ripartiti' : '',
    filtri.provincia ? `Provincia: ${filtri.provincia}` : '',
    filtri.anno ? `Anno di fine trasporto: ${filtri.anno}` : '',
    filtri.ricerca ? `Ricerca: ${filtri.ricerca}` : '',
    filtri.solo_date ? 'solo quelli col formulario da correggere' : '',
  ].filter(Boolean).join(' · ');
  return {
    ...comune(anno, 'Da dichiarare'),
    sottotitolo: scelte,
    riepilogo: [
      { etichetta: 'Ordini', valore: dati.totale_righe || righe.length, tipo: 'intero' },
      { etichetta: 'Peso da dichiarare', valore: dati.totale_kg || 0, tipo: 'kg' },
      { etichetta: 'Mesi coinvolti', valore: perMese.filter(m => m.mese).length, tipo: 'intero' },
      { etichetta: 'Col formulario da correggere', valore: date.n || 0, tipo: 'intero' },
    ],
    sezioni: [
      {
        titolo: 'Di quali mesi sono',
        colonne: [
          { titolo: 'Mese di fine trasporto', tipo: 'testo', peso: 2 },
          { titolo: 'Ordini', tipo: 'intero', peso: 1 },
          { titolo: 'Peso da dichiarare', tipo: 'kg', peso: 1.4 },
        ],
        // Il totale si scrive solo dove c'e' qualcosa da totalizzare: su un
        // elenco vuoto una riga «Totale 0» sembrerebbe un dato.
        righe: [
          ...perMese.map(m => ({ celle: [nomeMese(m.mese), m.ordini, m.kg] })),
          ...(perMese.length ? [{ stile: 'totale', celle: ['Totale', dati.totale_righe || righe.length, dati.totale_kg || 0] }] : []),
        ],
      },
      {
        titolo: 'Ordini, dal carico arrivato da piu’ tempo',
        colonne: [
          // Le larghezze nascono dai dati veri: un numero d'ordine sta in dieci
          // caratteri, un FIR in tredici, e una colonna piu' stretta del suo
          // contenuto lo manda a capo in mezzo alla parola.
          { titolo: 'Ordine', tipo: 'testo', peso: 1.2 },
          { titolo: 'FIR', tipo: 'testo', peso: 1.4 },
          { titolo: 'Fine trasporto', tipo: 'testo', peso: 0.9 },
          { titolo: 'Attesa (gg)', tipo: 'intero', peso: 0.7 },
          { titolo: 'Punto di raccolta', tipo: 'testo', peso: 2 },
          { titolo: 'Comune', tipo: 'testo', peso: 1.2 },
          { titolo: 'Pr.', tipo: 'testo', peso: 0.35 },
          { titolo: 'Prodotto', tipo: 'testo', peso: 0.7 },
          { titolo: 'Peso da dichiarare', tipo: 'kg', peso: 1 },
          { titolo: 'Destinazione', tipo: 'testo', peso: 1.4 },
          { titolo: 'Trasferito a', tipo: 'testo', peso: 1.2 },
          { titolo: 'Formulario nel gestionale', tipo: 'testo', peso: 2 },
        ],
        righe: [
          ...righe.map(r => ({
            celle: [
              r.ordine_primaria, r.numero_fir, giornoItaliano(r.fine_trasporto), r.giorni_attesa,
              r.punto_di_raccolta, r.comune, r.provincia, r.prodotto, r.peso_non_dichiarato_kg,
              r.destinazione, r.destinazione_secondaria,
              (r.date_da_sistemare || []).map(d => `${d.tipo} ${d.id_ordine}: ${d.testo}`).join(' · '),
            ],
          })),
          ...(righe.length ? [{ stile: 'totale', celle: ['Totale', null, null, null, null, null, null, null, dati.totale_kg || 0, null, null, null] }] : []),
        ],
      },
    ],
    note: [
      'Il peso e’ quello che il portale aspetta ancora per quell’ordine, non il peso del formulario: un ordine dichiarato a meta’ porta solo la parte che resta.',
      'Tutto per fine del trasporto, mai per la data di chiusura a portale. Un carico senza fine trasporto non si colloca in nessun mese e sta nel gruppo a parte.',
      date.n > 0 ? `${date.n} ordini hanno, nel gestionale, un formulario terminato senza tutte le date obbligatorie (${date.kg} kg): l’ultima colonna dice quali.` : '',
    ].filter(Boolean),
  };
}

/**
 * Scheda Stoccaggi: la lettura del portale di ogni piazzale accanto alla
 * giacenza di oggi. Sono due cose diverse e si mostrano affiancate: una lettura
 * vecchia non e' la giacenza di adesso (06/10/2026). Rete e ACI non si sommano.
 *
 * `esitoDi(r)` da' il controllo della rilevazione in due pezzi: `breve` sta
 * nella colonna, `lungo` va in coda. Una cella del PDF tiene tre righe e poi
 * taglia: la frase intera finiva mozzata a meta' parola, e un controllo che
 * dice «confrontata con quella del 23/09/2026 piu' i movimenti del periodo: 2»
 * e' peggio che non dirlo (09/10/2026).
 */
export function stoccaggiPdf(anno, righe, esitoDi = () => '') {
  const esito = (r) => {
    const e = esitoDi(r);
    return typeof e === 'string' ? { breve: e, lungo: '' } : (e || { breve: '', lungo: '' });
  };
  const kgDi = (r, campi) => campi.reduce((s, c) => s + (Number(r[c]) || 0), 0);
  const reteDi = (r) => kgDi(r, ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg']) / 1000;
  const aciDi = (r) => (Number(r.class9_kg) || 0) / 1000;
  const sommaOggi = (campo) => righe.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
  return {
    ...comune(anno, 'Stoccaggi'),
    riepilogo: [
      { etichetta: 'Piazzali', valore: righe.length, tipo: 'intero' },
      { etichetta: 'Letto a portale, rete', valore: righe.reduce((s, r) => s + reteDi(r), 0), tipo: 't' },
      { etichetta: 'Giacenza di oggi, rete', valore: sommaOggi('giacenza_rete_t'), tipo: 't' },
      { etichetta: 'Giacenza di oggi, ACI', valore: sommaOggi('giacenza_aci_t'), tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Piazzali: lettura del portale e giacenza di oggi',
      colonne: [
        { titolo: 'Unita’ locale', tipo: 'testo', peso: 1.6 },
        { titolo: 'Sito', tipo: 'testo', peso: 1.6 },
        { titolo: 'Rilevazione del', tipo: 'testo', peso: 0.9 },
        { titolo: 'P (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'M (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G1 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'G2 (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'ACI (kg)', tipo: 'intero', peso: 0.8 },
        { titolo: 'Letto rete (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Letto ACI (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Oggi rete (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Oggi ACI (t)', tipo: 't', peso: 0.9 },
        { titolo: 'Controllo della rilevazione', tipo: 'testo', peso: 2.2 },
      ],
      righe: righe.map(r => ({
        celle: [
          [r.descrizione_unita, r.id_unita_stoccaggio ? `#${r.id_unita_stoccaggio}` : '', r.comune ? `${r.comune}${r.provincia ? ` (${r.provincia})` : ''}` : ''].filter(Boolean).join(' · '),
          r.sito, giornoItaliano(r.data_rilevazione),
          r.class1_kg, r.class2_kg, r.class3_kg, r.class4_kg, r.class9_kg,
          reteDi(r), aciDi(r),
          r.giacenza_rete_t, r.giacenza_aci_t,
          esito(r).breve,
        ],
      })),
    }],
    note: [
      ...righe.map(r => ({ r, e: esito(r) })).filter(x => x.e.lungo).map(x => `${x.r.sito}: ${x.e.lungo}`),
      'La lettura e’ la fotografia del portale di quel giorno; la giacenza di oggi e’ l’ancora dell’anno piu’ tutti i movimenti finiti dopo. Se la seconda e’ piu’ bassa, nel frattempo il materiale e’ uscito in secondaria.',
      'Rete (classi 1-4) e ACI (classe 9) non si sommano mai: sono due commesse diverse.',
      'Il saldo degli stoccaggi il portale lo mostra nella pagina Unita’ Locali di Stoccaggio, che non si esporta: questi valori si rilevano a mano quando lo si consulta.',
    ],
  };
}

/**
 * Scheda Chiusura anno: il dossier della fotografia del 31 dicembre, com'e' in
 * quel momento. Le letture che l'utente sta scrivendo ci sono gia' dentro,
 * perche' il dossier le rifa' a ogni «Aggiorna il confronto».
 */
export function chiusuraAnnoPdf(dossier, { decisioneDi = () => '', pesoInParole = () => '', nomeCanale = (c) => String(c || '').toLowerCase() } = {}) {
  const CLASSI = ['P', 'M', 'G1', 'G2', 'ACI'];
  const anno = dossier.anno;
  const confronti = [];
  for (const c of dossier.piazzali || []) {
    const attesaDi = (cl) => (c.attesa || []).find(a => a.classe === cl) || {};
    const lettaDi = (cl) => (c.verifica_lettura ? c.verifica_lettura.classi.find(x => x.classe === cl) : null);
    const salvataDi = (cl) => (c.verifica_da_salvare ? c.verifica_da_salvare.classi.find(x => x.classe === cl) : null);
    // Undici celle quante le colonne. Tutto quello che si dice del piazzale sta
    // nella PRIMA cella, che e' la piu' larga: messo nella seconda, che e' la
    // colonna «Classe», «nessuna rilevazione precedente» usciva spezzato in
    // «nessuna / rilevazio / ne prece» (09/10/2026).
    const quando = c.precedente_del ? `dal ${giornoItaliano(c.precedente_del)}` : 'senza rilevazione precedente';
    const dicembre = c.dicembre && c.dicembre.n ? ` · ${c.dicembre.n} voci di dicembre` : '';
    confronti.push({ stile: 'gruppo', celle: [`${c.nome} — ${quando}${dicembre}`, null, null, null, null, null, null, null, null, null, null] });
    for (const a of c.attesa || []) {
      const cl = a.classe;
      const letta = lettaDi(cl), salvata = salvataDi(cl), att = attesaDi(cl);
      confronti.push({
        celle: [
          '', cl, att.canale === 'ACI' ? 'ACI' : 'rete',
          att.precedente_kg, att.ingressi_kg, att.uscite_kg, att.atteso,
          c.lettura ? c.lettura[cl] : null,
          letta && letta.scarto ? letta.scarto : null,
          c.lettura ? c.rettifica.classi[cl] : null,
          salvata && salvata.scarto ? salvata.scarto : null,
        ],
      });
    }
  }
  return {
    nomeFile: `giacenze-chiusura-${anno}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
    titolo: `Giacenze · Chiusura ${anno}`,
    sottotitolo: `Fotografia del ${giornoItaliano(dossier.giorno)}`,
    titoloNote: 'Come si leggono questi numeri',
    riepilogo: [
      { etichetta: 'Piazzali da fotografare', valore: dossier.riepilogo.piazzali, tipo: 'intero' },
      { etichetta: 'Fotografie pronte', valore: dossier.riepilogo.piazzali_pronti, tipo: 'intero' },
      { etichetta: 'Letture mancanti', valore: dossier.riepilogo.letture_mancanti, tipo: 'intero' },
      { etichetta: 'Dicembre da decidere', valore: dossier.riepilogo.voci_da_decidere, tipo: 'intero' },
    ],
    sezioni: [
      {
        titolo: 'Che cosa chiedere al portale',
        colonne: [
          { titolo: 'Sito', tipo: 'testo', peso: 1.6 },
          { titolo: 'Ruolo', tipo: 'testo', peso: 0.6 },
          { titolo: 'Che cosa serve', tipo: 'testo', peso: 2.2 },
          { titolo: 'Dove si legge', tipo: 'testo', peso: 3 },
          { titolo: 'In sospeso di dicembre', tipo: 'testo', peso: 2 },
          { titolo: 'Stato', tipo: 'testo', peso: 0.8 },
        ],
        righe: (dossier.richieste || []).map(q => ({
          celle: [q.nome, q.tipo, q.cosa, q.dove, q.dicembre.n ? pesoInParole(q.dicembre.per_canale) : '', q.stato === 'inserita' ? 'inserita' : 'da chiedere'],
        })),
      },
      {
        titolo: `Le letture del ${giornoItaliano(dossier.giorno)} · piazzali`,
        colonne: [
          { titolo: 'Piazzale', tipo: 'testo', peso: 2.4 },
          { titolo: 'Ultima rilevazione', tipo: 'testo', peso: 1 },
          ...CLASSI.map(c => ({ titolo: `${c} (kg)`, tipo: 'intero', peso: 1 })),
          { titolo: 'Fotografia', tipo: 'testo', peso: 1.6 },
        ],
        righe: (dossier.piazzali || []).map(p => ({
          celle: [
            p.nome, p.precedente_del ? giornoItaliano(p.precedente_del) : 'mai',
            ...CLASSI.map(c => (p.lettura ? p.lettura[c] : null)),
            p.gia_salvata ? `gia’ salvata al ${giornoItaliano(p.giorno)}` : p.pronto ? 'pronta' : `${p.blocchi.length} cosa/e da sistemare`,
          ],
        })),
      },
      {
        titolo: `Le letture del ${giornoItaliano(dossier.giorno)} · impianti`,
        colonne: [
          { titolo: 'Impianto', tipo: 'testo', peso: 2.4 },
          { titolo: 'PFU di rete non dichiarato (kg)', tipo: 'intero', peso: 1.4 },
          { titolo: 'ACI (kg)', tipo: 'intero', peso: 1 },
          { titolo: 'Lettera: PFU', tipo: 'intero', peso: 1 },
          { titolo: 'Lettera: ACI', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto rete', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto ACI', tipo: 'intero', peso: 1 },
        ],
        righe: (dossier.impianti || []).map(i => ({
          celle: [i.nome, i.lettura_kg, i.lettura_aci_kg, i.lettera ? i.lettera.pfu_kg : null, i.lettera ? i.lettera.aci_kg : null, i.scarto_kg, i.scarto_aci_kg],
        })),
      },
      {
        titolo: 'L’elenco di dicembre, voce per voce',
        colonne: [
          { titolo: 'Sito', tipo: 'testo', peso: 1.6 },
          { titolo: 'Movimento', tipo: 'testo', peso: 0.8 },
          { titolo: 'Canale', tipo: 'testo', peso: 0.8 },
          { titolo: 'ID ordine', tipo: 'testo', peso: 1 },
          { titolo: 'Formulario', tipo: 'testo', peso: 1 },
          { titolo: 'Classe', tipo: 'testo', peso: 0.5 },
          { titolo: 'Verso', tipo: 'testo', peso: 0.6 },
          { titolo: 'Peso (kg)', tipo: 'intero', peso: 0.8 },
          { titolo: 'Fine trasporto', tipo: 'testo', peso: 0.8 },
          { titolo: 'Chiuso a portale', tipo: 'testo', peso: 0.8 },
          { titolo: 'Controparte', tipo: 'testo', peso: 1.5 },
          { titolo: 'Decisione', tipo: 'testo', peso: 1.4 },
          { titolo: 'Perche’ e’ in elenco', tipo: 'testo', peso: 2 },
        ],
        // L'elenco e' gia' piatto: le stesse voci del dossier Excel, nello
        // stesso ordine. Un'uscita si scrive col segno meno, come li'.
        righe: [
          ...(dossier.elenco_dicembre && dossier.elenco_dicembre.voci ? dossier.elenco_dicembre.voci : []).map(v => ({
            celle: [
              `${v.nome} (${v.ruolo === 'stoc' ? 'piazzale' : 'impianto'})`, v.tipo, nomeCanale(v.canale), v.id_ordine, v.numero_fir,
              v.classe || 'senza classe', v.verso === 'uscita' ? 'uscita' : 'entrata',
              v.verso === 'uscita' ? -v.kg : v.kg, giornoItaliano(v.finito_il), v.chiuso_il ? giornoItaliano(v.chiuso_il) : 'non ancora',
              v.controparte, decisioneDi(v), v.perche,
            ],
          })),
          ...(dossier.elenco_dicembre && dossier.elenco_dicembre.aperti_prima ? dossier.elenco_dicembre.aperti_prima : []).map(v => ({
            celle: [
              `${v.nome} (${v.ruolo === 'stoc' ? 'piazzale' : 'impianto'})`, v.tipo, nomeCanale(v.canale), v.id_ordine, v.numero_fir,
              v.classe || 'senza classe', v.verso === 'uscita' ? 'uscita' : 'entrata',
              v.verso === 'uscita' ? -v.kg : v.kg, giornoItaliano(v.finito_il), v.chiuso_il ? giornoItaliano(v.chiuso_il) : 'non ancora',
              v.controparte, 'non si rettifica da qui', v.perche,
            ],
          })),
        ],
      },
      {
        titolo: 'Il confronto, piazzale per piazzale',
        colonne: [
          { titolo: 'Piazzale', tipo: 'testo', peso: 2 },
          { titolo: 'Classe', tipo: 'testo', peso: 0.6 },
          { titolo: 'Canale', tipo: 'testo', peso: 0.6 },
          { titolo: 'Prima', tipo: 'intero', peso: 1 },
          { titolo: 'Ingressi', tipo: 'intero', peso: 1 },
          { titolo: 'Uscite', tipo: 'intero', peso: 1 },
          { titolo: 'Attesa', tipo: 'intero', peso: 1 },
          { titolo: 'Letta al 31/12', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto della lettura', tipo: 'intero', peso: 1 },
          { titolo: 'Da salvare', tipo: 'intero', peso: 1 },
          { titolo: 'Scarto dopo la rettifica', tipo: 'intero', peso: 1 },
        ],
        righe: confronti,
      },
    ],
    note: [
      'La fotografia del 31 dicembre e’ il punto da cui ripartono le giacenze dell’anno dopo: si legge a portale, si confronta con quello che i movimenti dicono e si salva.',
      'Il periodo di un movimento e’ sempre la fine del trasporto. La chiusura a portale dice soltanto se la fotografia lo contiene gia’: i movimenti di dicembre non ancora chiusi non ci sono, e vanno decisi uno per uno.',
      ...(dossier.avvisi || []).map(a => a.testo),
    ],
  };
}

/** Scheda Derivati: che cosa e' uscito dal trattamento. */
export function derivatiPdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Derivati'),
    riepilogo: [
      { etichetta: 'Dichiarato', valore: totali.dichiarato_t, tipo: 't' },
      { etichetta: 'Granulo', valore: totali.granulo_t, tipo: 't' },
      { etichetta: 'Fibre', valore: totali.fibre_t, tipo: 't' },
      { etichetta: 'Metallo', valore: totali.metallo_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Derivati per sito',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Dichiarato', tipo: 't', peso: 1 },
        { titolo: 'Granulo', tipo: 't', peso: 1 },
        { titolo: 'Fibre', tipo: 't', peso: 1 },
        { titolo: 'Metallo', tipo: 't', peso: 1 },
        { titolo: 'Ciabattato', tipo: 't', peso: 1 },
        { titolo: 'Cippato', tipo: 't', peso: 1 },
      ],
      righe: righe.filter(r => r.dichiarato_t > 0).map(r => ({
        celle: [r.sito, ruolo(r), r.dichiarato_t, r.granulo_t, r.fibre_t, r.metallo_t, r.ciabattato_t, r.cippato_t],
      })),
    }],
  };
}

/** Scheda Target: target, conferito, residuo e copertura. */
export function targetPdf(anno, righe, totali) {
  return {
    ...comune(anno, 'Target'),
    riepilogo: [
      { etichetta: 'Target primarie', valore: totali.target_primarie_t, tipo: 't' },
      { etichetta: 'Target totale', valore: totali.target_totale_t, tipo: 't' },
      { etichetta: 'Primarie RETE', valore: totali.conferito_primarie_t, tipo: 't' },
      { etichetta: 'Conferito RETE', valore: totali.conferito_t, tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Target e conferito per sito',
      colonne: [
        { titolo: 'Sito', tipo: 'testo', peso: 2 },
        { titolo: 'Ruolo', tipo: 'testo', peso: 0.9 },
        { titolo: 'Target primarie', tipo: 't', peso: 1 },
        { titolo: 'Target totale', tipo: 't', peso: 1 },
        { titolo: 'Primarie RETE', tipo: 't', peso: 1 },
        { titolo: 'Secondarie', tipo: 't', peso: 1 },
        { titolo: 'Conferito RETE', tipo: 't', peso: 1 },
        { titolo: 'Residuo', tipo: 't', peso: 1 },
        { titolo: 'Copertura %', tipo: 'percentuale', peso: 0.8 },
        { titolo: 'ACI', tipo: 't', peso: 0.9 },
        { titolo: 'Extra raccolta', tipo: 't', peso: 0.9 },
      ],
      righe: righe.map(r => ({
        celle: [
          r.sito, ruolo(r), r.target_primarie_t, r.target_totale_t, r.conferito_primarie_t,
          r.secondarie_nette_t, r.conferito_t, r.residuo_t, r.percentuale_target,
          r.conferito_aci_t, r.conferito_extra_t,
        ],
      })),
    }],
    note: [
      'Residuo: target totale meno tutto quello che e’ arrivato, primarie e secondarie. Copertura: le sole primarie sul target totale.',
      'Il target delle primarie dei raccoglitori senza impianto scritto e’ ripartito mese per mese sui conferimenti.',
    ],
  };
}

/**
 * La griglia dei target dei raccoglitori di Target & Status: impianto,
 * raccoglitore, regione, i dodici target mensili e i totali. Dove l'impianto non
 * e' scritto si dice come il gestionale sta ripartendo quel target.
 */
export function targetRaccoglitoriPdf(anno, elenco, ripartizione) {
  const MESI_B = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const MESI_N = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const righe = (elenco || []).map(r => {
    const mesi = MESI_N.map(m => (r.mesi && r.mesi[m] && !r.mesi[m].non_raccoglie ? Number(r.mesi[m].target) || 0 : null));
    const somma = mesi.reduce((s, v) => s + (v || 0), 0);
    const annuo = r.annuo ? Number(r.annuo.target_tonnellate) || 0 : 0;
    const quote = r.impianto ? '' : ((ripartizione && ripartizione(r)) || []).map(q => `${q.impianto} ${q.pct}%`).join(', ');
    return {
      celle: [
        r.impianto || (quote ? `ripartito: ${quote}` : 'senza impianto'),
        r.nome, r.regione || '', annuo, ...mesi, somma, annuo ? Math.round((annuo - somma) * 1000) / 1000 : null,
      ],
    };
  });
  return {
    nomeFile: `target-raccoglitori-${anno}`,
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE',
    titolo: 'Target & Status · Target raccoglitori',
    sottotitolo: `Anno ${anno}`,
    riepilogo: [
      { etichetta: 'Righe', valore: righe.length, tipo: 'intero' },
      { etichetta: 'Target annuo totale', valore: righe.reduce((s, r) => s + (r.celle[3] || 0), 0), tipo: 't' },
    ],
    sezioni: [{
      titolo: 'Target per raccoglitore, impianto e regione',
      colonne: [
        { titolo: 'Impianto', tipo: 'testo', peso: 1.6 },
        { titolo: 'Raccoglitore', tipo: 'testo', peso: 1.6 },
        { titolo: 'Regione', tipo: 'testo', peso: 1 },
        { titolo: 'Annuo', tipo: 't', peso: 0.9 },
        ...MESI_B.map(m => ({ titolo: m, tipo: 't', peso: 0.7 })),
        { titolo: 'Somma mesi', tipo: 't', peso: 0.9 },
        { titolo: 'Da ripartire', tipo: 't', peso: 0.9 },
      ],
      righe,
    }],
    note: ['Dove l’impianto non e’ scritto, il target si ripartisce da se’ fra i siti dove quel raccoglitore ha portato le primarie dell’anno.'],
  };
}

// Prova delle sezioni PDF delle schede di Giacenze e Target & Status
// (src/lib/giacenzePdf.js), chieste dall'utente il 06/10/2026: «un pulsante per
// esportare in pdf la situazione presente in ogni momento».
//
// Qui si controlla la forma degli argomenti - quella che esportaSezioniPdf si
// aspetta - e due cose che si sbagliano facilmente: un valore di riepilogo senza
// `tipo` finisce scritto in EURO, e le percentuali non sono euro. npm run prove
import { situazionePdf, derivatiPdf, targetPdf, targetRaccoglitoriPdf, daDichiararePdf, stoccaggiPdf, chiusuraAnnoPdf } from '../src/lib/giacenzePdf.js';
import { readFileSync } from 'node:fs';
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const righe = [
  { sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', giacenza_portale_t: 555.34, giacenza_classi_kg: { P: 508460, M: 44080, G1: 7800, G2: 0, ACI: 0 }, in_attesa_dichiarazione_t: 0, ordini_da_dichiarare: 194, dichiarato_t: 2877.48, granulo_t: 1000, fibre_t: 200, metallo_t: 300, ciabattato_t: 0, cippato_t: 0, target_primarie_t: 3423.077, target_totale_t: 4445, conferito_primarie_t: 2716, secondarie_nette_t: 731.66, conferito_t: 3447.66, residuo_t: 997.34, percentuale_target: 61.1, conferito_aci_t: 0, conferito_extra_t: 0.46 },
  { sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', giacenza_portale_t: 30.44, giacenza_classi_kg: { P: 18180, M: 7270, G1: 4990, G2: 0, ACI: 0 }, in_attesa_dichiarazione_t: 836.04, ordini_da_dichiarare: 390, dichiarato_t: 0, target_primarie_t: 2437.844, target_totale_t: 0, conferito_primarie_t: 1626.84, secondarie_nette_t: -1631.36, conferito_t: 1626.84, residuo_t: null, percentuale_target: null, conferito_aci_t: 19.72, conferito_extra_t: 0 },
];
const totali = { giacenza_portale_t: 1447.83, giacenza_aci_t: 26.81, in_attesa_dichiarazione_t: 836.04, dichiarato_t: 5339.66, granulo_t: 1000, fibre_t: 200, metallo_t: 300, target_primarie_t: 11550, target_totale_t: 11545, conferito_primarie_t: 8575.62, conferito_t: 10466.41 };

const forma = (a, quante) => a && typeof a.nomeFile === 'string' && a.nomeFile.length > 0
  && typeof a.titolo === 'string' && Array.isArray(a.sezioni) && a.sezioni.length === quante
  && a.sezioni.every(s => Array.isArray(s.colonne) && Array.isArray(s.righe)
    && s.righe.every(r => Array.isArray(r.celle) && r.celle.length === s.colonne.length));

console.log('LE TRE SCHEDE DI GIACENZE');
{
  const s = situazionePdf(2026, righe, totali);
  verifica('situazione: la forma e\' quella che esportaSezioniPdf si aspetta', forma(s, 1), JSON.stringify(s.sezioni?.[0]?.righe?.[0]));
  verifica('e ogni riga ha tante celle quante le colonne',
    s.sezioni[0].righe.length === 2 && s.sezioni[0].righe[0].celle.length === s.sezioni[0].colonne.length);
  verifica('il ruolo si legge a parole, non come sigla',
    s.sezioni[0].righe[0].celle[1] === 'Impianto' && s.sezioni[0].righe[1].celle[1] === 'Stoccaggio');

  const d = derivatiPdf(2026, righe, totali);
  verifica('derivati: ci sono solo i siti che hanno dichiarato', forma(d, 1) && d.sezioni[0].righe.length === 1);

  const t = targetPdf(2026, righe, totali);
  verifica('target: la forma torna', forma(t, 1));
  verifica('una percentuale ha il suo tipo, altrimenti il PDF la scrive in euro',
    t.sezioni[0].colonne.find(c => c.titolo === 'Copertura %')?.tipo === 'percentuale',
    JSON.stringify(t.sezioni[0].colonne.map(c => [c.titolo, c.tipo])));
  verifica('un residuo che non c\'e\' resta vuoto e non diventa zero',
    t.sezioni[0].righe[1].celle[7] === null, String(t.sezioni[0].righe[1].celle[7]));
}

// LE ALTRE TRE SCHEDE DI GIACENZE (09/10/2026).
//
// La regola e' del 06/10/2026 - «in tutte le loro sotto sezioni dovrebbe
// esserci un pulsante per esportare in pdf la situazione presente in ogni
// momento» - e mancavano Da dichiarare, Stoccaggi e Chiusura anno.
const daDichiarare = {
  totale_righe: 118,
  totale_kg: 364800,
  per_mese: [
    { mese: '2026-06', ordini: 16, kg: 41980 }, { mese: '2026-07', ordini: 39, kg: 108680 },
    { mese: '2026-08', ordini: 13, kg: 48420 }, { mese: '2026-09', ordini: 34, kg: 124800 },
    { mese: '2026-10', ordini: 16, kg: 40920 }, { mese: '', ordini: 0, kg: 0 },
  ],
  date_da_sistemare: { n: 2, kg: 5000 },
  righe: [
    { ordine_primaria: 'ET26080175', numero_fir: 'RTXZV001492NY', fine_trasporto: '2026-06-11', giorni_attesa: 120, punto_di_raccolta: 'ALC SRLS', comune: 'San Marcellino', provincia: 'CE', prodotto: '.class1', peso_non_dichiarato_kg: 3580, destinazione: 'T-CYCLE INDUSTRIES SRL', destinazione_secondaria: '', date_da_sistemare: [] },
    { ordine_primaria: 'ET26115824', numero_fir: '', fine_trasporto: null, giorni_attesa: null, punto_di_raccolta: 'DI COSTANZO GOMME SRL', comune: 'Pozzuoli', provincia: 'NA', prodotto: '.class2', peso_non_dichiarato_kg: 3420, destinazione: 'T-CYCLE INDUSTRIES SRL', destinazione_secondaria: '', date_da_sistemare: [{ tipo: 'primaria', id_ordine: 'ET26115824', testo: 'manca la fine trasporto' }] },
  ],
};

console.log('LA SCHEDA DA DICHIARARE');
{
  const a = daDichiararePdf(2026, daDichiarare, { sito: 'T-CYCLE INDUSTRIES SRL', ruolo: 'imp' });
  verifica('due sezioni: i mesi e gli ordini', forma(a, 2) && a.sezioni[0].titolo === 'Di quali mesi sono');
  // IL TOTALE E' DELL'ELENCO, NON DELLA PAGINA: e' il difetto corretto il
  // 09/10/2026, e in un PDF sarebbe lo stesso inganno.
  verifica('il totale e quello di tutto l elenco, non delle righe in pagina',
    a.riepilogo[0].valore === 118 && a.riepilogo[1].valore === 364800 && a.sezioni[1].righe.length === 3);
  verifica('la riga del totale e in fondo agli ordini, col suo stile',
    !!a.sezioni[1].righe[2] && a.sezioni[1].righe[2].stile === 'totale' && a.sezioni[1].righe[2].celle[8] === 364800);
  verifica('i mesi tornano col totale',
    a.sezioni[0].righe.filter(r => !r.stile).reduce((s, r) => s + r.celle[2], 0) === 364800);
  verifica('un mese si legge a parole e chi non ha la data lo dice',
    a.sezioni[0].righe[0].celle[0] === 'Giu 2026' && a.sezioni[0].righe[5].celle[0] === 'senza fine trasporto');
  verifica('il sottotitolo dice con quali filtri e stato fatto',
    /T-CYCLE INDUSTRIES SRL/.test(a.sottotitolo) && /impianto/.test(a.sottotitolo), a.sottotitolo);
  verifica('la fine trasporto si scrive all italiana', a.sezioni[1].righe[0].celle[2] === '11/06/2026');
  verifica('e il formulario da correggere arriva nel PDF',
    /manca la fine trasporto/.test(a.sezioni[1].righe[1].celle[11]));
  verifica('senza filtri il sottotitolo dice che ci sono tutti i siti',
    daDichiararePdf(2026, daDichiarare, {}).sottotitolo === 'Tutti i siti');
}

console.log('LA SCHEDA STOCCAGGI');
{
  const piazzali = [
    { sito: 'NAPPI SUD SRL', descrizione_unita: 'Piazzale Levatelle', id_unita_stoccaggio: 30041, comune: 'Eboli', provincia: 'SA', data_rilevazione: '2026-10-05', class1_kg: 18180, class2_kg: 7270, class3_kg: 4990, class4_kg: 0, class9_kg: 0, giacenza_rete_t: 38.04, giacenza_aci_t: 0 },
    { sito: 'T-CYCLE INDUSTRIES SRL', descrizione_unita: '', id_unita_stoccaggio: null, comune: '', provincia: '', data_rilevazione: '2026-09-30', class1_kg: 100000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 2000, giacenza_rete_t: null, giacenza_aci_t: null },
  ];
  const a = stoccaggiPdf(2026, piazzali, (r) => (r.sito === 'NAPPI SUD SRL' ? 'Il controllo quadra.' : ''));
  verifica('la forma torna', forma(a, 1));
  // La lettura e la giacenza di oggi sono due cose diverse e restano due
  // colonne diverse (06/10/2026).
  verifica('letto e giacenza di oggi stanno in colonne diverse',
    a.sezioni[0].colonne.map(c => c.titolo).join('|').includes('Letto rete (t)|Letto ACI (t)|Oggi rete (t)|Oggi ACI (t)'));
  verifica('il letto si ricava dalle classi, rete e ACI separate',
    a.sezioni[0].righe[0].celle[8] === 30.44 && a.sezioni[0].righe[0].celle[9] === 0,
    JSON.stringify(a.sezioni[0].righe[0].celle.slice(8, 10)));
  verifica('e il totale del riepilogo non somma mai rete e ACI',
    a.riepilogo.find(r => /rete/i.test(r.etichetta)) && a.riepilogo.find(r => /ACI/.test(r.etichetta)));
  verifica('una giacenza di oggi che non c e resta vuota, non zero',
    a.sezioni[0].righe[1].celle[10] === null, String(a.sezioni[0].righe[1].celle[10]));
  verifica('l esito del controllo arriva a parole', a.sezioni[0].righe[0].celle[12] === 'Il controllo quadra.');
  verifica('un piazzale senza unita locale non inventa un nome', a.sezioni[0].righe[1].celle[0] === '');
  // Una cella del PDF tiene tre righe e poi taglia: il verdetto sta in colonna,
  // la frase intera in coda, cosi' non esce mozzata a meta' parola (09/10/2026).
  const b = stoccaggiPdf(2026, piazzali, (r) => (r.sito === 'NAPPI SUD SRL'
    ? { breve: 'Si scostano le classi P, M: P -12.700 kg · M -11.480 kg', lungo: 'Rilevazione del 05/10/2026, confrontata con quella del 23/09/2026 piu\' i movimenti del periodo: 2 classi leggono meno di quello che i movimenti dicono.' }
    : { breve: 'Il controllo quadra', lungo: '' }));
  verifica('in colonna va il verdetto corto', b.sezioni[0].righe[0].celle[12] === 'Si scostano le classi P, M: P -12.700 kg · M -11.480 kg');
  verifica('e la frase intera finisce in coda, col nome del piazzale',
    b.note.some(n => n.startsWith('NAPPI SUD SRL: Rilevazione del 05/10/2026')), JSON.stringify(b.note[0]));
  verifica('chi non ha niente da raccontare non aggiunge una nota vuota',
    !b.note.some(n => n.startsWith('T-CYCLE')));
}

console.log('LA SCHEDA CHIUSURA ANNO');
{
  const dossier = {
    anno: 2025, giorno: '2025-12-31',
    riepilogo: { piazzali: 1, piazzali_pronti: 1, letture_mancanti: 0, voci_da_decidere: 1 },
    avvisi: [{ testo: 'Una lettura manca' }],
    richieste: [{ tipo: 'piazzale', chiave: 'nappisud', nome: 'NAPPI SUD SRL', cosa: 'il saldo per classe', dove: 'Unita\' Locali di Stoccaggio', dicembre: { n: 2, per_canale: { RETE: { n: 2, netto_kg: 4000 } } }, stato: 'da chiedere' }],
    piazzali: [{
      sito: 'nappisud', nome: 'NAPPI SUD SRL', precedente_del: '2025-11-30', giorno: '2025-12-31', pronto: true, gia_salvata: false, blocchi: [],
      lettura: { P: 10000, M: 2000, G1: 0, G2: 0, ACI: 0 },
      rettifica: { classi: { P: 12000, M: 2000, G1: 0, G2: 0, ACI: 0 }, applicate: [{ chiave: 'k1' }], ignorate: [], fuori_portale: [] },
      attesa: [{ classe: 'P', canale: 'RETE', precedente_kg: 8000, ingressi: 2, ingressi_kg: 4000, uscite: 0, uscite_kg: 0, atteso: 12000 }],
      verifica_lettura: { classi: [{ classe: 'P', scarto: -2000 }] },
      verifica_da_salvare: { classi: [{ classe: 'P', scarto: 0 }] },
    }],
    impianti: [{ chiave: 'irigom', nome: 'Irigom S.r.l.', lettura_kg: 385360, lettura_aci_kg: null, lettera: { pfu_kg: 385000, aci_kg: 0 }, scarto_kg: 360, scarto_aci_kg: null }],
    elenco_dicembre: {
      n: 1, n_prima: 1,
      voci: [{ chiave: 'k1', sito: 'nappisud', nome: 'NAPPI SUD SRL', ruolo: 'stoc', tipo: 'primaria', canale: 'RETE', id_ordine: 'ET25999', numero_fir: 'FIR1', classe: 'P', verso: 'ingresso', kg: 2000, finito_il: '2025-12-30', chiuso_il: '', controparte: 'GOMME SRL', perche: 'finito a dicembre, chiuso a portale dopo la fotografia' }],
      aperti_prima: [{ chiave: 'k2', sito: 'nappisud', nome: 'NAPPI SUD SRL', ruolo: 'stoc', tipo: 'secondaria', canale: 'RETE', id_ordine: 'SEC25888', numero_fir: 'FIR2', classe: 'M', verso: 'uscita', kg: 1500, finito_il: '2025-11-02', chiuso_il: '2025-12-20', controparte: 'Irigom S.r.l.', perche: 'finito prima di dicembre e ancora aperto' }],
    },
  };
  const a = chiusuraAnnoPdf(dossier, {
    decisioneDi: (v) => (v.chiave === 'k1' ? 'rettificata' : 'da decidere'),
    pesoInParole: (p) => Object.entries(p).map(([c, s]) => `${c}: ${s.n} per ${s.netto_kg} kg netti`).join(' · '),
    nomeCanale: (c) => (c === 'RETE' ? 'rete' : String(c).toLowerCase()),
  });
  verifica('cinque sezioni: richieste, letture piazzali, letture impianti, dicembre, confronto', forma(a, 5));
  verifica('il titolo porta l anno della chiusura e il sottotitolo il giorno della fotografia',
    a.titolo === 'Giacenze · Chiusura 2025' && a.sottotitolo === 'Fotografia del 31/12/2025');
  verifica('la lettura dell impianto si legge dal campo giusto',
    a.sezioni[2].righe[0].celle[1] === 385360, JSON.stringify(a.sezioni[2].righe[0].celle));
  // Nel dossier Excel un'uscita si scrive col segno meno: il PDF fa lo stesso,
  // altrimenti due fogli dello stesso dato direbbero numeri diversi.
  verifica('un uscita porta il segno meno, come nel dossier Excel',
    a.sezioni[3].righe[1].celle[7] === -1500, String(a.sezioni[3].righe[1].celle[7]));
  verifica('le voci di dicembre e quelle aperte da prima ci sono tutte, con la loro decisione',
    a.sezioni[3].righe.length === 2 && a.sezioni[3].righe[0].celle[11] === 'rettificata' && a.sezioni[3].righe[1].celle[11] === 'non si rettifica da qui');
  verifica('e si dice perche una voce e in elenco', /chiuso a portale dopo/.test(a.sezioni[3].righe[0].celle[12]));
  // La riga di gruppo dice tutto nella PRIMA cella, che e' la piu' larga:
  // messo nella seconda - la colonna «Classe» - «nessuna rilevazione
  // precedente» usciva spezzato in «nessuna / rilevazio / ne prece».
  verifica('il confronto apre con la riga del piazzale e poi le classi',
    a.sezioni[4].righe[0].stile === 'gruppo' && a.sezioni[4].righe[1].celle[1] === 'P');
  verifica('la riga del piazzale dice tutto nella prima cella, le altre sono vuote',
    a.sezioni[4].righe[0].celle[0] === 'NAPPI SUD SRL — dal 30/11/2025'
    && a.sezioni[4].righe[0].celle.slice(1).every(c => c === null), JSON.stringify(a.sezioni[4].righe[0].celle));
  verifica('gli avvisi del dossier finiscono nelle note', a.note.some(n => n === 'Una lettura manca'));
  verifica('un movimento non ancora chiuso a portale lo dice', a.sezioni[3].righe[0].celle[9] === 'non ancora');
}

console.log('OGNI VALORE DI RIEPILOGO DICE CHE COS\'E\'');
{
  // esportaTabella.js: `testoCella(r.valore, r.tipo || 'euro')`. Un riquadro
  // senza tipo stampa "11.550,00 €" al posto di "11.550,00 t".
  const chiusuraVuota = chiusuraAnnoPdf({ anno: 2025, giorno: '2025-12-31', riepilogo: { piazzali: 0, piazzali_pronti: 0, letture_mancanti: 0, voci_da_decidere: 0 }, piazzali: [], impianti: [], richieste: [], elenco_dicembre: { voci: [], aperti_prima: [] }, avvisi: [] });
  for (const [nome, a] of [
    ['situazione', situazionePdf(2026, righe, totali)], ['derivati', derivatiPdf(2026, righe, totali)],
    ['target', targetPdf(2026, righe, totali)], ['raccoglitori', targetRaccoglitoriPdf(2026, [], null)],
    ['da dichiarare', daDichiararePdf(2026, daDichiarare, {})], ['stoccaggi', stoccaggiPdf(2026, [], () => '')],
    ['chiusura', chiusuraVuota],
  ]) {
    verifica(`${nome}: nessun riquadro di riepilogo senza tipo`,
      (a.riepilogo || []).every(r => !!r.tipo), JSON.stringify((a.riepilogo || []).filter(r => !r.tipo)));
  }
}

// IL TITOLO DELLE NOTE IN CODA (09/10/2026).
//
// esportaSezioniPdf scriveva sempre «Anomalie da guardare prima di pagare»: in
// fatturazione e' giusto, nelle schede di Giacenze le note spiegano come si
// leggono i numeri e quel titolo diceva un'altra cosa.
console.log('LE NOTE IN CODA HANNO IL TITOLO GIUSTO');
{
  for (const [nome, a] of [
    ['situazione', situazionePdf(2026, righe, totali)], ['target', targetPdf(2026, righe, totali)],
    ['da dichiarare', daDichiararePdf(2026, daDichiarare, {})], ['stoccaggi', stoccaggiPdf(2026, [], () => '')],
  ]) {
    verifica(`${nome}: le note non si chiamano anomalie di fatturazione`, a.titoloNote === 'Come si leggono questi numeri', String(a.titoloNote));
  }
  const e = sorgente('src/lib/esportaTabella.js');
  verifica('il titolo delle note e un parametro, col vecchio come default',
    e.includes("titoloNote = 'Anomalie da guardare prima di pagare'") && e.includes('doc.text(perPdf(titoloNote), M, y + 4)'));
}

console.log('OGNI SOTTOSEZIONE DI GIACENZE HA IL SUO PULSANTE');
{
  // La regola dell'utente del 06/10/2026 vale per tutte le schede del modulo:
  // qui si controlla che nessuna resti senza, perche' una scheda in piu' domani
  // nascerebbe muta e nessuno se ne accorgerebbe.
  const pagina = sorgente('src/pages/Giacenze.jsx');
  const schede = [...pagina.matchAll(/<TabsTrigger value="([a-z]+)"/g)].map(m => m[1]);
  verifica('le schede sono sei', schede.length === 6, schede.join(', '));
  const conPulsante = {
    situazione: pagina.includes('situazionePdf'),
    dichiarare: sorgente('src/components/giacenze/DaDichiarareTable.jsx').includes('<EsportaPdf'),
    derivati: pagina.includes('derivatiPdf'),
    target: pagina.includes('targetPdf'),
    stoccaggi: sorgente('src/components/giacenze/StoccaggiManager.jsx').includes('<EsportaPdf'),
    chiusura: sorgente('src/components/giacenze/ChiusuraAnno.jsx').includes('<EsportaPdf'),
  };
  for (const s of schede) verifica(`la scheda ${s} ha il pulsante PDF`, conPulsante[s] === true);
  // Il PDF di «Da dichiarare» va a prendersi tutte le righe: il pulsante deve
  // quindi saper aspettare una funzione asincrona.
  verifica('il pulsante aspetta anche una funzione asincrona',
    sorgente('src/components/shared/EsportaPdf.jsx').includes('await (typeof sezioni === \'function\' ? sezioni() : sezioni)'));
  verifica('e quello di Da dichiarare chiede tutte le righe, non la pagina',
    sorgente('src/components/giacenze/DaDichiarareTable.jsx').includes('payloadFiltrato()'));
  // La regola di che fine ha fatto una voce di dicembre sta in un posto solo:
  // il dossier Excel e il PDF non possono dire due cose diverse.
  const c = sorgente('src/components/giacenze/ChiusuraAnno.jsx');
  verifica('la decisione di una voce si calcola in un posto solo',
    c.includes('export function decisioneDiVoce') && c.includes('const decisioneDi = (v) => decisioneDiVoce(dossier, v);'));
}

console.log('LA GRIGLIA DEI TARGET DEI RACCOGLITORI');
{
  const elenco = [
    { nome: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM SRL', annuo: { target_tonnellate: 1850 }, mesi: { Gennaio: { target: 140 }, Febbraio: { target: 160 } } },
    { nome: 'EMMESSE SRLS', regione: 'Calabria', impianto: '', annuo: { target_tonnellate: 50 }, mesi: { Maggio: { target: 10 } } },
  ];
  const quote = (r) => (r.nome === 'EMMESSE SRLS' ? [{ impianto: 'Irigom S.r.l.', pct: 62 }, { impianto: 'Gatim', pct: 38 }] : []);
  const a = targetRaccoglitoriPdf(2026, elenco, quote);
  verifica('la forma torna e le celle sono quante le colonne', forma(a, 1));
  verifica('chi ha l\'impianto scritto lo mostra', a.sezioni[0].righe[0].celle[0] === 'IRIGOM SRL');
  verifica('chi non ce l\'ha dice come il gestionale lo sta ripartendo',
    a.sezioni[0].righe[1].celle[0] === 'ripartito: Irigom S.r.l. 62%, Gatim 38%', a.sezioni[0].righe[1].celle[0]);
  verifica('la somma dei mesi e il da ripartire sono calcolati, non copiati',
    a.sezioni[0].righe[0].celle[16] === 300 && a.sezioni[0].righe[0].celle[17] === 1550,
    JSON.stringify(a.sezioni[0].righe[0].celle.slice(15)));
  verifica('un mese che non raccoglie resta vuoto, non zero',
    targetRaccoglitoriPdf(2026, [{ nome: 'X', mesi: { Gennaio: { target: 10, non_raccoglie: true } }, annuo: null }], null).sezioni[0].righe[0].celle[4] === null);
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

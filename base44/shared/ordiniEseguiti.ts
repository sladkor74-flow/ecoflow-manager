// GLI ORDINI RIMASTI «ESEGUITO» A PORTALE, IN UN POSTO SOLO (richiesta
// dell'utente del 14/10/2026).
//
// Parole dell'utente: «ad ogni caricamento di primarie, secondarie o terziarie,
// qualora risultassero degli ordini in stato "eseguito", quindi non terminato,
// non cancellato e non assegnato, devono essere sempre segnalati indicando l'id
// ordine affinche' vi si possa porre subito rimedio; questo e' infatti uno stato
// di "limbo" che non ha alcun senso e deve tramutarsi in un altro dei tre
// stati». E: «nel modo migliore, piu' elegante, professionale e meno invasivo
// possibile».
//
// Un ordine «eseguito» ha tutti i dati inseriti ma a portale nessuno ha premuto
// Chiudi (eEseguito in movimenti.ts). Il gestionale conta solo i terminati,
// quindi finche' resta cosi' quell'ordine non entra in nessun conto. Si SEGNALA
// e si MANTIENE (decisione del 28/09/2026, storicoConservato.ts): mai cancellato,
// mai sommato ai terminati. Si risolve da solo al caricamento dopo, quando il
// portale gli da' lo stato definitivo - se l'export lo riporta: uno immesso
// prima dell'anno da cui parte l'export resta «eseguito» finche' non si carica
// un export che parte dal suo anno, e le frasi lo dicono (fraseFuoriExport).
//
// Fino a oggi lo dicevano in quattro modi diversi la finestra del caricamento
// delle primarie (solo i conti, dal file), le pagine (dall'archivio, gli ID in
// una tendina), lo storico conservato (solo quanti) e la chiusura del mese; le
// secondarie e le terziarie, al caricamento, non lo dicevano affatto. Qui c'e'
// la regola sola: dalle righe di un archivio dopo il caricamento, l'elenco
// degli ordini per tipo di file e per canale - primarie rete, primarie ACI,
// secondarie rete e ACI, terziarie rete e ACI, mai sommati fra loro - con l'ID,
// il formulario, il raccoglitore o trasportatore, il punto di raccolta o lo
// stoccaggio, la fine trasporto e da quanti giorni, i chili e la frase di che
// cosa manca. La usano l'esito del caricamento (importaBlocco per le primarie,
// importEcotyreFile per secondarie e terziarie), la voce della dashboard
// (cruscotto.ts) e l'avviso delle pagine (AvvisoEseguiti.jsx), cosi' i tre posti
// dicono le stesse cose degli stessi ordini.
//
// LE LETTURE. Una sola per archivio, filtrata per stato (FILTRO_ESEGUITI): sono
// poche righe, di solito nessuna. Mai una lettura per riga o per soggetto. La
// fanno le funzioni con leggiEseguiti (shared/ordiniEseguitiLettura.ts), che sta
// a parte perche' le pagine non leggono archivi per nome.
//
// DA QUANTI GIORNI. Il caricamento che ha visto l'ordine «eseguito» per la prima
// volta non e' scritto da nessuna parte: l'archivio si riscrive a ogni
// caricamento e il registro non teneva gli ID. Si misura dalla fine del
// trasporto, il giorno da cui il dato e' completo e l'ordine si poteva chiudere.
//
// L'extra raccolta non c'e': si inserisce dal suo modulo e ha due stati soli,
// assegnato e terminato.
//
// Specchio nel browser: src/lib/ordiniEseguiti.js (stesso corpo, cambiano solo
// le righe di import).
import { eEseguito, chiaveOrdine, giornoMovimento, primoAnnoControllato } from "./movimenti.ts";
import { canaleDi } from "./canaleSecondaria.ts";
import { giornoPortale, annoPortale } from "./giornoItaliano.ts";

/**
 * I gruppi, nell'ordine in cui si dicono. Un tipo di file e un canale per
 * volta: rete e ACI non si sommano mai (regola 3), e nemmeno primarie,
 * secondarie e terziarie, che sono movimenti diversi. 'detto' e' il nome dentro
 * una frase, 'chi' come si chiama chi ha fatto il trasporto, 'dove' da dove
 * parte il materiale.
 */
export const GRUPPI_ESEGUITI = [
  { chiave: 'primarie_rete', tipo: 'primarie', canale: 'RETE', nome: 'Primarie rete', detto: 'primarie rete', link: '/primarie-rete', entita: 'PrimariaRete', chi: 'Raccoglitore', dove: 'Punto di raccolta', file: 'delle primarie' },
  { chiave: 'primarie_aci', tipo: 'primarie', canale: 'ACI', nome: 'Primarie ACI', detto: 'primarie ACI', link: '/primarie-aci', entita: 'PrimariaAci', chi: 'Raccoglitore', dove: 'Punto di raccolta', file: 'delle primarie' },
  { chiave: 'secondarie_rete', tipo: 'secondarie', canale: 'RETE', nome: 'Secondarie rete', detto: 'secondarie rete', link: '/secondarie', entita: 'Secondaria', chi: 'Trasportatore', dove: 'Stoccaggio', file: 'delle secondarie' },
  { chiave: 'secondarie_aci', tipo: 'secondarie', canale: 'ACI', nome: 'Secondarie ACI', detto: 'secondarie ACI', link: '/secondarie', entita: 'Secondaria', chi: 'Trasportatore', dove: 'Stoccaggio', file: 'delle secondarie' },
  { chiave: 'terziarie_rete', tipo: 'terziarie', canale: 'RETE', nome: 'Terziarie rete', detto: 'terziarie rete', link: '/terziarie', entita: 'Terziaria', chi: 'Trasportatore', dove: 'Origine', file: 'delle terziarie' },
  { chiave: 'terziarie_aci', tipo: 'terziarie', canale: 'ACI', nome: 'Terziarie ACI', detto: 'terziarie ACI', link: '/terziarie', entita: 'Terziaria', chi: 'Trasportatore', dove: 'Origine', file: 'delle terziarie' },
];

/** Gli archivi che possono avere ordini «eseguito»: uno per lettura. */
export const ARCHIVI_CON_ESEGUITI = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'Terziaria'];

/**
 * Il filtro della lettura. Lo stato negli archivi e' sempre minuscolo: tutte e
 * due le strade di caricamento lo scrivono cosi' (importaBlocco e
 * importEcotyreFile).
 */
export const FILTRO_ESEGUITI = { stato: 'eseguito' };

/** Come si chiama un archivio a parole, per dire quale non si e' potuto leggere. */
const NOME_ARCHIVIO = { PrimariaRete: 'Primarie rete', PrimariaAci: 'Primarie ACI', Secondaria: 'Secondarie', Terziaria: 'Terziarie' };

/**
 * Il gruppo di una riga: le primarie per archivio (lo smistamento rete/ACI l'ha
 * gia' fatto il caricamento), secondarie e terziarie per materiale, con la
 * regola delle loro pagine (canaleDi).
 */
export function gruppoDi(entita, r) {
  if (entita === 'PrimariaRete') return 'primarie_rete';
  if (entita === 'PrimariaAci') return 'primarie_aci';
  const aci = canaleDi(r) === 'ACI';
  if (entita === 'Secondaria') return aci ? 'secondarie_aci' : 'secondarie_rete';
  if (entita === 'Terziaria') return aci ? 'terziarie_aci' : 'terziarie_rete';
  return null;
}

// I giorni fra due giorni 'AAAA-MM-GG', a mezzanotte UTC: l'ora legale non li sposta.
const giorniFra = (da, a) => Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+da.slice(0, 4), +da.slice(5, 7) - 1, +da.slice(8, 10))) / 86400000);

/** Un giorno 'AAAA-MM-GG' scritto gg/mm/aaaa. */
export const ilGiorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');

/** Un intero all'italiana, col punto delle migliaia: 3.620. */
export const intero = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const testo = (v) => String(v === null || v === undefined ? '' : v).trim();

/**
 * Che cosa manca, in parole semplici. Tre casi:
 * - immesso prima dell'anno da cui parte l'export (fuori_export): il portale
 *   non lo riporta piu', quindi qui resta «eseguito» anche dopo averlo chiuso,
 *   finche' non si carica un export che parte dal suo anno;
 * - senza fine trasporto: a portale manca anche quella;
 * - altrimenti manca solo il clic su Chiudi.
 */
export function cosaManca(o) {
  if (o.fuori_export) {
    return `Manca lo stato definitivo: va chiuso a portale, ma è immesso nel ${o.anno_immissione} e l'export parte dal ${o.anno_inizio}, quindi qui resta «eseguito» finché non si carica un export che parte dal ${o.anno_immissione}`;
  }
  if (!o.fine_trasporto) return 'A portale mancano la fine del trasporto e il clic su Chiudi';
  return 'Manca il clic su Chiudi a portale';
}

/**
 * LA REGOLA. archivi: { PrimariaRete, PrimariaAci, Secondaria, Terziaria }, ogni
 * valore le righe di quell'archivio (intere o gia' filtrate per stato: qui si
 * tengono solo le «eseguito»). Un archivio che vale null non si e' potuto
 * leggere: finisce in non_letti, e nessuno lo scambia per «nessun eseguito».
 * Un archivio che non c'e' fra le chiavi non si e' chiesto e non si dice.
 *
 * opzioni: oggi ('AAAA-MM-GG', per i giorni dalla fine trasporto), annoInizio
 * (il primo anno dell'export dal portale; se manca, quello del gestionale:
 * l'anno scorso), massimo (quanti ordini per gruppo nell'elenco; i conti sono
 * sempre interi).
 *
 * Restituisce { gruppi, non_letti, ids }. gruppi: solo quelli con almeno un
 * ordine, nell'ordine di GRUPPI_ESEGUITI, ciascuno { ...gruppo, ordini, righe,
 * kg, fuori_export, anno_fuori_export, anno_inizio, elenco }: fuori_export e'
 * quanti ordini del gruppo sono immessi prima dell'anno da cui parte l'export,
 * anno_fuori_export il piu' vecchio dei loro anni di immissione (null se non ce
 * ne sono). Un ordine dell'elenco: { id_ordine, numero_fir, soggetto,
 * luogo, provincia, destinazione, immesso_il, fine_trasporto, giorni, kg,
 * righe, fuori_export, anno_immissione, anno_inizio, manca }. kg e' null se
 * nessuna riga dice il peso: un valore che manca non e' zero.
 */
export function ordiniEseguiti(archivi, { oggi = '', annoInizio = null, massimo = 200 } = {}) {
  const inizio = annoInizio || (oggi ? primoAnnoControllato(oggi) : null);
  const perGruppo = new Map();
  const nonLetti = [];
  for (const entita of ARCHIVI_CON_ESEGUITI) {
    if (!archivi || !(entita in archivi)) continue;
    const righe = archivi[entita];
    if (!Array.isArray(righe)) { nonLetti.push(NOME_ARCHIVIO[entita]); continue; }
    righe.forEach((r, i) => {
      if (!eEseguito(r)) return;
      const g = gruppoDi(entita, r);
      if (!perGruppo.has(g)) perGruppo.set(g, new Map());
      const ordini = perGruppo.get(g);
      const k = chiaveOrdine(r, i);
      if (!ordini.has(k)) ordini.set(k, []);
      ordini.get(k).push(r);
    });
  }
  const gruppi = [];
  for (const G of GRUPPI_ESEGUITI) {
    const ordini = perGruppo.get(G.chiave);
    if (!ordini || !ordini.size) continue;
    const elenco = [...ordini.values()].map(suoi => {
      const primo = (campo) => testo((suoi.find(r => testo(r && r[campo])) || {})[campo]);
      // La fine trasporto di un ordine e' una: se le righe ne portano piu' d'una
      // vale la piu' recente, che e' quella da cui l'ordine si poteva chiudere.
      const fine = suoi.map(giornoMovimento).filter(Boolean).sort().pop() || '';
      // L'immissione e' l'ora del portale, l'ora italiana scritta con la Z: si
      // legge il giorno scritto (giornoPortale, difetto 9, 16/10/2026). Con
      // giornoRoma un ordine immesso il 31/12 alle 23:30 cadeva nell'anno dopo, e
      // la frase di chi e' fuori dall'export sbagliava l'anno.
      const immesso = suoi.map(r => giornoPortale(r && r.ordine_immesso_il)).filter(Boolean).sort()[0] || '';
      const annoImmissione = annoPortale(immesso);
      const pesi = suoi.map(r => r && r.peso_effettivo).filter(p => p !== null && p !== undefined && p !== '' && Number.isFinite(Number(p)));
      const luogo = G.tipo === 'primarie'
        ? [primo('punto_di_raccolta') || primo('ragione_sociale'), primo('id_pdr') ? `PDR ${primo('id_pdr')}` : ''].filter(Boolean).join(' · ')
        : G.tipo === 'secondarie' ? (primo('stoccaggio') || primo('ragione_sociale')) : (primo('unita_locale_origine') || primo('ragione_sociale'));
      const o = {
        id_ordine: primo('id_ordine'),
        numero_fir: primo('numero_fir'),
        soggetto: primo('trasportatore'),
        luogo,
        provincia: primo('provincia'),
        destinazione: primo('destinazione'),
        immesso_il: immesso || null,
        fine_trasporto: fine || null,
        giorni: fine && oggi ? Math.max(0, giorniFra(fine, oggi)) : null,
        kg: pesi.length ? Math.round(pesi.reduce((s, p) => s + Number(p), 0)) : null,
        righe: suoi.length,
        fuori_export: !!(inizio && annoImmissione && annoImmissione < inizio),
        anno_immissione: annoImmissione,
        anno_inizio: inizio,
      };
      return { ...o, manca: cosaManca(o) };
    });
    // Prima chi aspetta da piu' tempo; chi non ha fine trasporto in testa,
    // perche' gli manca qualcosa in piu'.
    elenco.sort((a, b) => (a.fine_trasporto || '').localeCompare(b.fine_trasporto || '') || a.id_ordine.localeCompare(b.id_ordine));
    // Quelli fuori dall'export si contano su tutti, prima di tagliare
    // l'elenco: la frase che li riguarda (fraseFuoriExport) non deve dipendere
    // da quanti se ne mostrano.
    const fuori = elenco.filter(o => o.fuori_export);
    gruppi.push({
      ...G,
      ordini: elenco.length,
      righe: elenco.reduce((s, o) => s + o.righe, 0),
      kg: elenco.some(o => o.kg !== null) ? elenco.reduce((s, o) => s + (o.kg || 0), 0) : null,
      fuori_export: fuori.length,
      anno_fuori_export: fuori.length ? Math.min(...fuori.map(o => o.anno_immissione)) : null,
      anno_inizio: inizio,
      elenco: elenco.slice(0, massimo),
    });
  }
  return { gruppi, non_letti: nonLetti, ids: gruppi.flatMap(g => g.elenco.map(o => o.id_ordine || o.numero_fir).filter(Boolean)) };
}

/** Quanti ordini, a parole: «1 ordine», «3 ordini». */
export const quantiOrdini = (n) => `${intero(n)} ${n === 1 ? 'ordine' : 'ordini'}`;

/**
 * Un ordine in una riga: l'ID (o il formulario), da quando aspetta e, se e'
 * fuori dall'export, l'anno di immissione, che dice da che anno deve partire
 * l'export che lo risolve (fraseFuoriExport).
 */
export function ordineInBreve(o) {
  const id = o.id_ordine || (o.numero_fir ? `FIR ${o.numero_fir}` : 'senza ID');
  const quando = o.fine_trasporto
    ? `fine trasporto ${ilGiorno(o.fine_trasporto)}${o.giorni !== null && o.giorni !== undefined ? `, ${o.giorni === 0 ? 'oggi' : o.giorni === 1 ? 'ieri' : `${intero(o.giorni)} giorni fa`}` : ''}`
    : 'senza fine trasporto';
  return `${id} (${quando}${o.fuori_export ? `, immesso nel ${o.anno_immissione}, fuori dall'export` : ''})`;
}

/** Che cosa vuol dire, uguale dappertutto. */
const CHE_COSA_VUOL_DIRE = 'Hanno tutti i dati ma a portale nessuno ha premuto Chiudi: finché restano così non entrano in nessun conto (raccolto, giacenze, report, copertura del target, fatturazione).';

/** La spiegazione quando l'export li riporta tutti: che cosa vuol dire e che cosa fare. */
export const SPIEGAZIONE_ESEGUITI = `${CHE_COSA_VUOL_DIRE} Si chiudono a portale; al caricamento dopo prendono lo stato definitivo e spariscono da soli.`;

/**
 * LA FRASE PER QUELLI FUORI DALL'EXPORT; '' se non ce ne sono.
 *
 * «Spariscono da soli» vale solo per gli ordini che l'export riporta. Uno
 * immesso prima dell'anno da cui parte l'export (fuori_export: di solito un
 * ordine rimasto in limbo a cavallo del 1 gennaio) il file di sempre non lo
 * riscrive: dopo il Chiudi a portale qui resta «eseguito» finche' non si
 * carica un export che parte dal suo anno. La voce della dashboard e l'esito
 * del caricamento gli promettevano che sarebbe sparito da solo, e la voce
 * restava accesa senza dire perche' (revisione del 14/10/2026): la frase dice
 * che cosa serve, con gli anni. La usano la spiegazione qui sotto e l'avviso
 * delle pagine (AvvisoEseguiti.jsx), cosi' i tre posti dicono la stessa cosa.
 */
export function fraseFuoriExport(gruppi) {
  const gs = gruppi || [];
  const conFuori = gs.filter(g => g.fuori_export > 0);
  if (!conFuori.length) return '';
  const fuori = conFuori.reduce((s, g) => s + g.fuori_export, 0);
  const tutti = gs.reduce((s, g) => s + (g.ordini || 0), 0);
  const dal = Math.min(...conFuori.map(g => g.anno_fuori_export));
  const inizio = conFuori[0].anno_inizio;
  const uno = fuori === 1;
  const perche = `prima del ${inizio}, l'anno da cui parte l'export di sempre, che non ${uno ? 'lo' : 'li'} riporta`;
  const finche = `${uno ? 'resta' : 'restano'} «eseguito» anche dopo il Chiudi, finché non si carica un export che parte dal ${dal}`;
  if (fuori >= tutti) return `${uno ? 'È immesso' : 'Sono immessi'} ${perche}: qui ${finche}.`;
  return `${uno ? "Fa eccezione quello fuori dall'export: è immesso" : `Fanno eccezione i ${intero(fuori)} fuori dall'export: sono immessi`} ${perche}, quindi ${finche}.`;
}

/**
 * La spiegazione per questi gruppi, nella voce della dashboard e nell'esito del
 * caricamento: che cosa vuol dire e che cosa fare. Se sono tutti fuori
 * dall'export non si promette che spariscano da soli.
 */
export function spiegazioneEseguiti(gruppi) {
  const fuori = fraseFuoriExport(gruppi);
  if (!fuori) return SPIEGAZIONE_ESEGUITI;
  const tutti = (gruppi || []).every(g => (g.fuori_export || 0) >= g.ordini);
  return tutti ? `${CHE_COSA_VUOL_DIRE} Si chiudono a portale. ${fuori}` : `${SPIEGAZIONE_ESEGUITI} ${fuori}`;
}

/**
 * L'avviso del caricamento: { rete, aci, gruppi } per UN caricamento, cioe' per
 * un tipo di file solo. rete e aci sono le quote di quel file, con la forma che
 * la finestra del caricamento legge da settembre (testoEseguiti); gruppi porta
 * l'elenco. null se non ce n'e' nessuno: allora non si dice niente.
 */
export function avvisoDelCaricamento(esito) {
  if (!esito || !esito.gruppi || !esito.gruppi.length) return null;
  const quota = (canale) => {
    const gs = esito.gruppi.filter(g => g.canale === canale);
    return {
      ordini: gs.reduce((s, g) => s + g.ordini, 0),
      righe: gs.reduce((s, g) => s + g.righe, 0),
      kg: gs.reduce((s, g) => s + (g.kg || 0), 0),
      esempi: gs.flatMap(g => g.elenco).slice(0, 10),
    };
  };
  return { rete: quota('RETE'), aci: quota('ACI'), gruppi: esito.gruppi };
}

/**
 * La riga del registro dei caricamenti: le quote e gli ID, cosi' restano
 * scritti anche dopo che la finestra si e' chiusa. Comincia come da settembre
 * («rete 2, ACI 1: ordini con tutti i dati ...»), con gli ID in coda.
 */
export function testoRegistro(esito, massimo = 20) {
  if (!esito || !esito.gruppi || !esito.gruppi.length) return '';
  const quote = ['RETE', 'ACI']
    .map(c => [c, esito.gruppi.filter(g => g.canale === c).reduce((s, g) => s + g.ordini, 0)])
    .filter(([, n]) => n > 0)
    .map(([c, n]) => `${c === 'RETE' ? 'rete' : 'ACI'} ${n}`)
    .join(', ');
  const ids = esito.gruppi.map(g => {
    const quali = g.elenco.slice(0, massimo).map(o => o.id_ordine || o.numero_fir).filter(Boolean);
    return `${g.detto}: ${quali.join(', ')}${g.ordini > quali.length ? ` e altri ${g.ordini - quali.length}` : ''}`;
  }).join('; ');
  return `${quote}: ordini con tutti i dati ma a portale non e' stato premuto Chiudi, non entrano in nessun conto (${ids})`;
}

/**
 * LA VOCE DI «DA GESTIRE»: una sola per tutti i tipi, con gli ID nel dettaglio
 * e il collegamento al modulo del primo gruppo. Sparisce da sola quando il
 * caricamento dopo li risolve, perche' la dashboard rilegge l'archivio; per
 * quelli fuori dall'export serve un export che parte dal loro anno, e il
 * dettaglio lo dice (spiegazioneEseguiti). Non
 * torna ogni mattina per i giorni che crescono: firma fissa, e gli ID come
 * elementi, cosi' una voce nascosta torna solo per un ordine nuovo
 * (src/lib/avvisiNascosti.js).
 *
 * Se qualche archivio non si e' potuto leggere e non si e' trovato niente, una
 * voce «da sapere» lo dice: un verde falso no.
 */
export function voceEseguiti(esito) {
  if (!esito) return null;
  const gruppi = esito.gruppi || [];
  const nonLetti = esito.non_letti || [];
  if (!gruppi.length) {
    if (!nonLetti.length) return null;
    return {
      area: 'Chiusura a portale', gravita: 'info',
      titolo: 'Ordini in «eseguito»: non verificati',
      dettaglio: `Non si sono potuti leggere: ${nonLetti.join(', ')}. Si riprova alla prossima apertura della dashboard.`,
      link: '/caricamento-dati', chiave: 'eseguiti:non-letti', sezione: 'dati', firma: nonLetti.join('|'), misure: [],
    };
  }
  const tipi = new Set(gruppi.map(g => g.tipo));
  const canali = new Set(gruppi.map(g => g.canale));
  const sezione = tipi.size === 1 && tipi.has('primarie') && canali.size === 1
    ? (canali.has('ACI') ? 'aci' : 'rete')
    : tipi.has('primarie') ? 'generale' : 'impianti';
  const MOSTRATI = 10;
  const elenchi = gruppi.map(g => `${g.nome}: ${g.elenco.slice(0, MOSTRATI).map(ordineInBreve).join(', ')}${g.ordini > MOSTRATI ? ` e altri ${g.ordini - MOSTRATI}` : ''}`);
  return {
    area: 'Chiusura a portale', gravita: 'attenzione',
    titolo: `Ordini in «eseguito» a portale: ${gruppi.map(g => `${g.detto} ${intero(g.ordini)}`).join(' · ')}`,
    dettaglio: `${elenchi.join(' · ')}. ${spiegazioneEseguiti(gruppi)}${nonLetti.length ? ` Non letti: ${nonLetti.join(', ')}.` : ''}`,
    link: gruppi[0].link, chiave: 'eseguiti', sezione,
    firma: 'eseguiti', misure: [], elementi: esito.ids || [],
  };
}

// LA COPIA DI SICUREZZA DI TUTTI GLI ARCHIVI (14/10/2026).
//
// Migliorie approvate dall'utente il 14/10/2026 («per me ok ... su quanto da
// creare, procedi pure»): «una copia di sicurezza periodica dei dati:
// un'esportazione completa, per esempio ogni settimana, scaricabile
// dall'amministratore». Fino a quel giorno la copia dei dati veri delle prove
// (../dati-veri, fuori dal repository) si faceva a mano dagli strumenti del
// browser, seguendo il suo LEGGIMI.
//
// Che cosa fa, e perche' cosi':
// - legge dal browser TUTTI gli archivi (ARCHIVI_DELLA_COPIA: uno per ogni file
//   di base44/entities, nessuno escluso, e la prova lo controlla), a pagine da
//   5000 in ordine di id e coi doppioni tolti, come fetchAll: id_ordine non e'
//   unico e oltre le mille righe una lettura in un altro ordine perde o ripete
//   righe senza dirlo;
// - va piano: il limite di richieste della piattaforma vale per tutta l'app
//   (circa settanta al minuto), e la copia non deve togliere il margine agli
//   altri. Al massimo RICHIESTE_AL_MINUTO in ogni minuto, contando anche le
//   letture che fanno le due funzioni chiamate per gli «attesi»;
// - prima di leggere guarda il registro dei caricamenti: con un caricamento in
//   corso un archivio puo' essere a meta', e non si comincia. Alla fine guarda
//   se nel frattempo il registro e' cambiato: se si', la copia non e' coerente
//   e non si scarica (come dice il LEGGIMI della copia dei dati veri);
// - il file ha lo STESSO formato della copia dei dati veri - { meta, archivi,
//   attesi }, JSON compresso - cosi' una copia scaricata, rinominata
//   treadrider-dati-veri-aaaa-mm-gg.json.gz e messa in ../dati-veri, diventa la
//   copia nuova delle prove (prove/datiVeri.mjs). Gli «attesi» sono le risposte
//   di Giacenze e Dichiarazioni nello stesso momento (riepilogoDichiarazioni e
//   calcolaGiacenze con { anno }, senza registra: non scrivono niente);
// - NESSUN DATO VA SU UN SERVER: il file si prepara e si comprime nel browser e
//   finisce nei Download del PC. Nel gestionale resta solo una riga nel registro
//   CopiaSicurezza, coi conteggi e senza i dati;
// - i documenti allegati non si scaricano: i record tengono i loro riferimenti
//   (file_uri, file_url), e la copia lo scrive nel meta. Un file_uri basta a
//   chiunque sia collegato al gestionale per farsi aprire il documento
//   (AGENTS.md, «Il file_uri e' la chiave del documento»): la copia si conserva
//   come un documento riservato, e la pagina lo dice;
// - solo l'amministratore: la pagina disegna il pulsante solo a lui, e qui si
//   chiede al server chi e' collegato prima di leggere. Un altro utente
//   leggerebbe gli archivi riservati vuoti, e la copia direbbe il falso.
// Prova: prove/copiaSicurezza.mjs (sull'SDK finto) e
// prove/copiaSicurezzaDatiVeri.mjs (sulla copia dei dati veri, dove c'e').
import { leggiRegistro, statoDelRegistro, avvisoCaricamento, nomeArchivio, NOMI_ARCHIVI } from './registroCaricamenti.js';
import { giornoRoma } from './giornoItaliano.js';
import { scarica } from './docxModello.js';
import { PRODOTTO } from './prodotto.js';

/**
 * Tutti gli archivi del gestionale, uno per file di base44/entities (il nome
 * scritto nel file). Chi aggiunge un archivio lo aggiunge qui: altrimenti la
 * copia non lo salva, e prove/copiaSicurezza.mjs fallisce dicendo quale manca.
 */
export const ARCHIVI_DELLA_COPIA = [
  'Alert', 'Assegnato', 'AssegnatoAci', 'AvvisoQualifica', 'ChiusuraPassivaMese', 'CodiceEer',
  'CommessaEcotyre', 'ConoscenzaAssistente', 'ConsuntivoFornitore', 'ContenutoEsteso',
  'ContrattoFornitore', 'ControlloEvasione', 'ControlloNormativo', 'CopiaSicurezza',
  'DichiarazioneRentri', 'DichiarazioneSito', 'DichiarazioneTrattamento', 'DocumentoFatturazione',
  'DocumentoQualifica', 'DomandaAssistente', 'ErroreSito', 'EsecuzioneLavoro', 'EsercitazioneRT',
  'EsportazioneFatturazione', 'ExtraRaccolta', 'FileDaRimuovere', 'Fornitore',
  'FornitoreSecondaria', 'GiacenzaSito', 'GiacenzaStoccaggio', 'ImpiantoTarget',
  'ImpiantoTargetSecondaria', 'IndicatoreGiorno', 'IpotesiMensileSecondarie', 'ListaAssegnati',
  'LivelloUtente', 'MaterialeCorso', 'ModelloContratto', 'ModelloDocumento', 'ModificaDato',
  'Omologa', 'OrdineNonDichiarato', 'Pdr', 'PianificazioneSettimanale', 'PraticaIrigom',
  'PrefatturaEcotyre', 'PrimariaAci', 'PrimariaRete', 'QuadraturaFir', 'QualificaInclusione',
  'RegolaAlert', 'RichiestaEct', 'RichiestaUtente', 'RiepilogoQualifica', 'Secondaria', 'Servizio',
  'SurplusTariffa', 'TargetMensile', 'TargetRaccoglitore', 'TargetRaccoglitorePrimaria', 'Tariffa',
  'Terziaria', 'TipoDocumentoQualifica', 'Todo', 'UploadLog', 'User', 'VerificaReport',
  'VerificaSedePdr', 'VoceFatturazione', 'VocePassivaAmministrazione', 'ZonaRaccoglitore',
];

// Le pagine come fetchAll (base44/shared/fetchAll.ts): 5000 righe, il massimo
// della piattaforma. Una pagina corta ma tonda (un multiplo di mille) non chiude
// la lettura; un archivio che non finisce in cento pagine non si copia a meta'
// senza dirlo.
export const RIGHE_PER_PAGINA = 5000;
const PAGINE_MASSIME = 100;
const ultimaPagina = (letti, chiesti) => letti === 0 || (letti < chiesti && letti % 1000 !== 0);

// Il ritmo della copia: al massimo quaranta richieste in ogni minuto, sulle
// circa settanta di tutta l'app (22/09/2026). Le due funzioni degli attesi
// leggono da sole i loro archivi, tutti insieme: contano per quante letture
// fanno (AGENTS.md, «Giacenze e Dichiarazioni leggono ogni archivio una volta»:
// 15 e 18 richieste). Un'attesa si fa a passi brevi, cosi' «Annulla» risponde
// subito. L'etichetta e' il nome della pagina, quello che si dice a video.
export const RICHIESTE_AL_MINUTO = 40;
export const FINESTRA_MS = 60 * 1000;
const PASSO_ATTESA_MS = 500;
export const FUNZIONI_ATTESI = [
  { nome: 'riepilogoDichiarazioni', richieste: 15, etichetta: 'Dichiarazioni' },
  { nome: 'calcolaGiacenze', richieste: 18, etichetta: 'Giacenze' },
];

/** La pagina di un atteso: 'calcolaGiacenze_2026' -> 'Giacenze'. */
export function etichettaAtteso(chiave) {
  const f = FUNZIONI_ATTESI.find(x => String(chiave || '').startsWith(`${x.nome}_`));
  return f ? f.etichetta : String(chiave || '');
}

// Tutti i tipi del registro che riscrivono un archivio: un caricamento in corso
// di uno qualunque ferma la copia.
const TIPI_REGISTRO = Object.keys(NOMI_ARCHIVI);

const attendiMs = (ms) => new Promise(r => setTimeout(r, ms));

/** Un errore della copia, con il suo codice: lo legge testoErroreCopia. */
function errore(codice, messaggio, altro = {}) {
  const e = new Error(messaggio);
  e.codice = codice;
  Object.assign(e, altro);
  return e;
}

const annullata = (segnale) => !!(segnale && (segnale.aborted || segnale.annullata));
function fermaSeAnnullata(segnale) {
  if (annullata(segnale)) throw errore('annullata', 'copia annullata');
}

// L'errore di una richiesta come si legge (il corpo della risposta prima del
// messaggio del client, AGENTS.md «L'errore di una funzione si legge dal corpo»).
const motivoDi = (e) => String((e && e.response && e.response.data && e.response.data.error) || (e && e.data && e.data.error) || (e && e.message) || e || 'errore sconosciuto');
const statoDi = (e) => (e && (e.status || (e.response && e.response.status))) || null;

/**
 * Il ritmo delle richieste: attendi(peso) aspetta finche' nell'ultimo minuto
 * ci sono meno di alMinuto richieste, contando questa per «peso».
 */
export function creaRitmo({ alMinuto = RICHIESTE_AL_MINUTO, adesso = () => Date.now(), pausa = attendiMs, segnale = null } = {}) {
  const fatte = [];
  return {
    get fatte() { return fatte.slice(); },
    async attendi(peso = 1) {
      for (;;) {
        fermaSeAnnullata(segnale);
        const ora = adesso();
        while (fatte.length && fatte[0] <= ora - FINESTRA_MS) fatte.shift();
        if (!fatte.length || fatte.length + peso <= alMinuto) {
          for (let i = 0; i < peso; i++) fatte.push(ora);
          return;
        }
        // Si aspetta che escano dal minuto abbastanza richieste vecchie.
        const k = Math.min(fatte.length, fatte.length + peso - alMinuto);
        await pausa(Math.max(1, Math.min(fatte[k - 1] + FINESTRA_MS - ora, PASSO_ATTESA_MS)));
      }
    },
  };
}

/**
 * Un archivio intero: pagine da 5000 in ordine di id, doppioni tolti.
 * Risponde { righe, doppioni, pagine }.
 */
export async function leggiArchivio(archivio, { ritmo = null, segnale = null, suPagina = null } = {}) {
  let tutte = [];
  let salta = 0;
  let pagine = 0;
  for (;;) {
    if (pagine >= PAGINE_MASSIME) throw errore('troppo_grande', `oltre ${PAGINE_MASSIME} pagine da ${RIGHE_PER_PAGINA} righe: la lettura si e' fermata per non copiarlo a meta'`);
    fermaSeAnnullata(segnale);
    if (ritmo) await ritmo.attendi(1);
    const blocco = await archivio.list('id', RIGHE_PER_PAGINA, salta);
    if (!Array.isArray(blocco)) throw errore('risposta_strana', 'la lettura non ha restituito un elenco di righe');
    pagine++;
    tutte = tutte.concat(blocco);
    if (suPagina) suPagina(tutte.length);
    if (ultimaPagina(blocco.length, RIGHE_PER_PAGINA)) break;
    salta += blocco.length;
  }
  const visti = new Set();
  const righe = tutte.filter(r => (r && r.id ? (visti.has(r.id) ? false : (visti.add(r.id), true)) : true));
  return { righe, doppioni: tutte.length - righe.length, pagine };
}

// L'impronta del registro: la riga cambiata per ultima. Se alla fine non e' la
// stessa, durante la lettura un caricamento e' partito, finito o ha scritto la
// sua nota, e gli archivi letti prima e dopo non sono dello stesso momento.
async function improntaRegistro(Log, ritmo) {
  if (ritmo) await ritmo.attendi(1);
  const righe = (await Log.list('-updated_date', 1)) || [];
  const r = righe[0] || null;
  return {
    chiave: r ? `${r.id}|${r.updated_date || ''}|${r.esito || ''}|${r.messaggio || ''}` : 'vuoto',
    riga: r,
  };
}

// Il registro letto con la regola di tutti (registroCaricamenti.js), con il
// ritmo della copia: la prima lettura e quelle per tipo, se servono.
async function statoRegistro(Log, ritmo, adessoMs) {
  const conRitmo = { filter: async (...a) => { if (ritmo) await ritmo.attendi(1); return Log.filter(...a); } };
  return statoDelRegistro(await leggiRegistro(conRitmo, TIPI_REGISTRO), TIPI_REGISTRO, adessoMs);
}

const iso = (ms) => new Date(ms).toISOString();

/** Il nome del file: treadrider-copia-aaaa-mm-gg.json.gz, col giorno italiano. */
export const nomeFileCopia = (giorno) => `treadrider-copia-${giorno}.json.gz`;

/** Una riga del registro descritta per il meta, senza i campi che non servono. */
const caricamentoNelMeta = (r) => (r ? { tipo: r.tipo_file || null, il: r.created_date || null, esito: r.esito || null, aggiornato_il: r.updated_date || null } : null);

export const NOTA_FILE_ALLEGATI = "I documenti allegati (PDF, scansioni, fogli caricati) non sono nella copia: i record tengono i loro riferimenti (file_uri, file_url). "
  + "Un riferimento privato basta a chiunque sia collegato al gestionale per farsi aprire il documento: la copia va conservata come un documento riservato.";

/**
 * Legge tutto e risponde i dati della copia: { meta, archivi, attesi }.
 * client: il client delle pagine. Si ferma (con e.codice) se chi chiede non e'
 * l'amministratore, se un caricamento e' in corso, se e' annullata o se il
 * registro e' cambiato durante la lettura. Un archivio che non si legge non
 * ferma la copia: finisce in meta.non_letti, e la pagina lo dice.
 */
export async function leggiCopia({
  client, archivi = ARCHIVI_DELLA_COPIA, segnale = null, avanzamento = () => {},
  adesso = () => Date.now(), pausa = attendiMs, alMinuto = RICHIESTE_AL_MINUTO, versione = null,
} = {}) {
  const ritmo = creaRitmo({ alMinuto, adesso, pausa, segnale });
  fermaSeAnnullata(segnale);
  avanzamento({ fase: 'controllo' });
  const io = await client.auth.me().catch(() => null);
  if (!io || io.role !== 'admin') throw errore('non_amministratore', 'la copia di sicurezza la scarica solo l\'amministratore');
  const chi = String(io.full_name || io.email || '').trim() || null;

  // Prima l'impronta, poi lo stato: un caricamento che parte fra le due letture
  // scrive una riga nuova, l'impronta di dopo e' un'altra e la copia si ferma.
  // Nell'ordine inverso uno partito li' in mezzo, e ancora aperto alla fine, non
  // si sarebbe visto.
  const Log = client.entities.UploadLog;
  const impronta = await improntaRegistro(Log, ritmo);
  const prima = await statoRegistro(Log, ritmo, adesso());
  const aperti = prima.in_corso || [];
  const inCorso = aperti.filter(a => !a.interrotto && !a.non_riuscito && a.esito !== 'errore');
  if (inCorso.length) {
    throw errore('caricamento_in_corso', 'un caricamento e\' in corso', { caricamenti: inCorso.map(a => `${nomeArchivio(a.tipo_file)}${a.utente ? `, da ${a.utente}` : ''}`) });
  }
  const dal = adesso();

  const dati = {};
  const righe = {};
  const doppioni = {};
  const nonLetti = [];
  let lette = 0;
  for (let i = 0; i < archivi.length; i++) {
    const nome = archivi[i];
    avanzamento({ fase: 'lettura', indice: i, totale: archivi.length, archivio: nome, righe: lette });
    try {
      const r = await leggiArchivio(client.entities[nome], {
        ritmo, segnale, suPagina: (n) => avanzamento({ fase: 'lettura', indice: i, totale: archivi.length, archivio: nome, righe: lette + n }),
      });
      dati[nome] = r.righe;
      righe[nome] = r.righe.length;
      if (r.doppioni) doppioni[nome] = r.doppioni;
      lette += r.righe.length;
    } catch (e) {
      if (e && e.codice === 'annullata') throw e;
      nonLetti.push({ archivio: nome, motivo: motivoDi(e), stato: statoDi(e) });
    }
  }

  // Le risposte di Giacenze e Dichiarazioni nello stesso momento: quelle che
  // prove/datiVeri.mjs confronta. Senza registra le due funzioni non scrivono.
  // Se una non risponde la copia resta buona come copia di sicurezza, ma non
  // come copia dei dati veri dei controlli: si scrive perche' manca
  // (meta.attesi_mancanti), e lo dicono la pagina, la riga del registro e
  // prove/datiVeri.mjs, che su una copia cosi' fallisce. Prima la copia usciva
  // come buona e il controllo sui dati veri saltava in silenzio i confronti di
  // Giacenze: 99 verifiche su 158, tutte verdi (revisione del 15/10/2026).
  const giornoInizio = giornoRoma(iso(dal));
  const anno = Number(giornoInizio.slice(0, 4));
  const attesi = {};
  for (const f of FUNZIONI_ATTESI) {
    avanzamento({ fase: 'attesi', funzione: f.nome, righe: lette });
    await ritmo.attendi(f.richieste);
    try {
      const res = await client.functions.invoke(f.nome, { anno });
      attesi[`${f.nome}_${anno}`] = { stato: 200, risposta: res && typeof res === 'object' && 'data' in res ? res.data : res };
    } catch (e) {
      if (e && e.codice === 'annullata') throw e;
      attesi[`${f.nome}_${anno}`] = { stato: statoDi(e), errore: motivoDi(e) };
    }
  }

  fermaSeAnnullata(segnale);
  avanzamento({ fase: 'verifica', righe: lette });
  const fino = adesso();
  const dopo = await improntaRegistro(Log, ritmo);
  if (dopo.chiave !== impronta.chiave) {
    const r = dopo.riga || {};
    throw errore('caricamento_durante', 'il registro dei caricamenti e\' cambiato durante la lettura', {
      caricamento: r.tipo_file ? `${nomeArchivio(r.tipo_file)}${r.esito ? `, ${r.esito === 'in_corso' ? 'in corso' : r.esito}` : ''}` : null,
    });
  }

  const giorno = giornoRoma(iso(fino));
  const meta = {
    gestionale: PRODOTTO,
    tipo: 'copia di sicurezza',
    formato: 'meta, archivi, attesi: lo stesso della copia dei dati veri delle prove',
    letto_dal: iso(dal),
    letto_fino_al: iso(fino),
    giorno,
    chi,
    email: io.email || null,
    // Il browser non sa quale commit e' pubblicato: si scrive il pacchetto del
    // sito che ha fatto la copia, quando la pagina lo sa dire.
    commit_pubblicato: null,
    versione_sito: versione || null,
    ultimo_caricamento: caricamentoNelMeta(impronta.riga),
    // I caricamenti interrotti o non riusciti che c'erano gia': quegli archivi
    // sono copiati come stavano, cioe' forse a meta'.
    caricamenti_aperti: aperti.map(a => ({ tipo: a.tipo_file, il: a.creato_il || null, stato: avvisoCaricamento(a).stato })),
    archivi_letti: Object.keys(dati).length,
    righe_totali: lette,
    righe,
    doppioni_tolti: doppioni,
    non_letti: nonLetti,
    attesi_mancanti: Object.entries(attesi).filter(([, a]) => a.stato !== 200).map(([k]) => k),
    file_allegati: NOTA_FILE_ALLEGATI,
  };
  return { meta, archivi: dati, attesi };
}

/**
 * Il file della copia: il JSON compresso (gzip) come Blob. Il JSON si
 * costruisce a pezzi, un archivio per volta, per non fare una stringa sola di
 * decine di megabyte. Senza CompressionStream (browser vecchi) comprime fflate.
 */
export async function fileDellaCopia(dati) {
  const pezzi = ['{"meta":', JSON.stringify(dati.meta), ',"archivi":{'];
  Object.keys(dati.archivi).forEach((nome, i) => { pezzi.push(`${i ? ',' : ''}${JSON.stringify(nome)}:`, JSON.stringify(dati.archivi[nome])); });
  pezzi.push('},"attesi":', JSON.stringify(dati.attesi || {}), '}');
  const json = new Blob(pezzi, { type: 'application/json' });
  if (typeof CompressionStream === 'function') {
    return new Response(json.stream().pipeThrough(new CompressionStream('gzip'))).blob().then(b => new Blob([b], { type: 'application/gzip' }));
  }
  const { gzipSync } = await import('fflate');
  return new Blob([gzipSync(new Uint8Array(await json.arrayBuffer()))], { type: 'application/gzip' });
}

/**
 * La riga del registro CopiaSicurezza: i conteggi, mai i dati. Una copia a cui
 * manca qualcosa si riconosce anche dal registro: quali archivi non si sono
 * letti e quali risposte di Giacenze e Dichiarazioni mancano. Senza, la riga di
 * una copia senza Giacenze era uguale a quella di una copia completa
 * (revisione del 15/10/2026).
 */
export function rigaDelRegistro(meta, { nomeFile, kb }) {
  return {
    giorno: meta.giorno,
    il: meta.letto_fino_al,
    dal: meta.letto_dal,
    utente: meta.chi || meta.email || '',
    nome_file: nomeFile,
    archivi: meta.archivi_letti,
    righe: meta.righe_totali,
    kb,
    non_letti: (meta.non_letti || []).length,
    archivi_non_letti: (meta.non_letti || []).map(n => n.archivio).join(', '),
    attesi_mancanti: (meta.attesi_mancanti || []).join(', '),
    righe_json: JSON.stringify(meta.righe || {}),
  };
}

/**
 * Tutto il giro del pulsante: legge, comprime, scarica, registra. Produrre il
 * file e registrarlo sono due passi (AGENTS.md, «Regole tecniche»): se la riga
 * del registro non si scrive, il file c'e' lo stesso e l'esito lo dice.
 * Risponde { nomeFile, kb, archivi, righe, nonLetti, attesiMancanti,
 * attesiNonRisposti, registrata, motivoRegistro, riga }: attesiNonRisposti
 * dice per la pagina quale funzione non ha risposto e perche'.
 */
export async function scaricaCopiaSicurezza(opzioni = {}) {
  const { client, avanzamento = () => {}, segnale = null } = opzioni;
  const dati = await leggiCopia(opzioni);
  fermaSeAnnullata(segnale);
  avanzamento({ fase: 'compressione', righe: dati.meta.righe_totali });
  const file = await fileDellaCopia(dati);
  fermaSeAnnullata(segnale);
  const nomeFile = nomeFileCopia(dati.meta.giorno);
  const kb = Math.max(1, Math.round(file.size / 1024));
  (opzioni.scaricaFile || scarica)(file, nomeFile);
  avanzamento({ fase: 'registro', righe: dati.meta.righe_totali });
  const riga = rigaDelRegistro(dati.meta, { nomeFile, kb });
  let registrata = false;
  let motivoRegistro = null;
  let scritta = null;
  try {
    scritta = await client.entities.CopiaSicurezza.create(riga);
    registrata = true;
  } catch (e) {
    motivoRegistro = motivoDi(e);
  }
  const attesiNonRisposti = (dati.meta.attesi_mancanti || []).map(chiave => ({
    chiave, nome: etichettaAtteso(chiave), stato: (dati.attesi[chiave] || {}).stato || null, motivo: (dati.attesi[chiave] || {}).errore || null,
  }));
  return {
    nomeFile, kb, archivi: dati.meta.archivi_letti, righe: dati.meta.righe_totali,
    nonLetti: dati.meta.non_letti, attesiMancanti: dati.meta.attesi_mancanti, attesiNonRisposti,
    registrata, motivoRegistro, riga: { ...riga, ...(scritta && typeof scritta === 'object' ? scritta : {}) },
  };
}

// === come si dice a video ===

const conMigliaia = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ORA_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

/** Il peso di un file: «850 kB», «3,6 MB». */
export function testoPeso(kb) {
  const n = Number(kb);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n < 1024) return `${conMigliaia(n)} kB`;
  return `${(n / 1024).toFixed(1).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} MB`;
}

/** «70 archivi, 32.145 righe». */
export const testoConteggi = ({ archivi, righe }) => `${conMigliaia(archivi)} archivi, ${conMigliaia(righe)} righe`;

/** «07/10/2026 alle 09:12, da Mario Rossi · 70 archivi · 32.145 righe · 3,6 MB» per l'ultima copia del registro. */
export function testoUltimaCopia(r) {
  if (!r) return null;
  const istante = r.il || r.created_date;
  const conZ = istante ? String(istante).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z') : null;
  const giorno = /^\d{4}-\d{2}-\d{2}$/.test(String(r.giorno || '')) ? r.giorno : (conZ ? giornoRoma(conZ) : '');
  const ora = conZ && !isNaN(new Date(conZ).getTime()) ? ` alle ${ORA_ROMA.format(new Date(conZ))}` : '';
  const parti = [
    `${giorno ? giorno.split('-').reverse().join('/') : 'giorno non leggibile'}${ora}${r.utente ? `, da ${r.utente}` : ''}`,
    r.archivi != null ? `${conMigliaia(r.archivi)} archivi` : null,
    r.righe != null ? `${conMigliaia(r.righe)} righe` : null,
    r.kb != null ? testoPeso(r.kb) : null,
  ].filter(Boolean);
  // Che cosa manca, per nome (revisione del 15/10/2026).
  const quali = String(r.archivi_non_letti || '').trim();
  const nonLetti = Number(r.non_letti) > 0
    ? ` · incompleta: ${conMigliaia(r.non_letti)} ${Number(r.non_letti) === 1 ? 'archivio non letto' : 'archivi non letti'}${quali ? ` (${quali})` : ''}`
    : '';
  const attesi = String(r.attesi_mancanti || '').split(',').map(s => s.trim()).filter(Boolean).map(etichettaAtteso);
  const senzaAttesi = attesi.length ? ` · senza i numeri di ${attesi.join(' e ')}: non vale come copia dei dati veri per i controlli` : '';
  return parti.join(' · ') + nonLetti + senzaAttesi;
}

const corto = (s, n = 160) => {
  const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/**
 * Gli archivi rimasti fuori dalla copia, scritti per nome e col motivo nel
 * testo a video: «Non si è letto l'archivio Omologa (servizio non
 * disponibile)…». Prima il nome stava solo nel title del paragrafo, che al
 * tocco e sul telefono non si vede: non si capiva se mancava un archivio che
 * conta (revisione del 15/10/2026).
 */
export function testoNonLetti(nonLetti) {
  const elenco = (nonLetti || []).filter(Boolean);
  if (!elenco.length) return null;
  const nomi = elenco.map(n => `${n.archivio}${n.motivo ? ` (${corto(n.motivo)})` : ''}`).join('; ');
  return elenco.length === 1
    ? `Non si è letto l'archivio ${nomi}: non è nel file, e la copia è incompleta. Riprova più tardi per averla completa.`
    : `Non si sono letti ${conMigliaia(elenco.length)} archivi: ${nomi}. Non sono nel file, e la copia è incompleta. Riprova più tardi per averla completa.`;
}

/**
 * Giacenze o Dichiarazioni che non hanno risposto durante la copia: il file
 * tiene gli archivi, quindi vale come copia di sicurezza, ma senza i numeri che
 * il sito diceva in quel momento non puo' diventare la copia dei dati veri dei
 * controlli (prove/datiVeri.mjs). Si dice a video (revisione del 15/10/2026).
 * attesi: [{ nome, motivo }] (attesiNonRisposti dell'esito).
 */
export function testoAttesiMancanti(attesi) {
  const elenco = (attesi || []).filter(Boolean);
  if (!elenco.length) return null;
  const nomi = elenco.map(a => a.nome || etichettaAtteso(a.chiave));
  const motivi = elenco.length === 1
    ? (elenco[0].motivo ? ` (${corto(elenco[0].motivo)})` : '')
    : ` (${elenco.map((a, i) => `${nomi[i]}: ${a.motivo ? corto(a.motivo) : 'nessuna risposta'}`).join('; ')})`;
  const chi = nomi.length === 1 ? `${nomi[0]} non ha risposto` : `${nomi.join(' e ')} non hanno risposto`;
  return `${chi} durante la copia${motivi}: il file va bene come copia di sicurezza degli archivi, ma non come copia dei dati veri `
    + `per il controllo di Giacenze e Dichiarazioni, perché mancano i numeri che ${nomi.length === 1 ? `${nomi[0]} diceva` : 'dicevano'} in questo momento. `
    + 'Se ti serve per quello, rifalla fra qualche minuto.';
}

/** Il testo di un errore della copia, con un consiglio su che cosa fare. */
export function testoErroreCopia(e) {
  const codice = e && e.codice;
  if (codice === 'annullata') return { classe: 'text-muted-foreground', testo: 'Copia annullata: non è stato scaricato niente.' };
  if (codice === 'non_amministratore') return { classe: 'text-red-700', testo: 'La copia di sicurezza la scarica solo l\'amministratore.' };
  if (codice === 'caricamento_in_corso') {
    return { classe: 'text-amber-700', testo: `Un caricamento è in corso (${(e.caricamenti || []).join('; ') || 'archivio in caricamento'}): la copia si fa quando è finito, così non prende un archivio a metà. Riprova fra qualche minuto.` };
  }
  if (codice === 'caricamento_durante') {
    return { classe: 'text-amber-700', testo: `Durante la lettura è cambiato il registro dei caricamenti${e.caricamento ? ` (${e.caricamento})` : ''}: gli archivi non sarebbero tutti dello stesso momento, e la copia non è stata scaricata. Riprova quando il caricamento è finito.` };
  }
  return { classe: 'text-red-700', testo: `La copia non è riuscita (${motivoDi(e)}): non è stato scaricato niente. Riprova.` };
}

/** Che cosa dice la pagina mentre la copia va avanti. */
export function testoAvanzamento(a) {
  if (!a) return '';
  if (a.fase === 'controllo') return 'Controllo che nessun caricamento sia in corso…';
  if (a.fase === 'lettura') return `Leggo l'archivio ${conMigliaia(a.indice + 1)} di ${conMigliaia(a.totale)} · ${conMigliaia(a.righe)} righe lette`;
  if (a.fase === 'attesi') return `Leggo i numeri di Giacenze e Dichiarazioni · ${conMigliaia(a.righe)} righe lette`;
  if (a.fase === 'verifica') return 'Controllo che nessun caricamento sia entrato durante la lettura…';
  if (a.fase === 'compressione') return `Preparo il file compresso · ${conMigliaia(a.righe)} righe`;
  if (a.fase === 'registro') return 'File scaricato: lo segno nel registro delle copie…';
  return '';
}

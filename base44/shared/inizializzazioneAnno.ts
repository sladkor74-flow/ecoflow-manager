// CHE COSA SERVE A UN ANNO PER COMINCIARE, E CHE COSA GLI MANCA.
//
// Il contratto con Ecotyre, e con tutti i fornitori, e' ANNUALE SENZA TACITO
// RINNOVO (regola dell'utente, 06/10/2026): il 31 dicembre scade tutto e il 1°
// gennaio non c'e' piu' niente in piedi. Non e' un dettaglio amministrativo, e'
// la differenza fra un gestionale che riparte e uno che si ferma:
//
// - `seedTariffe2026` e `seedTariffeAttive2026` chiudono le tariffe al
//   31/12/2026. Dal giorno dopo, in `attivaCalcolo.ts`, una riga senza tariffa
//   vale **zero euro** e nasce con `stato_validazione: 'errore'`. Lo stesso
//   sulla passiva. Al primo formulario di gennaio la fatturazione e' inservibile
//   finche' qualcuno non scrive i prezzi nuovi.
// - `copiaAnnoTarget` sa gia' portare avanti impianti, target, collegamenti,
//   contratto Ecotyre ed elenco siti. Le TARIFFE no: nessuno le copiava.
// - La fotografia dei piazzali al 31/12 si legge a portale QUEL GIORNO: la
//   pagina Unita' Locali mostra il saldo di adesso, non lo storico. Chi la
//   chiede il 7 gennaio legge un numero sbagliato e non se ne accorge - e' gia'
//   successo per sei piazzali sul 2025, e quella lettura non torna piu'.
//
// Questo modulo non fa niente da solo: dice, voce per voce, se l'anno e' pronto,
// che cosa manca e dove si rimedia. La verifica e' una SOMMA DI FATTI letti
// dagli archivi, non una scadenza scritta da qualche parte: cosi' resta vera
// anche l'anno prossimo, quando nessuno si ricordera' di questo codice.
import { conNotaCopia, daConfermare, senzaNotaCopia } from "./annoTarget.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { prezzoAttivoExtra, sortTariffe, tariffeAttiveValide, DICITURA_PREDEFINITA } from "./ecotyreTariffe.ts";
import { tariffaValeIl } from "./validitaTariffa.ts";
import { conflittiTariffa, periodoTariffa, chiaveMatch, chiaveMatchAttiva } from "./conflittiTariffa.ts";

export const PRIMO_GIORNO = (anno) => `${Number(anno)}-01-01`;
export const ULTIMO_GIORNO = (anno) => `${Number(anno)}-12-31`;

const giorno = (v) => String(v || '').slice(0, 10);
const testo = (v) => String(v === undefined || v === null ? '' : v).trim().toLowerCase();
// Le date si scrivono all'italiana ovunque si leggano: 31/12/2026, non 2026-12-31.
const gg = (v) => (giorno(v) ? giorno(v).split('-').reverse().join('/') : '');
// Un prezzo in una frase, all'italiana: 420,00; 0,202 al chilo con i suoi
// decimali (11/10/2026: il motivo di una copia scartata ora arriva a video).
const prezzoIt = (v) => {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return '—';
  let [i, d] = Math.abs(n).toFixed(4).split('.');
  d = d.replace(/0+$/, '').padEnd(2, '0');
  return `${n < 0 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
};

/**
 * Una tariffa copre quel giorno? Senza data di inizio vale da sempre, senza
 * data di fine vale per sempre: e' cosi' che le legge la fatturazione. Dall'11/10/2026
 * e' letteralmente la regola della fatturazione (tariffaValeIl di
 * validitaTariffa.ts): prima qui si pretendeva lo stato 'attivo' e la fattura
 * teneva anche una 'non_attivo' con la data di fine, cioe' una tariffa poteva
 * fatturare fino al 31/12 e non risultare da rinnovare.
 */
export function copreIlGiorno(t, quando) {
  return tariffaValeIl(t, quando);
}

// Un nome di fornitore, di stoccaggio o di impianto si confronta come la
// passiva lo confronta per scegliere la tariffa: normalizzato.
const ragione = (v) => normalizzaRagioneSociale(String(v === undefined || v === null ? '' : v));

/**
 * CHE COSA RENDE DUE TARIFFE «LA STESSA RIGA IN DUE ANNI».
 *
 * Tutto quello che la fatturazione usa per scegliere una tariffa, e nient'altro:
 * il VALORE no - e' proprio quello che cambia da un anno all'altro - e le date
 * nemmeno. Due righe con questa chiave uguale sono la stessa tariffa rinnovata.
 *
 * I NOMI SI CONFRONTANO COME LI CONFRONTA LA PASSIVA (chiusura dell'audit,
 * 11/10/2026). Il fornitore, il produttore, il destinatario e la destinazione
 * erano solo in minuscolo, mentre la passiva li normalizza: «GATIM S.R.L.» del
 * 2026 e «GATIM» del 2027 scritto a mano erano due tariffe qui e una sola per la
 * passiva. «Prepara le tariffe» copiava allora il prezzo del 2026 accanto a
 * quello nuovo, e la passiva pagava la copia (la piu' recente) invece del
 * prezzo scritto dall'amministratore.
 */
export function chiaveTariffa(t) {
  return [
    testo(t && t.direzione) || 'passiva',
    testo(t && t.tipologia),
    testo(t && t.prestazione),
    ragione(t && t.fornitore_nome),
    testo(t && t.cliente),
    testo(t && t.servizio_nome),
    testo(t && t.servizio_ecotyre),
    testo(t && t.regione),
    testo(t && t.provincia),
    testo(t && t.classe_materiale),
    testo(t && t.eer_codice),
    ragione(t && t.destinazione),
    ragione(t && t.produttore),
    ragione(t && t.destinatario),
    testo(t && t.unita_misura),
  ].join('|');
}

/**
 * L'ANNO NUOVO HA GIA' LA SUA TARIFFA? La stessa idea di «stessa tariffa» dei
 * conflitti (conflittiTariffa.ts), con una tipologia TUTTE che copre RETE e ACI
 * (chiusura dell'audit, 11/10/2026).
 *
 * Qui contava solo la chiave piena (chiaveTariffa), dove TUTTE e RETE sono due
 * tariffe diverse, mentre la copia d'anno passa dai controlli dei conflitti,
 * dove TUTTE copre RETE: con la tratta TRANSAR del 2026 scritta RETE a 400 e
 * quella del 2027 gia' scritta a mano come TUTTE a 420, la lista diceva «manca:
 * 1 tariffa scade il 31/12/2026», il pulsante preparava 0 tariffe (la copia si
 * scontrava con quella del 2027 ed era scartata) e la voce restava «manca» per
 * sempre, dal 1° gennaio in rosso nel cruscotto, anche se la passiva il prezzo
 * lo trovava. Ora la vecchia e' coperta se l'anno nuovo ha la stessa chiave
 * piena, oppure una tariffa con cui la copia si scontrerebbe: per le passive
 * stesso fornitore, prestazione, ambito e una tipologia che la copre (la stessa,
 * o TUTTE per RETE e ACI); per le attive la chiave delle attive. Una vecchia
 * TUTTE e' coperta da una TUTTE, o da una RETE e da una ACI insieme: con la sola
 * RETE l'ACI del nuovo anno il prezzo non ce l'ha, e la voce resta da fare.
 */
const tipologiaNorm = (v) => String(v || '').trim().toUpperCase();
const copreLaTipologia = (nuova, vecchia) => {
  const n = tipologiaNorm(nuova);
  const v = tipologiaNorm(vecchia);
  return n === v || (n === 'TUTTE' && (v === 'RETE' || v === 'ACI'));
};
export function tariffaCopertaNelNuovoAnno(vecchia, nuove) {
  const elenco = nuove || [];
  const chiave = chiaveTariffa(vecchia);
  if (elenco.some(s => chiaveTariffa(s) === chiave)) return true;
  const direzione = testo((vecchia && vecchia.direzione) || 'PASSIVA');
  const stessaDirezione = elenco.filter(s => testo((s && s.direzione) || 'PASSIVA') === direzione);
  if (direzione === 'attiva') return stessaDirezione.some(s => chiaveMatchAttiva(vecchia, s));
  // stessa chiave dei conflitti, tipologia a parte: la si guarda qui sotto
  const stessoAmbito = stessaDirezione.filter(s => chiaveMatch({ ...vecchia, tipologia: '' }, { ...s, tipologia: '' }));
  const coperta = (tipologia) => stessoAmbito.some(s => copreLaTipologia(s.tipologia, tipologia));
  if (tipologiaNorm(vecchia && vecchia.tipologia) === 'TUTTE') return coperta('TUTTE') || (coperta('RETE') && coperta('ACI'));
  return coperta(vecchia && vecchia.tipologia);
}

/**
 * Le tariffe che scadono con l'anno vecchio e che l'anno nuovo non ha.
 * Si guarda chi copre il 31 dicembre e non copre il 1° gennaio dopo: e' il
 * buco, e si misura sui fatti invece che su una data scritta nel codice.
 * «Non ha» vuol dire nessuna tariffa del 1° gennaio che la copra
 * (tariffaCopertaNelNuovoAnno): la stessa idea della copia d'anno.
 */
export function tariffeDaRinnovare(tariffe, anno, direzione = '') {
  const prima = ULTIMO_GIORNO(Number(anno) - 1);
  const dopo = PRIMO_GIORNO(anno);
  const dir = testo(direzione);
  const scelte = (tariffe || []).filter(t => !dir || testo(t.direzione || 'PASSIVA') === dir);
  const nuove = scelte.filter(t => copreIlGiorno(t, dopo));
  const per = new Map();
  for (const t of scelte) {
    if (!copreIlGiorno(t, prima)) continue;
    const k = chiaveTariffa(t);
    if (per.has(k) || tariffaCopertaNelNuovoAnno(t, nuove)) continue;
    per.set(k, t);
  }
  return [...per.values()];
}

/**
 * La stessa tariffa per l'anno nuovo: identica, con la validita' spostata e il
 * VALORE DELL'ANNO PRIMA come punto di partenza.
 *
 * Il prezzo si copia perche' la riga senza prezzo non serve a niente, ma si
 * copia SEGNATA: `conNotaCopia` scrive «copiato dal {anno-1}, da confermare», e
 * `daConfermare` la riconosce. Finche' nessuno l'ha confermata la voce della
 * lista resta gialla: un prezzo vecchio che passa per nuovo e' peggio di un
 * prezzo che manca, e questo e' l'unico modo di avere tutt'e due le cose -
 * la fatturazione che riparte e il dubbio che resta scritto.
 *
 * L'identificativo e le date di sistema non si copiano: nasce un record nuovo.
 */
export function copiaTariffa(t, anno) {
  const nuova = { ...t };
  for (const k of ['id', 'created_date', 'updated_date', 'created_by_id', 'created_by', 'is_sample']) delete nuova[k];
  nuova.data_inizio_validita = PRIMO_GIORNO(anno);
  nuova.data_fine_validita = ULTIMO_GIORNO(anno);
  nuova.stato = 'attivo';
  nuova.note = conNotaCopia(t && t.note, anno);
  return nuova;
}

/**
 * IL PIANO DELLA COPIA D'ANNO, PASSATO DAGLI STESSI CONTROLLI DI CHI SALVA A
 * MANO (chiusura dell'audit, 11/10/2026).
 *
 * preparaAnno creava le copie con un create diretto, senza i controlli dei
 * conflitti di gestisciAnagrafiche: una copia poteva affiancarsi a una tariffa
 * dello stesso fornitore gia' scritta per l'anno nuovo, e la passiva - due
 * tariffe ugualmente specifiche - pagava la prima che trovava. Qui ogni copia
 * si confronta con le tariffe che ci sono e con le copie gia' decise
 * (conflittiTariffa): quella che si sovrappone a qualcosa non si crea, e si
 * dice con chi si scontra, perche' quale delle due vale lo decide chi conosce
 * il contratto.
 *
 * @returns { da_creare: [{ direzione, tariffa, copia }], scartate: [{ direzione, tariffa, contro, motivo }] }
 */
export function pianoCopiaTariffe(tariffe, anno, direzioni = ['ATTIVA', 'PASSIVA']) {
  const visti = [...(tariffe || [])];
  const da_creare = [];
  const scartate = [];
  for (const direzione of direzioni) {
    for (const t of tariffeDaRinnovare(tariffe, anno, direzione)) {
      const copia = copiaTariffa(t, anno);
      const { conflitti, chiudibili } = conflittiTariffa(copia, visti);
      const contro = conflitti[0] || chiudibili[0];
      if (contro) {
        scartate.push({
          direzione, tariffa: t, contro,
          motivo: `si sovrappone alla tariffa ${contro.fornitore_nome || contro.cliente || '—'} ${prezzoIt(contro.valore)} ${contro.unita_misura || ''} (${periodoTariffa(contro)}): non si copia, controlla sul contratto quale delle due vale`.replace(/\s+\(/, ' ('),
        });
        continue;
      }
      da_creare.push({ direzione, tariffa: t, copia });
      visti.push(copia);
    }
  }
  return { da_creare, scartate };
}

/** Le tariffe dell'anno nate da una copia e non ancora confermate. */
/**
 * LA CONFERMA DI UNA TARIFFA COPIATA (10/10/2026).
 *
 * La lista diceva «vanno confermate sul contratto» e non c'era un modo per farlo:
 * bisognava aprire ogni tariffa e cancellare a mano la nota della copia. Qui la
 * nota della copia se ne va e al suo posto resta scritto chi l'ha confermata e
 * quando: il dubbio si chiude, ma non sparisce senza traccia.
 */
export function confermaTariffa(t, { il = '', da = '', anno = '' } = {}) {
  const resto = senzaNotaCopia(t && t.note);
  const traccia = `Confermata sul contratto ${anno} il ${String(il).slice(0, 10).split('-').reverse().join('/')}${da ? ` da ${da}` : ''}.`;
  return { note: [resto, traccia].filter(Boolean).join(' · ') };
}

export function tariffeDaConfermare(tariffe, anno, direzione = '') {
  const dir = testo(direzione);
  return (tariffe || []).filter(t => (!dir || testo(t.direzione || 'PASSIVA') === dir)
    && copreIlGiorno(t, PRIMO_GIORNO(anno)) && daConfermare(t));
}

/** Quanti giorni mancano al 1° gennaio dell'anno; negativo se e' gia' passato. */
export function giorniAlPrimoGennaio(anno, oggi) {
  const a = giorno(oggi);
  if (!a) return null;
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const al = Date.UTC(Number(anno), 0, 1);
  return Math.round((al - da) / 86400000);
}

const voce = (chiave, titolo, perche, dove) => ({ chiave, titolo, perche, dove, stato: 'manca', dettaglio: '', azione: '' });
const conta = (righe, anno) => (righe || []).filter(r => Number(r && r.anno) === Number(anno)).length;

/**
 * QUALE ANNO NUOVO MOSTRARE IN DASHBOARD (revisione del 10/10/2026).
 *
 * La dashboard guardava sempre l'anno dopo quello di oggi: dal 1° gennaio 2027
 * guardava il 2028, a 364 giorni, e taceva proprio quando le tariffe e le
 * aperture del 2027 mancavano ancora. Il ramo «il 2027 e' gia' cominciato»,
 * critico, non poteva scattare mai. A gennaio e febbraio si guarda prima
 * l'anno appena cominciato, finche' gli manca qualcosa; poi l'anno dopo. La
 * finestra di due mesi c'e' perche' un avviso che resta tutto l'anno non e'
 * piu' un avviso.
 * @param {object} args gli argomenti di listaAnno, con oggi; l'anno lo sceglie lei
 */
export function annoNuovoDaMostrare(args = {}) {
  const oggi = String(args.oggi || '');
  const annoOggi = Number(oggi.slice(0, 4));
  if (Number(oggi.slice(5, 7)) <= 2) {
    const corrente = listaAnno({ ...args, anno: annoOggi });
    if (corrente.avvicinandosi) return corrente;
  }
  return listaAnno({ ...args, anno: annoOggi + 1 });
}

/**
 * LA LISTA DI CONTROLLO DELL'ANNO NUOVO.
 *
 * Otto voci, ognuna con il suo stato: `pronto` (non c'e' niente da fare),
 * `parziale` (c'e' qualcosa ma va confermato o completato), `manca`.
 * `azione` dice che cosa il gestionale sa fare da solo; `dove` dove si fa a mano.
 */
export function listaAnno({
  anno,
  tariffe = [],
  giacenzeSito = [],
  // I target annui dei raccoglitori (TargetRaccoglitore): e' quello che la copia
  // d'anno scrive e quello che la griglia di Target & Status mostra. Prima qui si
  // contava ImpiantoTarget, che non ha mai avuto una riga: la voce sarebbe rimasta
  // «manca» il 1° gennaio anche dopo la copia (audit del 10/10/2026).
  targetRaccoglitori = [],
  commesse = [],
  contrattiFornitore = [],
  rilevazioni = [],
  piazzali = [],
  oggi = '',
} = {}) {
  const annoNum = Number(anno);
  const voci = [];

  // 1-2. Le tariffe, una direzione per volta: non si mescolano mai, come i canali.
  for (const [dir, chiave, titolo, perche] of [
    ['ATTIVA', 'tariffe_attive', 'Tariffe verso Ecotyre', 'Senza tariffa una riga della fatturazione attiva vale zero euro e nasce in errore.'],
    ['PASSIVA', 'tariffe_passive', 'Tariffe verso i fornitori', 'Senza tariffa una riga della fatturazione passiva vale zero euro e nasce in errore.'],
  ]) {
    const v = voce(chiave, titolo, perche, 'Fatturazione > Anagrafiche > Tariffe');
    const mancano = tariffeDaRinnovare(tariffe, annoNum, dir);
    const daConf = tariffeDaConfermare(tariffe, annoNum, dir);
    const attive = (tariffe || []).filter(t => testo(t.direzione || 'PASSIVA') === testo(dir) && copreIlGiorno(t, PRIMO_GIORNO(annoNum)));
    if (mancano.length) {
      v.stato = 'manca';
      v.dettaglio = `${mancano.length} ${mancano.length === 1 ? 'tariffa scade' : 'tariffe scadono'} il ${gg(ULTIMO_GIORNO(annoNum - 1))} e il ${annoNum} non ${mancano.length === 1 ? "ce l'ha" : 'ce le ha'}.`;
      v.azione = 'copia_tariffe';
    } else if (daConf.length) {
      v.stato = 'parziale';
      v.dettaglio = `${daConf.length} ${daConf.length === 1 ? 'tariffa copiata' : 'tariffe copiate'} dal ${annoNum - 1} con il prezzo dell'anno prima: vanno confermate sul contratto.`;
      v.azione = 'conferma_tariffe';
      v.direzione = dir;
    } else if (attive.length) {
      v.stato = 'pronto';
      v.dettaglio = `${attive.length} ${attive.length === 1 ? 'tariffa copre' : 'tariffe coprono'} il ${annoNum}.`;
    } else {
      v.stato = 'manca';
      v.dettaglio = `Nessuna tariffa copre il ${annoNum}, e nemmeno il ${annoNum - 1} ne aveva: vanno scritte dal contratto.`;
    }
    v.quante = mancano.length || daConf.length || attive.length;
    voci.push(v);
  }

  // 2-bis. LA BASE DELL'EXTRA RACCOLTA DELL'ANNO NUOVO (chiusura dell'audit,
  //    11/10/2026). La tariffa EXTRA_RACCOLTA resta aperta per scelta (campagne
  //    occasionali, prezzo concordato intervento per intervento), quindi la voce
  //    delle tariffe attive la vede «coperta» anche nell'anno dopo e tace. Ma un
  //    intervento senza prezzo scritto, dal 1° gennaio, si fattura col prezzo
  //    dell'anno prima e l'avviso «prezzo di un altro anno», oppure - se la
  //    tariffa non c'e' piu' e il gestionale non ha una base per quell'anno - a
  //    zero euro in errore. Si misura con la stessa funzione della fattura,
  //    prezzoAttivoExtra, sul 1° gennaio: la base e' quella che la fattura
  //    userebbe, non una lettura a parte delle tariffe.
  {
    const v = voce('base_extra_raccolta', `Base extra raccolta del ${annoNum}`, 'È il prezzo con cui si fattura a Ecotyre un intervento di extra raccolta che non ha un prezzo scritto: senza la base dell’anno nuovo esce col prezzo dell’anno prima, o a zero euro in errore.', 'Fatturazione > Anagrafiche > Tariffe');
    const attiveTutte = (tariffe || []).filter(t => testo(t.direzione || 'PASSIVA') === 'attiva');
    const p = prezzoAttivoExtra({ prezzo_attivo_t: 0 }, sortTariffe(tariffeAttiveValide(attiveTutte)), DICITURA_PREDEFINITA, annoNum, PRIMO_GIORNO(annoNum));
    const tariffa = p.origine === 'tabella' ? attiveTutte.find(t => t.id && t.id === p.id) : null;
    const prezzo = `${p.valore} ${p.unita}`;
    v.quante = p.valore ? 1 : 0;
    if (p.origine === 'tabella' && p.altro_anno) {
      v.stato = 'parziale';
      v.dettaglio = `La base è la tariffa del ${p.anno_tariffa} (${prezzo}), rimasta aperta: nel ${annoNum} un intervento senza prezzo scritto si fattura a quel prezzo, con l’avviso «prezzo di un altro anno». Scrivi la tariffa EXTRA_RACCOLTA del ${annoNum}, oppure il prezzo su ogni intervento.`;
    } else if (p.origine === 'tabella' && tariffa && daConfermare(tariffa)) {
      v.stato = 'parziale';
      v.dettaglio = `La base del ${annoNum} (${prezzo}) è copiata dall’anno prima: va confermata sul contratto.`;
    } else if (p.origine === 'tabella') {
      v.stato = 'pronto';
      v.dettaglio = `La base del ${annoNum} è ${prezzo}, dalla tabella delle tariffe attive.`;
    } else if (p.origine === 'base') {
      v.stato = 'pronto';
      v.dettaglio = `La base del ${annoNum} è ${prezzo}, scritta nel gestionale.`;
    } else {
      v.stato = 'manca';
      v.dettaglio = `Nel ${annoNum} non c’è una base: un intervento senza prezzo scritto si fattura a zero euro, in errore. Scrivi la tariffa EXTRA_RACCOLTA del ${annoNum}, oppure il prezzo su ogni intervento.`;
    }
    voci.push(v);
  }

  // 3. Il contratto Ecotyre: da li' arrivano target e prezzi veri.
  {
    const v = voce('contratto_ecotyre', 'Contratto Ecotyre', 'Target annuo, regioni e prezzi dell’anno vengono da qui.', 'Target & Status > Commessa Ecotyre');
    const n = conta(commesse, annoNum);
    // Un contratto COPIATO dall'anno prima porta target e prezzi vecchi: va
    // confermato sul contratto vero, come le tariffe. Prima la lista lo dava per
    // pronto mentre una tariffa nello stesso stato era parziale (10/10/2026).
    const copiati = (commesse || []).filter(c => Number(c && c.anno) === annoNum && daConfermare(c)).length;
    v.stato = !n ? 'manca' : (copiati === n ? 'parziale' : 'pronto');
    v.quante = n;
    v.dettaglio = !n ? `Il ${annoNum} non ha ancora un contratto.`
      : copiati === n ? `Il contratto ${annoNum} e’ copiato dal ${annoNum - 1}: target, regioni e prezzi vanno presi dal contratto nuovo e confermati.`
      : `Il contratto ${annoNum} c’e’.`;
    voci.push(v);
  }

  // 4. Target e siti: lo sa fare copiaAnnoTarget, che non sovrascrive niente.
  {
    const v = voce('target_e_siti', 'Target e siti', 'Senza i target dei raccoglitori la copertura, gli avvisi e la predittivita’ dell’anno non si calcolano.', 'Target & Status > Impianti > Copia dall’anno prima');
    const t = conta(targetRaccoglitori, annoNum);
    const s = conta(giacenzeSito, annoNum);
    const tCopiati = (targetRaccoglitori || []).filter(r => Number(r && r.anno) === annoNum && daConfermare(r)).length;
    v.quante = t;
    // Basta un target ancora copiato perche' la voce resti gialla, come per le
    // tariffe: prima diventava verde al primo confermato (revisione del 10/10/2026).
    if (t && s && tCopiati > 0) { v.stato = 'parziale'; v.dettaglio = `${tCopiati} target dei raccoglitori su ${t} ancora copiati dal ${annoNum - 1}, e ${s} siti: i target vanno confermati sul contratto nuovo.`; }
    else if (t && s) { v.stato = 'pronto'; v.dettaglio = `${t} target dei raccoglitori e ${s} siti per il ${annoNum}.`; }
    else if (t || s) { v.stato = 'parziale'; v.dettaglio = `${t} target dei raccoglitori e ${s} siti: manca una delle due metà.`; }
    else { v.stato = 'manca'; v.dettaglio = `Il ${annoNum} non ha ancora né target né siti.`; }
    voci.push(v);
  }

  // 5. La fotografia del 31/12: e' l'ancora da cui l'anno nuovo riparte, e si
  //    legge a portale QUEL GIORNO.
  {
    const al = ULTIMO_GIORNO(annoNum - 1);
    const v = voce('fotografia', `Fotografia dei piazzali al ${gg(al)}`, 'E’ il punto da cui ripartono le giacenze: il portale mostra il saldo di adesso, non quello di un mese fa, quindi si legge il 31 dicembre.', 'Giacenze > Chiusura anno');
    const fatte = new Set((rilevazioni || []).filter(r => giorno(r.data_rilevazione) === al).map(r => testo(r.sito)));
    const attesi = (piazzali || []).map(p => testo(p));
    const mancano = attesi.filter(p => !fatte.has(p));
    v.quante = fatte.size;
    if (!attesi.length) { v.stato = 'pronto'; v.dettaglio = 'Nessun piazzale da fotografare.'; }
    else if (!mancano.length) { v.stato = 'pronto'; v.dettaglio = `Tutti i ${attesi.length} piazzali hanno la lettura del ${gg(al)}.`; }
    else if (fatte.size) { v.stato = 'parziale'; v.dettaglio = `${fatte.size} piazzali su ${attesi.length} hanno la lettura del ${gg(al)}; mancano ${mancano.length}.`; }
    else { v.stato = 'manca'; v.dettaglio = `Nessuno dei ${attesi.length} piazzali ha la lettura del ${gg(al)}.`; }
    voci.push(v);
  }

  // 5-bis. LE APERTURE DEGLI IMPIANTI (10/10/2026). La fotografia dei piazzali
  //    c'era; quella degli impianti no, e nessuno la scriveva: il 2 gennaio ogni
  //    impianto sarebbe ripartito da zero mentre il portale si porta dietro la sua
  //    giacenza. Gli impianti attesi sono quelli dell'anno prima; un'apertura c'e'
  //    se la riga dell'anno nuovo la porta, scritta dalla chiusura (apertura_del)
  //    o messa a mano con un valore. Uno zero a mano non si distingue da un campo
  //    vuoto, e per questo la strada e' la chiusura: lei scrive anche lo zero, e
  //    dice di che giorno e'.
  {
    const al = ULTIMO_GIORNO(annoNum - 1);
    const v = voce('aperture_impianti', `Aperture degli impianti al ${gg(al)}`, 'Ogni impianto riparte dal peso non dichiarato del 31 dicembre, rete e ACI: senza, il 2 gennaio la quadratura col portale salta su tutti gli impianti che hanno giacenza.', 'Giacenze > Chiusura anno');
    const eImp = (g) => !String((g && g.tipo_destinazione) || 'imp').toLowerCase().startsWith('stoc');
    // I siti si riconoscono per chiave, come nella chiusura che scrive le aperture:
    // per testo, «Gatim» e «GATIM SRL» restavano due siti e la voce non si
    // chiudeva mai (revisione del 10/10/2026).
    const attesi = [...new Set((giacenzeSito || []).filter(g => eImp(g) && Number(g.anno) === annoNum - 1).map(g => normalizzaRagioneSociale(g.sito)).filter(Boolean))];
    const conApertura = new Set((giacenzeSito || []).filter(g => eImp(g) && Number(g.anno) === annoNum
      && (giorno(g.apertura_del) === al || Number(g.giacenza_riferimento_t) > 0 || Number(g.giacenza_riferimento_aci_t) > 0)).map(g => normalizzaRagioneSociale(g.sito)));
    const fatte = attesi.filter(x => conApertura.has(x));
    v.quante = fatte.length;
    if (!attesi.length) { v.stato = 'pronto'; v.dettaglio = 'Nessun impianto da aprire.'; }
    else if (fatte.length === attesi.length) { v.stato = 'pronto'; v.dettaglio = `Tutti i ${attesi.length} impianti hanno l’apertura del ${gg(al)}.`; }
    else if (fatte.length) { v.stato = 'parziale'; v.dettaglio = `${fatte.length} impianti su ${attesi.length} hanno l’apertura del ${gg(al)}; mancano ${attesi.length - fatte.length}.`; }
    else { v.stato = 'manca'; v.dettaglio = `Nessuno dei ${attesi.length} impianti ha l’apertura del ${gg(al)}.`; }
    voci.push(v);
  }

  // 6. I contratti ai subfornitori: annuali anche loro.
  {
    const v = voce('contratti_fornitori', 'Contratti ai subfornitori', 'Annuali senza tacito rinnovo: vanno rigenerati e rifirmati ogni anno.', 'Qualifica Fornitori > Contratti');
    const n = conta(contrattiFornitore, annoNum);
    const prima = conta(contrattiFornitore, annoNum - 1);
    v.quante = n;
    // Il confronto con l'anno prima serve solo se l'anno prima ne aveva: dove non
    // c'erano contratti non c'e' niente da rinnovare, e dirlo «parziale» sarebbe
    // chiedere di completare una cosa che non esiste (10/10/2026).
    if (!prima && !n) { v.stato = 'pronto'; v.dettaglio = `Nel ${annoNum - 1} non ce n'erano: niente da rinnovare.`; }
    else if (!n) { v.stato = 'manca'; v.dettaglio = `Nessun contratto per il ${annoNum}; nel ${annoNum - 1} erano ${prima}.`; }
    else if (!prima || n >= prima) { v.stato = 'pronto'; v.dettaglio = `${n} ${n === 1 ? 'contratto' : 'contratti'} per il ${annoNum}.`; }
    else { v.stato = 'parziale'; v.dettaglio = `${n} ${n === 1 ? 'contratto' : 'contratti'} per il ${annoNum}, contro ${prima} del ${annoNum - 1}.`; }
    voci.push(v);
  }

  const giorni = giorniAlPrimoGennaio(annoNum, oggi);
  const mancanti = voci.filter(v => v.stato === 'manca').length;
  const parziali = voci.filter(v => v.stato === 'parziale').length;
  return {
    anno: annoNum,
    voci,
    giorni_al_primo_gennaio: giorni,
    pronte: voci.filter(v => v.stato === 'pronto').length,
    parziali,
    mancanti,
    pronto: mancanti === 0 && parziali === 0,
    // Si comincia a insistere a dicembre: prima e' presto, e un avviso dato
    // troppo presto si impara a ignorarlo.
    urgente: mancanti > 0 && giorni !== null && giorni <= 31,
    // QUANDO VALE LA PENA DIRLO IN DASHBOARD: dal 1° novembre, cioe' due mesi
    // prima, e finche' resta qualcosa da fare - anche a gennaio inoltrato, se
    // le tariffe nuove non le ha ancora confermate nessuno. Fuori da questa
    // finestra la dashboard tace: un avviso che sta li' tutto l'anno non e'
    // un avviso, e' arredamento.
    avvicinandosi: giorni !== null && giorni <= 61 && (mancanti > 0 || parziali > 0),
  };
}

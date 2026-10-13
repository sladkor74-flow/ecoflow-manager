// Chi usa un fornitore o una tariffa, prima di eliminarli (audit del 20/09, alta
// A88; corretta il 12/10/2026).
//
// Tariffe e fornitori si eliminavano senza guardare chi li usa: la pagina
// chiedeva solo «Eliminare X?», e gestisciAnagrafiche toglieva il record. Un
// fornitore eliminato lascia le sue tariffe, le voci del foglio della passiva e i
// contratti senza un soggetto, e i movimenti che lo nominano non trovano piu' a
// chi fatturare; una tariffa eliminata toglie il prezzo ai movimenti del suo
// periodo, anche a quelli gia' fatturati. Lo storico delle modifiche (traccia.ts)
// registra l'eliminazione, ma non la impedisce.
//
// Qui si contano i riferimenti; gestisciAnagrafiche li dice prima di eliminare e
// propone l'alternativa che non rompe niente: «disattiva» per un fornitore,
// «chiudi periodo» per una tariffa ancora aperta. L'eliminazione resta
// possibile, senza riferimenti o con una conferma che li ha visti elencati.
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { eTerminato, giornoMovimento } from "./movimenti.ts";
import { canaleDi } from "./canaleSecondaria.ts";
import { formatoKg } from "./formato.ts";
import { tariffaNonDisattivata } from "./validitaTariffa.ts";
import { regioneDi } from "./regioneMovimento.ts";
import { oggiRoma } from "./giornoItaliano.ts";

const chiave = (v) => normalizzaRagioneSociale(String(v || ''));

/**
 * Gli archivi dei movimenti che la fatturazione legge, e i campi in cui un
 * fornitore puo' comparire per nome: chi raccoglie o trasporta, chi riceve, e
 * per le secondarie lo stoccaggio da cui partono.
 */
export const CAMPI_FORNITORE_NEI_MOVIMENTI = {
  PrimariaRete: ['trasportatore', 'destinazione'],
  PrimariaAci: ['trasportatore', 'destinazione'],
  Secondaria: ['trasportatore', 'destinazione', 'stoccaggio', 'ragione_sociale'],
  ExtraRaccolta: ['trasportatore', 'destinazione', 'stoccaggio'],
};
export const ARCHIVI_MOVIMENTI = Object.keys(CAMPI_FORNITORE_NEI_MOVIMENTI);

const NOMI_ARCHIVIO = {
  PrimariaRete: ['primaria di rete terminata', 'primarie di rete terminate'],
  PrimariaAci: ['primaria ACI terminata', 'primarie ACI terminate'],
  Secondaria: ['secondaria terminata', 'secondarie terminate'],
  ExtraRaccolta: ['intervento di extra raccolta terminato', 'interventi di extra raccolta terminati'],
};
const movimentiDi = (archivio, n) => plurale(n, ...NOMI_ARCHIVIO[archivio]);
// un intero col punto delle migliaia, scritto a mano come in formato.ts: Intl
// con l'italiano non lo mette sotto le diecimila («1234»)
const numero = (n) => formatoKg(n);
const plurale = (n, uno, tanti) => `${numero(n)} ${n === 1 ? uno : tanti}`;

/**
 * I riferimenti a un fornitore. `dati` porta gli archivi letti: tariffe,
 * fornitori, voci (VocePassivaAmministrazione), contratti (ContrattoFornitore) e
 * movimenti ({ PrimariaRete: [...], ... }).
 *
 * Per nome contano solo se il nome resta senza padrone: se in anagrafica c'e' un
 * altro record con lo stesso nome normalizzato (il doppione «GATIM» e «GATIM
 * S.R.L.»), le tariffe, le voci e i movimenti scritti col nome li prende lui, e
 * a restare appesi sono solo i collegamenti per id a QUESTO record.
 */
export function riferimentiFornitore(f, dati = {}) {
  const { tariffe = [], fornitori = [], voci = [], contratti = [], movimenti = {} } = dati;
  const k = chiave(f && f.ragione_sociale);
  const gemello = fornitori.find(x => x && x.id !== f.id && k && chiave(x.ragione_sociale) === k) || null;
  const perNome = !!k && !gemello;
  const suo = (nome, id) => (!!id && id === f.id) || (perNome && chiave(nome) === k);

  const tariffeSue = tariffe.filter(t => t && suo(t.fornitore_nome, t.fornitore_id));
  const fatturanoTramite = fornitori.filter(x => x && x.id !== f.id && suo(x.fattura_tramite_nome, x.fattura_tramite_id));
  const vociSue = perNome ? voci.filter(v => v && chiave(v.soggetto) === k) : [];
  const contrattiSuoi = perNome ? contratti.filter(c => c && (c.soggetto_chiave === k || chiave(c.soggetto_nome) === k)) : [];
  const movimentiSuoi = {};
  if (perNome) {
    for (const archivio of ARCHIVI_MOVIMENTI) {
      const campi = CAMPI_FORNITORE_NEI_MOVIMENTI[archivio];
      const n = (movimenti[archivio] || []).filter(r => r && eTerminato(r) && campi.some(c => chiave(r[c]) === k)).length;
      if (n) movimentiSuoi[archivio] = n;
    }
  }
  const nMovimenti = Object.values(movimentiSuoi).reduce((s, n) => s + n, 0);

  const elenco = [
    tariffeSue.length ? `${plurale(tariffeSue.length, 'tariffa', 'tariffe')} del fornitore` : '',
    fatturanoTramite.length ? `${plurale(fatturanoTramite.length, 'fornitore che fattura', 'fornitori che fatturano')} tramite lui (${fatturanoTramite.map(x => x.ragione_sociale).join(', ')})` : '',
    vociSue.length ? `${plurale(vociSue.length, 'voce', 'voci')} del foglio della passiva` : '',
    contrattiSuoi.length ? `${plurale(contrattiSuoi.length, 'contratto', 'contratti')}` : '',
    ...Object.entries(movimentiSuoi).map(([a, n]) => `${movimentiDi(a, n)} che lo nominano`),
  ].filter(Boolean);

  return {
    entita: 'Fornitore', id: f.id, nome: f.ragione_sociale || '',
    tariffe: tariffeSue.length, fatturano_tramite: fatturanoTramite.map(x => x.ragione_sociale || x.id),
    voci_passiva: vociSue.length, contratti: contrattiSuoi.length,
    movimenti: nMovimenti, movimenti_per_archivio: movimentiSuoi,
    gemello: gemello ? { id: gemello.id, nome: gemello.ragione_sociale || '' } : null,
    totale: tariffeSue.length + fatturanoTramite.length + vociSue.length + contrattiSuoi.length + nMovimenti,
    elenco,
    proposta: 'disattiva',
  };
}

// Su quali movimenti puo' valere una tariffa, per prestazione: chi ha il ruolo
// (il campo del movimento) e in quali archivi. Le attive non hanno un fornitore:
// sono il prezzo di Ecotyre su tutte le primarie terminate del canale.
const RUOLO_PRESTAZIONE = {
  RACCOLTA: { campo: 'trasportatore', secondarie: false, primarie: true },
  TRASPORTO_SECONDARIA: { campo: 'trasportatore', secondarie: true, primarie: false },
  TRATTAMENTO: { campo: 'destinazione', secondarie: true, primarie: true },
  CONFERIMENTO_STOCCAGGIO: { campo: 'destinazione', secondarie: false, primarie: true },
};

/** Il canale di un movimento, per archivio: rete, ACI o extra raccolta. */
function canaleMovimento(archivio, r) {
  if (archivio === 'ExtraRaccolta') return 'EXTRA_RACCOLTA';
  if (archivio === 'PrimariaAci') return 'ACI';
  if (archivio === 'PrimariaRete') return 'RETE';
  return canaleDi(r);
}
const eSecondaria = (archivio, r) => archivio === 'Secondaria' || (archivio === 'ExtraRaccolta' && String(r.tipo_movimento || '').toLowerCase() === 'secondaria');

/**
 * I movimenti terminati a cui una tariffa puo' dare il prezzo: del suo canale
 * (TUTTE = rete e ACI), con la fine del trasporto - il giorno italiano, regola 1
 * - dentro il suo periodo di validita', e per una passiva col fornitore nel
 * ruolo della prestazione. E' il perimetro su cui la tariffa conta, non il conto
 * esatto della passiva (classe e zona possono assegnarne una parte a un'altra
 * tariffa): basta a dire se eliminarla toglie un prezzo a qualcosa.
 *
 * `oggi` ('AAAA-MM-GG', il giorno italiano; senza, oggiRoma) decide la proposta.
 * «Chiudi periodo» solo a una tariffa ancora aperta, senza data di fine o con
 * la fine dopo oggi: a una gia' chiusa - dal 01/01/2027 tutte quelle del 2026 -
 * portava a chiuderla a oggi, cioe' ad allungarla, contro i contratti annuali
 * senza tacito rinnovo. A una chiusa la proposta e' 'periodo_chiuso', e il
 * testo dice che e' chiusa (revisione del 13/10/2026: la regola stava in
 * gestisciAnagrafiche, e chi chiamava questa funzione da solo non la vedeva).
 */
export function riferimentiTariffa(t, dati = {}) {
  const { movimenti = {}, fornitori = [], oggi = null } = dati;
  const giorno = String(oggi || oggiRoma()).slice(0, 10);
  const dal = String(t.data_inizio_validita || '').slice(0, 10);
  const al = String(t.data_fine_validita || '').slice(0, 10);
  const tipologia = String(t.tipologia || '').toUpperCase();
  const canali = tipologia === 'TUTTE' ? ['RETE', 'ACI'] : tipologia ? [tipologia] : ['RETE', 'ACI', 'EXTRA_RACCOLTA'];
  const attiva = String(t.direzione || '').toUpperCase() === 'ATTIVA';
  const ruolo = attiva ? null : RUOLO_PRESTAZIONE[String(t.prestazione || '').toUpperCase()] || null;
  const forn = fornitori.find(x => x && x.id === t.fornitore_id);
  const k = chiave((forn && forn.ragione_sociale) || t.fornitore_nome);
  // L'ambito della tariffa: regione e provincia, lette come le legge ogni modulo
  // (regioneDi). La classe no: la passiva la confronta con regole sue, e qui
  // basta dire il perimetro. Una tariffa 'non_attivo' non vale mai
  // (validitaTariffa.ts): eliminarla non toglie il prezzo a niente.
  const minuscolo = (v) => String(v || '').trim().toLowerCase();
  const regione = minuscolo(t.regione);
  const provincia = minuscolo(t.provincia);
  const vale = tariffaNonDisattivata(t);

  const perArchivio = {};
  for (const archivio of ARCHIVI_MOVIMENTI) {
    let n = 0;
    for (const r of movimenti[archivio] || []) {
      if (!vale || !r || !eTerminato(r)) continue;
      if (regione && minuscolo(regioneDi(r)) !== regione) continue;
      if (provincia && minuscolo(r.provincia) !== provincia) continue;
      const g = giornoMovimento(r);
      if (!g || (dal && g < dal) || (al && g > al)) continue;
      if (!canali.includes(canaleMovimento(archivio, r))) continue;
      const sec = eSecondaria(archivio, r);
      if (attiva) { if (sec) continue; } else if (ruolo) {
        if (sec ? !ruolo.secondarie : !ruolo.primarie) continue;
        if (!k || chiave(r[ruolo.campo]) !== k) continue;
      } else if (!k || !CAMPI_FORNITORE_NEI_MOVIMENTI[archivio].some(c => chiave(r[c]) === k)) continue;
      n++;
    }
    if (n) perArchivio[archivio] = n;
  }
  const totale = Object.values(perArchivio).reduce((s, n) => s + n, 0);
  const periodo = `${dal ? dal.split('-').reverse().join('/') : 'sempre'} → ${al ? al.split('-').reverse().join('/') : 'aperto'}`;
  return {
    entita: 'Tariffa', id: t.id, periodo,
    movimenti: totale, movimenti_per_archivio: perArchivio,
    totale,
    elenco: Object.entries(perArchivio).map(([a, n]) => `${movimentiDi(a, n)} nel suo periodo (${periodo}), a cui può dare il prezzo`),
    proposta: !al || al > giorno ? 'chiudi_periodo' : 'periodo_chiuso',
  };
}

/** Il testo della conferma: che cosa usa il record, e che cosa conviene fare invece. */
export function testoRiferimenti(r) {
  if (!r || !r.totale) return '';
  // testo a video: con gli accenti
  const chi = r.entita === 'Fornitore' ? `«${r.nome}» è usato da` : `La tariffa (${r.periodo}) è usata da`;
  // A una tariffa gia' chiusa non si propone di chiudere il periodo: si dice fin
  // dove vale, e che cosa perde chi la elimina.
  const invece = r.proposta === 'disattiva'
    ? 'Invece di eliminarlo conviene disattivarlo: resta per i conti già fatti e non si propone più.'
    : r.proposta === 'periodo_chiuso'
      ? 'Il suo periodo è già chiuso: vale solo per i giorni che ha coperto e non va allungato. Eliminandola, quei movimenti restano senza prezzo, anche nei mesi già fatturati.'
      : 'Invece di eliminarla conviene chiudere il periodo: resta valida per i giorni che ha coperto, e i mesi già fatturati non perdono il prezzo.';
  return `${chi}: ${r.elenco.join('; ')}. ${invece}`;
}

// LO STORICO DELLE MODIFICHE IN ECOTYNA (11/10/2026).
//
// Le domande come «chi ha cambiato il target di Irigom e quando» o «quando e'
// cambiato il prezzo di Emmesse» avevano una sola risposta onesta: non si sa.
// Dall'11/10/2026 le scritture a mano dei numeri che fanno i conti lasciano una
// riga in ModificaDato (shared/campiTracciati.ts): qui lo strumento
// storico_modifiche di EcoTyna le legge, le filtra per soggetto, per che cosa,
// per anno, per chi e per periodo, e le restituisce col valore di prima e di
// dopo, gia' nell'unita' che usa la pagina.
//
// I costi dei fornitori (tariffe passive, costi dell'extra raccolta, voci della
// passiva) li sente solo l'amministratore: le righe riservate restano fuori per
// gli altri, e si dice perche' (vedeICosti, AGENTS.md).
//
// Lo storico comincia il giorno in cui e' stato pubblicato: prima non c'e'
// niente, e «nessuna modifica» non vuol dire «mai cambiato». Lo strumento lo
// dice sempre, perche' EcoTyna non lo deduca al contrario.
// Prove: prove/storicoModifiche.mjs.
import { fetchAll } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { giornoRoma, oggiRoma } from "./giornoItaliano.ts";
import { campoTracciato, nomeCampo, valoreDelTesto, differenzeJson } from "./campiTracciati.ts";

const NOMI_ARCHIVI = {
  ImpiantoTargetSecondaria: "target dell'impianto (Target & Status)",
  ImpiantoTarget: "target mensile dell'impianto",
  TargetRaccoglitore: 'target annuo del raccoglitore',
  TargetMensile: 'target mensile del raccoglitore',
  TargetRaccoglitorePrimaria: 'target delle primarie del raccoglitore',
  GiacenzaSito: 'sito di Giacenze (apertura)',
  Tariffa: 'tariffa',
  CommessaEcotyre: 'commessa Ecotyre',
  DichiarazioneSito: "dichiarazione dell'impianto",
  ExtraRaccolta: 'intervento di extra raccolta',
  VocePassivaAmministrazione: 'voce del foglio della passiva',
};
const OPERAZIONI = { create: 'inserito', update: 'modificato', delete: 'eliminato' };

const TARGET = ['ImpiantoTargetSecondaria', 'ImpiantoTarget', 'TargetRaccoglitore', 'TargetMensile', 'TargetRaccoglitorePrimaria'];
const CAMPI_TARGET_COMMESSA = ['target_annuo_t', 'regioni_json', 'target_mensile_iniziale_json', 'target_mensile_json', 'destinazioni_json'];

// Che cosa si chiede, detto a parole: ogni gruppo riconosce le sue righe. Una
// parola che non e' in nessun gruppo si cerca nel nome del campo e
// nell'etichetta.
const COSE = [
  { parole: ['target', 'obiettiv', 'capacit'], prende: (r) => TARGET.includes(r.entita) || (r.entita === 'CommessaEcotyre' && CAMPI_TARGET_COMMESSA.includes(r.campo)) },
  { parole: ['apertur', 'giacenz', 'riferiment'], prende: (r) => r.entita === 'GiacenzaSito' },
  { parole: ['tariff', 'prezz', 'listin'], prende: (r) => r.entita === 'Tariffa' || (r.entita === 'VocePassivaAmministrazione' && r.campo === 'prezzo') || (r.entita === 'ExtraRaccolta' && r.campo === 'prezzo_attivo_t') },
  { parole: ['commess', 'contratt', 'budget'], prende: (r) => r.entita === 'CommessaEcotyre' },
  { parole: ['dichiar'], prende: (r) => r.entita === 'DichiarazioneSito' },
  { parole: ['extra'], prende: (r) => r.entita === 'ExtraRaccolta' },
  { parole: ['passiv', 'voce', 'voci'], prende: (r) => r.entita === 'VocePassivaAmministrazione' },
  { parole: ['cost', 'sovracost'], prende: (r) => r.riservato === true || /cost/.test(String(r.campo || '')) },
];

const minuscolo = (v) => String(v || '').toLowerCase().trim();

function filtroCosa(cosa) {
  const c = minuscolo(cosa);
  if (!c) return null;
  const gruppi = COSE.filter(g => g.parole.some(p => c.includes(p)));
  if (gruppi.length) return (r) => gruppi.some(g => g.prende(r));
  return (r) => minuscolo(`${nomeCampo(r.entita, r.campo)} ${r.etichetta} ${NOMI_ARCHIVI[r.entita] || ''}`).includes(c);
}

const ORA_ROMA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const quando = (il) => { const d = new Date(String(il || '')); return Number.isNaN(d.getTime()) ? '' : ORA_ROMA.format(d).replace(',', ''); };

// L'unita' come la dice la pagina: un target salvato in chili che la pagina
// scrive in tonnellate si da' in tonnellate. Si decide una volta per riga, non
// per lato: su un impianto cancellato il «dopo» e' vuoto, e prima l'unita' si
// prendeva da li' (i chili della riga) mentre il numero di prima era gia' in
// tonnellate. EcoTyna avrebbe detto 1.050 kg per un target di 1.050 t
// (revisione delle migliorie, 11/10/2026).
function unitaMostrata(r) {
  const spec = campoTracciato(r.entita, r.campo) || {};
  return r.unita === 'kg' && spec.mostra === 't' ? 't' : (r.unita || '');
}

// Il valore di un lato nell'unita' mostrata.
function valore(r, testo, unita) {
  const v = valoreDelTesto(r.unita, testo);
  if (typeof v === 'number' && r.unita === 'kg' && unita === 't') return Math.round(v) / 1000;
  return v;
}

/**
 * La risposta dello strumento storico_modifiche. archivi e'
 * base44.asServiceRole.entities; p: { soggetto, cosa, anno, chi, dal, al }.
 * opzioni: { vedeCosti, costiRiservati, elenco } (elenco taglia la lista come
 * gli altri strumenti).
 */
export async function storicoModifiche(archivi, p = {}, { vedeCosti = false, costiRiservati = '', elenco = null } = {}) {
  const tutte = await fetchAll(archivi.ModificaDato, null, '-il');
  const anno = Number(p.anno) || null;
  const soggetto = p.soggetto ? normalizzaRagioneSociale(String(p.soggetto)) : '';
  const chi = minuscolo(p.chi);
  const dal = giornoRoma(p.dal) || '';
  const al = giornoRoma(p.al) || '';
  const cosa = filtroCosa(p.cosa);

  const scelte = tutte.filter(r => {
    if (!r) return false;
    if (anno && Number(r.anno) !== anno) return false;
    if (soggetto && !normalizzaRagioneSociale(String(r.etichetta || '')).includes(soggetto)) return false;
    if (chi && !minuscolo(r.utente).includes(chi)) return false;
    const giorno = giornoRoma(r.il || r.created_date) || '';
    if (dal && giorno < dal) return false;
    if (al && giorno > al) return false;
    if (cosa && !cosa(r)) return false;
    return true;
  });
  const visibili = vedeCosti ? scelte : scelte.filter(r => r.riservato !== true);
  const nascoste = scelte.length - visibili.length;

  const righe = visibili
    .sort((a, b) => String(b.il || b.created_date || '').localeCompare(String(a.il || a.created_date || '')))
    .map((r) => {
      const unita = unitaMostrata(r);
      return {
        quando: quando(r.il || r.created_date),
        chi: r.utente || 'non registrato',
        cosa: r.etichetta || '',
        archivio: NOMI_ARCHIVI[r.entita] || r.entita,
        campo: nomeCampo(r.entita, r.campo),
        operazione: OPERAZIONI[r.operazione] || 'modificato',
        ...(r.unita === 'json'
          ? { differenze: differenzeJson(r.prima, r.dopo, campoTracciato(r.entita, r.campo)) }
          : { prima: valore(r, r.prima, unita), dopo: valore(r, r.dopo, unita), unita }),
        ...(r.motivo ? { motivo: r.motivo } : {}),
        ...(r.origine ? { da_dove: r.origine } : {}),
      };
    });

  const filtri = [p.soggetto && `soggetto ${p.soggetto}`, p.cosa && `${p.cosa}`, anno && `anno ${anno}`, p.chi && `scritte da ${p.chi}`, dal && `dal ${dal}`, al && `al ${al}`].filter(Boolean);
  return {
    fonte: 'Storico delle modifiche',
    periodo: filtri.length ? `modifiche registrate: ${filtri.join(', ')}` : 'tutte le modifiche registrate',
    dati_al: oggiRoma(),
    dati: {
      modifiche: typeof elenco === 'function' ? elenco(righe, 60) : righe,
      ...(nascoste > 0 ? { riservate_non_dette: nascoste, nota_riservate: costiRiservati } : {}),
      // La conferma di un valore copiato (Target & Status, tariffe) scrive
      // solo la nota del record e non lascia righe: la nota non deve dire al
      // presente «da confermare» di un valore che puo' essere gia' confermato
      // (revisione delle migliorie, 11/10/2026).
      nota: "Lo storico registra le modifiche fatte a mano (target, aperture, tariffe, commessa, dichiarazioni, costi e prezzi dell'extra raccolta, voci della passiva) dall'ottobre 2026: prima non c'e' niente, quindi «nessuna modifica» non vuol dire che il valore non sia mai cambiato. Anche le copie dell'anno nuovo lasciano le loro righe (inserito, motivo «copia dal <anno prima>, da confermare»): la copia di Target & Status e le tariffe preparate per l'anno. Il motivo dice com'era al momento della copia, valori dell'anno prima allora da confermare sul contratto nuovo; la conferma invece non lascia righe qui, perche' toglie solo il segno «da confermare» dal record. Da queste righe quindi non si sa se un valore copiato e' stato confermato dopo: lo dice la pagina (Target & Status, o la nota della tariffa), e non si deve dire che e' ancora da confermare solo per il motivo di queste righe. Le modifiche precedenti ai target dei raccoglitori e alla commessa restano nello storico della loro riga in Target & Status. I caricamenti dei file non passano da qui: il loro storico e' quello dei caricamenti. Ogni valore e' nell'unita' indicata accanto (unita). Nelle differenze delle tabelle della commessa ogni numero porta la sua: t i target mensili, i budget e i target per regione o destinazione; €/t il prezzo della previsione ACI; % la ripartizione per classe, gia' in percentuale (35 vuol dire 35%). Una differenza senza unita' e' un testo (il criterio di una voce della passiva). Una riga di tabella aggiunta o tolta senza nessun valore ha solo il nome (voce), con riga «aggiunta» o «tolta» e valori «nessuno».",
    },
  };
}

// QUANTO RESTA DA DICHIARARE A PORTALE (riepilogoDichiarazioni, CellaMese, Riepilogo).
//
// Il primo fatto, 02/10/2026. L'utente apre il riepilogo di settembre e trova due
// cose non vere: GREEN TYRE PROJECT risulta avere gia' dichiarato una parte di
// settembre, quando a portale non ha dichiarato niente, e di Gatim non si vedono
// i 122.170 kg che il portale aspetta.
//
// La causa non era la fotografia del portale, che quei numeri ce li ha esatti
// (export del 02/10: Gatim giugno 112.240 e settembre 122.170, GREEN TYRE
// settembre 244.080, nessuna riga senza fine trasporto). Era il conto: si
// sottraeva dagli ingressi del mese tutto quello che stava scritto in
// quantita_kg, anche quando quella quantita' a portale non era mai arrivata.
// L'entita' DichiarazioneSito dice il contrario, sul campo caricata_inviata:
// «Solo i mesi con questo flag true concorrono a decurtare la giacenza».
//
// I numeri falsi venivano dalle righe seminate il 12/09/2026
// (seedGiacenze2026): per i mesi non ancora dichiarati portano in quantita_kg
// il quantitativo DA dichiarare a quella data, con caricata_inviata false.
//
// Il secondo fatto, 09/10/2026, e non e' una correzione del primo ma la sua
// parte mancante. Gli ingressi del mese restano l'unita' di conto, ma il
// dichiarato da sottrarre non e' quello scritto SU QUEL MESE: il portale aggancia
// le quantita' agli ordini piu' vecchi aperti, quindi i PFU di gennaio escono con
// la dichiarazione di marzo. Quanto di ogni mese e' uscito lo dice il report del
// portale, ordine per ordine, e la regola sta in shared/usciteDichiarate.ts (con
// le sue prove in prove/usciteDichiarate.mjs). Qui si prova che il conto del mese
// la usa, che non legge mai quantita_kg nudo, e che la casella resta leggibile.
// npm run prove
import { readFileSync } from 'node:fs';
import { allineaAllaGiacenza } from '../base44/shared/usciteDichiarate.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// La regola, scritta qui come la scrive la funzione: di un mese resta quello che
// non gli e' uscito, e quello che gli e' uscito lo dice il portale. La
// dichiarazione scritta sul mese non entra nel conto in nessun modo: e' proprio
// questo che rende impossibile la trappola delle righe seminate.
const restaDelMese = (ingressi, dich, uscitoAPortale = 0) => {
  const d = dich || {};
  if (d.motivo_assenza === 'non_dovuta') return 0;
  return allineaAllaGiacenza([ingressi], [uscitoAPortale], null).resta[0];
};

console.log('I DUE CASI SEGNALATI DALL\'UTENTE');
{
  // GREEN TYRE settembre: 105.740 kg scritti come dichiarati, mai caricati a
  // portale, e a portale di quel mese non e' uscito niente. Restano tutti.
  const seme = { quantita_kg: 105740, caricata_inviata: false };
  verifica('GREEN TYRE settembre: una dichiarazione mai caricata non toglie niente',
    restaDelMese(255780, seme, 0) === 255780, String(restaDelMese(255780, seme, 0)));
  verifica('e col vecchio conto ne mancavano 105.740', 255780 - 105740 === 150040);
  // Gatim settembre: 17.940 seminati, il portale ne aspetta 122.170.
  verifica('Gatim settembre: restano tutti gli ingressi del mese',
    restaDelMese(122170, { quantita_kg: 17940, caricata_inviata: false }, 0) === 122170);
  // Gatim giugno: il seme vale esattamente quanto il portale aspetta, quindi il
  // vecchio conto dava zero - il mese spariva dal totale.
  verifica('Gatim giugno: prima dava zero, adesso vale 112.240',
    restaDelMese(112240, { quantita_kg: 112240, caricata_inviata: false }, 0) === 112240);
  verifica('e sommando i due mesi tornano i 234.410 kg del portale',
    restaDelMese(112240, { quantita_kg: 112240, caricata_inviata: false }, 0)
    + restaDelMese(122170, { quantita_kg: 17940, caricata_inviata: false }, 0) === 234410);
}

console.log('QUELLO CHE A PORTALE E USCITO NON RESTA DA DICHIARARE');
{
  verifica('uscito tutto: non resta niente', restaDelMese(78430, { quantita_kg: 78430, caricata_inviata: true }, 78430) === 0);
  verifica('uscito in parte: resta la differenza', restaDelMese(100000, null, 80000) === 20000);
  verifica('il portale non puo aver preso piu di quanto e arrivato: non si va sotto zero',
    restaDelMese(50000, null, 80000) === 0);
  verifica('senza nessun aggancio restano tutti gli ingressi', restaDelMese(94040, null, 0) === 94040);
  // IL CASO T-CYCLE, che e' il motivo di tutto: il mese della nave dichiara
  // 146.860 kg, ma di marzo ne sono usciti 22.700 - il resto erano gennaio e
  // febbraio. Il conto del mese guarda l'uscito, non il dichiarato.
  verifica('marzo di T-Cycle: dichiarati 146.860 ma di marzo usciti 22.700',
    restaDelMese(43320, { quantita_kg: 146860, caricata_inviata: true }, 22700) === 20620);
  verifica('e gennaio, che non ha nessuna dichiarazione scritta, e uscito tutto',
    restaDelMese(87740, null, 87740) === 0);
}

console.log('IL FERRO, E I MESI CHE NON SI DEVONO');
{
  // Regola dell'utente, 02/10/2026: «va anche sommato cio' che e' stato solo
  // dichiarato come uscite di ferro, perche' quelle quantita' non corrispondono
  // a una decurtazione da portale: le uscite di ferro sono gestite al di fuori
  // del portale». Il ferro non si carica mai, quindi a portale non esce niente.
  verifica('un mese di soli metalli resta tutto da dichiarare',
    restaDelMese(40000, { quantita_kg: 0, motivo_assenza: 'solo_metalli' }, 0) === 40000);
  verifica('e vale anche se il ferro e stato scritto come quantita non caricata',
    restaDelMese(40000, { quantita_kg: 12000, caricata_inviata: false, motivo_assenza: 'solo_metalli' }, 0) === 40000);
  // Non dovuta e' un'altra cosa: quel trattamento non e' a nostro carico, e un
  // arretrato che non esiste non va chiesto.
  verifica('un mese non dovuto non resta da dichiarare',
    restaDelMese(40000, { quantita_kg: 0, motivo_assenza: 'non_dovuta' }, 0) === 0);
}

console.log('LA FUNZIONE FA QUESTO, NON ALTRO');
{
  const s = sorgente('base44/functions/riepilogoDichiarazioni/entry.ts');
  verifica('si tiene da parte solo cio che e caricato a portale',
    /const caricatoAPortale = dich\.caricata_inviata \? dichiarata : 0;/.test(s));
  verifica('e il conto del mese e quello che non gli e uscito',
    s.includes('da_dichiarare_kg: m.non_dovuta ? 0 : allineato.resta[i]'));
  verifica('il vecchio conto, che sottraeva tutto, non c e piu',
    !/Math\.max\(0, totale - Math\.round\(Number\(\(perDich\.get\(chiave\) \|\| \{\}\)\.quantita_kg\)/.test(s),
    'si sottrae ancora la quantita senza guardare se e caricata');
  verifica('e nemmeno quello che sottraeva il caricato del solo mese',
    !s.includes('da_dichiarare_kg: nonDovuta ? 0 : Math.max(0, totale - caricatoAPortale)'));
  // Una dichiarazione che c'e' ma non e' a portale non e' la stessa cosa del non
  // averla: il numero si conserva, perche' la casella lo dice.
  verifica('la dichiarazione non caricata resta visibile a parte',
    /dichiarato_non_caricato_kg: dichiarata - caricatoAPortale/.test(s));
  verifica('solo metalli NON azzera il conto', !/solo_metalli.*\? 0/.test(s));
  // Il totale di riga che la colonna mostra e' la somma dei mesi.
  verifica('il totale della riga e la somma dei mesi',
    /da_dichiarare_t: t3\(mesi\.reduce\(\(s, m\) => s \+ m\.da_dichiarare_kg, 0\) \/ 1000\)/.test(s)
    && /resta_t: t3\(mesi\.reduce\(\(s, m\) => s \+ m\.resta_kg, 0\) \/ 1000\)/.test(s));
}

console.log('LA CASELLA: UN NUMERO SOLO, E IL COLORE DICE CHE COS E');
{
  // Il 02/10/2026 la casella era diventata illeggibile: il numero, la parola
  // dello stato, e sotto quanto mancava. Tre scritte in settanta pixel, per
  // dodici mesi e venti righe. Parole dell'utente: «ci devono solo essere in
  // verde i dichiarati e in un altro colore cio' che manca con i numeri del
  // mese... cosa sono tutte quelle scritte?».
  const c = sorgente('src/components/dichiarazioni/CellaMese.jsx');
  verifica('un numero solo', c.includes('{numero}') && !/da segnare|in mano|non dovuta/.test(c.split('return (')[1] || ''));
  // I COLORI, dal 09/10/2026: il verde e' per quello che e' USCITO (pieno se
  // tutto, chiaro se in parte) e l'indaco per il mese in cui la dichiarazione e'
  // stata caricata a portale, cioe' il mese della nave. Parole dell'utente:
  // «marcando in verde i quantitativi effettivamente usciti... e colorare
  // diversamente le celle in cui avviene il caricamento a portale».
  verifica('indaco dove si e caricato a portale, verde cio che e uscito, arancione il ferro, ambra cio che resta',
    c.includes("stato === 'caricata' ? 'bg-indigo-600")
    && c.includes("uscitoTutto ? 'bg-emerald-600")
    && c.includes("uscitoInParte ? 'bg-emerald-200")
    && c.includes("stato === 'solo_metalli' ? 'bg-orange-300")
    && c.includes("inAmbra ? 'bg-amber-50"));
  verifica('e ambra vuol dire che di quel mese non e uscito niente ed e dovuto',
    c.includes("const inAmbra = resta > 0 && !nonDovuto && stato !== 'caricata' && !(uscito > 0)"));
  // I mesi che non sono un arretrato non si colorano come tale: la rete non
  // dovuta per accordo e i mesi di soli metalli, che si dichiarano con la
  // prossima uscita di gomma.
  verifica('non dovuta e soli metalli non sono un arretrato',
    c.includes("const nonDovuto = stato === 'non_dovuta' || stato === 'solo_metalli'"));
  // I mesi di solo ferro erano caselle chiare e vuote: zero dichiarato a portale
  // e, da quando le parole sono uscite dalle caselle, nemmeno una scritta. Ma
  // qualcosa e uscito, ed e ferro (utente, 02/10/2026).
  verifica('i mesi di solo ferro portano il ferro uscito',
    c.includes("const numero = stato === 'solo_metalli' ? ferro") && c.includes("Number(d.metalli_kg) > 0 ? kg(d.metalli_kg)"));
  verifica('e lo dicono, e dicono anche quando il ferro non e indicato',
    c.includes("solo metalli ferrosi") && c.includes("ferro da indicare"));
  // IL NUMERO NON CAMBIA SIGNIFICATO A META TABELLA (lezione del 01/10/2026):
  // dove il fondo e indaco il numero e il dichiarato caricato, dove e verde e
  // l'uscito, dove e ambra e quello che resta.
  verifica('ogni colore ha il suo numero',
    c.includes("stato === 'caricata' ? dichiarato") && c.includes('uscito > 0 ? `${circa}${kg(uscito)}`') && c.includes('inAmbra ? kg(resta)'));
  // Una parte ripartita dal gestionale non si presenta come un dato letto.
  verifica('un uscito stimato si distingue da uno letto',
    c.includes("const circa = mese.uscito_stimato ? '~' : ''"));
  // Nessun commento // dentro il JSX: in JSX si stampa a video, ed e' cosi' che
  // il 02/10/2026 la parola NON DOVUTA e finita dentro ogni casella della
  // tabella. Si guarda solo da 'return (' in giu.
  const jsx = c.split('return (')[1] || '';
  verifica('nessun commento // dentro il JSX', !new RegExp('^\\s*\\/\\/', 'm').test(jsx), 'un commento // in JSX si stampa a video');
}

console.log('LA COLONNA DEL RIEPILOGO: E LA SOMMA DELLA RIGA, CHE E LA GIACENZA');
{
  const r = sorgente('src/components/dichiarazioni/Riepilogo.jsx');
  verifica('la colonna c e', />Da dichiarare \(t\)<\/th>/.test(r));
  // E' LA GIACENZA, non una somma che le assomiglia. Fino al 02/10/2026 la
  // colonna leggeva la giacenza calcolata per un'altra strada, perche' sommare i
  // mesi dava un numero diverso (Irigom: 1.301,08 invece di 543,22). Dal
  // 09/10/2026 i due numeri coincidono per costruzione, perche' il mese sa quanto
  // gli e' uscito: la colonna mostra la somma della riga, e cosi' la riga non
  // puo' piu' smentirsi da sola.
  verifica('la colonna e la somma della riga resta in giacenza', r.includes('const resta = flusso.resta_t'));
  verifica('e la riga c e, sotto quella del conferito',
    r.includes('resta in giacenza') && r.includes('conferito nel mese') && r.includes('m.resta_kg'));
  // Sotto zero non si azzera: si mostra e si segnala. La somma dei mesi non va
  // sotto zero, quindi il negativo lo dice la giacenza del canale.
  verifica('una giacenza sotto zero si vede, in rosso',
    r.includes('if (g && g.giacenza_t < 0) return') && r.includes('text-red-600'));
  // colonna deve tacere: altrimenti mostrerebbe come arretrato tutti gli
  // ingressi dell'anno di un impianto che non ci deve niente.
  verifica('dove la rete non e dovuta la colonna tace',
    /flusso\.canale === 'RETE' && sito\.dichiara_rete === false/.test(r));
  verifica('e l intestazione della tabella resta allineata', /colSpan=\{15\}/.test(r));
  // Dove il conto non si chiude si dice, invece di aggiustarlo in silenzio.
  verifica('le due differenze da capire sono scritte sopra la tabella',
    r.includes('uscito_oltre_kg') && r.includes('uscito_non_allocato_kg'));
}

// LE TRE LINEE DEL RIEPILOGO (06/10/2026 e 09/10/2026).
//
// La doppia linea l'ha chiesta l'utente il 06/10: «una doppia linea per
// distinguere cio' che in quel mese e' stato dichiarato e cio' che e' stato
// conferito». La terza il 09/10: «lasciando in basso la parte restante in
// giacenza oltre agli ingressi del mese». Il delta col segno che stava sotto il
// conferito e' uscito: diceva la stessa cosa per approssimazione, e adesso c'e'
// il numero vero.
console.log('LE TRE LINEE DEL RIEPILOGO');
{
  const r = sorgente('src/components/dichiarazioni/Riepilogo.jsx');
  verifica('sotto ogni riga c e quella del conferito', r.includes('conferito nel mese'));
  verifica('e sotto quella di cio che resta in giacenza', r.includes('resta in giacenza'));
  verifica('il delta approssimato non c e piu', !r.includes('caricatoDelMese(m)'));
  // IL DICHIARATO E' SOLO IL CARICATO, anche nel foglio: quantita_kg nudo, sulle
  // righe seminate, e' il DA dichiarare.
  const e = sorgente('src/lib/dichiarazioniExport.js');
  verifica('il foglio Excel ha le stesse voci dello schermo',
    e.includes("'Dichiarato a portale'") && e.includes("'Uscito nel mese'") && e.includes("'Conferito nel mese'") && e.includes("'Resta in giacenza'"));
  verifica('e non legge piu quantita_kg nudo come dichiarato',
    !e.includes('m.dichiarazione ? m.dichiarazione.quantita_kg : null') && e.includes('caricatoDelMese(m)'));

  // La regola del caricato sta in un posto solo, e vale anche senza il campo nuovo.
  const d = sorgente('base44/shared/dichiarazioniImpianti.ts');
  verifica('la regola del caricato e scritta una volta sola', /export function caricatoDelMese/.test(d));
}
{
  const { caricatoDelMese } = await import('../src/lib/dichiarazioniImpianti.js');
  verifica('il caricato di un mese e quello che il gestionale ha gia calcolato',
    caricatoDelMese({ caricato_kg: 12000, dichiarazione: { quantita_kg: 99999, caricata_inviata: false } }) === 12000);
  verifica('senza quel campo vale solo la dichiarazione caricata',
    caricatoDelMese({ dichiarazione: { quantita_kg: 105740, caricata_inviata: false } }) === 0
    && caricatoDelMese({ dichiarazione: { quantita_kg: 105740, caricata_inviata: true } }) === 105740);
  verifica('e un mese senza niente vale zero', caricatoDelMese(null) === 0 && caricatoDelMese({}) === 0);
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);

// QUANTO RESTA DA DICHIARARE A PORTALE (riepilogoDichiarazioni, CellaMese, Riepilogo).
//
// Il fatto da cui nasce, 02/10/2026. L'utente apre il riepilogo di settembre e
// trova due cose non vere: GREEN TYRE PROJECT risulta avere gia' dichiarato una
// parte di settembre, quando a portale non ha dichiarato niente, e di Gatim non
// si vedono i 122.170 kg che il portale aspetta.
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
// E la stessa correzione risolve la regola del ferro, detta dall'utente lo
// stesso giorno: le uscite di ferro si gestiscono fuori dal portale, quindi non
// vengono mai caricate, quindi non decurtano niente. Non c'e' da sommarle: basta
// non sottrarle. npm run prove
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// La regola, scritta qui come la scrive la funzione: si prova sui casi veri.
const restaDelMese = (ingressi, dich) => {
  const d = dich || {};
  const dichiarata = Math.round(Number(d.quantita_kg) || 0);
  const caricato = d.caricata_inviata ? dichiarata : 0;
  if (d.motivo_assenza === 'non_dovuta') return 0;
  return Math.max(0, Math.round(ingressi) - caricato);
};

console.log('I DUE CASI SEGNALATI DALL\'UTENTE');
{
  // GREEN TYRE settembre: 105.740 kg scritti come dichiarati, mai caricati a
  // portale. Prima restavano da dichiarare gli ingressi meno quei 105.740;
  // adesso restano tutti.
  const seme = { quantita_kg: 105740, caricata_inviata: false };
  verifica('GREEN TYRE settembre: una dichiarazione mai caricata non toglie niente',
    restaDelMese(255780, seme) === 255780, String(restaDelMese(255780, seme)));
  verifica('e col vecchio conto ne mancavano 105.740', 255780 - 105740 === 150040);
  // Gatim settembre: 17.940 seminati, il portale ne aspetta 122.170.
  verifica('Gatim settembre: restano tutti gli ingressi del mese',
    restaDelMese(122170, { quantita_kg: 17940, caricata_inviata: false }) === 122170);
  // Gatim giugno: il seme vale esattamente quanto il portale aspetta, quindi il
  // vecchio conto dava zero - il mese spariva dal totale.
  verifica('Gatim giugno: prima dava zero, adesso vale 112.240',
    restaDelMese(112240, { quantita_kg: 112240, caricata_inviata: false }) === 112240);
  verifica('e sommando i due mesi tornano i 234.410 kg del portale',
    restaDelMese(112240, { quantita_kg: 112240, caricata_inviata: false })
    + restaDelMese(122170, { quantita_kg: 17940, caricata_inviata: false }) === 234410);
}

console.log('UN MESE DAVVERO CARICATO A PORTALE NON RESTA DA DICHIARARE');
{
  verifica('caricata e di pari quantita: non resta niente',
    restaDelMese(78430, { quantita_kg: 78430, caricata_inviata: true }) === 0);
  verifica('caricata per meno: resta la differenza',
    restaDelMese(100000, { quantita_kg: 80000, caricata_inviata: true }) === 20000);
  verifica('caricata per piu del conferito: non si va sotto zero',
    restaDelMese(50000, { quantita_kg: 80000, caricata_inviata: true }) === 0);
  verifica('senza nessuna dichiarazione restano tutti gli ingressi',
    restaDelMese(94040, null) === 94040);
}

console.log('IL FERRO, E I MESI CHE NON SI DEVONO');
{
  // Regola dell'utente, 02/10/2026: «va anche sommato cio' che e' stato solo
  // dichiarato come uscite di ferro, perche' quelle quantita' non corrispondono
  // a una decurtazione da portale: le uscite di ferro sono gestite al di fuori
  // del portale». Il ferro non si carica mai, quindi non si sottrae mai.
  verifica('un mese di soli metalli resta tutto da dichiarare',
    restaDelMese(40000, { quantita_kg: 0, motivo_assenza: 'solo_metalli' }) === 40000);
  verifica('e vale anche se il ferro e stato scritto come quantita non caricata',
    restaDelMese(40000, { quantita_kg: 12000, caricata_inviata: false, motivo_assenza: 'solo_metalli' }) === 40000);
  // Non dovuta e' un'altra cosa: quel trattamento non e' a nostro carico, e un
  // arretrato che non esiste non va chiesto.
  verifica('un mese non dovuto non resta da dichiarare',
    restaDelMese(40000, { quantita_kg: 0, motivo_assenza: 'non_dovuta' }) === 0);
}

console.log('LA FUNZIONE FA QUESTO, NON ALTRO');
{
  const s = sorgente('base44/functions/riepilogoDichiarazioni/entry.ts');
  verifica('si sottrae solo cio che e caricato a portale',
    /const caricatoAPortale = dich\.caricata_inviata \? dichiarata : 0;/.test(s));
  verifica('e il conto del mese usa quello',
    /da_dichiarare_kg: nonDovuta \? 0 : Math\.max\(0, totale - caricatoAPortale\)/.test(s));
  verifica('il vecchio conto, che sottraeva tutto, non c e piu',
    !/Math\.max\(0, totale - Math\.round\(Number\(\(perDich\.get\(chiave\) \|\| \{\}\)\.quantita_kg\)/.test(s),
    'si sottrae ancora la quantita senza guardare se e caricata');
  // Una dichiarazione che c'e' ma non e' a portale non e' la stessa cosa del non
  // averla: il numero si conserva, perche' la casella lo dice.
  verifica('la dichiarazione non caricata resta visibile a parte',
    /dichiarato_non_caricato_kg: dichiarata - caricatoAPortale/.test(s));
  verifica('solo metalli NON azzera il conto', !/solo_metalli.*\? 0/.test(s));
  // Il totale di riga che la colonna nuova mostra e' la somma dei mesi.
  verifica('il totale della riga e la somma dei mesi',
    /da_dichiarare_t: t3\(mesi\.reduce\(\(s, m\) => s \+ m\.da_dichiarare_kg, 0\) \/ 1000\)/.test(s));
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
  verifica('verde dove e caricato a portale, ambra dove manca',
    c.includes("stato === 'caricata' ? 'bg-emerald-600") && c.includes("inAmbra ? 'bg-amber-50"));
  verifica('e ambra vuol dire che resta qualcosa di dovuto',
    c.includes("const inAmbra = resta > 0 && !nonDovuto && stato !== 'caricata'"));
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
  // dove il mese e caricato il numero e il dichiarato, dove non lo e e quello
  // che manca - e li il dichiarato non si scrive, perche non e mai arrivato.
  verifica('dove e caricato il numero e il dichiarato',
    c.includes("stato === 'caricata' ? dichiarato : (inAmbra ? kg(resta) : dichiarato)"));
  // Nessun commento // dentro il JSX: in JSX si stampa a video, ed e' cosi' che
  // il 02/10/2026 la parola NON DOVUTA e finita dentro ogni casella della
  // tabella. Si guarda solo da 'return (' in giu.
  const jsx = c.split('return (')[1] || '';
  verifica('nessun commento // dentro il JSX', !new RegExp('^\\s*\\/\\/', 'm').test(jsx), 'un commento // in JSX si stampa a video');
}

console.log('LA COLONNA NUOVA DEL RIEPILOGO: E LA GIACENZA');
{
  const r = sorgente('src/components/dichiarazioni/Riepilogo.jsx');
  verifica('la colonna c e', />Da dichiarare \(t\)<\/th>/.test(r));
  // E' LA GIACENZA, non la somma dei mesi. Coincidono dove l'impianto dichiara
  // mese per mese (Gatim 234,41 e Green Tyre 260,20, identici) ma non dove
  // dichiara quando il prodotto esce: Irigom e' un R1, il mese in cui parte la
  // nave dichiara piu' di quanto gli e' arrivato, e sommando i mesi con il max a
  // zero quell'eccedenza si perdeva - usciva 1.301,08 invece di 543,22.
  verifica('per la rete mostra la giacenza calcolata',
    r.includes("flusso.canale === 'RETE' ? sito.giacenza_calcolata_t : flusso.da_dichiarare_t"));
  // colonna deve tacere: altrimenti mostrerebbe come arretrato tutti gli
  // ingressi dell'anno di un impianto che non ci deve niente.
  verifica('dove la rete non e dovuta la colonna tace',
    /flusso\.canale === 'RETE' && sito\.dichiara_rete === false/.test(r));
  verifica('e l intestazione della tabella resta allineata', /colSpan=\{15\}/.test(r));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);

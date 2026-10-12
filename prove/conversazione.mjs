// Prova della MODALITA' CONVERSAZIONE DI ECOTYNA (utente, 11/10/2026: «vorrei
// rendere EcoTyna piu' realistica»).
//
// Con la voce si parlava a turni rigidi: microfono, Invia, ascoltare fino in
// fondo. Con la modalita' accesa:
//   - finita la risposta torna ad ascoltare da sola;
//   - se le si parla sopra si ferma, ma la sua eco dalle casse non la ferma;
//   - la domanda dettata parte da sola dopo una pausa, con un conto durante il
//     quale la si annulla o la si manda subito; riprendere a parlare lo ferma;
//   - una domanda non parte mai per sbaglio: «basta» non e' una domanda, chi
//     scrive a mano non vuole l'invio automatico, il pulsante Ferma non riapre
//     il microfono.
// In fondo, il riconoscimento del browser con le sessioni in fila (voce.js).
// Revisione delle migliorie (11/10/2026): la sua parola di stop non la ferma, una
// domanda che riprende le sue parole si'; la domanda dettata parte come dal
// pulsante Invia, coi file in coda (sezione 6, sul codice vero della pagina).
// Verifica delle correzioni (12/10/2026, sezione 3): la sua eco capita male
// («quanto» per «quando») non la ferma, «ok basta» la ferma ma non parte, la
// domanda che comincia col fornitore appena detto da lei parte intera.
// npm run prove
import { readFileSync } from 'node:fs';
import { creaConversazione, TEMPI } from '../src/lib/conversazione.js';
import { creaRiconoscimento } from '../src/lib/voce.js';
import { testoParlato } from '../src/lib/parlato.js';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const banco = ({ onTesto = null, onInvia = null } = {}) => {
  let ora = 0;
  let coda = [];
  const timer = {
    setTimeout: (fn, ms) => { const t = { fn, quando: ora + ms, vivo: true }; coda.push(t); return t; },
    clearTimeout: (t) => { if (t) t.vivo = false; },
  };
  const avanza = (ms) => {
    const fine = ora + ms;
    for (;;) {
      const prossimo = coda.filter(t => t.vivo && t.quando <= fine).sort((a, b) => a.quando - b.quando)[0];
      if (!prossimo) break;
      prossimo.vivo = false;
      ora = prossimo.quando;
      prossimo.fn();
    }
    ora = fine;
    coda = coda.filter(t => t.vivo);
  };
  const ascolto = { aperte: 0, chiuse: 0, avvia(o) { this.aperte++; this.ultime = o; }, annulla() { this.chiuse++; } };
  const r = { testi: [], inviate: [], interruzioni: 0, stati: [] };
  const c = creaConversazione({
    ascolto, timer,
    onTesto: (t) => { r.testi.push(t); if (onTesto) onTesto(t); },
    onInvia: (q) => { r.inviate.push(q); if (onInvia) onInvia(q); },
    onInterrompi: () => { r.interruzioni++; c.finitoDiParlare('fermata'); },
    onStato: (s) => r.stati.push(s),
  });
  return { c, ascolto, avanza, r };
};
const sentito = (...testi) => testi.map(testo => ({ testo, definitivo: true }));

const DETTO = 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete. Ad agosto duemilaventisei Emmesse ha raccolto quattrocentododici virgola trenta tonnellate sulla rete.';

console.log('1. LA DOMANDA PARTE DA SOLA, DOPO UNA PAUSA E UN CONTO');
{
  const { c, ascolto, avanza, r } = banco();
  c.accendi({ ascolta: true });
  verifica('accesa con un clic: ascolta subito, a sessione continua', c.modo === 'domanda' && ascolto.aperte === 1 && ascolto.ultime.continuo === true);
  c.risultato(sentito('quanto ha raccolto Emmesse ad agosto'), 0);
  verifica('il testo dettato va nella casella', r.testi[r.testi.length - 1] === 'quanto ha raccolto Emmesse ad agosto');
  avanza(TEMPI.silenzio - 1);
  verifica('mentre si potrebbe ancora parlare, niente conto', c.modo === 'domanda');
  avanza(1);
  verifica('dopo la pausa comincia il conto', c.modo === 'conto' && r.inviate.length === 0);
  avanza(TEMPI.conto - 1);
  verifica('durante il conto non parte', r.inviate.length === 0);
  avanza(1);
  verifica('finito il conto la domanda parte, una volta', r.inviate.length === 1 && r.inviate[0] === 'quanto ha raccolto Emmesse ad agosto');
  verifica('e si smette di ascoltare', c.modo === 'pronta' && ascolto.chiuse >= 1);
  avanza(60000);
  verifica('non riparte da sola', r.inviate.length === 1);
}
{
  const { c, avanza, r } = banco();
  c.accendi({ ascolta: true });
  c.risultato(sentito('quanto ha raccolto'), 0);
  avanza(TEMPI.silenzio);
  verifica('il conto e\' partito', c.modo === 'conto');
  c.risultato(sentito('quanto ha raccolto', 'Emmesse ad agosto'), 1);
  verifica('riprendere a parlare ferma il conto', c.modo === 'domanda');
  avanza(TEMPI.conto);
  verifica('...e il vecchio conto non manda la domanda a meta\'', r.inviate.length === 0);
  avanza(TEMPI.silenzio + TEMPI.conto);
  verifica('parte la domanda intera', r.inviate.join('|') === 'quanto ha raccolto Emmesse ad agosto', r.inviate.join('|'));
}
{
  const { c, avanza, r } = banco();
  c.accendi({ ascolta: true });
  c.risultato(sentito('quanto ha raccolto Emmesse'), 0);
  avanza(TEMPI.silenzio);
  c.annullaInvio();
  avanza(60000);
  verifica('«Annulla»: la domanda non parte e resta scritta', r.inviate.length === 0 && r.testi[r.testi.length - 1] === 'quanto ha raccolto Emmesse' && c.modo === 'pronta');
}
{
  const { c, r } = banco();
  c.accendi({ ascolta: true });
  c.risultato(sentito('quanto ha raccolto Emmesse'), 0);
  c.inviaOra();
  verifica('«Invia ora» non aspetta il conto', r.inviate.length === 1);
}
{
  const { c, avanza, r } = banco();
  c.accendi({ ascolta: true });
  c.risultato(sentito('quanto ha raccolto'), 0);
  c.utenteScrive();
  avanza(60000);
  verifica('chi comincia a scrivere a mano non si vede partire la domanda', r.inviate.length === 0 && c.modo === 'pronta');
}
{
  const { c, ascolto, avanza, r } = banco();
  c.accendi({ ascolta: true });
  avanza(TEMPI.attesa);
  verifica('senza una parola, dopo l\'attesa si smette di ascoltare', c.modo === 'pronta' && ascolto.chiuse >= 1 && r.inviate.length === 0);
}
{
  const { c, ascolto } = banco();
  c.accendi();
  verifica('ritrovata accesa aprendo la pagina: non apre il microfono da sola', c.modo === 'pronta' && ascolto.aperte === 0);
}

console.log('2. DOPO LA RISPOSTA TORNA AD ASCOLTARE');
{
  const { c, ascolto, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(DETTO);
  verifica('mentre parla sorveglia: il microfono e\' aperto per le interruzioni', c.modo === 'sorveglia' && ascolto.aperte === 1);
  c.risultato(sentito('Emmesse ha raccolto quattrocentododici virgola trenta tonnellate'), 0);
  verifica('la sua eco non la ferma e non finisce nella casella', r.interruzioni === 0 && r.testi.length === 0 && c.modo === 'sorveglia');
  c.risultato(sentito('Emmesse ha raccolto quattrocentododici virgola trenta tonnellate', '412,30 tonnellate sulla rete'), 1);
  verifica('nemmeno coi numeri trascritti in cifre', r.interruzioni === 0);
  c.finitoDiParlare('finito');
  verifica('finita la risposta, ascolta la domanda in una sessione nuova (senza l\'eco di prima)', c.modo === 'domanda' && ascolto.aperte === 2);
  c.risultato(sentito('e a settembre'), 0);
  avanza(TEMPI.silenzio + TEMPI.conto);
  verifica('e la domanda parte', r.inviate.join('|') === 'e a settembre', r.inviate.join('|'));
  c.iniziaAParlare(DETTO);
  verifica('alla risposta dopo si ricomincia', c.modo === 'sorveglia');
}
{
  const { c, ascolto, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(DETTO);
  c.finitoDiParlare('fermata');
  avanza(60000);
  verifica('fermata col pulsante: non si rimette ad ascoltare', c.modo === 'pronta' && ascolto.aperte === 1 && r.inviate.length === 0);
}
{
  const { c, ascolto, avanza } = banco();
  c.accendi();
  c.iniziaAParlare(DETTO);
  c.fineAscolto('');
  avanza(TEMPI.riprova);
  verifica('il browser chiude l\'ascolto mentre lei parla: lo si riapre', ascolto.aperte === 2 && c.modo === 'sorveglia');
  for (let i = 0; i < TEMPI.ripreseMassime + 5; i++) { c.fineAscolto(''); avanza(TEMPI.riprova); }
  verifica('...ma non all\'infinito', ascolto.aperte === 1 + TEMPI.ripreseMassime, String(ascolto.aperte));
}
{
  const { c, ascolto } = banco();
  c.iniziaAParlare(DETTO);
  c.accendi();
  verifica('accesa mentre lei parla (il saluto): sorveglia subito', c.modo === 'sorveglia' && ascolto.aperte === 1);
  c.finitoDiParlare('finito');
  verifica('...e finito il saluto ascolta', c.modo === 'domanda');
}

console.log('3. SE LE SI PARLA SOPRA, SI FERMA');
{
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(DETTO);
  c.risultato(sentito('sulla rete', 'scusa ma Gatim a settembre quanto ha fatto'), 1);
  verifica('una domanda sopra la sua voce la ferma, una volta', r.interruzioni === 1 && c.modo === 'domanda');
  verifica('la domanda e\' quella detta dall\'utente, senza la sua eco', r.testi[r.testi.length - 1] === 'scusa ma Gatim a settembre quanto ha fatto', r.testi.join('|'));
  avanza(TEMPI.silenzio + TEMPI.conto);
  verifica('e parte come le altre', r.inviate.join('|') === 'scusa ma Gatim a settembre quanto ha fatto');
}
{
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(DETTO);
  c.risultato(sentito('basta'), 0);
  verifica('«basta» la ferma', r.interruzioni === 1);
  avanza(TEMPI.attesa + TEMPI.conto + TEMPI.silenzio);
  verifica('ma «basta» non e\' una domanda: non parte niente', r.inviate.length === 0 && c.modo === 'pronta' && r.testi.every(t => t === ''), r.testi.join('|'));
}
{
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(DETTO);
  c.risultato(sentito('basta dimmi invece l\'ACI'), 0);
  avanza(TEMPI.silenzio + TEMPI.conto);
  verifica('«basta» seguito da una domanda: parte la domanda, senza «basta»', r.inviate.join('|') === 'dimmi invece l\'ACI', r.inviate.join('|'));
}
{
  // Il SUO «basta» (revisione, 11/10/2026): le frasi si dicono una per volta, e
  // il primo risultato di una frase nuova e' una parola sola.
  const daDire = "Su Irigom il file di settembre 2026 non e' completo. Basta ricaricare il file del portale e i conti tornano.";
  const { c, r } = banco();
  c.accendi();
  c.iniziaAParlare(`${daDire}\n${testoParlato(daDire)}`);
  const prima = sentito('su Irigom il file di settembre 2026 non è completo');
  c.risultato(prima, 0);
  c.risultato([...prima, { testo: 'basta', definitivo: false }], 1);
  c.risultato([...prima, { testo: 'basta ricaricare', definitivo: false }], 1);
  verifica('il suo «basta» dalle casse non la ferma', r.interruzioni === 0 && c.modo === 'sorveglia' && r.testi.length === 0, `fermate ${r.interruzioni}, modo ${c.modo}`);
  c.risultato([...prima, { testo: 'basta ricaricare', definitivo: true }, { testo: 'ferma', definitivo: false }], 2);
  verifica('...«ferma», che lei non dice, si\'', r.interruzioni === 1);
}
{
  // Una domanda vera che riprende le sue parole: due parole nuove su sette.
  const daDire = 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, in 58 formulari.';
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(`${daDire}\n${testoParlato(daDire)}`);
  c.risultato(sentito('quanto ha raccolto Emmesse sulla rete a settembre'), 0);
  verifica('una domanda che riprende le sue parole la ferma', r.interruzioni === 1 && c.modo === 'domanda');
  avanza(TEMPI.silenzio + TEMPI.conto);
  verifica('...e parte intera', r.inviate.join('|') === 'quanto ha raccolto Emmesse sulla rete a settembre', r.inviate.join('|'));
}
// La verifica delle correzioni (12/10/2026): la domanda che COMINCIA col
// fornitore o col canale appena detti da lei partiva senza («settembre quanto ha
// raccolto»), perche' le sue parole in testa si toglievano una per una.
for (const domanda of ['Emmesse sulla rete a settembre quanto ha raccolto', 'Emmesse a settembre quanto ha raccolto sulla rete']) {
  const daDire = 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, in 58 formulari.';
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(`${daDire}\n${testoParlato(daDire)}`);
  c.risultato(sentito(domanda), 0);
  avanza(TEMPI.silenzio + TEMPI.conto);
  verifica(`«${domanda}» la ferma e parte intera, col fornitore`, r.interruzioni === 1 && r.inviate.join('|') === domanda, r.inviate.join('|'));
}
{
  // ...ma un pezzo della sua frase in testa resta eco e si toglie.
  const daDire = 'Ad agosto 2026 Emmesse ha raccolto 412,30 t sulla rete, in 58 formulari.';
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(`${daDire}\n${testoParlato(daDire)}`);
  c.risultato(sentito('in 58 formulari quanto ha raccolto Emmesse a settembre'), 0);
  avanza(TEMPI.silenzio + TEMPI.conto);
  verifica('l\'eco in testa alla domanda si toglie ancora', r.inviate.join('|') === 'quanto ha raccolto Emmesse a settembre', r.inviate.join('|'));
}
{
  // La sua eco capita male: «quanto» per il suo «quando» e un nome storpiato.
  // Si fermava da sola e la sua frase partiva come domanda al modello.
  const daDire = 'Quando Irigom chiude il mese, la giacenza di Nappi Sud scende a 120,40 t sulla rete.';
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(`${daDire}\n${testoParlato(daDire)}`);
  c.risultato(sentito('quanto Irigom chiude il mese la giacenza di Napoli sud scende a 120,40 tonnellate sulla rete'), 0);
  avanza(TEMPI.silenzio + TEMPI.conto + TEMPI.attesa);
  verifica('la sua eco capita male non la ferma e non parte come domanda', r.interruzioni === 0 && r.inviate.length === 0 && c.modo === 'sorveglia', `fermate ${r.interruzioni}, inviate ${r.inviate.join('|')}, modo ${c.modo}`);
}
for (const comando of ['ok basta', 'basta grazie', 'basta così']) {
  // Con «basta» nella sua risposta: una parola che lei non dice accanto al
  // «basta» e' l'utente, e la ferma; ma non e' una domanda.
  const daDire = "Su Irigom il file di settembre 2026 non e' completo. Basta ricaricare il file del portale e i conti tornano.";
  const { c, avanza, r } = banco();
  c.accendi();
  c.iniziaAParlare(`${daDire}\n${testoParlato(daDire)}`);
  c.risultato(sentito(comando), 0);
  avanza(TEMPI.attesa + TEMPI.silenzio + TEMPI.conto);
  verifica(`«${comando}» la ferma anche quando lei dice «basta», e non parte niente`, r.interruzioni === 1 && r.inviate.length === 0 && c.modo === 'pronta', `fermate ${r.interruzioni}, inviate ${r.inviate.join('|')}, modo ${c.modo}`);
}
{
  const { c, avanza, r } = banco();
  c.accendi({ ascolta: true });
  c.risultato(sentito('ok basta'), 0);
  avanza(TEMPI.attesa + TEMPI.silenzio + TEMPI.conto);
  verifica('«ok basta» dettato a voce ferma non e\' una domanda', r.inviate.length === 0 && c.modo === 'pronta', r.inviate.join('|'));
}
{
  const { c, ascolto, r } = banco();
  c.accendi();
  c.iniziaAParlare(DETTO);
  c.ascoltaOra();
  verifica('il microfono premuto mentre parla la ferma e ascolta', r.interruzioni === 1 && c.modo === 'domanda' && ascolto.aperte === 2);
  c.ascoltaOra();
  verifica('premuto di nuovo smette di ascoltare', c.modo === 'pronta');
}

console.log('4. SPENTA E MICROFONO NEGATO');
{
  const { c, ascolto, avanza, r } = banco();
  c.accendi({ ascolta: true });
  c.risultato(sentito('quanto'), 0);
  c.spegni();
  avanza(60000);
  c.iniziaAParlare(DETTO);
  verifica('spenta: niente invio, niente ascolto quando lei parla', r.inviate.length === 0 && c.modo === 'spenta' && ascolto.aperte === 1);
}
{
  const { c, r } = banco();
  c.accendi({ ascolta: true });
  c.fineAscolto('negato');
  verifica('microfono negato: si spegne e lo dice', c.modo === 'spenta' && r.stati.some(s => s.negato));
}

console.log('5. IL RICONOSCIMENTO DEL BROWSER, CON LE SESSIONI IN FILA');
{
  const create = [];
  class Finto {
    constructor() { this.avviato = false; this.annullato = false; create.push(this); }
    start() { this.avviato = true; }
    abort() { this.annullato = true; }
    stop() {}
  }
  const eventi = [];
  const r = creaRiconoscimento(Finto, {
    onRisultato: (rr, i) => eventi.push(`risultato ${rr.map(x => x.testo + (x.definitivo ? '!' : '')).join('+')} da ${i}`),
    onFine: (m) => eventi.push(`fine ${m}`),
    onAscolto: (si) => eventi.push(`ascolto ${si}`),
  });
  r.avvia({ continuo: true });
  verifica('una sessione in italiano, continua e coi risultati parziali', create.length === 1 && create[0].avviato && create[0].lang === 'it-IT' && create[0].continuous && create[0].interimResults);
  const risultati = (...xs) => ({ resultIndex: 1, results: xs.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })) });
  create[0].onresult(risultati(['quanto', true], ['ha raccolto', false]));
  verifica('i risultati arrivano tutti, col primo cambiato', eventi.includes('risultato quanto!+ha raccolto da 1'), eventi.join(' | '));
  r.avvia({ continuo: true });
  verifica('una nuova sessione aspetta che la vecchia chiuda', create.length === 1 && create[0].annullato);
  create[0].onresult(risultati(['eco vecchia', true]));
  create[0].onend();
  verifica('la vecchia, annullata, non manda piu\' niente, nemmeno la fine', !eventi.some(e => /eco vecchia|^fine/.test(e)), eventi.join(' | '));
  verifica('chiusa la vecchia, parte la nuova', create.length === 2 && create[1].avviato);
  r.annulla();
  create[1].onresult(risultati(['dopo annulla', true]));
  create[1].onend();
  verifica('annullata: niente risultati e niente fine', !eventi.some(e => /dopo annulla|^fine/.test(e)), eventi.join(' | '));
  r.avvia({});
  create[2].onerror({ error: 'not-allowed' });
  create[2].onend();
  verifica('il microfono negato arriva come «negato»', eventi[eventi.length - 1] === 'fine negato', eventi.join(' | '));
  r.avvia({});
  create[3].onend();
  verifica('una sessione chiusa da sola lo dice', eventi[eventi.length - 1] === 'fine ', eventi.join(' | '));
}

console.log('6. LA DOMANDA DETTATA PARTE COME DAL PULSANTE, COI FILE IN CODA');
// Il codice vero della pagina: la funzione invia di ChatAssistente.jsx e il
// collegamento onInvia passato a useConversazione, guidati dalla conversazione
// vera. Prima la conversazione chiamava invia(q), la strada degli esempi: il
// file in coda non partiva e la coda si svuotava (revisione, 11/10/2026).
{
  const chat = readFileSync(new URL('../src/components/assistente/ChatAssistente.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  const corpoInvia = (chat.match(/\n {2}const invia = async \([^)]*\) => \{[\s\S]*?\n {2}\};\n/) || [''])[0];
  const collegamento = ((chat.match(/useConversazione\(\{[\s\S]*?\n {2}\}\);/) || [''])[0].match(/onInvia: ([^\n]*?),\n/) || [])[1];
  verifica('la pagina ha invia e il collegamento della conversazione', !!corpoInvia && !!collegamento, String(collegamento));
  const pagina = ({ leggendo = false } = {}) => {
    const st = {
      testo: '', invio: false, leggendo,
      coda: [{ file: { name: 'bolla.xlsx' }, letto: { nome: 'bolla.xlsx', tipo: 'xlsx', dimensione: 10, testo: 'Foglio1: ...', tagliato: false, daCaricare: false } }],
      chiamate: [], avvisi: [],
    };
    const ctx = {
      get testo() { return st.testo; }, get coda() { return st.coda; }, get invio() { return st.invio; }, get leggendo() { return st.leggendo; },
      attiva: 'conv-1', isAdmin: true,
      voce: { ferma() {} },
      setInvio: (v) => { st.invio = v; },
      setTesto: (v) => { st.testo = typeof v === 'function' ? v(st.testo) : v; },
      setCoda: (v) => { st.coda = typeof v === 'function' ? v(st.coda) : v; },
      setAttiva() {}, setDomande() {}, setFileRecenti() {}, setParlate() {},
      toast: (t) => st.avvisi.push(t.title), carica: async () => {},
      base44: {
        integrations: { Core: { UploadPrivateFile: async () => ({ file_uri: 'privato' }) } },
        functions: { invoke: async (nome, corpo) => { st.chiamate.push(corpo); return { data: { record: { id: 'd1', conversazione_id: 'conv-1' } } }; } },
      },
    };
    // eslint-disable-next-line no-new-func
    const invia = new Function('ctx', `with (ctx) { ${corpoInvia.replace('const invia', 'var invia')} return invia; }`)(ctx);
    const inviaRef = { current: invia };
    // eslint-disable-next-line no-new-func
    const onInvia = new Function('inviaRef', `return ${collegamento};`)(inviaRef);
    return { st, invia, onInvia };
  };
  const tick = () => new Promise(fatto => setTimeout(fatto, 0));
  const DETTATA = 'dimmi cosa c\'è in questo file';
  const allegati = (corpo) => (corpo && corpo.allegati ? corpo.allegati.map(a => a.nome).join(',') : '');

  if (corpoInvia && collegamento) {
    {
      const p = pagina();
      p.st.testo = DETTATA;
      await p.invia();
      verifica('scritta e mandata col pulsante: il file parte', p.st.chiamate.length === 1 && allegati(p.st.chiamate[0]) === 'bolla.xlsx');
    }
    {
      // La pagina scrive nella casella quello che si detta (onTesto -> setTesto).
      const p = pagina();
      const { c, avanza } = banco({ onTesto: (t) => { p.st.testo = t; }, onInvia: p.onInvia });
      c.accendi({ ascolta: true });
      c.risultato(sentito(DETTATA), 0);
      avanza(TEMPI.silenzio + TEMPI.conto);
      await tick();
      verifica('dettata in conversazione: parte una volta, col testo dettato', p.st.chiamate.length === 1 && p.st.chiamate[0].domanda === DETTATA, JSON.stringify(p.st.chiamate));
      verifica('...e col file in coda, come dal pulsante', allegati(p.st.chiamate[0]) === 'bolla.xlsx', `allegati: ${allegati(p.st.chiamate[0]) || 'nessuno'}`);
      verifica('...e la coda si svuota perche\' il file e\' partito', p.st.coda.length === 0);
    }
    {
      const p = pagina();
      const { c, avanza } = banco({ onTesto: (t) => { p.st.testo = t; }, onInvia: p.onInvia });
      c.accendi({ ascolta: true });
      c.risultato(sentito(DETTATA), 0);
      avanza(TEMPI.silenzio);
      // Durante il conto si preme Invia: parte subito, e il conto non la rimanda.
      await p.invia();
      avanza(TEMPI.conto);
      await tick();
      verifica('Invia premuto durante il conto: la domanda parte una volta sola', p.st.chiamate.length === 1, `chiamate: ${p.st.chiamate.length}`);
    }
    {
      const p = pagina({ leggendo: true });
      const { c, avanza } = banco({ onTesto: (t) => { p.st.testo = t; }, onInvia: p.onInvia });
      c.accendi({ ascolta: true });
      c.risultato(sentito(DETTATA), 0);
      avanza(TEMPI.silenzio + TEMPI.conto);
      await tick();
      verifica('mentre un file si legge non parte senza di lui: resta nella casella e lo dice',
        p.st.chiamate.length === 0 && p.st.testo === DETTATA && p.st.coda.length === 1 && p.st.avvisi.length === 1,
        `chiamate ${p.st.chiamate.length}, casella «${p.st.testo}», coda ${p.st.coda.length}, avvisi ${p.st.avvisi.join('|')}`);
    }
    {
      const p = pagina();
      await p.invia('Quanto ha raccolto la rete a settembre?');
      verifica('un esempio non porta i file in coda...', p.st.chiamate.length === 1 && !allegati(p.st.chiamate[0]));
      verifica('...e non li butta: restano per la domanda dopo', p.st.coda.length === 1, `file in coda: ${p.st.coda.length}`);
    }
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

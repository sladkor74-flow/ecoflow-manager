// «DA DICHIARARE»: LA RICERCA PARTE QUANDO SI SMETTE DI SCRIVERE
// (segnalazione alta A49 del 20/09, corretta il 12/10/2026).
//
// Ogni tasto nel campo «Cerca FIR / ordine» chiamava getOrdiniDaDichiarare, che
// legge primarie, secondarie e il file del portale: un numero FIR di dodici
// cifre erano dodici chiamate pesanti, sul limite di richieste al minuto che
// vale per tutta l'app. Qui la tabella vera gira con un client finto e un
// orologio finto (prove/dati/paginaFinta.mjs): si scrive come scrive una
// persona, un tasto ogni 100 ms, e si contano le chiamate. Gli ordini a video
// alla fine devono essere quelli della ricerca scritta, come prima.
import { caricaPagina, clienteFinto, aspetta, trova, testo, orologioFinto } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// 250 ordini da dichiarare: il FIR dice a quale ricerca rispondono.
const TUTTI = Array.from({ length: 250 }, (_, i) => ({
  ordine_primaria: `ET26${String(i).padStart(6, '0')}`,
  numero_fir: i < 3 ? `ABC12${i}` : i < 140 ? `XYZ${String(i).padStart(4, '0')}` : `QQQ${i}`,
  fine_trasporto: '2026-09-10', punto_di_raccolta: 'P', peso_non_dichiarato_kg: 100 + i,
}));
const FUNZIONI = {
  getOrdiniDaDichiarare: async (p) => {
    const filtrate = p.ricerca ? TUTTI.filter(r => r.numero_fir.includes(p.ricerca) || r.ordine_primaria.includes(p.ricerca)) : TUTTI;
    const righe = p.tutte ? filtrate : filtrate.slice(p.offset || 0, (p.offset || 0) + (p.limite || 100));
    return {
      righe, totale_righe: filtrate.length, totale_kg: filtrate.reduce((s, r) => s + r.peso_non_dichiarato_kg, 0),
      per_mese: [], siti_distinti: ['IRIGOM SRL'], province_distinte: ['NA'], anni_distinti: [2026],
    };
  },
};

const orologio = orologioFinto().installa();
const { Componente, monta } = await caricaPagina('components/giacenze/DaDichiarareTable');
const c = clienteFinto({ funzioni: FUNZIONI });
globalThis.__CLIENTE_FINTO = c.cliente;
const r = monta(Componente, { onPulisciFiltroSito: () => {} });
await aspetta();

const chiamate = () => c.funzioniChiamate('getOrdiniDaDichiarare');
const campo = () => trova(r.albero, 'Input')[0];
const scrivi = async (t) => { campo().props.onChange({ target: { value: t } }); await aspetta(); };
const pulsante = (scritta) => trova(r.albero, el => el.type && el.type.__finto === 'Button' && testo(el).includes(scritta))[0];
const pdf = () => trova(r.albero, 'EsportaPdf')[0];
// Gli ordini in tabella: la prima cella di ogni riga del corpo.
const ordini = () => trova(r.albero, 'tbody')[0] ? trova(trova(r.albero, 'tbody')[0], 'tr').map(tr => testo(trova(tr, 'td')[0])).filter(t => /^ET/.test(t)) : [];
const totale = () => testo(trova(r.albero, 'strong')[0]);

console.log("ALL'APERTURA UNA LETTURA");
verifica('la tabella si monta senza errori', r.errori.length === 0, String(r.errori[0] || ''));
verifica('una chiamata', chiamate().length === 1, String(chiamate().length));
verifica('cento ordini in tabella e 250 in tutto', ordini().length === 100 && totale() === '250', `${ordini().length} ${totale()}`);

console.log('SCRIVENDO UN FIR, UN TASTO OGNI 100 MS');
{
  c.azzera();
  for (const t of ['A', 'AB', 'ABC', 'ABC1', 'ABC12']) { await scrivi(t); await orologio.avanza(100); }
  verifica('mentre si scrive non parte niente', chiamate().length === 0, JSON.stringify(chiamate().map(x => x.payload.ricerca)));
  verifica('il campo mostra quello che si scrive', campo().props.value === 'ABC12', campo().props.value);
  verifica('e finche\' la ricerca non parte, Excel e PDF aspettano', pulsante('Esporta Excel')?.props.disabled === true && pdf()?.props.disabilitato === true);
  await orologio.avanza(300);
  verifica('400 ms dopo l\'ultimo tasto, una chiamata sola', chiamate().length === 1, JSON.stringify(chiamate().map(x => x.payload.ricerca)));
  verifica('con la ricerca scritta, dalla prima pagina', chiamate()[0]?.payload.ricerca === 'ABC12' && chiamate()[0]?.payload.offset === 0, JSON.stringify(chiamate()[0]?.payload));
  verifica('a video gli ordini di quella ricerca', JSON.stringify(ordini()) === '["ET26000000","ET26000001","ET26000002"]' && totale() === '3', `${JSON.stringify(ordini())} ${totale()}`);
  verifica('e ora Excel e PDF si possono fare', pulsante('Esporta Excel')?.props.disabled === false && pdf()?.props.disabilitato === false);
  await orologio.avanza(2000);
  verifica('e poi niente altro', chiamate().length === 1, String(chiamate().length));
}

console.log('CON INVIO PARTE SUBITO');
{
  c.azzera();
  await scrivi('XYZ');
  campo().props.onKeyDown?.({ key: 'Enter' });
  await aspetta();
  verifica('una chiamata senza aspettare', chiamate().length === 1 && chiamate()[0].payload.ricerca === 'XYZ', JSON.stringify(chiamate().map(x => x.payload.ricerca)));
  await orologio.avanza(1000);
  verifica('e nessuna dopo', chiamate().length === 1, String(chiamate().length));
  verifica('137 ordini, cento in tabella', totale() === '137' && ordini().length === 100, `${totale()} ${ordini().length}`);
}

console.log('DALLA SECONDA PAGINA, UNA RICERCA NUOVA E\' UNA LETTURA SOLA');
{
  pulsante('Successivi').props.onClick();
  await aspetta();
  verifica('si va alla seconda pagina', chiamate().at(-1)?.payload.offset === 100 && ordini().length === 37, `${JSON.stringify(chiamate().at(-1)?.payload)} ${ordini().length}`);
  c.azzera();
  await scrivi('XYZ01');
  await orologio.avanza(400);
  verifica('la ricerca riparte dalla prima pagina, con una chiamata', chiamate().length === 1 && chiamate()[0].payload.offset === 0 && chiamate()[0].payload.ricerca === 'XYZ01',
    JSON.stringify(chiamate().map(x => x.payload)));
  verifica('a video i suoi ordini', totale() === '40' && ordini().length === 40 && ordini()[0] === 'ET26000100', `${totale()} ${ordini().length} ${ordini()[0]}`);
}

console.log('CANCELLARE LA RICERCA E\' UNA RICERCA');
{
  c.azzera();
  await scrivi('XYZ0');
  await scrivi('');
  await orologio.avanza(400);
  verifica('una chiamata, senza ricerca', chiamate().length === 1 && chiamate()[0].payload.ricerca === undefined, JSON.stringify(chiamate().map(x => x.payload)));
  verifica('di nuovo tutti', totale() === '250' && ordini().length === 100, `${totale()} ${ordini().length}`);
}

console.log('GLI ALTRI FILTRI NON ASPETTANO');
{
  c.azzera();
  trova(r.albero, el => el.type === 'input' && el.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
  await aspetta();
  verifica('la spunta chiama subito', chiamate().length === 1 && chiamate()[0].payload.solo_date_da_sistemare === true, JSON.stringify(chiamate().map(x => x.payload)));
}

orologio.ripristina();
r.smonta();
console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

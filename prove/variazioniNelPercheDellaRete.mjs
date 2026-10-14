// IL PERCHE' DELLA SEZIONE RETE DICE ANCHE LE VARIAZIONI DEL CONSORZIO
// (chiusura del giro del 14/10/2026).
//
// L'utente, il 14/10/2026: «come variano gli altri moduli e sezioni di
// conseguenza considerando che il target è passato a 11.650 t nell'anno 2026?».
// Il gruppo E-2 ha messo le variazioni a parole nella cifra «Target annuo del
// contratto» (la riga sotto e il suo perche'), ma il perche' della sezione
// Rete, quello del pulsante «i» accanto al titolo, diceva ancora «Target: il
// contratto Ecotyre del 2026 in Target & Status, il modificato per ultimo.» e
// basta: 11.650 t senza dire che 100 sono l'assegnazione di ottobre in Puglia.
// Qui la sezione si disegna davvero (React lato server), col riquadro del
// perche' aperto: il pulsante «i» apre un popover che lato server non si
// disegna, quindi Perche si sostituisce con un contenitore che mostra quello che
// avrebbe dentro. Il quadro lo fa quadroRete vero, su un contratto come quello
// del 2026 con la variazione registrata come la registra la finestra
// (variazioneDelContratto e storicoConVariazione di attesoContratto.ts).
// - con la variazione: la frase di fraseVariazioni(rete, 2026), la stessa della
//   cifra del target, nel perche' della sezione;
// - senza variazioni, e con una variazione superata da un salvataggio dopo: il
//   perche' di prima, carattere per carattere.
// npm run prove
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as A from '../base44/shared/attesoContratto.ts';
import * as Q from '../base44/shared/quadroCommessa.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const testo = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// La sezione Rete, col perche' aperto: Perche diventa un contenitore marcato.
const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(f => existsSync(f) && /\.\w+$/.test(f)) || base; };
const PERCHE_APERTO = "import React from 'react'; export default function Perche({ children }) { return React.createElement('div', { 'data-perche': 'aperto' }, children); }";
const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { MemoryRouter } from 'react-router-dom';
import SezioneRete from ${JSON.stringify(qui('../src/components/dashboard/SezioneRete.jsx'))};
export * as righe from ${JSON.stringify(qui('../src/components/dashboard/righeQuadro.js'))};
export const sezioneRete = (props) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(SezioneRete, props)));
`;
let P = null;
try {
  const pacchetto = await build({
    stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
    bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
    loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'perche-aperto', setup(b) {
      b.onResolve({ filter: /^@\/components\/shared\/Perche$/ }, () => ({ path: 'perche', namespace: 'perche-aperto' }));
      b.onLoad({ filter: /.*/, namespace: 'perche-aperto' }, () => ({ contents: PERCHE_APERTO, loader: 'js', resolveDir: qui('.') }));
      b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
    } }],
  });
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1, matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }) };
  P = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
} catch (e) { verifica('la sezione Rete si impacchetta', false, String(e && e.message).slice(0, 400)); }

// I riquadri del perche' disegnati, nell'ordine: il primo e' quello della sezione.
const riquadri = (html) => [...String(html).matchAll(/<div data-perche="aperto">([\s\S]*?)<\/div>/g)].map(m => testo(m[1]));

// Un contratto come quello del 2026 (prove/variazioneContratto.mjs).
const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const contratto = {
  id: 'c26', anno: 2026, target_annuo_t: 11550,
  regioni_json: J([{ regione: 'Campania', target_t: 4400 }, { regione: 'Puglia', target_t: 2500 }, { regione: 'Sicilia', target_t: 4650 }]),
  target_mensile_json: J(PROFILO),
  destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4450 }, { destinazione: 'T_CYCLE', target_t: 7100 }]),
  storico_json: J([{ il: '2026-09-14T17:35:58.203Z', da: 'Antonio', nota: 'importato dal foglio', prima: null }]),
};
const OTTOBRE = { mese_idx: 9, regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' };
const registra = (c, variazione, il) => {
  const v = A.variazioneDelContratto(c, variazione);
  return { ...c, ...v.patch, storico_json: A.storicoConVariazione(c.storico_json, { il, da: 'Antonio Castellano', voce: v.voce, prima: v.prima }) };
};
// Il foglio di inizio anno salvato dopo la variazione: la riscrive (in_vigore falso).
const CAMPI = ['target_annuo_t', 'regioni_json', 'target_mensile_json', 'destinazioni_json'];
const riscritto = (dopo, prima) => ({
  ...dopo, ...Object.fromEntries(CAMPI.map(k => [k, prima[k]])),
  storico_json: J([...JSON.parse(dopo.storico_json), { il: '2026-10-20T09:00:00.000Z', da: 'Antonio Castellano', nota: 'importato da contratto-ecotyre.xlsx', prima: Object.fromEntries(CAMPI.map(k => [k, dopo[k]])) }]),
});
const conVariazione = registra(contratto, OTTOBRE, '2026-10-14T10:00:00.000Z');
const superata = riscritto(conVariazione, contratto);

const kpi = (com) => ({ raccolto_rete_anno: 8818.55, raggiungimento_pct: 75, target: A.targetAnnuoDellAnno(com, 2026).t, atteso: null, target_ripiego: [], target_da_confermare: [] });
const quadro = (com) => ({
  anno: 2026, giorno_dati: '2026-10-08', giorno_misura: '2026-10-08', anno_chiuso: false,
  rete: Q.quadroRete({ anno: 2026, oggi: '2026-10-11', giornoDati: '2026-10-08', commessa: com, kpi: kpi(com), reteAnno: [], rete: [], mensili: [], annui: [] }),
});
const LA_FRASE = 'ottobre, Puglia +100,00 t (assegnazione del consorzio di ottobre, comunicata il 14/10/2026)';
const PRIMA = 'Target: il contratto Ecotyre del 2026 in Target & Status, il modificato per ultimo.';

console.log("1. IL PERCHE' DELLA SEZIONE RETE, DISEGNATO");
if (P) {
  const disegna = (com) => {
    try { return riquadri(P.sezioneRete({ quadro: quadro(com), arretrato: null, annoInCorso: true })); } catch (e) { return ['ERRORE ' + String(e && e.message).slice(0, 300)]; }
  };
  const con = disegna(conVariazione), senza = disegna(contratto), sup = disegna(superata);
  const sezione = (rr) => rr.find(r => r.startsWith('Raccolto: primarie di rete')) || '';
  verifica('la sezione si disegna, col perche\' della sezione e quello della cifra del target', sezione(con) && sezione(senza) && sezione(sup) && con.length >= 2, J(con.map(r => r.slice(0, 80))));

  const frase = P.righe.fraseVariazioni(quadro(conVariazione).rete, 2026);
  verifica('premessa: la frase delle variazioni (fraseVariazioni, anno compreso) dice la variazione di ottobre e il target senza', frase.startsWith(`Il contratto 2026 comprende una variazione del consorzio: ${LA_FRASE}. Senza, il target sarebbe 11.550,00 t.`), frase);
  verifica('con la variazione: il perche\' della sezione dice il target e poi la variazione', sezione(con).includes(`${PRIMA} ${frase}`), sezione(con).slice(0, 400));
  verifica('e la frase c\'e\' una volta sola, dopo il target (non nel raccolto ne\' nell\'atteso)', sezione(con).split('comprende una variazione del consorzio').length === 2 && /^Raccolto: primarie di rete terminate del 2026/.test(sezione(con)), sezione(con).slice(0, 200));

  // Il perche' della cifra del target resta quello del gruppo E-2: la frase senza l'anno.
  const cifra = con.find(r => r.startsWith('Il contratto comprende'));
  verifica('il perche\' della cifra del target resta il suo (fraseVariazioni senza l\'anno)', cifra === testo(P.righe.fraseVariazioni(quadro(conVariazione).rete)), J(con.map(r => r.slice(0, 60))));

  // Senza variazioni, e con quella superata: il perche' di prima.
  const primaDelGiro = (rr) => sezione(rr).split(' Atteso:')[0];
  verifica('senza variazioni: il perche\' della sezione e\' quello di prima', !/variazion/i.test(senza.join(' ')) && primaDelGiro(senza) === `Raccolto: primarie di rete terminate del 2026, per giorno italiano di fine trasporto (mai la chiusura a portale). ${PRIMA}`, primaDelGiro(senza));
  verifica('con la variazione superata da un salvataggio dopo: come senza', J(sup) === J(senza), J(sup.map(r => r.slice(0, 80))));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

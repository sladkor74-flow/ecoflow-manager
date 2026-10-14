// IL MESE DI UN TARGET MENSILE SI LEGGE COM'E' SCRITTO, IN TUTTI I MODULI
// (rilievo della revisione, corretto con le decisioni del 13/10/2026).
//
// targetMensiliValidi (andamentoTarget.ts) riconosce il doppione col mese com'e'
// scritto: «Ottobre» e «ottobre» sono due righe diverse, e tutte e due passano.
// Target & Status, l'Andamento, gli avvisi ed EcoTyna leggono poi «Ottobre» e
// basta (i mesi di targetRaccoglitori.ts), e la riga «ottobre» non c'e'. La
// ripartizione dei target fra gli impianti (ripartisciTargetPrimarie, in
// targetImpianti.ts: Giacenze e predittivita') leggeva invece il mese in
// minuscolo, e le due righe le sommava: 80 t + 50 t = 130 t a ottobre sul sito
// scritto, dove la pagina e gli avvisi dicono 80. Ora il mese e' quello scritto,
// come ovunque: la riga «ottobre» non vale in nessun modulo.
// npm run prove
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ripartisciTargetPrimarie } from '../base44/shared/targetImpianti.ts';
import { aggregaTargetMensili, targetRaccoglitoreMese, MESI } from '../base44/shared/targetRaccoglitori.ts';
import { righeAndamento } from '../base44/shared/andamentoTarget.ts';
import { normalizzaRagioneSociale } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;
const testo = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8').replace(/\r/g, '');

// Lo scenario: un raccoglitore con 1.000 t l'anno; a ottobre la riga «Ottobre»
// (80 t su IRIGOM) e, scritta da un'importazione, la stessa con «ottobre» (50 t).
const annui = [{ raccoglitore: 'Ecorecuperi Srl', regione: 'Campania', anno: 2026, target_tonnellate: 1000 }];
const base = { raccoglitore: 'Ecorecuperi Srl', regione: 'Campania', impianto: 'IRIGOM', anno: 2026, non_raccoglie: false };
const giusta = { ...base, id: 'm1', mese: 'Ottobre', target: 80, updated_date: '2026-10-01T10:00:00Z' };
const minuscola = { ...base, id: 'm2', mese: 'ottobre', target: 50, updated_date: '2026-10-02T10:00:00Z' };
const settembre = { ...base, id: 'm0', impianto: 'TECNOGUM', mese: 'Settembre', target: 200, updated_date: '2026-09-01T10:00:00Z' };
const conferiti = [{ raccoglitore: 'ECORECUPERI SRL', regione: 'Campania', sito: 'GATIM SRL', ruolo: 'imp', mese: 9, kg: 100000 }];
const quote = (mensili) => {
  const r = ripartisciTargetPrimarie({ raccoglitori: annui, mensili, conferiti, anno: 2026 });
  const q = (sito) => r.per.get(normalizzaRagioneSociale(sito) + '|imp') || 0;
  return { irigom: q('IRIGOM'), tecnogum: q('TECNOGUM'), gatim: q('GATIM SRL'), somma: Math.round([...r.per.values()].reduce((s, v) => s + v, 0) * 1000) / 1000 };
};

console.log('1. GLI ALTRI MODULI LEGGONO «Ottobre» E BASTA');
{
  const avvisi = aggregaTargetMensili([giusta, minuscola]);
  const ottobre = avvisi.filter(x => x.mese === 'Ottobre').map(x => x.target);
  verifica('gli avvisi (aggregaTargetMensili): ottobre 80 t', J(ottobre) === J([80]), J(avvisi));
  const mese = targetRaccoglitoreMese([giusta, minuscola], 'Ecorecuperi Srl', 'Ottobre');
  verifica("l'evasione degli assegnati (targetRaccoglitoreMese): ottobre 80 t", mese && mese.target_kg === 80000, J(mese));
  const andamento = righeAndamento({ mensili: [giusta, minuscola], annui, raccolto: [] });
  const ott = andamento.length ? (andamento[0].mesi.find(m => m.mese === 'Ottobre') || {}).target : null;
  verifica("l'Andamento di Target & Status: ottobre 80 t", ott === 80, J(andamento.map(r => r.mesi.filter(m => m.target))));
  verifica('i mesi di TargetMensile sono «Gennaio» ... «Dicembre»', MESI.length === 12 && MESI[9] === 'Ottobre');
}

console.log('2. LA RIPARTIZIONE FRA GLI IMPIANTI DICE LO STESSO');
{
  const solo = quote([settembre, giusta]);
  const conLaMinuscola = quote([settembre, giusta, minuscola]);
  verifica('con la sola riga «Ottobre»: IRIGOM 80, TECNOGUM 820 (settembre e il resto), GATIM 100, in tutto 1.000',
    J(solo) === J({ irigom: 80, tecnogum: 820, gatim: 100, somma: 1000 }), J(solo));
  verifica('e la riga «ottobre» non cambia niente: IRIGOM 80, non 130', J(conLaMinuscola) === J(solo), J(conLaMinuscola));
  // Un mese scritto in un altro modo non vale da nessuna parte: nemmeno da solo.
  const soloMinuscola = quote([settembre, minuscola]);
  verifica('una riga sola, «ottobre»: la ripartizione non la conta, come gli avvisi e la pagina', soloMinuscola.irigom === 0 && soloMinuscola.somma === 1000, J(soloMinuscola));
}

console.log('3. LA REGOLA E\' UNA');
{
  const s = testo('base44/shared/targetImpianti.ts');
  verifica('targetImpianti.ts prende i mesi da targetRaccoglitori.ts, non se li scrive', /import \{ MESI \} from "\.\/targetRaccoglitori\.ts"/.test(s) && /const MESI_TARGET = MESI;/.test(s));
  verifica('e il mese si legge com\'e\' scritto, senza minuscole', /MESI_TARGET\.indexOf\(m\.mese\)/.test(s) && !/MESI_TARGET\.indexOf\(testo\(/.test(s));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

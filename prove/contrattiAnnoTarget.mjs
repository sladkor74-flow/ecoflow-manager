// Prova del TARGET NEI CONTRATTI DI RACCOLTA (base44/functions/contrattiAnno,
// chiusura dell'audit, 11/10/2026).
//
// Il contratto di raccolta di un soggetto porta il target dell'anno del
// raccoglitore, sommato fra le regioni. Il soggetto ha il nome dei movimenti;
// il target puo' essere scritto abbreviato («PNEUSERVICE SRL» per «PNEUSERVICE
// CONVERSANO SRL»). contrattiAnno cercava solo il nome uguale: il contratto
// restava senza target mentre l'Andamento, gli alert ed EcoTyna, con lo stesso
// target, abbinano l'abbreviazione (targetDelPortale). Ora lo stesso abbinatore:
// prima il nome uguale, poi l'abbreviazione, mai il contrario; un'abbreviazione
// che vale per due raccoglitori non si assegna a caso.
// Qui la funzione intera, con l'archivio finto di prove/dati/bancoFunzioni.mjs.
// npm run prove
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const modulo = await caricaFunzione('contrattiAnno');
let n = 0;
const prim = (trasportatore, g = '2026-03-10') => ({ id: 'p' + (++n), id_ordine: 'P' + n, stato: 'terminato', classe: 'P', provincia: 'BA', trasportatore, destinazione: 'IRIGOM SRL', tipo_destinazione: 'imp', peso_effettivo: 10000, ordine_immesso_il: g + 'T08:00:00Z', trasporto_iniziato_il: g + 'T08:00:00Z', trasporto_finito_il: g + 'T10:00:00Z' });
const target = (raccoglitore, regione, t) => ({ id: 't' + (++n), raccoglitore, regione, target_tonnellate: t, anno: 2026 });
const db = (primarie, targets) => ({ PrimariaRete: primarie, PrimariaAci: [], ExtraRaccolta: [], Secondaria: [], Fornitore: [], QualificaInclusione: [], ContrattoFornitore: [], ModelloContratto: [], ImpiantoTargetSecondaria: [], TargetRaccoglitore: targets });
// la chiave del soggetto e' il nome normalizzato (normalizzaRagioneSociale): minuscola, senza la sigla
const raccolta = (j, chiaveSoggetto) => {
  const s = (j.soggetti || []).find(x => x.chiave === chiaveSoggetto.toLowerCase());
  return s ? (s.contratti || []).find(c => c.tipo === 'raccolta') : undefined;
};

console.log('IL TARGET SCRITTO ABBREVIATO');
const caso = await chiama(modulo, { db: db(
  [prim('PNEUSERVICE CONVERSANO SRL'), prim('SMOCO SRL'), prim('EMMESSE SRL')],
  [target('PNEUSERVICE SRL', 'Puglia', 600), target('PNEUSERVICE SRL', 'Basilicata', 100), target('Emmesse S.r.l.', 'Campania', 900)],
), corpo: { anno: 2026 } });
verifica('la funzione risponde', caso.stato === 200, JSON.stringify(caso.j).slice(0, 300));
verifica('«PNEUSERVICE SRL» e\' il target di PNEUSERVICE CONVERSANO, sommato fra le regioni', raccolta(caso.j, 'PNEUSERVICE CONVERSANO')?.target_t === 700, JSON.stringify(raccolta(caso.j, 'PNEUSERVICE CONVERSANO')));
verifica('il nome uguale (scritto in un altro modo) vale come prima', raccolta(caso.j, 'EMMESSE')?.target_t === 900, JSON.stringify(raccolta(caso.j, 'EMMESSE')));
verifica('chi non ha target resta senza, non zero', raccolta(caso.j, 'SMOCO') === undefined || raccolta(caso.j, 'SMOCO').target_t === null);

console.log('MAI IL CONTRARIO, MAI A CASO');
const contrario = await chiama(modulo, { db: db([prim('LOGISTICA SRL')], [target('Logistica & Pneumatici Srl', 'Campania', 300)]), corpo: { anno: 2026 } });
verifica('il nome lungo del target non va al portale piu\' corto', raccolta(contrario.j, 'LOGISTICA')?.target_t === null, JSON.stringify(raccolta(contrario.j, 'LOGISTICA')));
const dueSoggetti = await chiama(modulo, { db: db([prim('PNEUSERVICE CONVERSANO SRL'), prim('PNEUSERVICE BARI SRL')], [target('PNEUSERVICE SRL', 'Puglia', 600)]), corpo: { anno: 2026 } });
verifica('un\'abbreviazione che vale per due raccoglitori non si assegna a nessuno dei due', raccolta(dueSoggetti.j, 'PNEUSERVICE CONVERSANO')?.target_t === null && raccolta(dueSoggetti.j, 'PNEUSERVICE BARI')?.target_t === null);
const esattoEAbbreviato = await chiama(modulo, { db: db([prim('PNEUSERVICE CONVERSANO SRL'), prim('PNEUSERVICE SRL')], [target('PNEUSERVICE SRL', 'Puglia', 600), target('PNEUSERVICE CONVERSANO SRL', 'Puglia', 200)]), corpo: { anno: 2026 } });
verifica('il nome uguale vince sull\'abbreviazione: ciascuno il suo', raccolta(esattoEAbbreviato.j, 'PNEUSERVICE')?.target_t === 600 && raccolta(esattoEAbbreviato.j, 'PNEUSERVICE CONVERSANO')?.target_t === 200,
  JSON.stringify([raccolta(esattoEAbbreviato.j, 'PNEUSERVICE'), raccolta(esattoEAbbreviato.j, 'PNEUSERVICE CONVERSANO')].map(c => c && c.target_t)));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

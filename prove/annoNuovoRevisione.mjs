// Prova del PASSAGGIO D'ANNO: I CASI CHE LA REVISIONE DEL 10/10/2026 HA TROVATO.
//
// La lista dell'anno nuovo e la chiusura sono state scritte il 10/10/2026, e la
// revisione dello stesso giorno ci ha trovato cinque cose che non andavano:
//   1. dal 1° gennaio la dashboard guardava l'anno DOPO (il 2028), e taceva
//      proprio quando al 2027 mancavano ancora tariffe e aperture;
//   2. la voce «Target e siti» diventava verde al primo target confermato;
//   3. la voce «Aperture» confrontava i siti per testo: «Gatim» e «GATIM S.R.L.»
//      erano due siti, e la voce non si chiudeva mai;
//   4. dalla pagina della chiusura un'apertura non si poteva salvare se non
//      c'era anche un piazzale pronto;
//   5. il messaggio dopo il salvataggio diceva «piazzali e impianti» anche
//      quando nessuna apertura era stata scritta.
// npm run prove
import { readFileSync } from 'node:fs';
import { listaAnno, annoNuovoDaMostrare } from '../base44/shared/inizializzazioneAnno.ts';
import { notaCopia } from '../base44/shared/annoTarget.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const voce = (l, chiave) => (l.voci || []).find(v => v.chiave === chiave) || {};

console.log("1. LA DASHBOARD, DAL 1° GENNAIO, GUARDA L'ANNO APPENA COMINCIATO");
{
  const base = { tariffe: [], giacenzeSito: [], targetRaccoglitori: [], commesse: [], contrattiFornitore: [], rilevazioni: [], piazzali: [] };
  const gennaio = annoNuovoDaMostrare({ ...base, oggi: '2027-01-02' });
  verifica('il 2 gennaio 2027, col 2027 vuoto, mostra il 2027 e non il 2028', gennaio.anno === 2027 && gennaio.avvicinandosi === true, `${gennaio.anno} ${gennaio.avvicinandosi}`);
  verifica("e sa che l'anno e' gia' cominciato (giorni al 1° gennaio <= 0)", gennaio.giorni_al_primo_gennaio <= 0, String(gennaio.giorni_al_primo_gennaio));
  const febbraio = annoNuovoDaMostrare({ ...base, oggi: '2027-02-27' });
  verifica('a fine febbraio ancora il 2027', febbraio.anno === 2027, String(febbraio.anno));
  const marzo = annoNuovoDaMostrare({ ...base, oggi: '2027-03-01' });
  verifica('da marzo si torna a guardare l\'anno dopo: un avviso tutto l\'anno non e\' un avviso', marzo.anno === 2028, String(marzo.anno));
  const novembre = annoNuovoDaMostrare({ ...base, oggi: '2026-11-15' });
  verifica('a novembre si prepara il 2027, come prima', novembre.anno === 2027, String(novembre.anno));
  const src = readFileSync(new URL('../base44/functions/cruscottoOperativo/entry.ts', import.meta.url), 'utf8');
  verifica('e la dashboard usa proprio questa scelta', /annoNuovo: annoNuovoDaMostrare\(\{/.test(src) && !/annoNuovo: listaAnno\(/.test(src));
}

console.log('2. TARGET E SITI: GIALLA FINCHE\' UN TARGET E\' ANCORA COPIATO');
{
  const copiato = (r) => ({ anno: 2027, note: notaCopia(2027), ...r });
  const targetRaccoglitori = [
    copiato({ raccoglitore: 'ALFA SRL' }),
    copiato({ raccoglitore: 'BETA SRL' }),
    { anno: 2027, raccoglitore: 'GAMMA SRL', note: '' },          // confermato
  ];
  const l = listaAnno({ anno: 2027, tariffe: [], giacenzeSito: [{ sito: 'Irigom S.r.l.', anno: 2027, tipo_destinazione: 'imp' }], targetRaccoglitori, piazzali: [], rilevazioni: [], oggi: '2026-12-10' });
  const v = voce(l, 'target_e_siti');
  verifica('uno confermato su tre: resta parziale', v.stato === 'parziale', `${v.stato}: ${v.dettaglio}`);
  verifica('e dice quanti sono ancora copiati', /2 target dei raccoglitori su 3/.test(v.dettaglio || ''), v.dettaglio);
  const tutti = listaAnno({ anno: 2027, tariffe: [], giacenzeSito: [{ sito: 'Irigom S.r.l.', anno: 2027, tipo_destinazione: 'imp' }], targetRaccoglitori: targetRaccoglitori.map(r => ({ ...r, note: '' })), piazzali: [], rilevazioni: [], oggi: '2026-12-10' });
  verifica('tutti confermati: pronta', voce(tutti, 'target_e_siti').stato === 'pronto', voce(tutti, 'target_e_siti').stato);
}

console.log('3. LE APERTURE SI RICONOSCONO PER CHIAVE, NON PER TESTO');
{
  const giacenzeSito = [
    { sito: 'Gatim', anno: 2026, tipo_destinazione: 'imp' },
    { sito: 'T.R.S.  SRL', anno: 2026, tipo_destinazione: 'imp' },
    { sito: 'GATIM S.R.L.', anno: 2027, tipo_destinazione: 'imp', apertura_del: '2026-12-31', giacenza_riferimento_t: 0 },
    { sito: 'T.R.S. SRL', anno: 2027, tipo_destinazione: 'imp', apertura_del: '2026-12-31', giacenza_riferimento_t: 12 },
  ];
  const v = voce(listaAnno({ anno: 2027, tariffe: [], giacenzeSito, piazzali: [], rilevazioni: [], oggi: '2026-12-31' }), 'aperture_impianti');
  verifica('«Gatim» e «GATIM S.R.L.», «T.R.S.  SRL» e «T.R.S. SRL»: gli stessi due impianti, tutti e due aperti', v.stato === 'pronto', `${v.stato}: ${v.dettaglio}`);
}

console.log('4-5. LA PAGINA DELLA CHIUSURA');
{
  const src = readFileSync(new URL('../src/components/giacenze/ChiusuraAnno.jsx', import.meta.url), 'utf8');
  verifica("il pulsante si accende anche per le sole aperture", /disabled=\{caricamento \|\| inCorso === 'salva' \|\| daAggiornare \|\| !qualcosaDaSalvare\}/.test(src)
    && /qualcosaDaSalvare = pronti\.length > 0 \|\| apertureDaScrivere\.length > 0 \|\| apertureDaCambiare\.length > 0/.test(src));
  verifica('e la sostituzione dice che vale anche per le aperture', /Rifai anche le fotografie e le aperture gia&apos; salvate/.test(src));
  verifica("il messaggio dice «e impianti» solo se un'apertura si e' scritta", /aperture\.length && salvati \? 'Da qui ripartiranno le giacenze dell\\'anno dopo, piazzali e impianti\.'/.test(src)
    && /nessuna apertura di impianto scritta/.test(src));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

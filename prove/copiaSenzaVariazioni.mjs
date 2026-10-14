// LA COPIA DEL CONTRATTO NEL NUOVO ANNO PARTE SENZA LE VARIAZIONI DEL CONSORZIO
// (decisione dell'utente del 14/10/2026).
//
// Il 14/10/2026 e' registrata nel contratto 2026 la variazione del consorzio
// «ottobre, Puglia +100 t, IRIGOM»: contratto 11.650, Puglia 2.600, ottobre
// rivisto 1.200, IRIGOM 4.550 (senza: 11.550, 2.500, 1.100, 4.450). La copia
// dell'anno (pianoCopiaAnno, funzione copiaAnnoTarget) portava nel 2027 i numeri
// variati come «da confermare», e lo storico copiato diceva solo «copiato dal
// 2026, da confermare». L'utente ha detto «ok» alla proposta: il nuovo anno
// parte dal contratto senza le variazioni in vigore, con una nota che le
// ricorda; le superate non si tolgono (non sono piu' nei numeri).
//
// Qui:
// 1. la regola (contrattoSenzaVariazioni di attesoContratto.ts, e lo specchio
//    del browser) su contratti costruiti: una variazione, nessuna, una superata,
//    due (una in piu' e una in meno, regioni diverse), una senza mese rivisto
//    scritto, il chilo e lo zero;
// 2. il piano della copia (pianoCopiaAnno): il contratto senza variazioni con la
//    nota nello storico, e senza variazioni la copia di prima campo per campo;
//    il resto della copia non cambia;
// 3. la funzione copiaAnnoTarget intera sulla copia dei dati veri dell'11/10/2026
//    con la variazione di ottobre registrata qui: anteprima, scrittura, storico
//    delle modifiche; senza variazioni, superata, con due variazioni;
// 4. la finestra della copia (DialogoAzione) disegnata lato server;
// 5. i due moduli che si importano a vicenda si caricano in tutti e due gli ordini.
//
// I ritocchi dopo la revisione dello stesso giorno stanno nelle parti 1-4, sotto
// «RITOCCHI»: la variazione si toglie solo dalla prima riga della sua regione e
// della sua destinazione; una destinazione riscritta dopo la variazione si copia
// com'e' e la nota lo dice; una variazione superata dal solo mese si copia
// com'e' scritta, ma la nota dice che la regione la porta ancora; se i target dei
// raccoglitori copiati portano la variazione, la nota lo dice coi numeri del
// cruscotto (il caso vero del 14/10: SMOCO in Puglia 1.950, ottobre 270).
// Senza la copia dei dati veri la parte 3 si salta e lo dice.
// node prove/copiaSenzaVariazioni.mjs
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as A from '../base44/shared/attesoContratto.ts';
import * as AB from '../src/lib/attesoContratto.js';
import { pianoCopiaAnno, daConfermare, notaCopia } from '../base44/shared/annoTarget.ts';
import { normalizzaRagioneSociale as chiave } from '../base44/shared/normalizzaRagioneSociale.ts';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';
import { vociContrattoRaccoglitori } from '../base44/shared/cruscotto.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const leggi = (x) => (typeof x === 'string' ? JSON.parse(x) : x);
// un campo che manca (la regola che non c'e', col codice di prima) da' undefined e la verifica fallisce, senza fermare la prova
const elenco = (x) => { const v = leggi(x === undefined || x === null || x === '' ? '[]' : x); return Array.isArray(v) ? v : []; };
const regione = (c, nome) => (elenco(c && c.regioni_json).find(r => r.regione === nome) || {}).target_t;
const mese = (c, i) => elenco(c && c.target_mensile_json)[i];
const dest = (c, nome) => (elenco(c && c.destinazioni_json).find(d => d.destinazione === nome) || {}).target_t;
const ha = typeof A.contrattoSenzaVariazioni === 'function';
verifica('attesoContratto.ts ha la regola del contratto da copiare', ha, Object.keys(A).join(', '));
const senza = (c, anno) => (ha ? A.contrattoSenzaVariazioni(c, anno) : { campi: {}, variazioni: [], righe: [], nota: '', motivo: '' });
// per i ritocchi: coi raccoglitori, e coi campi nuovi sempre presenti (col codice di prima la verifica fallisce, la prova non si ferma)
const VUOTO = { campi: {}, variazioni: [], righe: [], raccoglitori: [], parti: [], nota: '', motivo: '' };
const senzaR = (c, anno, raccoglitori) => ({ ...VUOTO, ...(ha ? A.contrattoSenzaVariazioni(c, anno, raccoglitori) : {}) });
const senzaB = (c, anno, raccoglitori) => (typeof AB.contrattoSenzaVariazioni === 'function' ? AB.contrattoSenzaVariazioni(c, anno, raccoglitori) : null);

// La variazione si registra come la scheda: variazioneDelContratto e la voce nello storico.
const registra = (c, variazione, il) => {
  const e = A.variazioneDelContratto(c, variazione);
  if (e.errori.length) throw new Error(e.errori.join(' '));
  return { ...c, ...e.patch, updated_date: il, storico_json: A.storicoConVariazione(c.storico_json, { il, da: 'Antonio Castellano', voce: e.voce, prima: e.prima }) };
};
// Un salvataggio della tabella del contratto, come scriviContratto della scheda:
// la voce nello storico porta i valori di prima dei campi scritti.
const salvaTabella = (c, valori, il, nota = 'importato dal foglio') => {
  const prima = Object.fromEntries(Object.keys(valori).map(k => [k, c[k] ?? null]));
  return { ...c, ...valori, updated_date: il, storico_json: J([...leggi(c.storico_json || '[]'), { il, da: 'Antonio Castellano', nota, prima }]) };
};

const OTTOBRE = { mese_idx: 9, regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' };
const NOVEMBRE = { mese_idx: 10, regione: 'Sicilia', t: -50, destinazione: 'GATIM', motivo: 'riduzione del consorzio di novembre', comunicata_il: '2026-10-20' };
const contratto = (extra = {}) => ({
  id: 'c26', anno: 2026, target_annuo_t: 11550, updated_date: '2026-09-14T17:35:58.572000',
  regioni_json: J([{ regione: 'Campania', province: 'Tutte', target_t: 4400 }, { regione: 'Puglia', province: 'BA,BR,TA,LE', target_t: 2500 }, { regione: 'Sicilia', province: 'CT', target_t: 4650 }]),
  target_mensile_iniziale_json: J([800, 750, 800, 950, 1100, 1100, 1050, 500, 1000, 1100, 1100, 950]),
  target_mensile_json: J([851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950]),
  budget_rete_json: J([720, 790, 920, 930, 900, 960, 970, 420, 1030, 1120, 1150, 1190]),
  destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4450, trattamento: 'R1' }, { destinazione: 'GATIM', target_t: 7100, trattamento: 'EoW' }]),
  storico_json: J([{ il: '2026-09-14T17:35:58.203Z', da: 'Antonio Castellano', nota: 'importato dal foglio', prima: null }]),
  ...extra,
});

console.log('1. LA REGOLA: IL CONTRATTO SENZA LE VARIAZIONI IN VIGORE');
{
  const c = registra(contratto(), OTTOBRE, '2026-10-14T10:00:00Z');
  verifica('il contratto con la variazione: 11.650, Puglia 2.600, ottobre 1.200, IRIGOM 4.550', c.target_annuo_t === 11650 && regione(c, 'Puglia') === 2600 && mese(c, 9) === 1200 && dest(c, 'IRIGOM') === 4550);
  const s = senza(c, 2027);
  const k = { ...c, ...s.campi };
  verifica('senza: 11.550, Puglia 2.500, ottobre 1.100, IRIGOM 4.450', k.target_annuo_t === 11550 && regione(k, 'Puglia') === 2500 && mese(k, 9) === 1100 && dest(k, 'IRIGOM') === 4450, J(s.campi));
  verifica('le altre regioni, gli altri mesi e le altre destinazioni non cambiano', regione(k, 'Campania') === 4400 && regione(k, 'Sicilia') === 4650 && dest(k, 'GATIM') === 7100
    && leggi(k.target_mensile_json).every((v, i) => i === 9 || v === leggi(contratto().target_mensile_json)[i]), J(s.campi));
  verifica('tocca solo annuo, regioni, mese rivisto e destinazioni', J(Object.keys(s.campi).sort()) === J(['destinazioni_json', 'regioni_json', 'target_annuo_t', 'target_mensile_json']), J(Object.keys(s.campi)));
  verifica('le righe per l\'anteprima, con e senza', J(s.righe) === J([
    { cosa: 'Target annuo', con_t: 11650, senza_t: 11550 }, { cosa: 'Puglia', con_t: 2600, senza_t: 2500 },
    { cosa: 'Ottobre, target mensile rivisto', con_t: 1200, senza_t: 1100 }, { cosa: 'Destinazione IRIGOM', con_t: 4550, senza_t: 4450 }]), J(s.righe));
  verifica('la variazione tolta, con mese, regione, t, destinazione, motivo e giorno', s.variazioni.length === 1
    && J(s.variazioni[0]) === J({ mese_idx: 9, mese: 'Ottobre', regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14', nel_mese: true }), J(s.variazioni));
  verifica('la nota: non copiata, valeva per il 2026, quale, e che cosa fare se il consorzio la conferma',
    s.nota === 'La variazione del consorzio del 2026 non è copiata, perché valeva per il 2026: ottobre, Puglia +100,00 t, destinazione IRIGOM, «assegnazione del consorzio di ottobre», comunicata il 14/10/2026. Se il consorzio la conferma anche per il 2027, registrala come variazione del 2027 nella scheda Commessa Ecotyre.', s.nota);
  verifica('il motivo in breve per lo storico delle modifiche', s.motivo === 'senza la variazione del consorzio del 2026 (ottobre, Puglia +100,00 t)', s.motivo);
  verifica('lo specchio del browser dice lo stesso', typeof AB.contrattoSenzaVariazioni === 'function' && J(AB.contrattoSenzaVariazioni(c, 2027)) === J(s));

  const nessuna = senza(contratto(), 2027);
  verifica('senza variazioni non si toglie niente e non c\'e\' nota', J(nessuna) === J(VUOTO), J(nessuna));
  verifica('e nemmeno senza contratto', J(senza(null, 2027).campi) === '{}' && senza(undefined).nota === '');

  // superata: un foglio importato dopo riscrive la Puglia
  const sup = salvaTabella(c, { target_annuo_t: 11700, regioni_json: J(leggi(c.regioni_json).map(r => (r.regione === 'Puglia' ? { ...r, target_t: 2650 } : r))) }, '2026-10-20T09:00:00Z');
  const vs = A.variazioniDelContratto(sup);
  verifica('la variazione riscritta da un foglio e\' superata', vs.length === 1 && vs[0].in_vigore === false, J(vs));
  const ss = senza(sup, 2027);
  verifica('una variazione superata non si toglie: si copia il contratto di oggi', J(ss.campi) === '{}' && ss.nota === '' && ss.variazioni.length === 0, J(ss));

  // due variazioni, una in piu' e una in meno, in regioni diverse
  const due = registra(c, NOVEMBRE, '2026-10-20T10:00:00Z');
  verifica('due variazioni in vigore: 11.600, Puglia 2.600, Sicilia 4.600, novembre 1.050, GATIM 7.050',
    due.target_annuo_t === 11600 && regione(due, 'Sicilia') === 4600 && mese(due, 10) === 1050 && dest(due, 'GATIM') === 7050 && A.variazioniDelContratto(due).every(v => v.in_vigore));
  const sd = senza(due, 2027);
  const kd = { ...due, ...sd.campi };
  verifica('senza tutte e due i conti tornano al contratto di partenza', kd.target_annuo_t === 11550 && regione(kd, 'Puglia') === 2500 && regione(kd, 'Sicilia') === 4650 && regione(kd, 'Campania') === 4400
    && mese(kd, 9) === 1100 && mese(kd, 10) === 1100 && dest(kd, 'IRIGOM') === 4450 && dest(kd, 'GATIM') === 7100
    && kd.target_mensile_json === contratto().target_mensile_json && kd.destinazioni_json === contratto().destinazioni_json && kd.regioni_json === contratto().regioni_json, J(sd.campi));
  verifica('la nota al plurale le elenca tutte e due', /^Le 2 variazioni del consorzio del 2026 non sono copiate, perché valevano per il 2026: ottobre, Puglia \+100,00 t, destinazione IRIGOM, «assegnazione del consorzio di ottobre», comunicata il 14\/10\/2026; novembre, Sicilia -50,00 t, destinazione GATIM, «riduzione del consorzio di novembre», comunicata il 20\/10\/2026\. Se il consorzio le conferma anche per il 2027, registrale come variazioni del 2027 nella scheda Commessa Ecotyre\.$/.test(sd.nota)
    && sd.motivo === 'senza le 2 variazioni del consorzio del 2026 (ottobre, Puglia +100,00 t; novembre, Sicilia -50,00 t)', `${sd.nota} | ${sd.motivo}`);

  // senza target mensile rivisto la variazione non e' nel mese, e il mese non si tocca
  const senzaProfilo = registra(contratto({ target_mensile_json: J([]) }), OTTOBRE, '2026-10-14T10:00:00Z');
  verifica('su un contratto senza profilo la variazione non e\' nel mese', A.variazioniDelContratto(senzaProfilo)[0].nel_mese === false && senzaProfilo.target_mensile_json === J([]));
  const sp = senza(senzaProfilo, 2027);
  verifica('e la copia non scrive il mese: annuo, regione e destinazione si', !('target_mensile_json' in sp.campi) && sp.campi.target_annuo_t === 11550 && regione(sp.campi, 'Puglia') === 2500 && dest(sp.campi, 'IRIGOM') === 4450, J(sp.campi));
  // il profilo scritto dopo, senza toccare la Puglia: la variazione resta in vigore e il mese non e' suo
  const profiloDopo = salvaTabella(senzaProfilo, { target_mensile_json: J([900, 900, 900, 900, 900, 900, 900, 900, 900, 1200, 1000, 850]) }, '2026-10-16T09:00:00Z', 'profilo rivisto');
  const spd = senza(profiloDopo, 2027);
  verifica('un profilo scritto dopo la variazione non perde 100 t a ottobre', A.variazioniDelContratto(profiloDopo)[0].in_vigore && !('target_mensile_json' in spd.campi) && spd.campi.target_annuo_t === 11550, J(spd.campi));

  // al chilo come la variazione, mai sotto zero, un annuo che manca resta mancante
  const terzi = registra(contratto(), { ...OTTOBRE, t: 33.3333 }, '2026-10-14T10:00:00Z');
  const st = senza(terzi, 2027);
  verifica('al chilo: 2.533,333 torna 2.500 esatto, senza resti di virgola mobile', terzi.target_annuo_t === 11583.333 && st.campi.target_annuo_t === 11550 && regione(st.campi, 'Puglia') === 2500 && mese(st.campi, 9) === 1100 && /\+33,333 t/.test(st.nota), J([terzi.target_annuo_t, st.campi.target_annuo_t, st.nota]));
  const corretto = salvaTabella(c, { target_annuo_t: 60 }, '2026-10-15T09:00:00Z', 'annuo corretto a mano');
  verifica('una correzione del solo annuo non supera la variazione, e la copia non va sotto zero', A.variazioniDelContratto(corretto)[0].in_vigore && senza(corretto, 2027).campi.target_annuo_t === 0, J(senza(corretto, 2027).campi));
  const senzaAnnuo = salvaTabella(c, { target_annuo_t: null }, '2026-10-15T09:00:00Z', 'annuo tolto');
  verifica('un target annuo che manca resta mancante, non diventa zero', !('target_annuo_t' in senza(senzaAnnuo, 2027).campi) && regione(senza(senzaAnnuo, 2027).campi, 'Puglia') === 2500, J(senza(senzaAnnuo, 2027).campi));

  // RITOCCHI. Righe doppie: la variazione si scrive nella prima riga della sua
  // regione e della sua destinazione, e la copia la toglie solo da li'.
  const doppie = contratto({
    regioni_json: J([{ regione: 'Campania', province: 'Tutte', target_t: 4400 }, { regione: 'Puglia', province: 'BA,BR', target_t: 2000 }, { regione: 'Puglia', province: 'TA,LE', target_t: 500 }, { regione: 'Sicilia', province: 'CT', target_t: 4650 }]),
    destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4000, trattamento: 'Frantumazione/R1' }, { destinazione: 'IRIGOM', target_t: 450, trattamento: 'EoW' }, { destinazione: 'GATIM', target_t: 7100, trattamento: 'EoW' }]),
  });
  const cd = registra(doppie, OTTOBRE, '2026-10-14T10:00:00Z');
  verifica('con due righe Puglia e due IRIGOM la variazione e\' scritta solo nella prima', J(elenco(cd.regioni_json).map(r => r.target_t)) === J([4400, 2100, 500, 4650]) && J(elenco(cd.destinazioni_json).map(d => d.target_t)) === J([4100, 450, 7100]));
  const sdp = senzaR(cd, 2027);
  verifica('e la copia la toglie solo dalla prima: si torna al contratto di partenza, non 200 t in meno', sdp.campi.regioni_json === doppie.regioni_json && sdp.campi.destinazioni_json === doppie.destinazioni_json && sdp.campi.target_annuo_t === 11550, J(sdp.campi));
  verifica('l\'anteprima ha una riga sola per la Puglia e una per IRIGOM', J(sdp.righe) === J([{ cosa: 'Target annuo', con_t: 11650, senza_t: 11550 }, { cosa: 'Puglia', con_t: 2100, senza_t: 2000 },
    { cosa: 'Ottobre, target mensile rivisto', con_t: 1200, senza_t: 1100 }, { cosa: 'Destinazione IRIGOM', con_t: 4100, senza_t: 4000 }]), J(sdp.righe));

  // La destinazione riscritta dopo la variazione (le 100 t spostate da IRIGOM a
  // GATIM): la variazione resta in vigore, ma non si toglie di nuovo da IRIGOM.
  const spostata = salvaTabella(c, { destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4450, trattamento: 'R1' }, { destinazione: 'GATIM', target_t: 7200, trattamento: 'EoW' }]) }, '2026-10-20T09:00:00Z', 'le 100 t vanno a GATIM');
  verifica('spostare le 100 t fra le destinazioni non supera la variazione', A.variazioniDelContratto(spostata)[0].in_vigore === true);
  const ssp = senzaR(spostata, 2027);
  verifica('la copia non le toglie di nuovo da IRIGOM: le destinazioni restano come sono scritte', !('destinazioni_json' in ssp.campi) && ssp.campi.target_annuo_t === 11550 && regione(ssp.campi, 'Puglia') === 2500 && mese(ssp.campi, 9) === 1100
    && !ssp.righe.some(r => /^Destinazione/.test(r.cosa)), J(ssp));
  verifica('e la nota lo dice, col giorno del salvataggio', ssp.parti.length === 2 && ssp.parti[0] === senza(c, 2027).nota
    && ssp.parti[1] === 'La destinazione IRIGOM è stata riscritta dopo la variazione (salvataggio del 20/10/2026), quindi la variazione (+100,00 t) non si toglie dalle destinazioni, che si copiano come sono scritte: controllale nella scheda Commessa Ecotyre.'
    && ssp.nota === ssp.parti.join(' '), J(ssp.parti));
  const dueIrigom = registra(c, { ...NOVEMBRE, regione: 'Puglia', destinazione: 'IRIGOM', t: 50 }, '2026-10-20T10:00:00Z');
  const sdi = senzaR(dueIrigom, 2027);
  verifica('due variazioni sulla stessa destinazione non la fanno sembrare riscritta: si tolgono tutte e due', dest(sdi.campi, 'IRIGOM') === 4450 && regione(sdi.campi, 'Puglia') === 2500 && sdi.parti.length === 1, J(sdi));

  // Superata dal solo mese: ottobre riscritto dopo la variazione, la Puglia no.
  const meseRiscritto = salvaTabella(c, { target_mensile_json: J(elenco(c.target_mensile_json).map((v, i) => (i === 9 ? 1250 : v))) }, '2026-10-20T09:00:00Z', 'profilo rivisto');
  verifica('riscrivere solo ottobre supera la variazione', A.variazioniDelContratto(meseRiscritto)[0].in_vigore === false);
  const sm = senzaR(meseRiscritto, 2027);
  verifica('la superata non si toglie: niente numeri, niente righe, niente motivo', J(sm.campi) === '{}' && sm.variazioni.length === 0 && sm.righe.length === 0 && sm.motivo === '', J(sm));
  verifica('ma la nota dice che la Puglia porta ancora le sue 100 t', sm.parti.length === 1
    && sm.nota === 'La variazione di ottobre (Puglia +100,00 t, «assegnazione del consorzio di ottobre») è superata dal salvataggio del 20/10/2026 e il contratto si copia come è scritto, ma la regione Puglia non è stata riscritta e porta ancora le sue 100,00 t in più. Se il consorzio non le conferma per il 2027, correggi il contratto copiato nella scheda Commessa Ecotyre.', sm.nota);
  verifica('superata dalla regione riscritta: le 100 t non ci sono piu\', e la nota non c\'e\'', senzaR(sup, 2027).nota === '');

  // I target dei raccoglitori dell'anno nuovo: la nota dice se col contratto
  // senza variazioni non fanno piu' la regione (il cruscotto lo direbbe dopo).
  const racc = (puglia, sicilia = 4650) => [
    { raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM SRL', anno: 2027, target_tonnellate: puglia - 650 },
    { raccoglitore: 'PNEUSERVICE CONVERSANO SRL', regione: 'Puglia', impianto: 'IRIGOM SRL', anno: 2027, target_tonnellate: 650 },
    { raccoglitore: 'SMOCO S.r.l.', regione: 'Sicilia', impianto: 'GATIM', anno: 2027, target_tonnellate: sicilia },
  ];
  const sr = senzaR(c, 2027, racc(2600));
  verifica('i raccoglitori con le 100 t: la nota dice che non fanno piu\' la Puglia, coi numeri', J(sr.raccoglitori) === J([{ regione: 'Puglia', raccoglitori_t: 2600, contratto_t: 2500, con_variazioni_t: 2600, differenza_t: 100 }])
    && sr.parti[1] === 'I target dei raccoglitori si copiano come sono, e quelli della Puglia fanno 2.600,00 t: 100,00 t più del contratto 2027 copiato (2.500,00 t). Se il consorzio non conferma la variazione per il 2027, correggili nella scheda Target raccoglitori; se la conferma, registrandola tornano a fare il contratto.', J(sr));
  verifica('i numeri del contratto e il motivo non cambiano per i raccoglitori', J(sr.campi) === J(senza(c, 2027).campi) && sr.motivo === senza(c, 2027).motivo && sr.parti[0] === senza(c, 2027).nota);
  verifica('raccoglitori che fanno il contratto senza variazioni: niente da dire', senzaR(c, 2027, racc(2500)).nota === senza(c, 2027).nota);
  verifica('raccoglitori gia\' lontani, che la copia avvicina: niente da dire', senzaR(c, 2027, racc(1950)).raccoglitori.length === 0 && senzaR(c, 2027, racc(1950)).nota === senza(c, 2027).nota);
  verifica('nessun raccoglitore nell\'anno nuovo: niente da dire, come il cruscotto', senzaR(c, 2027, []).nota === senza(c, 2027).nota);
  const srd = senzaR(due, 2027, racc(2600, 4600));
  verifica('con due variazioni, due regioni nella stessa frase', srd.raccoglitori.length === 2
    && srd.parti[1] === 'I target dei raccoglitori si copiano come sono, e non fanno il contratto 2027 copiato: Puglia 2.600,00 t contro 2.500,00 t (+100,00 t); Sicilia 4.600,00 t contro 4.650,00 t (-50,00 t). Se il consorzio non conferma le variazioni per il 2027, correggili nella scheda Target raccoglitori; se le conferma, registrandole tornano a fare il contratto.', J(srd.parti));
  verifica('lo specchio del browser dice lo stesso: righe doppie, destinazione riscritta, superata, raccoglitori',
    J(senzaB(cd, 2027)) === J(sdp) && J(senzaB(spostata, 2027)) === J(ssp) && J(senzaB(meseRiscritto, 2027)) === J(sm) && J(senzaB(c, 2027, racc(2600))) === J(sr) && J(senzaB(due, 2027, racc(2600, 4600))) === J(srd));
}

console.log('2. IL PIANO DELLA COPIA');
// la copia di prima del 14/10/2026, scritta qui: tutti i campi del contratto
// meno quelli di sistema, la fine della programmazione e lo storico, con l'anno
// nuovo e lo storico che riparte da «copiato dal ..., da confermare»
const copiaDiPrima = (c, anno, il, da) => {
  const { id, created_date, updated_date, created_by, created_by_id, is_sample, storico_json, fine_programmazione, ...campi } = c;
  const pieni = Object.fromEntries(Object.entries(campi).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return { ...pieni, anno, storico_json: J([{ il, da, nota: notaCopia(anno), prima: null }]) };
};
const IL = '2026-12-20T10:00:00Z';
const vuoto = { impianti: [], fornitori: [], raccoglitori: [], mensili: [], commessa: [], siti: [] };
const resto = {
  impianti: [{ id: 'iI', nome_impianto: 'IRIGOM S.R.L.', target: 1050000, stato: 'attivo', anno: 2026 }],
  fornitori: [{ id: 'fN', nome: 'Nappi Sud', impianto_id: 'iI', impianto_nome: 'IRIGOM S.R.L.', ruolo: 'stoccaggio', stato: 'attivo', anno: 2026 }],
  raccoglitori: [{ id: 'r1', raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', anno: 2026, target_tonnellate: 1950 }],
  mensili: [{ id: 'm1', raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', mese: 'Ottobre', anno: 2026, target: 270 }],
  siti: [{ id: 's1', sito: 'IRIGOM S.R.L.', tipo_destinazione: 'imp', anno: 2026 }],
};
const piano = (commessa) => pianoCopiaAnno({ anno: 2027, sorgente: { ...vuoto, ...resto, commessa: [commessa] }, esistenti: vuoto, regolePrecedenti: {}, chiave, il: IL, da: 'Admin' });
{
  const c = registra(contratto({ kg_per_viaggio: 13000, fine_programmazione: '2026-12-18', note: 'contratto 2026' }), OTTOBRE, '2026-10-14T10:00:00Z');
  const p = piano(c);
  const k = p.commessa;
  verifica('il 2027 copiato fa 11.550, Puglia 2.500, ottobre 1.100, IRIGOM 4.450', k && k.target_annuo_t === 11550 && regione(k, 'Puglia') === 2500 && mese(k, 9) === 1100 && dest(k, 'IRIGOM') === 4450, J(k));
  const st = leggi(k.storico_json);
  verifica('lo storico copiato e\' una voce sola, con la nota della copia davanti e quella delle variazioni', st.length === 1 && st[0].il === IL && st[0].da === 'Admin' && st[0].prima === null
    && st[0].nota.startsWith('copiato dal 2026, da confermare · La variazione del consorzio del 2026 non è copiata') && st[0].nota.endsWith('registrala come variazione del 2027 nella scheda Commessa Ecotyre.'), J(st));
  verifica('e porta le variazioni non copiate, per registrarle di nuovo se servono', J(st[0].variazioni_non_copiate) === J(senza(c, 2027).variazioni), J(st[0].variazioni_non_copiate));
  verifica('il contratto copiato resta da confermare e non ha variazioni sue', daConfermare(k) && A.variazioniDelContratto(k).length === 0);
  verifica('il piano porta la nota e le righe per l\'anteprima', p.senzaVariazioni && p.senzaVariazioni.nota === senza(c, 2027).nota && J(p.senzaVariazioni.righe) === J(senza(c, 2027).righe) && p.senzaVariazioni.motivo === senza(c, 2027).motivo, J(p.senzaVariazioni));
  const atteso = copiaDiPrima(c, 2027, IL, 'Admin');
  const { storico_json: _a, ...fuoriStorico } = k;
  const { storico_json: _b, ...fuoriStoricoAtteso } = { ...atteso, ...senza(c, 2027).campi };
  verifica('il resto del contratto si copia come prima: profilo iniziale, budget, chili per viaggio, note; la fine della programmazione no',
    J(fuoriStorico) === J(fuoriStoricoAtteso) && k.target_mensile_iniziale_json === c.target_mensile_iniziale_json && k.budget_rete_json === c.budget_rete_json && k.kg_per_viaggio === 13000 && !('fine_programmazione' in k), J(k));

  const base = contratto({ kg_per_viaggio: 13000, fine_programmazione: '2026-12-18', note: 'contratto 2026' });
  const p0 = piano(base);
  verifica('senza variazioni la copia e\' quella di prima: stessi campi, stesso storico', J(p0.commessa) === J(copiaDiPrima(base, 2027, IL, 'Admin')) && p0.senzaVariazioni === null, J(p0.commessa));
  verifica('impianti, collegamenti, raccoglitori, mensili e siti non cambiano per la variazione', ['impianti', 'collegamenti', 'raccoglitori', 'mensili', 'siti'].every(x => J(p[x]) === J(p0[x])) && J(p.saltati) === J(p0.saltati), J({ p: p.raccoglitori, p0: p0.raccoglitori }));
  const sup = salvaTabella(c, { target_annuo_t: 11700, regioni_json: J(leggi(c.regioni_json).map(r => (r.regione === 'Puglia' ? { ...r, target_t: 2650 } : r))) }, '2026-10-20T09:00:00Z');
  const ps = piano(sup);
  verifica('con la variazione superata la copia porta i numeri del contratto di oggi, senza nota', J(ps.commessa) === J(copiaDiPrima(sup, 2027, IL, 'Admin')) && ps.commessa.target_annuo_t === 11700 && mese(ps.commessa, 9) === 1200 && ps.senzaVariazioni === null, J(ps.commessa));
  const giaFatto = pianoCopiaAnno({ anno: 2027, sorgente: { ...vuoto, commessa: [c] }, esistenti: { ...vuoto, commessa: [{ id: 'c27', anno: 2027, target_annuo_t: 12000 }] }, regolePrecedenti: {}, chiave, il: IL, da: 'Admin' });
  verifica('un 2027 che ha gia\' il contratto non si tocca e non ha nota', giaFatto.commessa === null && giaFatto.senzaVariazioni === null && giaFatto.saltati.commessa_esistente === 1);

  // RITOCCHI. I raccoglitori che il 2027 avra' dopo la copia entrano nella nota.
  const pugliaCon = (t) => [
    { id: 'r1', raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', anno: 2026, target_tonnellate: t - 650 },
    { id: 'r2', raccoglitore: 'PNEUSERVICE CONVERSANO SRL', regione: 'Puglia', impianto: 'IRIGOM S.R.L.', anno: 2026, target_tonnellate: 650 },
  ];
  const pr = pianoCopiaAnno({ anno: 2027, sorgente: { ...vuoto, ...resto, raccoglitori: pugliaCon(2600), commessa: [c] }, esistenti: vuoto, regolePrecedenti: {}, chiave, il: IL, da: 'Admin' });
  const notaR = leggi(pr.commessa.storico_json)[0].nota;
  verifica('raccoglitori copiati con le 100 t: lo storico del contratto copiato lo dice', notaR === `copiato dal 2026, da confermare · ${senzaR(c, 2027, pr.raccoglitori).nota}`
    && /quelli della Puglia fanno 2\.600,00 t: 100,00 t più del contratto 2027 copiato \(2\.500,00 t\)/.test(notaR), notaR);
  verifica('e il piano lo porta all\'anteprima, in parti', !!pr.senzaVariazioni && J(pr.senzaVariazioni.raccoglitori) === J([{ regione: 'Puglia', raccoglitori_t: 2600, contratto_t: 2500, con_variazioni_t: 2600, differenza_t: 100 }])
    && Array.isArray(pr.senzaVariazioni.parti) && pr.senzaVariazioni.parti.length === 2 && pr.senzaVariazioni.nota === pr.senzaVariazioni.parti.join(' '), J(pr.senzaVariazioni));
  verifica('i raccoglitori si copiano come sono, con le 100 t', J(pr.raccoglitori.map(r => r.target_tonnellate)) === J([1950, 650]));
  verifica('i raccoglitori gia\' lontani dal contratto (SMOCO 1.950 da solo) non fanno dire niente', !/raccoglitori/.test(leggi(p.commessa.storico_json)[0].nota));
  const giaScritti = pugliaCon(2600).map((r, i) => ({ ...r, id: 'g' + i, anno: 2027, storico_json: J([{ il: IL, da: 'Antonio Castellano', nota: 'scritto a mano', prima: null }]) }));
  const pg = pianoCopiaAnno({ anno: 2027, sorgente: { ...vuoto, ...resto, commessa: [c] }, esistenti: { ...vuoto, raccoglitori: giaScritti }, regolePrecedenti: {}, chiave, il: IL, da: 'Admin' });
  verifica('contano anche i raccoglitori che il 2027 ha gia\', scritti a mano', pg.raccoglitori.length === 0 && !!pg.senzaVariazioni && (pg.senzaVariazioni.raccoglitori || []).length === 1, J(pg.senzaVariazioni));
  // superata dal solo mese: si copia com'e', con la nota e senza variazioni non copiate
  const meseR = salvaTabella(c, { target_mensile_json: J(elenco(c.target_mensile_json).map((v, i) => (i === 9 ? 1250 : v))) }, '2026-10-20T09:00:00Z', 'profilo rivisto');
  const pm = piano(meseR);
  const vm = leggi(pm.commessa.storico_json)[0];
  verifica('superata dal solo mese: il 2027 porta i numeri di oggi, con la nota che la Puglia ha ancora le 100 t', pm.commessa.target_annuo_t === 11650 && regione(pm.commessa, 'Puglia') === 2600 && mese(pm.commessa, 9) === 1250
    && vm.nota === `copiato dal 2026, da confermare · ${senzaR(meseR, 2027).nota}` && /porta ancora le sue 100,00 t in più/.test(vm.nota) && !('variazioni_non_copiate' in vm) && daConfermare(pm.commessa), J(vm));
  verifica('e il piano lo dice senza variazioni tolte, senza righe e senza motivo', !!pm.senzaVariazioni && pm.senzaVariazioni.variazioni.length === 0 && pm.senzaVariazioni.motivo === '' && J(pm.senzaVariazioni.righe) === '[]', J(pm.senzaVariazioni));
}

console.log('3. LA FUNZIONE INTERA SULLA COPIA DEI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!copie.length) {
  console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: parte saltata.`);
} else {
  const copia = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  console.log(`  Copia: ${copia}, letta il ${DATI.meta.letto_fino_al}`);
  const DELL_11_10 = copia === 'treadrider-dati-veri-2026-10-11.json.gz';
  const vero = (DATI.archivi.CommessaEcotyre || []).filter(c => Number(c.anno) === 2026).sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date)))[0];
  if (DELL_11_10) {
    verifica('il contratto 2026 della copia: 11.550, Puglia 2.500, ottobre 1.100, IRIGOM 4.450, senza variazioni', vero.target_annuo_t === 11550 && regione(vero, 'Puglia') === 2500 && mese(vero, 9) === 1100 && dest(vero, 'IRIGOM') === 4450 && A.variazioniDelContratto(vero).length === 0);
  }
  const conVariazione = registra(vero, OTTOBRE, '2026-10-14T10:00:00.000000');
  const archivi = (commessa, altro = {}) => ({
    ImpiantoTargetSecondaria: DATI.archivi.ImpiantoTargetSecondaria || [],
    FornitoreSecondaria: DATI.archivi.FornitoreSecondaria || [],
    TargetRaccoglitore: DATI.archivi.TargetRaccoglitore || [],
    TargetMensile: DATI.archivi.TargetMensile || [],
    GiacenzaSito: DATI.archivi.GiacenzaSito || [],
    CommessaEcotyre: [commessa],
    ...altro,
  });
  // l'orologio fermo al 14/10/2026: la copia nel 2027 si puo' fare, e le voci hanno un istante solo
  const ADESSO = Date.parse('2026-10-14T12:00:00Z');
  const DataVera = Date;
  const fermo = async (f) => {
    globalThis.Date = class extends DataVera { constructor(...a) { super(...(a.length ? a : [ADESSO])); } static now() { return ADESSO; } };
    try { return await f(); } finally { globalThis.Date = DataVera; }
  };
  const funzione = await caricaFunzione('copiaAnnoTarget');
  const copiaIl = (commessa, simula = false, altro = {}) => fermo(() => chiama(funzione, { db: archivi(commessa, altro), corpo: { anno: 2027, simula } }));
  const del2027 = (r) => (r.db.CommessaEcotyre || []).find(c => Number(c.anno) === 2027);

  const anteprima = await copiaIl(conVariazione, true);
  const cs = anteprima.j.contratto_senza_variazioni;
  verifica('l\'anteprima non scrive e dice il contratto senza la variazione', anteprima.stato === 200 && anteprima.j.simulato === true && anteprima.scritte.length === 0 && anteprima.j.conteggi.commessa === 1
    && cs && J(cs.righe) === J([{ cosa: 'Target annuo', con_t: 11650, senza_t: 11550 }, { cosa: 'Puglia', con_t: 2600, senza_t: 2500 }, { cosa: 'Ottobre, target mensile rivisto', con_t: 1200, senza_t: 1100 }, { cosa: 'Destinazione IRIGOM', con_t: 4550, senza_t: 4450 }])
    && /^La variazione del consorzio del 2026 non è copiata/.test(cs.nota) && cs.variazioni.length === 1, J(anteprima.j));

  const fatta = await copiaIl(conVariazione);
  const k = del2027(fatta);
  verifica('il 2027 scritto fa 11.550, Puglia 2.500, ottobre 1.100, IRIGOM 4.450', fatta.stato === 200 && k && k.target_annuo_t === 11550 && regione(k, 'Puglia') === 2500 && mese(k, 9) === 1100 && dest(k, 'IRIGOM') === 4450, J(k));
  verifica('con la nota nello storico copiato', k && leggi(k.storico_json).length === 1 && leggi(k.storico_json)[0].nota === `copiato dal 2026, da confermare · ${cs && cs.nota}` && daConfermare(k), k && k.storico_json);
  verifica('la risposta della copia porta la stessa nota dell\'anteprima', fatta.j.contratto_senza_variazioni && fatta.j.contratto_senza_variazioni.nota === (cs && cs.nota));
  const righe = fatta.db.ModificaDato || [];
  const delContratto = righe.filter(x => x.entita === 'CommessaEcotyre');
  verifica('le righe del contratto nello storico delle modifiche dicono che le variazioni non sono copiate', delContratto.length > 0
    && delContratto.every(x => x.motivo === 'copia dal 2026, da confermare; senza la variazione del consorzio del 2026 (ottobre, Puglia +100,00 t)') && delContratto.some(x => x.campo === 'target_annuo_t' && x.dopo === '11550'), J(delContratto.map(x => [x.campo, x.dopo, x.motivo])));
  verifica('le righe degli altri archivi hanno il motivo di sempre', righe.filter(x => x.entita !== 'CommessaEcotyre').every(x => x.motivo === 'copia dal 2026, da confermare'));

  const senzaV = await copiaIl(vero);
  const k0 = del2027(senzaV);
  verifica('senza variazioni: la copia di prima, campo per campo, e la risposta di prima', senzaV.stato === 200 && J(k0) === J({ id: k0.id, ...copiaDiPrima(vero, 2027, new DataVera(ADESSO).toISOString(), 'prova@prova') }) && !('contratto_senza_variazioni' in senzaV.j), J(k0));
  verifica('e le righe del contratto col motivo di sempre', (senzaV.db.ModificaDato || []).filter(x => x.entita === 'CommessaEcotyre').every(x => x.motivo === 'copia dal 2026, da confermare'));
  const senzaId = (r, nome) => J((r.db[nome] || []).filter(x => Number(x.anno) === 2027).map(({ id, ...x }) => x));
  verifica('impianti, target dei raccoglitori, mensili e siti copiati sono gli stessi con e senza la variazione', ['ImpiantoTargetSecondaria', 'FornitoreSecondaria', 'TargetRaccoglitore', 'TargetMensile', 'GiacenzaSito'].every(n => senzaId(fatta, n) === senzaId(senzaV, n))
    && J(fatta.j.conteggi) === J(senzaV.j.conteggi), J([fatta.j.conteggi, senzaV.j.conteggi]));
  if (DELL_11_10) {
    verifica('sulla copia dell\'11/10: 6 impianti, 14 target annui, 147 mensili, 8 siti, il contratto', J(fatta.j.conteggi) === J({ impianti: 6, collegamenti: 0, raccoglitori: 14, mensili: 147, commessa: 1, siti: 8 }), J(fatta.j.conteggi));
  }

  const superata = salvaTabella(conVariazione, { target_annuo_t: 11700, regioni_json: J(leggi(conVariazione.regioni_json).map(r => (r.regione === 'Puglia' ? { ...r, target_t: 2650 } : r))) }, '2026-10-20T09:00:00.000000');
  const ks = del2027(await copiaIl(superata));
  verifica('con la variazione superata: i numeri del contratto di oggi (11.700, Puglia 2.650, ottobre 1.200, IRIGOM 4.550), senza nota',
    ks && ks.target_annuo_t === 11700 && regione(ks, 'Puglia') === 2650 && mese(ks, 9) === 1200 && dest(ks, 'IRIGOM') === 4550 && leggi(ks.storico_json)[0].nota === 'copiato dal 2026, da confermare', J(ks));

  const conDue = registra(conVariazione, NOVEMBRE, '2026-10-20T10:00:00.000000');
  const due = await copiaIl(conDue);
  const kd = del2027(due);
  verifica('con due variazioni (+100 Puglia, -50 Sicilia) il 2027 torna al contratto di partenza', kd && kd.target_annuo_t === 11550 && kd.regioni_json === vero.regioni_json && kd.target_mensile_json === vero.target_mensile_json && kd.destinazioni_json === vero.destinazioni_json, J(kd));
  verifica('e la nota le elenca tutte e due', kd && /Le 2 variazioni del consorzio del 2026 non sono copiate/.test(leggi(kd.storico_json)[0].nota) && /novembre, Sicilia -50,00 t/.test(leggi(kd.storico_json)[0].nota), kd && kd.storico_json);

  // RITOCCHI sui dati veri.
  // (a) Il caso vero del 14/10: l'utente ha messo le 100 t sui raccoglitori
  // (SMOCO in Puglia 1.850 -> 1.950, ottobre 170 -> 270, come
  // prove/variazioneContratto.mjs sezione 3) e poi ha registrato la variazione.
  const smoco = (r) => /^smoco/i.test(String(r.raccoglitore || '')) && r.regione === 'Puglia' && Number(r.anno) === 2026;
  const del14 = {
    TargetRaccoglitore: (DATI.archivi.TargetRaccoglitore || []).map(r => (smoco(r) ? { ...r, target_tonnellate: Number(r.target_tonnellate) + 100 } : r)),
    TargetMensile: (DATI.archivi.TargetMensile || []).map(r => (smoco(r) && r.mese === 'Ottobre' ? { ...r, target: Number(r.target) + 100 } : r)),
  };
  verifica('coi raccoglitori dell\'11/10 (Puglia 2.500, come il contratto senza la variazione) la nota non parla dei raccoglitori', !!cs && !/raccoglitori/.test(cs.nota) && J((cs && cs.raccoglitori) || []) === '[]', J(cs));
  const ant14 = await copiaIl(conVariazione, true, del14);
  const cs14 = ant14.j.contratto_senza_variazioni || {};
  verifica('il caso del 14/10: l\'anteprima dice che i raccoglitori della Puglia fanno 2.600,00 t, 100,00 t piu\' del contratto 2027', J(cs14.raccoglitori) === J([{ regione: 'Puglia', raccoglitori_t: 2600, contratto_t: 2500, con_variazioni_t: 2600, differenza_t: 100 }])
    && (cs14.parti || []).some(x => x.startsWith('I target dei raccoglitori si copiano come sono, e quelli della Puglia fanno 2.600,00 t: 100,00 t più del contratto 2027 copiato (2.500,00 t).')) && J(cs14.righe) === J(cs && cs.righe), J(cs14));
  const fatta14 = await copiaIl(conVariazione, false, del14);
  const k14 = del2027(fatta14);
  const r14 = (fatta14.db.TargetRaccoglitore || []).filter(r => Number(r.anno) === 2027);
  const voci14 = k14 ? vociContrattoRaccoglitori([k14], r14, 2027) : [];
  verifica('e il 2027 scritto: contratto 11.550 e Puglia 2.500, raccoglitori come erano (11.650, Puglia 2.600), la nota nello storico', !!k14 && k14.target_annuo_t === 11550 && regione(k14, 'Puglia') === 2500
    && Math.abs(r14.reduce((x, r) => x + r.target_tonnellate, 0) - 11650) < 0.001 && Math.abs(r14.filter(r => r.regione === 'Puglia').reduce((x, r) => x + r.target_tonnellate, 0) - 2600) < 0.001
    && leggi(k14.storico_json)[0].nota === `copiato dal 2026, da confermare · ${cs14.nota}`, k14 && k14.storico_json);
  verifica('la nota dice i numeri che il cruscotto dira\' sul 2027', voci14.length === 1 && voci14[0].dettaglio.startsWith('Puglia: raccoglitori 2.600,00 t, contratto 2.500,00 t (+100,00 t).')
    && /2\.600,00 t: 100,00 t più del contratto 2027 copiato \(2\.500,00 t\)/.test(cs14.nota || ''), J([voci14, cs14.nota]));

  // (b) Le 100 t spostate da IRIGOM a T_CYCLE dopo la variazione: la Puglia resta 2.600, la variazione in vigore.
  const spostata = salvaTabella(conVariazione, { destinazioni_json: J(leggi(conVariazione.destinazioni_json).map(d => (d.destinazione === 'IRIGOM' ? { ...d, target_t: 4450 } : d.destinazione === 'T_CYCLE' ? { ...d, target_t: 1150 } : d))) }, '2026-10-20T09:00:00.000Z', 'le 100 t vanno a T_CYCLE');
  const copiaSpostata = await copiaIl(spostata);
  const kf = del2027(copiaSpostata);
  verifica('le 100 t spostate a T_CYCLE: il 2027 ha IRIGOM 4.450 e T_CYCLE 1.150 come sono scritti, non IRIGOM 4.350', A.variazioniDelContratto(spostata)[0].in_vigore && !!kf && dest(kf, 'IRIGOM') === 4450 && dest(kf, 'T_CYCLE') === 1150
    && kf.target_annuo_t === 11550 && regione(kf, 'Puglia') === 2500 && mese(kf, 9) === 1100, J(kf));
  verifica('e la nota lo dice, e l\'anteprima non ha la riga di IRIGOM', !!kf && leggi(kf.storico_json)[0].nota.includes('La destinazione IRIGOM è stata riscritta dopo la variazione (salvataggio del 20/10/2026)')
    && !((copiaSpostata.j.contratto_senza_variazioni || {}).righe || [{ cosa: 'IRIGOM' }]).some(r => /IRIGOM/.test(r.cosa)), kf && kf.storico_json);

  // (c) Ottobre riscritto dopo la variazione (1.200 -> 1.250), la Puglia no: la variazione e' superata.
  const meseV = salvaTabella(conVariazione, { target_mensile_json: J(leggi(conVariazione.target_mensile_json).map((v, i) => (i === 9 ? 1250 : v))) }, '2026-10-20T09:00:00.000Z', 'profilo rivisto');
  const copiaMese = await copiaIl(meseV);
  const km = del2027(copiaMese);
  verifica('ottobre riscritto: il 2027 porta il contratto di oggi (11.650, Puglia 2.600, ottobre 1.250) e la nota sulle 100 t della Puglia', !A.variazioniDelContratto(meseV)[0].in_vigore && !!km && km.target_annuo_t === 11650 && regione(km, 'Puglia') === 2600 && mese(km, 9) === 1250
    && /^copiato dal 2026, da confermare · La variazione di ottobre \(Puglia \+100,00 t, «assegnazione del consorzio di ottobre»\) è superata dal salvataggio del 20\/10\/2026/.test(leggi(km.storico_json)[0].nota), km && km.storico_json);
  verifica('e lo storico delle modifiche ha il motivo di sempre, senza code', (copiaMese.db.ModificaDato || []).filter(x => x.entita === 'CommessaEcotyre').every(x => x.motivo === 'copia dal 2026, da confermare')
    && !!copiaMese.j.contratto_senza_variazioni && copiaMese.j.contratto_senza_variazioni.variazioni.length === 0, J(copiaMese.j.contratto_senza_variazioni));
}

console.log('4. LA FINESTRA DELLA COPIA');
{
  // Come in prove/storicoModifiche.mjs, sezione 7: la finestra vera, con la
  // finestra di sistema e l'accesso sostituiti da contenitori semplici.
  // src/lib/utils.js guarda window appena caricato (isIframe): come in
  // prove/dati/libPagine.mjs, un window finto.
  if (typeof globalThis.window === 'undefined') globalThis.window = { self: 1, top: 1 };
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
  const FINTI = {
    client: 'export const base44 = { functions: { invoke: async () => ({ data: {} }) }, entities: {}, auth: { me: async () => ({}) } };',
    dialog: `import React from 'react';
      const box = (tag) => ({ children }) => React.createElement(tag, null, children);
      export const Dialog = ({ children }) => React.createElement(React.Fragment, null, children);
      export const DialogContent = box('div'); export const DialogHeader = box('div'); export const DialogFooter = box('div');
      export const DialogTitle = box('h2'); export const DialogDescription = box('p');`,
    accesso: 'export const useAuth = () => ({ user: null, isLoadingAuth: false }); export const AuthProvider = ({ children }) => children;',
  };
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import { DialogoAzione } from ${JSON.stringify(qui('../src/components/target-status/ConfigurazioneImpianti.jsx'))};
export const disegna = (props) => renderToStaticMarkup(React.createElement(DialogoAzione, { anno: 2027, onChiudi() {}, onConferma() {}, ...props }));
`;
  let disegna = null;
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'finto' }));
        b.onResolve({ filter: /^@\/components\/ui\/dialog$/ }, () => ({ path: 'dialog', namespace: 'finto' }));
        b.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: 'accesso', namespace: 'finto' }));
        b.onLoad({ filter: /.*/, namespace: 'finto' }, (args) => ({ contents: FINTI[args.path], loader: 'js', resolveDir: qui('.') }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    ({ disegna } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
  } catch (e) { verifica('la finestra si impacchetta e si carica', false, String(e && e.message).slice(0, 400)); }
  if (disegna) {
    const c = registra(contratto(), OTTOBRE, '2026-10-14T10:00:00Z');
    const s = senza(c, 2027);
    const contrattoSenza = { variazioni: s.variazioni, righe: s.righe, nota: s.nota, motivo: s.motivo };
    const testo = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const prima = disegna({ azione: { tipo: 'copia', fase: 'conferma', errore: null, dati: { conteggi: { impianti: 6, commessa: 1 }, contratto_senza_variazioni: contrattoSenza } } });
    const t = testo(prima);
    verifica('prima di confermare: il contratto si copia senza le variazioni, coi numeri con e senza',
      t.includes('Il contratto Ecotyre si copia senza le variazioni del consorzio del 2026:') && t.includes('Target annuo: 11.550,00 t (nel 2026, con le variazioni, 11.650,00 t)')
      && t.includes('Puglia: 2.500,00 t (nel 2026, con le variazioni, 2.600,00 t)') && t.includes('Ottobre, target mensile rivisto: 1.100,00 t (nel 2026, con le variazioni, 1.200,00 t)')
      && t.includes('Destinazione IRIGOM: 4.450,00 t (nel 2026, con le variazioni, 4.550,00 t)'), t.slice(0, 1500));
    verifica('e la nota che finisce nello storico', t.includes(testo(s.nota)), t.slice(0, 1500));
    // a 375 px: il riquadro va a capo, niente righe che non si spezzano
    const titolo = prima.indexOf('si copia senza le variazioni');
    const riquadro = titolo < 0 ? '' : prima.slice(prima.lastIndexOf('<div class="text-amber-900', titolo), prima.indexOf('</div></div>', titolo) + 12);
    verifica('il riquadro va a capo a 375 px (break-words, min-w-0, niente nowrap ne\' larghezze fisse)', /break-words/.test(riquadro) && /min-w-0/.test(riquadro) && !/nowrap|truncate|\bw-\[|min-w-\[/.test(riquadro) && riquadro.includes(s.nota.slice(-40)), riquadro);
    const dopo = testo(disegna({ azione: { tipo: 'copia', fase: 'fatto', errore: null, dati: { conteggi: { impianti: 6, commessa: 1 }, contratto_senza_variazioni: contrattoSenza, traccia: { scritta: true, righe: 10 } } } }));
    verifica('dopo la copia lo dice al passato', dopo.includes('Fatto.') && dopo.includes('Il contratto Ecotyre del 2027 è copiato senza le variazioni del consorzio del 2026:'), dopo.slice(0, 800));
    const nessuna = testo(disegna({ azione: { tipo: 'copia', fase: 'conferma', errore: null, dati: { conteggi: { impianti: 6, commessa: 1 } } } }));
    verifica('senza variazioni il riquadro non c\'e\'', nessuna.includes('Se confermi, copio') && !nessuna.includes('si copia senza le variazioni') && !nessuna.includes('con le variazioni,'), nessuna.slice(0, 800));
    const giaContratto = testo(disegna({ azione: { tipo: 'copia', fase: 'conferma', errore: null, dati: { conteggi: { impianti: 6, commessa: 0 }, contratto_senza_variazioni: contrattoSenza } } }));
    verifica('se il contratto non si copia il riquadro non c\'e\'', !giaContratto.includes('si copia senza le variazioni'), giaContratto.slice(0, 800));

    // RITOCCHI: la nota arriva in parti, un paragrafo per cosa; una superata da
    // sola non ha il titolo «senza le variazioni» ne' le righe con e senza.
    const P1 = s.nota;
    const P2 = 'I target dei raccoglitori si copiano come sono, e quelli della Puglia fanno 2.600,00 t: 100,00 t più del contratto 2027 copiato (2.500,00 t). Se il consorzio non conferma la variazione per il 2027, correggili nella scheda Target raccoglitori; se la conferma, registrandola tornano a fare il contratto.';
    const inParti = disegna({ azione: { tipo: 'copia', fase: 'conferma', errore: null, dati: { conteggi: { impianti: 6, commessa: 1 }, contratto_senza_variazioni: { ...contrattoSenza, parti: [P1, P2], nota: `${P1} ${P2}` } } } });
    const paragrafi = [...inParti.matchAll(/<p>([^<]*)<\/p>/g)].map(m => testo(m[1]).trim());
    verifica('a video la nota e\' in paragrafi: le variazioni non copiate, poi i raccoglitori', paragrafi.includes(testo(P1).trim()) && paragrafi.includes(testo(P2).trim()), J(paragrafi));
    const P3 = 'La variazione di ottobre (Puglia +100,00 t, «assegnazione del consorzio di ottobre») è superata dal salvataggio del 20/10/2026 e il contratto si copia come è scritto, ma la regione Puglia non è stata riscritta e porta ancora le sue 100,00 t in più. Se il consorzio non le conferma per il 2027, correggi il contratto copiato nella scheda Commessa Ecotyre.';
    const soloSuperata = testo(disegna({ azione: { tipo: 'copia', fase: 'conferma', errore: null, dati: { conteggi: { impianti: 6, commessa: 1 }, contratto_senza_variazioni: { variazioni: [], righe: [], raccoglitori: [], parti: [P3], nota: P3, motivo: '' } } } }));
    verifica('una superata da sola: il riquadro c\'e\', senza il titolo «senza le variazioni» e senza righe', soloSuperata.includes(testo(P3)) && !soloSuperata.includes('si copia senza le variazioni') && !soloSuperata.includes('con le variazioni,'), soloSuperata.slice(0, 1200));
  }
}

console.log('5. I DUE MODULI CHE SI IMPORTANO A VICENDA');
{
  // annoTarget importa contrattoSenzaVariazioni da attesoContratto, che importa
  // daConfermare da annoTarget: regge solo se nessuno dei due usa l'altro mentre
  // si carica. Si impacchettano come fanno le funzioni e le pagine, nei due
  // ordini, per tutti e due i lati.
  const ordini = [
    ['base44/shared/annoTarget.ts', 'base44/shared/attesoContratto.ts'],
    ['base44/shared/attesoContratto.ts', 'base44/shared/annoTarget.ts'],
    ['src/lib/annoTarget.js', 'src/lib/attesoContratto.js'],
    ['src/lib/attesoContratto.js', 'src/lib/annoTarget.js'],
  ];
  for (const [primo, secondo] of ordini) {
    let esito = '';
    try {
      const pacchetto = await build({
        stdin: { contents: `import * as P from ${J(qui('../' + primo))}; import * as S from ${J(qui('../' + secondo))};
const M = { ...P, ...S };
const c = { anno: 2027, target_annuo_t: 11550, storico_json: JSON.stringify([{ nota: 'copiato dal 2026, da confermare' }]) };
export const esito = [M.targetAnnuoDellAnno(c, 2027).da_confermare, typeof M.pianoCopiaAnno({ anno: 2027, sorgente: {}, esistenti: {}, chiave: (x) => x }).commessa, M.contrattoSenzaVariazioni(c, 2028).nota].join('|');`, resolveDir: qui('.'), loader: 'js' },
        bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
      });
      ({ esito } = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64')));
    } catch (e) { esito = String(e && e.message).slice(0, 300); }
    verifica(`impacchettati con ${primo.split('/').pop()} per primo si caricano e funzionano`, esito === 'true|object|', esito);
  }
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

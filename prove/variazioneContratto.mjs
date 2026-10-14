// LA VARIAZIONE DEL CONTRATTO ARRIVA IN TUTTI I MODULI (richiesta dell'utente del 14/10/2026).
//
// L'utente, testuale: «abbiamo avuto per il mese di ottobre dal consorzio 100 t
// in più che per il momento ho aggiunto al target di Smoco in Puglia [...] non
// sto notando che da altre parti la modifica viene interessata, compresa la
// dashboard». Il target dei raccoglitori era salito a 11.650 t, il contratto
// (CommessaEcotyre) era rimasto a 11.550: dashboard, atteso alla data,
// proiezione, Andamento ed EcoTyna leggono il contratto e non si muovevano.
// Ora la variazione si registra nel contratto (variazioneDelContratto di
// attesoContratto.ts, la finestra VariazioneContratto.jsx), e la scheda dei
// raccoglitori avvisa quando una regione non fa il contratto (scartiDalContratto),
// col pulsante che apre la variazione gia' compilata.
//
// Qui:
// 1. le regole, su contratti costruiti: errori, arrotondamento al chilo, mesi e
//    regioni che non c'entrano intatti, il contratto senza target mensile, la
//    variazione in meno, lo storico e l'elenco;
// 2. l'avviso e la proposta del mese: dallo storico dei target mensili, solo se
//    si capisce, mai dopo la variazione gia' registrata;
// 3. sulla copia dei dati veri dell'11/10/2026, con la modifica dell'utente del
//    14/10 (SMOCO in Puglia 1.850 -> 1.950 t, ottobre 170 -> 270 t): l'avviso
//    della Puglia (+100 t, ottobre, IRIGOM), la variazione (11.650 t, Puglia
//    2.600, ottobre 1.200), e poi dashboard (getDashboardRaccolta intera),
//    Andamento ed EcoTyna (situazioneGestionale) che si muovono, coi numeri;
// 4. la finestra, l'elenco e l'avviso disegnati con React lato server;
// 5. il sorgente: chi scrive passa da scriviConTraccia e rilegge il contratto;
// 6. la revisione del 14/10/2026: l'atteso di una regione (attesoDellaRegione)
//    prende le variazioni solo nel loro mese e nella loro regione, le altre
//    regioni non cambiano, il totale e' la somma delle regioni; una variazione
//    i cui numeri un salvataggio riscrive esce dal contratto (in_vigore falso),
//    e la scheda lo dice prima di salvare.
// Senza la copia dei dati veri la parte 3 si salta e lo dice. node prove/variazioneContratto.mjs
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as A from '../base44/shared/attesoContratto.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const vicino = (a, b, d = 0.001) => a !== null && a !== undefined && b !== null && b !== undefined && Math.abs(Number(a) - Number(b)) < d;
// Le tonnellate come le scrive il gestionale (formatNumber di src/lib/utils.js):
// punto delle migliaia anche a quattro cifre, due decimali, tre se i chili non
// sono tondi. toLocaleString di Node non mette il punto in 8818,55.
const numero = (v, min, max) => {
  const fixed = Math.abs(Number(v)).toFixed(max);
  const [i, d0 = ''] = fixed.split('.');
  let d = d0;
  while (d.length > min && d.endsWith('0')) d = d.slice(0, -1);
  return (Number(v) < 0 && Number(fixed) !== 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : '');
};
const t = (v) => (v === null || v === undefined ? '—' : numero(v, 2, 3));
const pc = (v) => (v === null || v === undefined ? '—' : `${numero(v, 2, 2)}%`);
const conSegno = (v) => `${v > 0 ? '+' : ''}${t(v)}`;

const ci = (nome) => typeof A[nome] === 'function';
verifica('attesoContratto ha le regole delle variazioni', ci('variazioneDelContratto') && ci('variazioniDelContratto') && ci('storicoConVariazione') && ci('scartiDalContratto') && ci('destinazioneDelContratto'),
  Object.keys(A).join(', '));
// Senza le regole le parti 1-3 non hanno niente da chiamare: si saltano, e la
// prova fallisce gia' qui; la 4 e la 5 guardano le pagine comunque.
const REGOLE = ci('variazioneDelContratto') && ci('scartiDalContratto');

const PROFILO = [851.29, 915.48, 868.47, 932.55, 1053.85, 1100, 1100, 550, 1050, 1100, 1100, 950];
const contratto = (extra = {}) => ({
  id: 'c26', anno: 2026, target_annuo_t: 11550,
  regioni_json: J([{ regione: 'Campania', province: 'Tutte', target_t: 4400 }, { regione: 'Puglia', province: 'BA,BR,TA,LE', target_t: 2500 }, { regione: 'Sicilia', province: 'CT', target_t: 4650 }]),
  target_mensile_iniziale_json: J([800, 750, 800, 950, 1100, 1100, 1050, 500, 1000, 1100, 1100, 950]),
  target_mensile_json: J(PROFILO),
  budget_rete_json: J([720, 790, 920, 930, 900, 960, 970, 420, 1030, 1120, 1150, 1190]),
  destinazioni_json: J([{ destinazione: 'IRIGOM', target_t: 4450, trattamento: 'R1' }, { destinazione: 'T_CYCLE', target_t: 7100, trattamento: 'R1' }]),
  storico_json: J([{ il: '2026-09-14T17:35:58.203Z', da: 'Antonio', nota: 'importato dal foglio', prima: null }]),
  ...extra,
});
const OTTOBRE = { mese_idx: 9, regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' };
const leggi = (json) => JSON.parse(json);

console.log('1. LE REGOLE');
if (REGOLE) {
  const c = contratto();
  const v = A.variazioneDelContratto(c, OTTOBRE);
  verifica('si puo\' registrare', v.errori.length === 0, J(v.errori));
  verifica('target annuo 11.550 -> 11.650', v.patch.target_annuo_t === 11650);
  const reg = leggi(v.patch.regioni_json);
  verifica('Puglia 2.500 -> 2.600, le province restano, le altre regioni intatte', J(reg) === J([{ regione: 'Campania', province: 'Tutte', target_t: 4400 }, { regione: 'Puglia', province: 'BA,BR,TA,LE', target_t: 2600 }, { regione: 'Sicilia', province: 'CT', target_t: 4650 }]), J(reg));
  const mesi = leggi(v.patch.target_mensile_json);
  verifica('ottobre 1.100 -> 1.200 nel target mensile rivisto, gli altri mesi intatti', mesi[9] === 1200 && J(mesi.filter((_, i) => i !== 9)) === J(PROFILO.filter((_, i) => i !== 9)), J(mesi));
  verifica('la destinazione IRIGOM 4.450 -> 4.550, T_CYCLE intatta', J(leggi(v.patch.destinazioni_json)) === J([{ destinazione: 'IRIGOM', target_t: 4550, trattamento: 'R1' }, { destinazione: 'T_CYCLE', target_t: 7100, trattamento: 'R1' }]));
  verifica('il target mensile iniziale e i budget non si toccano', !('target_mensile_iniziale_json' in v.patch) && !('budget_rete_json' in v.patch) && !('budget_aci_json' in v.patch) && !('target_prezzo_regioni_json' in v.patch), Object.keys(v.patch).join(','));
  verifica('prima porta i campi com\'erano', v.prima.target_annuo_t === 11550 && v.prima.regioni_json === c.regioni_json && v.prima.target_mensile_json === c.target_mensile_json && v.prima.destinazioni_json === c.destinazioni_json);
  verifica('le righe per mostrarla prima di confermare', J(v.righe.map(r => [r.cosa, r.prima_t, r.dopo_t])) === J([['Target annuo', 11550, 11650], ['Puglia', 2500, 2600], ['Ottobre, target mensile rivisto', 1100, 1200], ['Destinazione IRIGOM', 4450, 4550]]), J(v.righe));
  verifica('la voce dello storico', J(v.voce) === J({ mese_idx: 9, regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' }), J(v.voce));
  verifica('la regione si riconosce senza badare a maiuscole e spazi', A.variazioneDelContratto(c, { ...OTTOBRE, regione: ' puglia ' }).voce.regione === 'Puglia');
  // al chilo: 851,29 + 0,1 non deve diventare 851,3900000000001
  const febbraio = A.variazioneDelContratto(c, { ...OTTOBRE, mese_idx: 0, t: 0.1, destinazione: '' });
  verifica('arrotondato al chilo', leggi(febbraio.patch.target_mensile_json)[0] === 851.39 && febbraio.patch.target_annuo_t === 11550.1, febbraio.patch.target_mensile_json);
  verifica('senza destinazione la tabella delle destinazioni non si tocca', !('destinazioni_json' in febbraio.patch));
  const meno = A.variazioneDelContratto(c, { ...OTTOBRE, t: -50, destinazione: '' });
  verifica('in meno: 11.500, Puglia 2.450, ottobre 1.050', meno.patch.target_annuo_t === 11500 && leggi(meno.patch.regioni_json)[1].target_t === 2450 && leggi(meno.patch.target_mensile_json)[9] === 1050 && meno.voce.t === -50);

  const errori = (variazione, com = c) => A.variazioneDelContratto(com, variazione).errori.join(' | ');
  verifica('senza contratto non si registra', /non è inserito/.test(errori(OTTOBRE, null)));
  verifica('senza target annuo nel contratto no', /non ha il target annuo/.test(errori(OTTOBRE, contratto({ target_annuo_t: null }))));
  verifica('il mese si sceglie', /Scegli il mese/.test(errori({ ...OTTOBRE, mese_idx: '' })) && /Scegli il mese/.test(errori({ ...OTTOBRE, mese_idx: 12 })));
  verifica('una regione fuori dal contratto no', /Calabria non è fra le regioni del contratto/.test(errori({ ...OTTOBRE, regione: 'Calabria' })) && /Scegli la regione/.test(errori({ ...OTTOBRE, regione: '' })));
  verifica('zero tonnellate o un testo no', /Scrivi le tonnellate/.test(errori({ ...OTTOBRE, t: 0 })) && /Scrivi le tonnellate/.test(errori({ ...OTTOBRE, t: NaN })) && /Scrivi le tonnellate/.test(errori({ ...OTTOBRE, t: '' })));
  verifica('il motivo e il giorno vero della comunicazione servono', /Scrivi il motivo/.test(errori({ ...OTTOBRE, motivo: '  ' })) && /giorno della comunicazione/.test(errori({ ...OTTOBRE, comunicata_il: '2026-02-31' })) && /giorno della comunicazione/.test(errori({ ...OTTOBRE, comunicata_il: '' })));
  verifica('una destinazione che il contratto non ha no', /GATIM non è fra le destinazioni/.test(errori({ ...OTTOBRE, destinazione: 'GATIM' })));
  verifica('niente sotto zero, e si dice che cosa', /sotto zero: Puglia, Ottobre, target mensile rivisto\.$/.test(errori({ ...OTTOBRE, t: -2600, destinazione: '' })) && /sotto zero: Ottobre, target mensile rivisto\.$/.test(errori({ ...OTTOBRE, t: -2000, destinazione: '' })),
    errori({ ...OTTOBRE, t: -2600, destinazione: '' }));
  // un contratto senza target mensile: il mese non si scrive, l'atteso resta in dodicesimi
  const senzaProfilo = A.variazioneDelContratto(contratto({ target_mensile_json: J(Array(12).fill(null)) }), OTTOBRE);
  verifica('senza target mensile rivisto il mese non si scrive, e lo si dice', senzaProfilo.errori.length === 0 && !('target_mensile_json' in senzaProfilo.patch) && /il resto del contratto in dodicesimi/.test(senzaProfilo.avvisi.join(' ')), J(senzaProfilo));
  const copiato = A.variazioneDelContratto(contratto({ storico_json: J([{ il: '2026-12-01T10:00:00Z', nota: 'copiato dal 2025, da confermare', prima: null }]) }), OTTOBRE);
  verifica('su un contratto copiato e non confermato si avvisa che lo conferma', /lo confermi/.test(copiato.avvisi.join(' ')));

  const storico = A.storicoConVariazione(c.storico_json, { il: '2026-10-14T10:00:00.000Z', da: 'Antonio Castellano', voce: v.voce, prima: v.prima });
  const voci = leggi(storico);
  verifica('lo storico tiene la voce di prima e aggiunge la variazione col motivo come nota', voci.length === 2 && voci[1].nota === 'assegnazione del consorzio di ottobre' && voci[1].prima.target_annuo_t === 11550 && voci[1].variazione.t === 100);
  // il contratto scritto con la variazione: lo storico da solo, sui numeri di prima, la darebbe superata (parte 6)
  const elenco = A.variazioniDelContratto({ ...c, ...v.patch, storico_json: storico });
  verifica('l\'elenco delle variazioni dell\'anno', J(elenco) === J([{ il: '2026-10-14T10:00:00.000Z', da: 'Antonio Castellano', mese_idx: 9, regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14', mese: 'Ottobre', nel_mese: true, in_vigore: true, superata: null }]), J(elenco));
  verifica('un contratto senza variazioni ha l\'elenco vuoto', A.variazioniDelContratto(c).length === 0 && A.variazioniDelContratto(null).length === 0);
  verifica('la destinazione dal nome dell\'impianto', A.destinazioneDelContratto(c, 'IRIGOM SRL') === 'IRIGOM' && A.destinazioneDelContratto(c, 'T-CYCLE SRL') === 'T_CYCLE' && A.destinazioneDelContratto(c, 'GATIM SRL') === '');
}

console.log('2. L\'AVVISO E LA PROPOSTA DEL MESE');
if (REGOLE) {
  const c = contratto();
  const mens = (mese, raccoglitore, target, storico, extra = {}) => ({ id: `${raccoglitore}|${mese}`, anno: 2026, regione: 'Puglia', raccoglitore, impianto: 'IRIGOM SRL', mese, target, storico_json: J(storico), ...extra });
  const MENSILI = [
    // creati prima del contratto e cambiati solo d'impianto: non contano
    mens('Settembre', 'SMOCO S.r.l.', 170, [{ il: '2026-08-11T00:00:00Z', prima: null }, { il: '2026-10-04T10:32:13Z', prima: { target: 170, impianto: '' } }]),
    // la modifica dell'utente del 14/10: ottobre 170 -> 270
    mens('Ottobre', 'SMOCO S.r.l.', 270, [{ il: '2026-10-01T08:00:00Z', prima: null }, { il: '2026-10-14T09:00:00Z', prima: { target: 170, non_raccoglie: false } }]),
    // novembre scritto a inizio mese: un cambio, ma non di 100
    mens('Novembre', 'ALFA SRL', 60, [{ il: '2026-11-02T08:00:00Z', prima: null }]),
  ];
  const per = [{ regione: 'Puglia', annuo: 2600, mesi: 0, contratto: 2500 }, { regione: 'Campania', annuo: 4400.38, contratto: 4400 }, { regione: 'Sicilia', annuo: 4649.62, contratto: 4650 }, { regione: 'Molise', annuo: 30, contratto: null }];
  const s = A.scartiDalContratto(c, per, MENSILI);
  verifica('solo la Puglia: sotto mezza tonnellata e' + ' un arrotondamento, e senza contratto non si confronta', J(s.map(x => [x.regione, x.differenza_t])) === J([['Puglia', 100]]), J(s));
  const p = s[0] && s[0].proposta;
  verifica('si propone ottobre, dal cambio di 100 t di SMOCO del 14/10, con la destinazione IRIGOM', p && p.mese_idx === 9 && p.mese === 'Ottobre' && p.destinazione === 'IRIGOM' && p.cambi.length === 1 && p.cambi[0].prima_t === 170 && p.cambi[0].dopo_t === 270, J(p));
  // due raccoglitori +50 a ottobre: la somma del mese fa la differenza
  const due = [mens('Ottobre', 'SMOCO S.r.l.', 220, [{ il: '2026-10-14T09:00:00Z', prima: { target: 170 } }]), mens('Ottobre', 'BETA SRL', 80, [{ il: '2026-10-14T09:05:00Z', prima: { target: 30 } }])];
  const pd = A.scartiDalContratto(c, per, due)[0].proposta;
  verifica('due cambi di 50 t nello stesso mese: si propone quel mese', pd && pd.mese_idx === 9 && pd.cambi.length === 2 && pd.destinazione === 'IRIGOM', J(pd));
  // cambi in due mesi che non fanno la differenza: non si capisce, e non si propone niente
  const confusi = [mens('Ottobre', 'SMOCO S.r.l.', 230, [{ il: '2026-10-14T09:00:00Z', prima: { target: 170 } }]), mens('Novembre', 'SMOCO S.r.l.', 140, [{ il: '2026-10-14T09:00:00Z', prima: { target: 100 } }])];
  verifica('se non si capisce, il mese lo sceglie l\'amministratore', A.scartiDalContratto(c, per, confusi)[0].proposta === null);
  verifica('in meno: la differenza e\' negativa', A.scartiDalContratto(c, [{ regione: 'Puglia', annuo: 2450, contratto: 2500 }], [])[0].differenza_t === -50);
  // registrata la variazione, la Puglia fa il contratto e l'avviso sparisce
  const v = A.variazioneDelContratto(c, OTTOBRE);
  const dopo = { ...c, ...v.patch, storico_json: A.storicoConVariazione(c.storico_json, { il: '2026-10-14T10:00:00Z', da: 'Antonio', voce: v.voce, prima: v.prima }) };
  const perDopo = per.map(r => (r.regione === 'Puglia' ? { ...r, contratto: leggi(dopo.regioni_json)[1].target_t } : r));
  verifica('dopo la variazione la Puglia fa il contratto: nessun avviso', A.scartiDalContratto(dopo, perDopo, MENSILI).length === 0);
  // altre 100 t ai raccoglitori dopo: il cambio di ottobre gia' registrato non si ripropone
  const ancora = A.scartiDalContratto(dopo, [{ regione: 'Puglia', annuo: 2700, contratto: 2600 }], MENSILI)[0];
  verifica('un cambio gia\' registrato come variazione non si ripropone', ancora && ancora.differenza_t === 100 && ancora.proposta === null, J(ancora));
}

console.log('3. SULLA COPIA DEI DATI VERI');
const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
if (!REGOLE) {
  console.log('  Le regole delle variazioni non ci sono: parte saltata.');
} else if (!copie.length) {
  console.log(`  Nessuna copia dei dati veri in ${CARTELLA}: parte saltata.`);
} else {
  const copia = copie[copie.length - 1];
  const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copia)).toString('utf8'));
  const ORA = DATI.meta.letto_fino_al;
  const ANNO = 2026;
  const DELL_11_10 = copia === 'treadrider-dati-veri-2026-10-11.json.gz';
  console.log(`  Copia: ${copia}, letta il ${ORA}`);
  const vero = (DATI.archivi.CommessaEcotyre || []).filter(c => Number(c.anno) === ANNO).sort((a, b) => String(b.updated_date).localeCompare(String(a.updated_date)))[0];
  verifica('il contratto 2026 della copia', vero && Number(vero.target_annuo_t) > 0, J(vero && vero.id));

  // La modifica dell'utente del 14/10/2026, sopra la copia dell'11/10: SMOCO in
  // Puglia verso IRIGOM, annuo 1.850 -> 1.950 e ottobre 170 -> 270, con le voci
  // di storico che la scheda dei raccoglitori scrive (conModifica).
  const IL_UTENTE = '2026-10-14T08:30:00.000Z';
  const smoco = (r) => /^smoco/i.test(String(r.raccoglitore || '')) && r.regione === 'Puglia' && Number(r.anno) === ANNO;
  const annui = (DATI.archivi.TargetRaccoglitore || []).filter(r => Number(r.anno) === ANNO).map(r => (smoco(r)
    ? { ...r, target_tonnellate: Number(r.target_tonnellate) + 100, storico_json: J([...JSON.parse(r.storico_json || '[]'), { il: IL_UTENTE, da: 'Antonio Castellano', nota: '', prima: { target_tonnellate: r.target_tonnellate, attivo_dal: '' } }]) }
    : r));
  const mensili = (DATI.archivi.TargetMensile || []).filter(r => Number(r.anno) === ANNO).map(r => (smoco(r) && r.mese === 'Ottobre'
    ? { ...r, target: Number(r.target) + 100, storico_json: J([...JSON.parse(r.storico_json || '[]'), { il: IL_UTENTE, da: 'Antonio Castellano', nota: '', prima: { target: r.target, non_raccoglie: false } }]) }
    : r));
  const regioniContratto = JSON.parse(vero.regioni_json);
  const perRegione = regioniContratto.map(rc => ({ regione: rc.regione, annuo: annui.filter(a => a.regione === rc.regione).reduce((s, a) => s + (Number(a.target_tonnellate) || 0), 0), contratto: Number(rc.target_t) }));
  const totaleRaccoglitori = annui.reduce((s, a) => s + (Number(a.target_tonnellate) || 0), 0);
  const ottobreRaccoglitori = mensili.filter(m => m.mese === 'Ottobre' && !m.non_raccoglie).reduce((s, m) => s + (Number(m.target) || 0), 0);
  if (DELL_11_10) {
    verifica('come a video il 14/10: raccoglitori 11.650 t, ottobre 1.325, Puglia 2.600 contro 2.500, SMOCO 1.950 e 270',
      vicino(totaleRaccoglitori, 11650) && vicino(ottobreRaccoglitori, 1325) && vicino(perRegione.find(r => r.regione === 'Puglia').annuo, 2600)
      && annui.some(a => smoco(a) && a.target_tonnellate === 1950) && mensili.some(m => smoco(m) && m.mese === 'Ottobre' && m.target === 270),
      J([totaleRaccoglitori, ottobreRaccoglitori, perRegione]));
  }
  const scarti = A.scartiDalContratto(vero, perRegione, mensili);
  verifica('l\'avviso c\'e\' solo per la Puglia, +100 t, con ottobre e IRIGOM proposti', scarti.length === 1 && scarti[0].regione === 'Puglia' && vicino(scarti[0].differenza_t, 100)
    && scarti[0].proposta && scarti[0].proposta.mese === 'Ottobre' && scarti[0].proposta.destinazione === 'IRIGOM', J(scarti));

  // La variazione come la compila il pulsante dell'avviso, col motivo dell'utente.
  const s0 = scarti[0] || { regione: 'Puglia', differenza_t: 100, proposta: { mese_idx: 9, destinazione: 'IRIGOM' } };
  const variazione = { mese_idx: s0.proposta.mese_idx, regione: s0.regione, t: s0.differenza_t, destinazione: s0.proposta.destinazione, motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' };
  const esito = A.variazioneDelContratto(vero, variazione);
  verifica('la variazione si registra', esito.errori.length === 0, J(esito.errori));
  const nuovo = { ...vero, ...esito.patch, updated_date: '2026-10-14T10:00:00.000000', storico_json: A.storicoConVariazione(vero.storico_json, { il: '2026-10-14T10:00:00.000Z', da: 'Antonio Castellano', voce: esito.voce, prima: esito.prima }) };
  const mesiNuovi = JSON.parse(nuovo.target_mensile_json);
  verifica('il contratto: 11.650 t, Puglia 2.600, ottobre 1.200', vicino(nuovo.target_annuo_t, 11650) && vicino(JSON.parse(nuovo.regioni_json).find(r => r.regione === 'Puglia').target_t, 2600) && vicino(mesiNuovi[9], 1200),
    J([nuovo.target_annuo_t, nuovo.regioni_json, mesiNuovi]));
  const dest = JSON.parse(nuovo.destinazioni_json || '[]');
  verifica('e le destinazioni tornano col target annuo (IRIGOM 4.550)', dest.length === 0 || (vicino(dest.reduce((s, d) => s + (Number(d.target_t) || 0), 0), Number(nuovo.target_annuo_t)) && vicino(dest.find(d => d.destinazione === 'IRIGOM').target_t, 4550)), J(dest));
  verifica('dopo, la scheda dei raccoglitori non avvisa piu\'', A.scartiDalContratto(nuovo, perRegione.map(r => ({ ...r, contratto: JSON.parse(nuovo.regioni_json).find(x => x.regione === r.regione).target_t })), mensili).length === 0);

  // LA DASHBOARD VERA: getDashboardRaccolta intera sulla copia, prima e dopo.
  globalThis.__DATI_VERI = { ...DATI.archivi, TargetRaccoglitore: annui, TargetMensile: mensili };
  const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  const x = r[k];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v && !v.$in.includes(x)) return false;
    if ('$gte' in v && !(x != null && String(x) >= String(v.$gte))) return false;
    if ('$lte' in v && !(x != null && String(x) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return x === null || x === undefined || x === '';
  return x === v;
});
const ordina = (righe, sort) => { const campo = String(sort || 'id').replace(/^[-+]/, ''); const giu = String(sort || '').startsWith('-');
  return [...righe].sort((a, b) => { const x = a[campo], y = b[campo]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return giu ? -c : c; }); };
const entita = (nome) => ({
  list: async (sort, lim = 1e9, skip = 0) => ordina(globalThis.__DATI_VERI[nome] || [], sort).slice(skip, skip + lim),
  filter: async (f, sort, lim = 1e9, skip = 0) => ordina((globalThis.__DATI_VERI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim),
  get: async (id) => (globalThis.__DATI_VERI[nome] || []).find(r => r.id === id) || null,
  create: async (r) => r, update: async (_id, r) => r, bulkCreate: async (r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export const sdk = { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities,
  functions: { invoke: async (n) => { throw new Error('non disponibile nella prova: ' + n); } } };
export function createClientFromRequest() { return sdk; }`;
  const plug = { name: 'sdk-finto', setup(b) {
    b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
    b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
  } };
  const modulo = async (opzioni) => import('data:text/javascript;base64,' + Buffer.from((await build({ bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent', plugins: [plug], ...opzioni })).outputFiles[0].text).toString('base64'));
  const dashboard = await modulo({ entryPoints: [qui('../base44/functions/getDashboardRaccolta/entry.ts')] });
  const { sdk } = await modulo({ stdin: { contents: SDK_FINTO, loader: 'js' } });
  const { situazioneGestionale } = await modulo({ entryPoints: [qui('../base44/shared/assistente.ts')] });
  const OraVera = Date;
  const conOra = async (iso, f) => {
    const ms = OraVera.parse(iso);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };
  const conContratto = async (commessa) => {
    globalThis.__DATI_VERI.CommessaEcotyre = [commessa];
    const d = await conOra(ORA, async () => (await dashboard.default({ json: async () => ({ anno: [ANNO] }) })).json());
    const eco = await conOra(ORA, () => situazioneGestionale(sdk, String(ORA).slice(0, 10)));
    return { d, eco };
  };
  const prima = await conContratto(vero);
  const dopo = await conContratto(nuovo);
  const P = prima.d, D = dopo.d;
  verifica('la dashboard risponde, prima e dopo', P && P.kpi && D && D.kpi && P.quadro && D.quadro, J([P.error, D.error]));
  const puglia = (x) => (x.target_vs_raccolto || []).find(r => r.regione === 'Puglia') || {};
  const regioneQ = (x, reg) => (x.quadro.rete.regioni || []).find(r => r.regione === reg) || {};
  const quota = A.quotaAttesa(nuovo, ANNO, D.kpi.atteso && D.kpi.atteso.giorno);
  verifica('dashboard: target RETE 11.550 -> 11.650', P.kpi.target === Number(vero.target_annuo_t) && D.kpi.target === 11650, J([P.kpi.target, D.kpi.target]));
  verifica('il raccolto non cambia, la percentuale si', D.kpi.raccolto_rete_anno === P.kpi.raccolto_rete_anno && vicino(D.kpi.raggiungimento_pct, (D.kpi.raccolto_rete_anno / 11650) * 100, 1e-9));
  verifica('l\'atteso alla data e\' quello del contratto nuovo (target per la quota del profilo nuovo)', D.kpi.atteso && vicino(D.kpi.atteso.atteso_t, 11650 * quota, 1e-6) && vicino(D.kpi.atteso.scarto_t, D.kpi.raccolto_rete_anno - 11650 * quota, 1e-6), J(D.kpi.atteso));
  // Le 100 t sono tutte di ottobre e tutte della Puglia (revisione del
  // 14/10/2026): fino al giorno dei dati se ne attende la parte di ottobre gia'
  // passata, e solo in Puglia.
  const giorno = D.kpi.atteso && D.kpi.atteso.giorno;
  const partoOttobre = 100 * A.frazioneDelMese(ANNO, 9, giorno);
  verifica('l\'atteso del totale cresce solo della parte di ottobre passata (100 t per i giorni coperti)', vicino(D.kpi.atteso.atteso_t - P.kpi.atteso.atteso_t, partoOttobre, 1e-6), J([P.kpi.atteso, D.kpi.atteso, partoOttobre]));
  verifica('la Puglia della dashboard: contratto 2.500 -> 2.600', puglia(P).target === 2500 && puglia(D).target === 2600, J([puglia(P), puglia(D)]));
  const altre = (D.target_vs_raccolto || []).filter(r => r.regione !== 'Puglia');
  verifica('le altre regioni hanno lo stesso contratto e lo stesso raccolto', altre.length === 4 && altre.every(r => { const p = P.target_vs_raccolto.find(x => x.regione === r.regione) || {}; return p.target === r.target && p.raccolto === r.raccolto; }), J(altre));
  // Queste due dicono se getDashboardRaccolta usa attesoDellaRegione: il gruppo
  // D-M le aveva lasciate rosse apposta, fuori dai suoi file; la chiusura del
  // giro del 14/10/2026 ha portato la dashboard su attesoDellaRegione.
  verifica('dashboard (getDashboardRaccolta): la Puglia si attende solo la parte di ottobre passata', vicino(puglia(D).atteso, puglia(P).atteso + partoOttobre, 1e-6) && vicino(puglia(D).atteso, A.attesoDellaRegione(nuovo, ANNO, giorno, 'Puglia').atteso_t, 1e-6), J([puglia(P).atteso, puglia(D).atteso, partoOttobre]));
  verifica('dashboard (getDashboardRaccolta): le regioni non toccate hanno lo stesso atteso', altre.every(r => vicino(r.atteso, (P.target_vs_raccolto.find(x => x.regione === r.regione) || {}).atteso, 1e-6))
    && (dq0 => (dq0.regioni || []).filter(r => r.regione !== 'Puglia' && r.atteso_t !== undefined).every(r => vicino(r.atteso_t, (regioneQ(P, r.regione) || {}).atteso_t, 0.002)))(D.quadro.rete),
    J(altre.map(r => [r.regione, (P.target_vs_raccolto.find(x => x.regione === r.regione) || {}).atteso, r.atteso])));
  const pq = P.quadro.rete, dq = D.quadro.rete;
  verifica('il quadro: target, residuo, proiezione e ritmo si muovono col contratto', dq.target_t === 11650 && vicino(dq.residuo_t, 11650 - D.kpi.raccolto_rete_anno, 0.002)
    && dq.proiezione && vicino(dq.proiezione.t, D.kpi.raccolto_rete_anno / quota, 0.002) && vicino(dq.proiezione.pct_target, (D.kpi.raccolto_rete_anno / quota / 11650) * 100, 1e-6), J([dq.residuo_t, dq.proiezione, dq.ritmo]));
  verifica('il quadro mese per mese: ottobre 100 t in piu\', gli altri mesi come prima', vicino(dq.mesi[9].target_t, pq.mesi[9].target_t + 100, 0.002) && dq.mesi.every((m, i) => i === 9 || vicino(m.target_t, pq.mesi[i].target_t, 0.002)), J([pq.mesi[9], dq.mesi[9], pq.mesi[8], dq.mesi[8]]));
  verifica('la regione del quadro: Puglia 2.600', regioneQ(D, 'Puglia').target_t === 2600 && regioneQ(P, 'Puglia').target_t === 2500);
  verifica('il profilo del contratto ora somma 100 t in piu\'', vicino(dq.profilo.somma_t, pq.profilo.somma_t + 100, 0.002), J([pq.profilo, dq.profilo]));

  // ECOTYNA: il riepilogo della commessa che passa al modello.
  const riga = (testo, inizio) => String(testo).split('\n').find(r => r.startsWith(inizio)) || '';
  verifica('EcoTyna: target annuo 11.650,00 t e la Puglia a 2.600,00 t', /target annuo 11\.650,00 t/.test(riga(dopo.eco, 'Contratto Ecotyre')) && /contratto 2\.600,00 t/.test(riga(dopo.eco, '- Puglia:'))
    && /target annuo 11\.550,00 t/.test(riga(prima.eco, 'Contratto Ecotyre')) && /contratto 2\.500,00 t/.test(riga(prima.eco, '- Puglia:')), `${riga(dopo.eco, 'Contratto Ecotyre')} | ${riga(dopo.eco, '- Puglia:')}`);
  // Come la dashboard: dice se assistente.ts usa attesoDellaRegione (portato dalla chiusura del giro, 14/10/2026).
  verifica('EcoTyna (assistente.ts): le regioni non toccate dicono lo stesso atteso', ['Campania', 'Basilicata', 'Calabria', 'Sicilia'].every(r => riga(prima.eco, `- ${r}:`) && riga(prima.eco, `- ${r}:`) === riga(dopo.eco, `- ${r}:`)),
    `${riga(prima.eco, '- Campania:')} | ${riga(dopo.eco, '- Campania:')}`);

  // L'ANDAMENTO DI TARGET & STATUS: le card e la tabella per regione e
  // contratto si fanno con targetAnnuoDellAnno, regioniDellAnno e
  // attesoDellaRegione sul contratto della pagina (TargetStatus.jsx,
  // AndamentoRegioni e kpis).
  const giornoDati = D.kpi.atteso.giorno;
  const raccoltoDi = (reg) => (D.target_vs_raccolto.find(r => r.regione === reg) || {}).raccolto;
  // senza attesoDellaRegione (il codice di prima della revisione) la pagina faceva regione per quota del totale
  const attesoRegione = (commessa, r) => (ci('attesoDellaRegione') ? A.attesoDellaRegione(commessa, ANNO, giornoDati, r.regione) : A.attesoAllaData(commessa, ANNO, giornoDati, r.target_t)).atteso_t;
  const andamento = (commessa) => {
    const target = A.targetAnnuoDellAnno(commessa, ANNO).t;
    const regioni = A.regioniDellAnno(commessa, ANNO).righe.map(r => ({ regione: r.regione, contratto: r.target_t, atteso: attesoRegione(commessa, r) }));
    const reg = regioni.find(r => r.regione === 'Puglia');
    const raccPuglia = raccoltoDi('Puglia');
    return { target, residuo: target - D.kpi.raccolto_rete_anno, regioni, puglia: reg.contratto, pctPuglia: (raccPuglia / reg.contratto) * 100, attesoPuglia: reg.atteso, scartoPuglia: raccPuglia - reg.atteso, ottobre: JSON.parse(commessa.target_mensile_json)[9] };
  };
  const ap = andamento(vero), ad = andamento(nuovo);
  verifica('Andamento: card del target 11.650, residuo 100 t in piu\', Puglia 2.600 che si attende solo la parte di ottobre passata', ad.target === 11650 && vicino(ad.residuo - ap.residuo, 100, 1e-6) && ad.puglia === 2600 && vicino(ad.attesoPuglia - ap.attesoPuglia, partoOttobre, 1e-6), J([ap, ad]));
  verifica('Andamento: le altre quattro regioni hanno lo stesso atteso di prima', ad.regioni.filter(r => r.regione !== 'Puglia').length === 4 && ad.regioni.filter(r => r.regione !== 'Puglia').every(r => vicino(r.atteso, ap.regioni.find(x => x.regione === r.regione).atteso, 1e-9)), J([ap.regioni, ad.regioni]));
  verifica('Andamento: prima della variazione l\'atteso per regione e\' quello della dashboard', ap.regioni.every(r => vicino(r.atteso, (P.target_vs_raccolto.find(x => x.regione === r.regione) || {}).atteso, 1e-6)), J(ap.regioni));
  verifica('le regioni sommano l\'atteso del totale, prima e dopo', vicino(ap.regioni.reduce((s, r) => s + r.atteso, 0), P.kpi.atteso.atteso_t, 1e-6) && vicino(ad.regioni.reduce((s, r) => s + r.atteso, 0), D.kpi.atteso.atteso_t, 1e-6),
    J([ap.regioni.reduce((s, r) => s + r.atteso, 0), P.kpi.atteso.atteso_t, ad.regioni.reduce((s, r) => s + r.atteso, 0), D.kpi.atteso.atteso_t]));
  verifica('Report generale e scheda dei raccoglitori: ottobre del contratto 1.200, «Affidato meno contratto» di ottobre 1.325 - 1.200', ad.ottobre === 1200 && (!DELL_11_10 || vicino(ottobreRaccoglitori - ad.ottobre, 125)), J([ad.ottobre, ottobreRaccoglitori]));

  const elenco = [
    ['Target annuo del contratto (dashboard, Andamento, EcoTyna)', t(P.kpi.target), t(D.kpi.target)],
    ['Raccolto RETE nell\'anno', t(P.kpi.raccolto_rete_anno), t(D.kpi.raccolto_rete_anno)],
    ['% del target', pc(P.kpi.raggiungimento_pct), pc(D.kpi.raggiungimento_pct)],
    [`Atteso al ${giornoDati.split('-').reverse().join('/')}`, t(Math.round(P.kpi.atteso.atteso_t * 100) / 100), t(Math.round(D.kpi.atteso.atteso_t * 100) / 100)],
    ['Scarto sull\'atteso', conSegno(Math.round(P.kpi.atteso.scarto_t * 100) / 100), conSegno(Math.round(D.kpi.atteso.scarto_t * 100) / 100)],
    ['Residuo dell\'anno', t(Math.round(pq.residuo_t * 100) / 100), t(Math.round(dq.residuo_t * 100) / 100)],
    ['Proiezione a fine anno', `${t(Math.round(pq.proiezione.t * 100) / 100)} (${pc(pq.proiezione.pct_target)})`, `${t(Math.round(dq.proiezione.t * 100) / 100)} (${pc(dq.proiezione.pct_target)})`],
    ['Ritmo che serve, t al mese', pq.ritmo ? t(Math.round(pq.ritmo.servono_t_mese * 100) / 100) : '—', dq.ritmo ? t(Math.round(dq.ritmo.servono_t_mese * 100) / 100) : '—'],
    ['Ottobre nel quadro (profilo riportato all\'annuo)', t(Math.round(pq.mesi[9].target_t * 100) / 100), t(Math.round(dq.mesi[9].target_t * 100) / 100)],
    ['Ottobre, target mensile rivisto del contratto', t(ap.ottobre), t(ad.ottobre)],
    ['Puglia: contratto', t(ap.puglia), t(ad.puglia)],
    ['Puglia: % del contratto', pc(ap.pctPuglia), pc(ad.pctPuglia)],
    ['Puglia: atteso', t(Math.round(ap.attesoPuglia * 100) / 100), t(Math.round(ad.attesoPuglia * 100) / 100)],
    ['Puglia: scarto sull\'atteso', conSegno(Math.round(ap.scartoPuglia * 100) / 100), conSegno(Math.round(ad.scartoPuglia * 100) / 100)],
    ...ad.regioni.filter(r => r.regione !== 'Puglia').map(r => {
      const p = ap.regioni.find(x => x.regione === r.regione);
      return [`${r.regione}: atteso e scarto (Andamento)`, `${t(Math.round(p.atteso * 100) / 100)} / ${conSegno(Math.round((raccoltoDi(r.regione) - p.atteso) * 100) / 100)}`, `${t(Math.round(r.atteso * 100) / 100)} / ${conSegno(Math.round((raccoltoDi(r.regione) - r.atteso) * 100) / 100)}`];
    }),
    ['Dashboard, atteso della Puglia (getDashboardRaccolta)', t(Math.round(puglia(P).atteso * 100) / 100), t(Math.round(puglia(D).atteso * 100) / 100)],
  ];
  console.log('  I numeri, prima e dopo la variazione di ottobre in Puglia (+100 t):');
  for (const [cosa, p, d] of elenco) console.log(`    ${cosa}: ${p} -> ${d}`);
  if (DELL_11_10) {
    // I numeri del progetto sulla copia dell'11/10/2026 (dashboardDatiVeri):
    // 8.818,55 t raccolte, atteso 8.689,23, scarto +129,32, proiezione 11.721,90.
    verifica('prima, i numeri del progetto sulla copia dell\'11/10', vicino(P.kpi.raccolto_rete_anno, 8818.55, 0.01) && vicino(P.kpi.atteso.atteso_t, 8689.23, 0.01) && vicino(pq.proiezione.t, 11721.9, 0.01), J([P.kpi.raccolto_rete_anno, P.kpi.atteso.atteso_t, pq.proiezione.t]));
  }
}

console.log('4. LA FINESTRA, L\'ELENCO E L\'AVVISO DISEGNATI');
{
  const ESTENSIONI = ['', '.js', '.jsx', '.ts'];
  const daAlias = (p) => { const base = qui('../src/' + p.slice(2)); return ESTENSIONI.map(e => base + e).find(existsSync) || base; };
  const CLIENT_FINTO = 'export const base44 = { entities: new Proxy({}, { get: () => ({ filter: async () => [] }) }), auth: { me: async () => ({}) } };';
  const percorso = qui('../src/components/target-status/VariazioneContratto.jsx');
  const INGRESSO = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.browser';
import VariazioneContratto, { ElencoVariazioni, AvvisiScarti, RigheVariazione, inizialeDaScarto, avvisoVariazioniChiuse } from ${JSON.stringify(percorso)};
export { inizialeDaScarto, avvisoVariazioniChiuse };
export const elenco = (p) => renderToStaticMarkup(React.createElement(ElencoVariazioni, p));
export const avvisi = (p) => renderToStaticMarkup(React.createElement(AvvisiScarti, p));
export const righe = (p) => renderToStaticMarkup(React.createElement(RigheVariazione, p));
export const finestra = VariazioneContratto;
`;
  let R = null;
  globalThis.window = globalThis.window || { self: 1, top: 1 };
  try {
    const pacchetto = await build({
      stdin: { contents: INGRESSO, resolveDir: qui('.'), loader: 'js' },
      bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
      loader: { '.jsx': 'jsx', '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'finti', setup(b) {
        b.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: 'client', namespace: 'client-finto' }));
        b.onLoad({ filter: /.*/, namespace: 'client-finto' }, () => ({ contents: CLIENT_FINTO, loader: 'js' }));
        b.onResolve({ filter: /^@\// }, (args) => ({ path: daAlias(args.path) }));
      } }],
    });
    R = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
  } catch (e) { verifica('la finestra della variazione si impacchetta', false, String(e && e.message).slice(0, 300)); }
  if (R) {
    const variazioni = [{ il: '2026-10-14T08:40:00.000Z', da: 'Antonio Castellano', mese_idx: 9, mese: 'Ottobre', regione: 'Puglia', t: 100, destinazione: 'IRIGOM', motivo: 'assegnazione del consorzio di ottobre', comunicata_il: '2026-10-14' }];
    const html = R.elenco({ variazioni, anno: 2026, targetAnnuo: 11650 });
    verifica('l\'elenco: giorno, mese, regione, +100,00 t, destinazione e motivo', html.includes('14/10/2026') && html.includes('Ottobre') && html.includes('Puglia') && html.includes('+100,00 t') && html.includes('IRIGOM') && html.includes('assegnazione del consorzio di ottobre') && html.includes('Antonio Castellano'), html.slice(0, 400));
    verifica('e dice il target senza le variazioni', html.includes('Il target annuo del contratto è 11.650,00 t: senza le variazioni sarebbe 11.550,00 t'), html.slice(-500));
    verifica('senza variazioni lo dice', /Nessuna variazione registrata nel 2026/.test(R.elenco({ variazioni: [], anno: 2026 })));
    const scarto = { regione: 'Puglia', contratto_t: 2500, raccoglitori_t: 2600, differenza_t: 100, proposta: { mese_idx: 9, mese: 'Ottobre', destinazione: 'IRIGOM', cambi: [{ il: '2026-10-14T08:30:00.000Z', mese_idx: 9, raccoglitore: 'SMOCO S.r.l.', impianto: 'IRIGOM SRL', prima_t: 170, dopo_t: 270, delta_t: 100 }] } };
    const av = R.avvisi({ scarti: [scarto], isAdmin: true, onRegistra: () => {} });
    verifica('l\'avviso dei raccoglitori, con le parole della richiesta', av.replace(/<[^>]+>/g, '').includes('I raccoglitori della Puglia hanno 100,00 t più del contratto (2.600,00 t contro 2.500,00 t): se è una variazione del consorzio, registrala nel contratto'), av.replace(/<[^>]+>/g, '').slice(0, 300));
    verifica('dice da dove viene il mese proposto', av.includes('A ottobre il target di SMOCO S.r.l. è passato da 170,00 t a 270,00 t il 14/10/2026'), av.replace(/<[^>]+>/g, '').slice(0, 500));
    verifica('per l\'amministratore c\'e\' il pulsante, per gli altri no', av.includes('Registra la variazione') && !R.avvisi({ scarti: [scarto], isAdmin: false }).includes('Registra la variazione') && R.avvisi({ scarti: [scarto], isAdmin: false }).includes('La registra l&#x27;amministratore'));
    const meno = R.avvisi({ scarti: [{ ...scarto, regione: 'Calabria', differenza_t: -50, raccoglitori_t: 1600, contratto_t: 1650, proposta: null }], isAdmin: true });
    verifica('in meno: assegnale ai raccoglitori o registra la riduzione', meno.replace(/<[^>]+>/g, '').includes('I raccoglitori della Calabria hanno 50,00 t meno del contratto') && meno.includes('assegnale ai raccoglitori'));
    verifica('nessuno scarto, nessun avviso', R.avvisi({ scarti: [], isAdmin: true }) === '');
    verifica('il pulsante compila regione, verso, tonnellate, mese e destinazione', J(R.inizialeDaScarto(scarto)) === J({ regione: 'Puglia', verso: 'piu', t: '100', mese_idx: '9', destinazione: 'IRIGOM' }) && R.inizialeDaScarto({ ...scarto, differenza_t: -12.5, proposta: null }).t === '12,5' && R.inizialeDaScarto({ ...scarto, differenza_t: -12.5, proposta: null }).verso === 'meno');
    const rr = R.righe({ righe: [{ cosa: 'Target annuo', prima_t: 11550, dopo_t: 11650 }] });
    verifica('l\'anteprima prima e dopo', rr.includes('11.550,00 t') && rr.includes('11.650,00 t'));

    // La revisione del 14/10/2026: una variazione superata resta barrata, con chi
    // l'ha superata, e fuori dai totali.
    const testo = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ');
    const superata = { ...variazioni[0], in_vigore: false, superata: { il: '2026-10-20T09:00:00.000Z', da: 'Antonio Castellano', nota: 'importato da contratto-ecotyre.xlsx' } };
    const hs = R.elenco({ variazioni: [superata], anno: 2026, targetAnnuo: 11550 });
    verifica('una variazione superata: barrata, con chi l\'ha superata, e niente «senza le variazioni sarebbe»', hs.includes('line-through') && testo(hs).includes('Non più nel contratto: riscritto il 20/10/2026 da Antonio Castellano (importato da contratto-ecotyre.xlsx)')
      && !testo(hs).includes('senza le variazioni sarebbe') && !testo(hs).includes('già nel target annuo') && testo(hs).includes('Il contratto di oggi non comprende nessuna variazione registrata') && testo(hs).includes('Quella barrata non è più nei numeri del contratto'), testo(hs).slice(-700));
    const misto = testo(R.elenco({ variazioni: [superata, { ...variazioni[0], il: '2026-10-21T08:00:00.000Z', mese_idx: 10, mese: 'Novembre', t: 50, in_vigore: true, superata: null }], anno: 2026, targetAnnuo: 11600 }));
    verifica('nei totali solo quelle in vigore', misto.includes('In tutto +50,00 t') && misto.includes('senza le variazioni sarebbe 11.550,00 t'), misto.slice(-700));
    verifica('l\'avviso della scheda prima di salvare', R.avvisoVariazioniChiuse([{ mese: 'Ottobre', regione: 'Puglia', t: 100 }]).startsWith('Salvando così, la variazione di ottobre in Puglia (+100,00 t) esce dai numeri del contratto') && R.avvisoVariazioniChiuse([]) === '');
    // Il caso del revisore (r2): registrata la variazione, si importa e si salva il
    // foglio di inizio anno (11.550, Puglia 2.500, ottobre 1.100) come fa la scheda.
    if (REGOLE) {
      const c = contratto();
      const v = A.variazioneDelContratto(c, OTTOBRE);
      const registrata = { ...c, ...v.patch, storico_json: A.storicoConVariazione(c.storico_json, { il: '2026-10-14T10:00:00.000Z', da: 'Antonio Castellano', voce: v.voce, prima: v.prima }) };
      const campi = ['target_annuo_t', 'regioni_json', 'target_mensile_json', 'destinazioni_json'];
      const salvata = { ...registrata, target_annuo_t: 11550, regioni_json: c.regioni_json, target_mensile_json: c.target_mensile_json, destinazioni_json: c.destinazioni_json,
        storico_json: J([...JSON.parse(registrata.storico_json), { il: '2026-10-20T09:00:00.000Z', da: 'Antonio Castellano', nota: 'importato da contratto-ecotyre.xlsx', prima: Object.fromEntries(campi.map(k => [k, registrata[k]])) }]) };
      const dopoImport = testo(R.elenco({ variazioni: A.variazioniDelContratto(salvata), anno: 2026, targetAnnuo: salvata.target_annuo_t }));
      verifica('il foglio di inizio anno salvato dopo la variazione: la scheda non dice piu\' che la comprende', !/senza le variazioni sarebbe 11\.450,00 t/.test(dopoImport) && !dopoImport.includes('già nel target annuo') && dopoImport.includes('Non più nel contratto: riscritto il 20/10/2026'), dopoImport.slice(-700));
    }
  }
}

console.log('5. IL SORGENTE');
{
  const sorgente = (p) => readFileSync(qui('../' + p), 'utf8').replace(/\r/g, '');
  const senzaCommenti = (s) => s.split('\n').filter(r => !r.trim().startsWith('//')).join('\n');
  const finestra = existsSync(qui('../src/components/target-status/VariazioneContratto.jsx')) ? senzaCommenti(sorgente('src/components/target-status/VariazioneContratto.jsx')) : '';
  verifica('la finestra rilegge il contratto dell\'anno e ci applica la variazione', /commessaDellAnno\(await base44\.entities\.CommessaEcotyre\.filter\(\{ anno \}\), anno\)/.test(finestra) && /variazioneDelContratto\(fresca, variazione\(\)\)/.test(finestra));
  verifica('e scrive una volta sola, dallo storico delle modifiche, con la voce nello storico della commessa', (finestra.match(/scriviConTraccia\(/g) || []).length === 1 && /scriviConTraccia\('CommessaEcotyre', fresca\.id, \{ \.\.\.esito\.patch, storico_json \}/.test(finestra) && /storicoConVariazione\(fresca\.storico_json/.test(finestra) && /avvisoTraccia\(scritta\)/.test(finestra));
  const modulo = senzaCommenti(sorgente('src/components/target-status/CommessaEcotyreForm.jsx'));
  verifica('la scheda Commessa: l\'elenco, e il pulsante solo per l\'amministratore, fermo con modifiche non salvate', /<ElencoVariazioni variazioni=\{variazioni\}/.test(modulo) && /\{isAdmin && record && \(\s*<div[^>]*>\s*<Button[^>]*onClick=\{\(\) => setVariazioneAperta\(true\)\} disabled=\{modificato\}/.test(modulo) && /\{isAdmin && record && \(\s*<VariazioneContratto /.test(modulo));
  const griglia = senzaCommenti(sorgente('src/components/target-status/TargetRaccoglitoriGrid.jsx'));
  verifica('la scheda dei raccoglitori: l\'avviso sulle righe della tabella per regione, e la finestra gia\' compilata', /scartiDalContratto\(commessa, perRegione, mensili\)/.test(griglia) && /<AvvisiScarti scarti=\{scarti\} isAdmin=\{isAdmin\} onRegistra=\{\(s\) => setVariazione\(inizialeDaScarto\(s\)\)\} \/>/.test(griglia) && /\{isAdmin && commessa && \(\s*<VariazioneContratto [^>]*iniziale=\{variazione\}/.test(griglia));
  const pagina = senzaCommenti(sorgente('src/pages/TargetStatus.jsx'));
  verifica('l\'Andamento dice le variazioni comprese nel contratto', /variazioniDelContratto\(commessa\)/.test(pagina) && /comprende le variazioni del consorzio/.test(pagina));
  // la revisione del 14/10/2026
  verifica('l\'Andamento: l\'atteso di ogni regione con attesoDellaRegione, e solo le variazioni in vigore', /attesoDellaRegione\(commessa, anno, giornoDati, r\.regione\)/.test(pagina) && !/attesoAllaData\(/.test(pagina) && /variazioniDelContratto\(commessa\)\.filter\(v => v\.in_vigore\)/.test(pagina));
  verifica('la scheda Commessa dice prima di salvare, e all\'import, le variazioni che escono dai numeri', /const valori = valoriDa\(dati, anno\);/.test(modulo) && /variazioniCheSiChiudono\(record, valoriDa\(dati, anno\)\)/.test(modulo)
    && /variazioniCheSiChiudono\(record, valoriDa\(statoDaContratto\(contratto\), anno\)\)/.test(modulo) && /\{escono && /.test(modulo));
}

console.log('6. LA REVISIONE DEL 14/10/2026: L\'ATTESO PER REGIONE E LE VARIAZIONI SUPERATE');
verifica('attesoContratto ha attesoDellaRegione e variazioniCheSiChiudono', ci('attesoDellaRegione') && ci('variazioniCheSiChiudono'), Object.keys(A).join(', '));
if (REGOLE && ci('attesoDellaRegione') && ci('variazioniCheSiChiudono')) {
  const c = contratto();
  const v = A.variazioneDelContratto(c, OTTOBRE);
  const dopo = { ...c, ...v.patch, storico_json: A.storicoConVariazione(c.storico_json, { il: '2026-10-14T10:00:00.000Z', da: 'Antonio Castellano', voce: v.voce, prima: v.prima }) };
  const REG = ['Campania', 'Puglia', 'Sicilia'];
  const at = (com, g, r) => A.attesoDellaRegione(com, 2026, g, r).atteso_t;
  const tot = (com, g) => A.attesoAllaData(com, 2026, g).atteso_t;
  // Senza variazioni la regola e' quella di prima: il target della regione per la quota del contratto.
  for (const g of ['2026-03-15', '2026-10-08', '2026-12-31']) {
    verifica(`senza variazioni, al ${g}, l'atteso di ogni regione e' quello di prima`, REG.every(r => vicino(at(c, g, r), A.attesoAllaData(c, 2026, g, JSON.parse(c.regioni_json).find(x => x.regione === r).target_t).atteso_t, 1e-9)));
  }
  // Con la variazione: le 100 t si attendono tutte a ottobre e tutte in Puglia.
  for (const [g, parte] of [['2026-09-30', 0], ['2026-10-08', (100 * 8) / 31], ['2026-10-31', 100], ['2026-11-20', 100]]) {
    verifica(`al ${g}: la Puglia ${conSegno(Math.round(parte * 100) / 100)} t, Campania e Sicilia come prima, il totale come la Puglia`, vicino(at(dopo, g, 'Puglia') - at(c, g, 'Puglia'), parte, 1e-6)
      && vicino(at(dopo, g, 'Campania'), at(c, g, 'Campania'), 1e-9) && vicino(at(dopo, g, 'Sicilia'), at(c, g, 'Sicilia'), 1e-9) && vicino(tot(dopo, g) - tot(c, g), parte, 1e-6),
      J([at(c, g, 'Puglia'), at(dopo, g, 'Puglia'), at(c, g, 'Campania'), at(dopo, g, 'Campania'), tot(c, g), tot(dopo, g)]));
    verifica(`al ${g}: le regioni sommano il totale`, vicino(REG.reduce((s, r) => s + at(dopo, g, r), 0), tot(dopo, g), 1e-6));
  }
  verifica('a fine anno la Puglia si attende tutto il suo contratto, 2.600 t, e il totale 11.650', vicino(at(dopo, '2026-12-31', 'Puglia'), 2600, 1e-6) && vicino(tot(dopo, '2026-12-31'), 11650, 1e-6));
  const pr = A.attesoDellaRegione(dopo, 2026, '2026-10-08', ' puglia ');
  verifica('attesoDellaRegione dice contratto e variazioni della regione, senza badare a maiuscole e spazi', pr.target_t === 2600 && pr.variazioni_t === 100 && pr.giorno === '2026-10-08' && vicino(pr.quota * 2600, pr.atteso_t, 1e-9), J(pr));
  verifica('una regione che il contratto non ha, o nessun giorno dei dati: nessun atteso', A.attesoDellaRegione(dopo, 2026, '2026-10-08', 'Molise').atteso_t === null && at(dopo, '', 'Puglia') === null);
  verifica('senza contratto il riparto di ripiego, in dodicesimi', vicino(at(null, '2026-06-30', 'Puglia'), 2500 * 0.5, 1e-9));
  const pesiPrima = A.profiloMensile(c).pesi, pesiDopo = A.profiloMensile(dopo).pesi;
  verifica('il profilo del totale: ottobre 100 t in piu\', gli altri mesi come prima, e somma 1', vicino(11650 * pesiDopo[9], 11550 * pesiPrima[9] + 100, 1e-6)
    && pesiDopo.every((p, i) => i === 9 || vicino(11650 * p, 11550 * pesiPrima[i], 1e-6)) && vicino(pesiDopo.reduce((s, p) => s + p, 0), 1, 1e-12));
  // Senza target mensile rivisto: il resto del contratto in dodicesimi, la variazione nel suo mese.
  const piatto = contratto({ target_mensile_json: J(Array(12).fill(null)) });
  const vp = A.variazioneDelContratto(piatto, OTTOBRE);
  const piattoDopo = { ...piatto, ...vp.patch, storico_json: A.storicoConVariazione(piatto.storico_json, { il: '2026-10-14T10:00:00.000Z', da: 'x', voce: vp.voce, prima: vp.prima }) };
  verifica('senza profilo: a fine settembre 9/12 del contratto di prima, a fine ottobre 10/12 piu\' le 100 t', vicino(tot(piattoDopo, '2026-09-30'), (11550 * 9) / 12, 1e-6) && vicino(tot(piattoDopo, '2026-10-31'), (11550 * 10) / 12 + 100, 1e-6)
    && vicino(at(piattoDopo, '2026-10-31', 'Puglia'), (2500 * 10) / 12 + 100, 1e-6) && A.variazioniDelContratto(piattoDopo)[0].nel_mese === false);

  // LE VARIAZIONI SUPERATE: il salvataggio della scheda Commessa scrive i valori
  // nuovi e mette nello storico tutti i campi di prima (CommessaEcotyreForm.salva).
  const CAMPI = ['target_annuo_t', 'regioni_json', 'classi_json', 'target_mensile_iniziale_json', 'target_mensile_json', 'budget_rete_json', 'budget_aci_json', 'destinazioni_json', 'target_prezzo_regioni_json'];
  const salva = (rec, valori, nota, letto = rec) => ({ ...rec, ...valori, storico_json: J([...JSON.parse(rec.storico_json), { il: '2026-10-20T09:00:00.000Z', da: 'Antonio Castellano', nota, prima: Object.fromEntries(CAMPI.map(k => [k, letto[k] ?? null])) }]) });
  const stato = (x) => A.variazioniDelContratto(x).map(y => (y.in_vigore ? 'in vigore' : `superata: ${y.superata.nota}`));
  const foglioVecchio = { target_annuo_t: 11550, regioni_json: c.regioni_json, target_mensile_json: c.target_mensile_json, destinazioni_json: c.destinazioni_json };
  const s1 = salva(dopo, foglioVecchio, 'importato da contratto-ecotyre.xlsx');
  const v1 = A.variazioniDelContratto(s1)[0];
  verifica('il foglio di inizio anno salvato dopo: la variazione e\' superata da quel salvataggio', J(stato(s1)) === J(['superata: importato da contratto-ecotyre.xlsx']) && v1.superata.il === '2026-10-20T09:00:00.000Z' && v1.superata.da === 'Antonio Castellano', J(v1));
  verifica('e l\'atteso e\' quello del contratto scritto, senza togliere 100 t che non ci sono piu\'', vicino(tot(s1, '2026-10-08'), tot(c, '2026-10-08'), 1e-9) && REG.every(r => vicino(at(s1, '2026-10-08', r), at(c, '2026-10-08', r), 1e-9)));
  verifica('la scheda lo dice prima di salvare', J(A.variazioniCheSiChiudono(dopo, foglioVecchio).map(x => [x.mese, x.regione, x.t])) === J([['Ottobre', 'Puglia', 100]]));
  const foglioNuovo = { target_annuo_t: 11650, regioni_json: dopo.regioni_json, target_mensile_json: dopo.target_mensile_json, destinazioni_json: dopo.destinazioni_json };
  verifica('un foglio che la comprende non la tocca', J(stato(salva(dopo, foglioNuovo, 'foglio rivisto'))) === J(['in vigore']) && A.variazioniCheSiChiudono(dopo, foglioNuovo).length === 0);
  const campania = J(JSON.parse(dopo.regioni_json).map(r => (r.regione === 'Campania' ? { ...r, target_t: 4450 } : r)));
  verifica('una correzione di un\'altra regione e del target annuo non la tocca', J(stato(salva(dopo, { target_annuo_t: 11700, regioni_json: campania }, 'Campania corretta'))) === J(['in vigore']));
  const ottobreAMano = J(JSON.parse(dopo.target_mensile_json).map((x, i) => (i === 9 ? 1150 : x)));
  verifica('ottobre riscritto a mano: superata', J(stato(salva(dopo, { target_mensile_json: ottobreAMano }, 'ottobre a mano'))) === J(['superata: ottobre a mano']));
  // una scheda letta prima della variazione e salvata dopo riscrive tutti i campi com'erano
  const vecchia = { ...Object.fromEntries(CAMPI.map(k => [k, c[k] ?? null])), budget_rete_json: J(Array(12).fill(900)) };
  verifica('una scheda aperta prima della variazione e salvata dopo: superata', J(stato(salva(dopo, vecchia, 'budget', c))) === J(['superata: budget']));
  verifica('i numeri cambiati senza passare dallo storico: superata, senza dire da chi', (x => x.in_vigore === false && J(x.superata) === J({ il: '', da: '', nota: '' }))(A.variazioniDelContratto({ ...dopo, regioni_json: c.regioni_json })[0]));
  const impianti = { ...dopo, fine_programmazione: '2026-12-15', storico_json: J([...JSON.parse(dopo.storico_json), { il: '2026-10-21T08:00:00Z', da: 'x', nota: 'fine della programmazione e chili per viaggio', prima: { target_annuo_t: 11650, fine_programmazione: null, kg_per_viaggio: null } }]) };
  verifica('le regole della predittivita\' salvate dopo non la toccano', J(stato(impianti)) === J(['in vigore']));
  // una seconda variazione in Puglia, in meno a novembre: tutte e due in vigore, ognuna nel suo mese
  const v2 = A.variazioneDelContratto(dopo, { ...OTTOBRE, mese_idx: 10, t: -30, destinazione: '', motivo: 'riduzione di novembre' });
  const due = { ...dopo, ...v2.patch, storico_json: A.storicoConVariazione(dopo.storico_json, { il: '2026-11-02T10:00:00.000Z', da: 'x', voce: v2.voce, prima: v2.prima }) };
  verifica('due variazioni in Puglia: tutte e due in vigore, ognuna nel suo mese, la Campania ferma', J(stato(due)) === J(['in vigore', 'in vigore']) && vicino(at(due, '2026-10-31', 'Puglia') - at(c, '2026-10-31', 'Puglia'), 100, 1e-6)
    && vicino(at(due, '2026-11-30', 'Puglia') - at(c, '2026-11-30', 'Puglia'), 70, 1e-6) && vicino(at(due, '2026-11-30', 'Campania'), at(c, '2026-11-30', 'Campania'), 1e-9));
  // l'avviso dei raccoglitori: una variazione superata non spiega piu' il cambio, e il mese torna a proporsi
  const MENS = [{ id: 'o', anno: 2026, regione: 'Puglia', raccoglitore: 'SMOCO S.r.l.', impianto: 'IRIGOM SRL', mese: 'Ottobre', target: 270, storico_json: J([{ il: '2026-10-01T08:00:00Z', prima: null }, { il: '2026-10-14T09:00:00Z', prima: { target: 170 } }]) }];
  const sc = A.scartiDalContratto(s1, [{ regione: 'Puglia', annuo: 2600, contratto: 2500 }], MENS)[0];
  verifica('superata la variazione, l\'avviso della Puglia torna e ripropone ottobre', sc && sc.differenza_t === 100 && sc.proposta && sc.proposta.mese === 'Ottobre', J(sc));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

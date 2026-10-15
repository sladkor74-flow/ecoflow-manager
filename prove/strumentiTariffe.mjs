// Prova dello strumento TARIFFE di EcoTyna: quando una tariffa vale oggi (chiusura
// dell'audit, 11/10/2026).
//
// La regola e' una sola, tariffaValeIl di base44/shared/validitaTariffa.ts: lo
// stato 'non_attivo' vuol dire «non deve valere mai», lo stato vuoto e' 'attivo',
// e il giorno sta fra inizio e fine di validita', estremi compresi. Lo strumento
// aveva la sua: leggeva solo stato 'attivo' (e perdeva lo stato vuoto) e una
// tariffa 'non_attivo' dentro le sue date risultava «vale oggi», mentre la
// fattura non la usa in nessun giorno.
// npm run prove
const R = new URL('../base44/shared/', import.meta.url).href;
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');
const { oggiRoma } = await import(R + 'giornoItaliano.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const oggi = oggiRoma();
const anno = Number(oggi.slice(0, 4));
const T = (id, extra) => ({ id, direzione: 'ATTIVA', prestazione: 'RACCOLTA', tipologia: 'RETE', cliente: 'ECOTYRE', unita_misura: '€/t', ...extra });
const TARIFFE = [
  // Una disattivata dentro le sue date, per prima: con la vecchia regola «vale oggi».
  T('t1', { valore: 190, stato: 'non_attivo', data_inizio_validita: `${anno}-01-01`, data_fine_validita: `${anno}-12-31` }),
  T('t2', { valore: 202, stato: 'attivo', data_inizio_validita: `${anno}-01-01`, data_fine_validita: `${anno}-12-31` }),
  // Lo stato vuoto e' 'attivo': il filtro su stato 'attivo' la perdeva.
  T('t3', { valore: 95, tipologia: 'ACI', data_inizio_validita: `${anno}-01-01`, data_fine_validita: `${anno}-12-31` }),
  // Rinegoziata: resta attiva con la data di fine, vale per i mesi gia' fatti.
  T('t4', { valore: 180, stato: 'attivo', data_inizio_validita: `${anno - 1}-01-01`, data_fine_validita: `${anno - 1}-12-31` }),
  T('t5', { valore: 210, stato: 'attivo', data_inizio_validita: `${anno + 1}-01-01`, data_fine_validita: `${anno + 1}-12-31` }),
  // L'ultimo giorno vale per tutto il giorno: finisce oggi, vale oggi.
  T('t6', { valore: 85, tipologia: 'EXTRA_RACCOLTA', stato: 'attivo', data_inizio_validita: `${anno}-01-01`, data_fine_validita: oggi }),
];
const finto = {
  asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => ({
    filter: async (f) => (String(nome) === 'Tariffa' ? TARIFFE.filter(t => Object.entries(f || {}).every(([k, v]) => t[k] === v)) : []),
    list: async () => (String(nome) === 'Tariffa' ? TARIFFE : []),
  }) }) },
};
const tar = STRUMENTI.find(s => s.nome === 'tariffe');
const d = (await tar.esegui(finto, {}, { amministratore: true })).dati;
const righe = (d.tariffe && d.tariffe.righe) || d.tariffe || [];
const di = (valore) => righe.find(r => r.valore === valore) || {};

console.log("QUANDO UNA TARIFFA VALE OGGI: LA REGOLA DELLA FATTURA");
verifica("una tariffa 'non_attivo' dentro le sue date: disattivata, non vale mai", di(190).stato_validita === 'disattivata, non vale mai', JSON.stringify(di(190)));
verifica("una attiva dentro le sue date: vale oggi", di(202).stato_validita === 'vale oggi', JSON.stringify(di(202)));
verifica("lo stato vuoto e' 'attivo': c'e', e vale oggi", di(95).stato_validita === 'vale oggi', JSON.stringify(di(95)));
verifica("rinegoziata, chiusa l'anno scorso: scaduta", di(180).stato_validita === 'scaduta', JSON.stringify(di(180)));
verifica("dell'anno prossimo: non ancora in vigore", di(210).stato_validita === 'non ancora in vigore', JSON.stringify(di(210)));
verifica("finisce oggi: vale per tutto il giorno", di(85).stato_validita === 'vale oggi', JSON.stringify(di(85)));
verifica("prima quelle che valgono oggi, in fondo la disattivata", righe.length === 6 && righe[0].stato_validita === 'vale oggi' && righe[righe.length - 1].stato_validita === 'disattivata, non vale mai', JSON.stringify(righe.map(r => r.stato_validita)));
verifica("e la nota dice che una disattivata non e' un prezzo da usare", /non vale in nessun giorno/.test(d.nota_validita || ''), d.nota_validita);

console.log("CHI NON E' AMMINISTRATORE VEDE SOLO LE ATTIVE, ANCHE COSI'");
TARIFFE.push(T('p1', { direzione: 'PASSIVA', cliente: undefined, fornitore_nome: 'EMMESSE SRLS', valore: 72, stato: 'attivo' }));
const op = (await tar.esegui(finto, {}, { amministratore: false })).dati;
verifica("niente prezzi dei fornitori", !JSON.stringify(op).includes('EMMESSE') && /solo le tariffe attive/.test(op.nota_riservate || ''), JSON.stringify(op).slice(0, 200));

// LE TARIFFE COPIATE DALL'ANNO PRIMA E NON CONFERMATE (prova del cambio d'anno
// del 15/10/2026, difetto 15, la parte di EcoTyna; D4, decisione dell'utente
// del 15/10/2026). Il 15/01/2027, con le tariffe 2027
// copiate da «Prepara le tariffe» il 28/12/2026 e mai confermate, EcoTyna diceva
// «vale oggi» a 202 €/t e a 70 €/t, senza un «copiata» ne' un «da confermare».
console.log("UNA TARIFFA COPIATA E NON CONFERMATA LO DICE");
{
  const COPIE = [
    T('c1', { valore: 202, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', note: 'copiato dal 2026, da confermare' }),
    T('c2', { direzione: 'PASSIVA', cliente: undefined, fornitore_nome: 'GATIM S.R.L.', valore: 70, stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', note: 'copiato dal 2026, da confermare' }),
    // la nota della copia nell'ultima voce dello storico, come i target
    T('c3', { valore: 95, tipologia: 'ACI', stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', storico_json: JSON.stringify([{ nota: 'copiato dal 2026, da confermare' }]) }),
    // confermata: la nota della copia non c'e' piu'
    T('c4', { valore: 205, tipologia: 'EXTRA_RACCOLTA', stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', note: '' }),
    // confermata dopo la copia: lo storico ha una voce dopo quella della copia
    T('c5', { valore: 96, tipologia: 'ACI', prestazione: 'TRATTAMENTO', stato: 'attivo', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', storico_json: JSON.stringify([{ nota: 'copiato dal 2026, da confermare' }, { nota: 'confermata' }]) }),
  ];
  const fintoCopie = { asServiceRole: { entities: new Proxy({}, { get: (_t, nome) => ({
    filter: async (f) => (String(nome) === 'Tariffa' ? COPIE.filter(t => Object.entries(f || {}).every(([k, v]) => t[k] === v)) : []),
    list: async () => (String(nome) === 'Tariffa' ? COPIE : []),
  }) }) } };
  const OraVera = Date;
  const alle = async (iso, f) => {
    const ms = OraVera.parse(iso);
    globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
    try { return await f(); } finally { globalThis.Date = OraVera; }
  };
  const gen = (await alle('2027-01-15T09:00:00Z', () => tar.esegui(fintoCopie, {}, { amministratore: true }))).dati;
  const rg = (gen.tariffe && gen.tariffe.righe) || [];
  const v = (valore) => (rg.find(r => r.valore === valore) || {}).stato_validita;
  verifica('15/01/2027, la tariffa rete copiata: «vale oggi, copiata dal 2026 e da confermare»', v(202) === 'vale oggi, copiata dal 2026 e da confermare', v(202));
  verifica('la raccolta di GATIM copiata: lo stesso', v(70) === 'vale oggi, copiata dal 2026 e da confermare', v(70));
  verifica('la copia scritta nello storico: lo stesso', v(95) === 'vale oggi, copiata dal 2026 e da confermare', v(95));
  verifica('una tariffa confermata dice «vale oggi»', v(205) === 'vale oggi' && v(96) === 'vale oggi', JSON.stringify([v(205), v(96)]));
  verifica('e un avviso dice quante sono e dove si confermano', /3 tariffe sono copiate dall'anno prima.*Target & Status › Nuovo anno/.test(gen.avviso_copiate || ''), gen.avviso_copiate);
  // Il 28/12/2026, appena copiate: non ancora in vigore, e gia' da confermare.
  const dic = (await alle('2026-12-28T09:00:00Z', () => tar.esegui(fintoCopie, {}, { amministratore: true }))).dati;
  const vd = (valore) => (((dic.tariffe && dic.tariffe.righe) || []).find(r => r.valore === valore) || {}).stato_validita;
  verifica('il 28/12/2026: «non ancora in vigore, copiata dal 2026 e da confermare»', vd(202) === 'non ancora in vigore, copiata dal 2026 e da confermare', vd(202));
  // Chi non e' amministratore vede la copia sulle attive, mai il prezzo di GATIM.
  const opGen = (await alle('2027-01-15T09:00:00Z', () => tar.esegui(fintoCopie, {}, { amministratore: false }))).dati;
  verifica('chi non e\' amministratore: la rete copiata lo dice, GATIM non c\'e\'', ((opGen.tariffe && opGen.tariffe.righe) || []).some(r => r.stato_validita === 'vale oggi, copiata dal 2026 e da confermare') && !JSON.stringify(opGen).includes('GATIM'), JSON.stringify(opGen).slice(0, 300));
}

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

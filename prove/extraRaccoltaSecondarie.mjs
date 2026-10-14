// LE SECONDARIE DELL'EXTRA RACCOLTA SONO TRASPORTI DI SECONDARIA (13/10/2026).
//
// Decisione dell'utente del 13/10/2026 sera, testuale: «per l'extra raccolta
// noi fatturiamo al consorzio solo le primarie con eventuali surplus [...]; le
// eventuali secondarie di extra raccolta saranno trattate come normali
// trasporti di secondaria con il loro €\t oppure €\viaggio a seconda del
// tragitto e dei contratti».
//
// Fino a oggi la passiva pagava il trasporto di una secondaria SOLO col prezzo
// a viaggio scritto a mano sull'intervento, e la metteva anche fra le raccolte,
// a zero euro sulle sue tonnellate, con l'avviso «il contratto di extra
// raccolta prevede 80 €/t» di raccolta. Con un contratto di trasporto a 30 €/t
// sulla tratta NAPPI SUD → TECNOGUM, 20 t si pagavano zero e l'anomalia diceva
// «non viene pagato a nessuno». Ora:
// 1. il prezzo e' la tariffa TRASPORTO_SECONDARIA del vettore (chi fattura, dopo
//    la catena dei subfornitori) per la tratta, valida nel giorno italiano della
//    fine del trasporto: prima una tariffa EXTRA_RACCOLTA, poi la «TUTTE» del
//    contratto; a tonnellata sui chili, a viaggio una volta (un intervento e' un
//    viaggio); una disattivata non vale;
// 2. il prezzo scritto sull'intervento vale solo per una tratta senza contratto;
//    senza l'uno e l'altro, l'anomalia;
// 3. una secondaria non e' una raccolta: niente riga fra i raccoglitori, e un
//    costo di raccolta scritto non si paga (e si dice); il sovracosto al
//    trasportatore si paga col suo trasporto; a un interno niente;
// 4. pagina, scheda e foglio dell'amministrazione (extraRaccoltaCalc.js,
//    bloccoExtraRaccolta) dicono lo stesso costo della passiva, caso per caso, e
//    le due regole scelgono la stessa tariffa;
// 5. il surplus del trasporto delle secondarie vale anche quando il trasporto
//    si paga col contratto;
// 6. (revisione del 14/10/2026) un viaggio e' un camion in un giorno: a
//    viaggio, le secondarie dello stesso camion, giorno italiano, tratta e
//    vettore pagano il viaggio una volta, diviso per peso, in passiva, in
//    pagina, nella scheda e nel foglio; senza targa e col camion misto con la
//    rete o l'ACI, l'anomalia lo dice. Prima due formulari dello stesso camion a
//    400 €/viaggio facevano 800.
// La passiva di rete e ACI e quella dei mesi veri non cambiano: lo controllano
// prove/passivaSurplus.mjs (l'impronta di ogni mese del 2026) e
// prove/datiVeri.mjs.
//
// node prove/extraRaccoltaSecondarie.mjs
import * as passivaMod from '../base44/shared/passivaCalcolo.ts';
import * as calc from '../src/lib/extraRaccoltaCalc.js';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaPagina, clienteFinto, aspetta, trova, testo } from './dati/paginaFinta.mjs';

const { calcolaPassivaMese } = passivaMod;
const subfornitori = await caricaLibPagine('lib/subfornitori');
const { bloccoExtraRaccolta } = await caricaLibPagine('lib/extraRaccoltaAmministrazione');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log(`  FALLITA: ${titolo}: si ferma con un errore (${e && e.message})`); }
};

const LOG = 'Logistica Srl A Socio Unico';
const FORNITORI = [
  { id: 'F-LOG', ragione_sociale: LOG, stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-TRA', ragione_sociale: 'TRANSAR SRL', stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-PAT', ragione_sociale: 'PATERTRANS SRL', stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-COR', ragione_sociale: 'CORRIERE SENZA CONTRATTO', stato: 'attivo', ruolo_raccolta: true },
  { id: 'F-SUB', ragione_sociale: 'AUTOTRASPORTI SUB', stato: 'attivo', fattura_tramite_nome: LOG, ruolo_raccolta: true },
  { id: 'F-SMO', ragione_sociale: 'SMOCO S.R.L.', stato: 'attivo', interno: true, ruolo_raccolta: true },
  { id: 'F-NAP', ragione_sociale: 'NAPPI SUD SRL', stato: 'attivo', ruolo_stoccaggio: true },
  { id: 'F-TEC', ragione_sociale: 'TECNOGUM SRL', stato: 'attivo', ruolo_trattamento: true },
  { id: 'F-IRI', ragione_sociale: 'IRIGOM S.R.L.', stato: 'attivo', ruolo_trattamento: true },
];
const T = (id, fornitore, destinatario, valore, unita, altro = {}) => ({
  id, direzione: 'PASSIVA', prestazione: 'TRASPORTO_SECONDARIA', tipologia: 'TUTTE', fornitore_nome: fornitore,
  produttore: 'NAPPI SUD SRL', destinatario, valore, unita_misura: unita, stato: 'attivo',
  data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...altro,
});
const TARIFFE = [
  T('t-log', LOG, 'TECNOGUM SRL', 30, '€/t'),
  T('t-tra', 'TRANSAR SRL', 'TECNOGUM SRL', 400, '€/viaggio'),
  // la tariffa scritta per l'extra raccolta vince sulla TUTTE del contratto
  T('t-tra-extra', 'TRANSAR SRL', 'TECNOGUM SRL', 350, '€/viaggio', { tipologia: 'EXTRA_RACCOLTA' }),
  // finisce il 30/09: un trasporto finito alle 22:30Z del 30/09 e' gia' l'1/10 in Italia
  T('t-log-iri', LOG, 'Irigom S.r.l.', 34, '€/t', { data_fine_validita: '2026-09-30' }),
  T('t-pat', 'PATERTRANS SRL', 'TECNOGUM SRL', 500, '€/viaggio', { stato: 'non_attivo' }),
  T('t-smo', 'SMOCO S.R.L.', 'TECNOGUM SRL', 25, '€/t'),
  // la raccolta di extra raccolta di Logistica: su una secondaria non c'entra
  { id: 'r-log', direzione: 'PASSIVA', prestazione: 'RACCOLTA', tipologia: 'EXTRA_RACCOLTA', fornitore_nome: LOG, valore: 80, unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31' },
];
const sec = (id, altro = {}) => ({
  id, stato: 'terminato', tipo_movimento: 'secondaria', numero_fir: 'FS ' + id, id_ordine: 'ER-' + id,
  stoccaggio: 'NAPPI SUD SRL', produttore: 'NAPPI SUD SRL', trasportatore: LOG, destinazione: 'TECNOGUM SRL', tipo_destinazione: 'imp', classe: 'P', cer: '160103',
  ordine_immesso_il: '2026-09-01T08:00:00.000Z', trasporto_iniziato_il: '2026-09-10T08:00:00.000Z', trasporto_finito_il: '2026-09-10T08:00:00.000Z',
  peso_effettivo: 20000, prezzo_attivo_t: 0, costo_raccolta_t: 0, costo_trattamento_t: 0, costo_trasporto_viaggio: 0,
  ...altro,
});
const passivaDi = (righe, { tariffe = TARIFFE, surplus = [], m = 8, mese = 'Settembre' } = {}) => calcolaPassivaMese({
  primarieRete: [], primarieAci: [], secondarieAll: [], extraRaccoltaAll: righe, tariffeAll: tariffe, fornitoriAll: FORNITORI, surplusAll: surplus,
}, 2026, m, mese, 'EXTRA_RACCOLTA');
const contesto = (surplus = [], tariffe = TARIFFE) => calc.contestoPrezzi([], FORNITORI, surplus, subfornitori, tariffe);
const trasporti = (p) => p.trasporti_secondaria.flatMap(f => f.righe.map(r => ({ fornitore: f.fornitore, ...r })));

// I casi: l'intervento, quanto si paga il suo trasporto e da dove viene.
const CASI = [
  ['contratto TUTTE a tonnellata: 20 t x 30 €/t', sec('A'), { importo: 600, origine: 'contratto', tariffa: 't-log', fornitore: LOG }],
  ['la tariffa EXTRA_RACCOLTA della tratta vince sulla TUTTE: 350 a viaggio, non 400', sec('B', { trasportatore: 'TRANSAR SRL' }), { importo: 350, origine: 'contratto', tariffa: 't-tra-extra', fornitore: 'TRANSAR SRL' }],
  ['contratto e prezzo scritto: si paga il contratto', sec('C', { costo_trasporto_viaggio: 150 }), { importo: 600, origine: 'contratto', tariffa: 't-log', fornitore: LOG }],
  ['tratta senza contratto: il prezzo scritto', sec('D', { trasportatore: 'CORRIERE SENZA CONTRATTO', costo_trasporto_viaggio: 150 }), { importo: 150, origine: 'intervento', tariffa: '', fornitore: 'CORRIERE SENZA CONTRATTO' }],
  ['il contratto vale nel giorno italiano: 30/09 alle 22:00 in Italia e\' ancora settembre', sec('E', { destinazione: 'IRIGOM S.R.L.', trasporto_finito_il: '2026-09-30T20:00:00.000Z', peso_effettivo: 10000 }), { importo: 340, origine: 'contratto', tariffa: 't-log-iri', fornitore: LOG }],
  ['una tariffa disattivata non vale: resta il prezzo scritto', sec('F', { trasportatore: 'PATERTRANS SRL', costo_trasporto_viaggio: 450 }), { importo: 450, origine: 'intervento', tariffa: '', fornitore: 'PATERTRANS SRL' }],
  ['un subraccoglitore: il contratto di chi fattura per lui', sec('G', { trasportatore: 'AUTOTRASPORTI SUB' }), { importo: 600, origine: 'contratto', tariffa: 't-log', fornitore: LOG }],
  ['il sovracosto al trasportatore si paga col suo trasporto: 600 + 50', sec('H', { sovracosto_pagato_raccoglitore: 50, note_costi: 'attesa al piazzale' }), { importo: 650, origine: 'contratto', tariffa: 't-log', fornitore: LOG }],
  ['un vettore interno non si paga, contratto o no', sec('I', { trasportatore: 'SMOCO S.R.L.' }), { importo: 0, origine: 'contratto', tariffa: 't-smo', fornitore: 'SMOCO S.R.L.' }],
];

await sezione('1. LA PASSIVA PAGA LA SECONDARIA COME UN TRASPORTO DI SECONDARIA', async () => {
  for (const [nome, r, atteso] of CASI) {
    const p = passivaDi([r]);
    const t = trasporti(p);
    verifica(`${nome}: una riga di trasporto, ${atteso.importo} € a ${atteso.fornitore}`, t.length === 1 && t[0].importo === atteso.importo && t[0].fornitore === atteso.fornitore, J(t));
    verifica(`${nome}: col prezzo della tariffa giusta`, t.length === 1 && (t[0].tariffa_id || '') === atteso.tariffa, J(t.map(x => [x.tariffa_id, x.tariffa_valore, x.unita_misura])));
    verifica(`${nome}: niente fra le raccolte`, p.raccoglitori.length === 0, J(p.raccoglitori));
    verifica(`${nome}: il totale della passiva e' il trasporto`, p.totali.totale_complessivo === atteso.importo && p.totali.trasporti_secondaria === atteso.importo, J(p.totali));
  }
  const a = trasporti(passivaDi([CASI[0][1]]))[0] || {};
  verifica('la riga dice tonnellate, 30 €/t e da dove viene il prezzo', a.tonnellate === 20 && a.tariffa_valore === 30 && a.unita_misura === '€/t' && /contratto del vettore per la tratta \(tariffa TUTTE\)/.test(a.note), J(a));
  const pA = passivaDi([CASI[0][1]]);
  verifica('e nessuna anomalia: ne\' «il contratto di extra raccolta prevede 80 €/t», ne\' «non viene pagato a nessuno»', pA.anomalie.length === 0, J(pA.anomalie.map(x => x.descrizione)));
  const c = trasporti(passivaDi([CASI[2][1]]))[0] || {};
  verifica('col contratto, il prezzo scritto sull\'intervento non si paga, e la nota lo dice', /i 150,00 € a viaggio scritti sull'intervento non si pagano/.test(c.note || ''), c.note);
  const d = trasporti(passivaDi([CASI[3][1]]))[0] || {};
  verifica('senza contratto la nota dice che vale il prezzo scritto', /prezzo scritto sull'intervento: la tratta non ha un contratto/.test(d.note || '') && d.unita_misura === '€/viaggio', J(d));
  const h = trasporti(passivaDi([CASI[7][1]]))[0] || {};
  verifica('il sovracosto sta nella riga, col suo campo e il motivo', h.sovracosto_euro === 50 && h.sovracosto_motivo === 'attesa al piazzale' && /50,00 € di sovracosto/.test(h.note || ''), J(h));
  const i = trasporti(passivaDi([CASI[8][1]]))[0] || {};
  verifica('l\'interno: la riga c\'e\', a zero, «interno, non fatturato»', i.importo === 0 && /^interno, non fatturato/.test(i.note || ''), J(i));
});

await sezione('2. SENZA CONTRATTO E SENZA PREZZO, L\'ANOMALIA; LA RACCOLTA DI UNA SECONDARIA NON SI PAGA', async () => {
  // alle 22:30Z del 30/09 in Italia e' l'1/10: la tariffa verso Irigom e' finita
  const fuori = sec('J', { destinazione: 'IRIGOM S.R.L.', trasporto_finito_il: '2026-09-30T22:30:00.000Z' });
  const p = passivaDi([fuori], { m: 9, mese: 'Ottobre' });
  verifica('fuori dalla validita\' il contratto non vale, e senza prezzo scritto il trasporto non ha riga', trasporti(p).length === 0, J(trasporti(p)));
  const an = p.anomalie.filter(x => x.prestazione === 'TRASPORTO_SECONDARIA');
  verifica('l\'anomalia dice che la tratta non ha la tariffa e il prezzo manca', an.length === 1 && /la tratta non ha una tariffa TRASPORTO_SECONDARIA del vettore e sull'intervento il costo del trasporto a viaggio e' vuoto/.test(an[0].descrizione) && an[0].tonnellate === 20, J(an));
  const senza = passivaDi([sec('K', { trasportatore: '' })]);
  verifica('senza trasportatore, l\'anomalia lo dice una volta', senza.anomalie.filter(x => /senza trasportatore/.test(x.descrizione)).length === 1 && !senza.anomalie.some(x => /senza raccoglitore/.test(x.descrizione)), J(senza.anomalie.map(x => x.descrizione)));
  const conRaccolta = sec('L', { costo_raccolta_t: 80 });
  const pr = passivaDi([conRaccolta]);
  verifica('un costo di raccolta scritto su una secondaria non si paga: si paga il trasporto, 600', pr.totali.raccoglitori === 0 && pr.totali.totale_complessivo === 600, J(pr.totali));
  verifica('e l\'anomalia lo dice', pr.anomalie.some(x => /e' una secondaria, un trasferimento da NAPPI SUD SRL, e ha scritto un costo di raccolta di 80,00 €\/t: non si paga/.test(x.descrizione)), J(pr.anomalie.map(x => x.descrizione)));
  const quad = pr.quadratura;
  verifica('la quadratura delle raccolte non conta la secondaria', quad.tonnellate_totali === 0 && quad.coincidente === true, J(quad));
});

await sezione('3. PAGINA, SCHEDA E FOGLIO DICONO IL COSTO DELLA PASSIVA', async () => {
  for (const [nome, r, atteso] of CASI) {
    const cx = calc.calcExtraRaccolta(r, contesto());
    const p = passivaDi([r]);
    verifica(`${nome}: la pagina dice ${p.totali.totale_complessivo}, come la passiva`, cx.costo_standard === p.totali.totale_complessivo && cx.costi.trasporto === (atteso.fornitore === 'SMOCO S.R.L.' ? 0 : atteso.importo - Number(r.sovracosto_pagato_raccoglitore || 0)), J([cx.costo_standard, cx.costi, p.totali.totale_complessivo]));
    verifica(`${nome}: e la stessa origine del prezzo`, cx.trasporto.origine === atteso.origine && ((cx.trasporto.tariffa && cx.trasporto.tariffa.id) || '') === atteso.tariffa, J(cx.trasporto));
    const b = bloccoExtraRaccolta([r], 2026, 'Settembre', contesto());
    const riga = b.righe[0] || {};
    verifica(`${nome}: il foglio dell'amministrazione ha lo stesso totale`, b.totale_euro === p.totali.totale_complessivo, J([b.totale_euro, p.totali.totale_complessivo]));
    // La formula della riga nel foglio Excel: un ROUND per costo a tonnellata,
    // piu' il trasporto del viaggio e gli oneri (formulaTotaleExtra).
    const t = (riga.kg || 0) / 1000;
    const formula = Math.round(riga.raccolta_t * t * 100) / 100 + Math.round(riga.stoccaggio_t * t * 100) / 100 + Math.round(riga.trattamento_t * t * 100) / 100 + riga.trasporto_viaggio + riga.oneri;
    verifica(`${nome}: e la formula della riga rifa' l'importo`, Math.abs(formula - riga.totale) < 0.005 && riga.raccolta_t === 0, J(riga));
  }
  const a = bloccoExtraRaccolta([CASI[0][1]], 2026, 'Settembre', contesto()).righe[0] || {};
  verifica('nel foglio il trasporto a tonnellata e\' l\'importo del viaggio, e la nota dice il contratto', a.trasporto_viaggio === 600
    && /trasporto dal contratto di Logistica Srl A Socio Unico per la tratta NAPPI SUD SRL → TECNOGUM SRL: 30,00 €\/t, 600,00 € per il viaggio/.test(a.note), J(a));
  const l = bloccoExtraRaccolta([sec('L', { costo_raccolta_t: 80 })], 2026, 'Settembre', contesto()).righe[0] || {};
  verifica('e una raccolta scritta su una secondaria si dice e non si conta', l.raccolta_t === 0 && /80,00 €\/t di raccolta scritti sull'intervento non si pagano/.test(l.note) && l.totale === 600, J(l));
  // Senza i contratti nel contesto (il foglio di oggi li riceve solo se chi lo
  // chiama li passa) la secondaria resta col prezzo scritto, e si dice.
  const nl = bloccoExtraRaccolta([sec('C', { costo_trasporto_viaggio: 150 })], 2026, 'Settembre', calc.contestoPrezzi([], FORNITORI, [], subfornitori)).righe[0] || {};
  verifica('senza i contratti nel contesto: il prezzo scritto e la nota «contratto della tratta non letto»', nl.trasporto_viaggio === 150 && /contratto della tratta non letto/.test(nl.note), J(nl));
  // Le due regole scelgono la stessa tariffa (passivaCalcolo.ts e extraRaccoltaCalc.js).
  const tp = passivaMod.tariffaTrasportoExtra;
  const griglia = [];
  for (const chi of [LOG, 'TRANSAR SRL', 'PATERTRANS SRL', 'SMOCO S.R.L.', 'NESSUNO']) {
    for (const dest of ['TECNOGUM SRL', 'Tecnogum S.r.l.', 'IRIGOM S.R.L.']) {
      for (const quando of ['2026-09-30T20:00:00.000Z', '2026-09-30T22:30:00.000Z', '2027-01-05T08:00:00.000Z']) {
        const k = calc.contestoPrezzi([], FORNITORI).anagrafica.passiva.fattura(chi).chiave;
        const x = typeof tp === 'function' ? tp(TARIFFE, k, 'NAPPI SUD SRL', dest, quando) : undefined;
        const y = calc.tariffaTrasportoExtra(contesto().trasporti, k, 'NAPPI SUD SRL', dest, quando);
        griglia.push([chi, dest, quando, (x && x.id) || null, (y && y.id) || null]);
      }
    }
  }
  verifica('passiva e pagina scelgono la stessa tariffa in 45 casi (vettore, destinazione scritta in due modi, giorno)', typeof tp === 'function' && griglia.every(g => g[3] === g[4]) && griglia.some(g => g[3]), J(griglia.filter(g => g[3] !== g[4])));
});

await sezione('4. IL SURPLUS DEL TRASPORTO DELLE SECONDARIE VALE ANCHE COL CONTRATTO', async () => {
  const s = [{ id: 'ts', nome: 'Accordo trasporti', origine: 'ACCORDO_COMMERCIALE', tipologia: 'EXTRA_RACCOLTA', prestazione: 'TRASPORTO_SECONDARIA', a_chi: 'tutti',
    euro_t_passiva: 2, euro_t_attiva: null, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo' }];
  const r = sec('M', { trasporto_finito_il: '2026-10-12T08:00:00.000Z' });
  const p = passivaDi([r], { surplus: s, m: 9, mese: 'Ottobre' });
  verifica('in passiva: 600 di trasporto dal contratto e 40 di surplus (20 t x 2 €/t)', p.totali.trasporti_secondaria === 640 && p.totali.surplus.trasporti_secondaria === 40, J(p.totali));
  const cx = calc.calcExtraRaccolta(r, contesto(s));
  verifica('in pagina lo stesso: costo 640, di cui surplus 40', cx.costo_totale === 640 && cx.surplus_costo === 40, J([cx.costo_totale, cx.surplus_costo]));
});

await sezione('5. LA SCHEDA DICE DA DOVE VIENE IL TRASPORTO E CHIUDE LA RACCOLTA', async () => {
  const f = await caricaPagina('components/fatturazione/ExtraRaccoltaForm');
  globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: { Fornitore: FORNITORI, Tariffa: [], ExtraRaccolta: [] } }).cliente;
  const scheda = async (initial) => {
    const r = f.monta(f.Componente, { open: true, initial, contesto: contesto(), interventi: [], onSave: () => {}, onCancel: () => {} });
    await aspetta(40);
    return { r, t: testo(r.albero) };
  };
  const a = await scheda(sec('A', { costo_trasporto_viaggio: 150 }));
  verifica('si monta senza errori', a.r.errori.length === 0, String(a.r.errori[0] || ''));
  verifica('sotto il trasporto: il contratto della tratta e quanto fa, e che il prezzo scritto non si paga', a.t.includes('dal contratto di Logistica Srl A Socio Unico per la tratta NAPPI SUD SRL → TECNOGUM SRL (tariffa TUTTE): 30,00 €/t = € 600,00')
    && a.t.includes('Il prezzo scritto qui (€ 150,00) non si paga: vale il contratto'), (a.t.match(/[^.]{0,80}contratto di[^.]{0,160}/g) || []).join(' | '));
  const campo = trova(a.r.albero, el => el.props && el.props.disabled === true && el.props.type === 'number');
  verifica('il costo di raccolta di una secondaria e\' chiuso, e dice perche\'', campo.length === 1 && a.t.includes('una secondaria non è una raccolta: si paga il trasporto'), J(campo.map(x => x.props.value)));
  const d = await scheda(sec('D', { trasportatore: 'CORRIERE SENZA CONTRATTO', costo_trasporto_viaggio: 0 }));
  verifica('una tratta senza contratto e senza prezzo: lo dice', d.t.includes('la tratta NAPPI SUD SRL → TECNOGUM SRL non ha un contratto di trasporto: scrivi il prezzo del viaggio'), '');
  // Il salvataggio di una secondaria scrive zero nella raccolta.
  let salvato = null;
  const r = f.monta(f.Componente, { open: true, initial: sec('N', { costo_raccolta_t: 80 }), contesto: contesto(), interventi: [], onSave: (p) => { salvato = p; }, onCancel: () => {} });
  await aspetta(40);
  const salva = trova(r.albero, el => el.props && typeof el.props.onClick === 'function' && testo(el).includes('Salva'))[0];
  if (salva) { salva.props.onClick(); await aspetta(20); }
  verifica('salvata, una secondaria ha la raccolta a zero', !!salvato && salvato.costo_raccolta_t === 0, J(salvato && { costo_raccolta_t: salvato.costo_raccolta_t }));
});

// ─── LO STESSO VIAGGIO SI PAGA UNA VOLTA (revisione del 14/10/2026) ───
// Un viaggio e' un camion in un giorno (chiaveViaggio), anche nell'extra
// raccolta. Il revisore: due secondarie sullo stesso camion GC599NL il
// 10/09/2026, tratta NAPPI SUD -> IRIGOM a 400 €/viaggio (contratto TUTTE di
// TRANSAR), si pagavano 800 nell'extra raccolta e 400 come secondarie di rete.
// Ora il viaggio si paga una volta e si divide fra gli interventi per peso, come
// il viaggio misto fra rete e ACI; la pagina, la scheda e il foglio
// dell'amministrazione dicono la stessa quota.
const TARIFFE_V = [
  ...TARIFFE,
  T('t-tra-iri', 'TRANSAR SRL', 'IRIGOM S.R.L.', 400, '€/viaggio'),
  T('t-log-tec-t', 'PATERTRANS SRL', 'IRIGOM S.R.L.', 20, '€/t'),
];
const viaggio = (id, altro = {}) => sec(id, {
  trasportatore: 'TRANSAR SRL', destinazione: 'IRIGOM S.R.L.', automezzo: 'GC599NL',
  trasporto_iniziato_il: '2026-09-10T07:00:00.000Z', trasporto_finito_il: '2026-09-10T11:00:00.000Z', peso_effettivo: 6000, ...altro,
});
const passivaV = (extra, { rete = [], canale = 'EXTRA_RACCOLTA', tariffe = TARIFFE_V, surplus = [], m = 8, mese = 'Settembre' } = {}) => calcolaPassivaMese({
  primarieRete: [], primarieAci: [], secondarieAll: rete, extraRaccoltaAll: extra, tariffeAll: tariffe, fornitoriAll: FORNITORI, surplusAll: surplus,
}, 2026, m, mese, canale);
const contestoV = (interventi, surplus = []) => calc.conViaggi(calc.contestoPrezzi([], FORNITORI, surplus, subfornitori, TARIFFE_V), interventi);
// Il costo del trasporto di ogni intervento, in passiva e in pagina.
const perIntervento = (p) => Object.fromEntries(trasporti(p).map(r => [r.note.match(/intervento (FS \w+)/)[1], r.importo]));
const inPagina = (interventi, surplus = []) => Object.fromEntries(interventi.map(r => [r.numero_fir, calc.calcExtraRaccolta(r, contestoV(interventi, surplus)).costi.trasporto]));

await sezione('6. LO STESSO CAMION NELLO STESSO GIORNO SI PAGA UNA VOLTA', async () => {
  const due = [viaggio('A'), viaggio('B')];
  const p = passivaV(due);
  const reteDue = due.map(({ tipo_movimento: _t, id_ordine: _o, ...r }) => r);
  const pr = passivaV([], { rete: reteDue, canale: 'RETE' });
  verifica('due formulari dello stesso viaggio a 400 €/viaggio: 400, non 800', p.totali.trasporti_secondaria === 400 && J(perIntervento(p)) === J({ 'FS A': 200, 'FS B': 200 }), J([p.totali.trasporti_secondaria, perIntervento(p)]));
  verifica('come le stesse due secondarie di rete: 400', pr.totali.trasporti_secondaria === 400 && p.totali.trasporti_secondaria === pr.totali.trasporti_secondaria, J([p.totali.trasporti_secondaria, pr.totali.trasporti_secondaria]));
  const a = trasporti(p).find(r => /FS A/.test(r.note)) || {};
  verifica('la riga dice con chi divide il viaggio e la sua quota', a.viaggi_quota === 0.5 && J(a.viaggio_condiviso) === J({ interventi: 2, altri: ['FS B'], tonnellate_viaggio: 12, prezzo_viaggio: 400 })
    && /stesso viaggio di FS B \(camion GC599NL, 10\/09\/2026\): i 400,00 € a viaggio si pagano una volta, divisi per peso, qui 6,00 t delle 12,00: 200,00 €/.test(a.note) && a.nota_informativa === true, J(a));
  verifica('e nessuna anomalia', p.anomalie.length === 0, J(p.anomalie.map(x => x.descrizione)));

  // Pesi diversi, tre interventi: la proporzione e il centesimo all'ultimo.
  const tre = [viaggio('A', { peso_effettivo: 7000 }), viaggio('B', { peso_effettivo: 3000 }), viaggio('C', { peso_effettivo: 3333 })];
  const p3 = passivaV(tre);
  verifica('tre interventi da 7.000, 3.000 e 3.333 kg: 210,01 + 90,00 + 99,99 = 400,00 (l\'ultimo prende la differenza)', J(perIntervento(p3)) === J({ 'FS A': 210.01, 'FS B': 90, 'FS C': 99.99 }) && p3.totali.trasporti_secondaria === 400, J(perIntervento(p3)));
  verifica('la pagina dice le stesse quote della passiva', J(inPagina(tre)) === J(perIntervento(p3)), J([inPagina(tre), perIntervento(p3)]));

  // Che cosa fa un viaggio: targa scritta in due modi, giorno italiano, altra targa, altra tratta, altro vettore.
  const casi = [
    ['la targa scritta in due modi e\' lo stesso mezzo: un viaggio', [viaggio('A'), viaggio('B', { automezzo: 'gc 599 nl' })], 400],
    ['alle 23:30 italiane del 10/09 e\' ancora lo stesso giorno: un viaggio', [viaggio('A'), viaggio('B', { trasporto_finito_il: '2026-09-10T21:30:00.000Z' })], 400],
    ['all\'1:30 italiana dell\'11/09 e\' un altro giorno: due viaggi', [viaggio('A'), viaggio('B', { trasporto_finito_il: '2026-09-10T23:30:00.000Z' })], 800],
    ['un altro camion: due viaggi', [viaggio('A'), viaggio('B', { automezzo: 'FX123AB' })], 800],
    ['un\'altra tratta: due viaggi, uno a 400 e uno a 350', [viaggio('A'), viaggio('B', { destinazione: 'TECNOGUM SRL' })], 750],
    ['un subraccoglitore di Logistica non e\' TRANSAR: il suo viaggio e\' di Logistica, a tonnellata', [viaggio('A'), viaggio('B', { trasportatore: 'AUTOTRASPORTI SUB', destinazione: 'TECNOGUM SRL' })], 400 + 180],
  ];
  for (const [nome, righe, atteso] of casi) {
    const px = passivaV(righe);
    verifica(`${nome}: ${atteso} €`, px.totali.trasporti_secondaria === atteso, J([px.totali.trasporti_secondaria, perIntervento(px)]));
    verifica(`${nome}: la pagina dice lo stesso`, J(inPagina(righe)) === J(perIntervento(px)), J([inPagina(righe), perIntervento(px)]));
  }

  // A tonnellata ognuno paga i suoi chili: niente da dividere.
  const aT = [viaggio('A', { trasportatore: 'PATERTRANS SRL' }), viaggio('B', { trasportatore: 'PATERTRANS SRL' })];
  const pt = passivaV(aT);
  verifica('a tonnellata lo stesso camion paga i chili di tutti e due: 120 + 120', J(perIntervento(pt)) === J({ 'FS A': 120, 'FS B': 120 }) && trasporti(pt).every(r => !r.viaggio_condiviso), J(trasporti(pt)));
  // Il prezzo scritto sull'intervento (tratta senza contratto) resta suo.
  const scritti = [viaggio('A', { trasportatore: 'CORRIERE SENZA CONTRATTO', costo_trasporto_viaggio: 150 }), viaggio('B', { trasportatore: 'CORRIERE SENZA CONTRATTO', costo_trasporto_viaggio: 150 })];
  verifica('senza contratto il prezzo scritto resta di ogni intervento: 150 + 150', passivaV(scritti).totali.trasporti_secondaria === 300, J(passivaV(scritti).totali));
  // Un intervento senza peso: la quota va a chi i chili ce li ha.
  const senzaPeso = [viaggio('A'), viaggio('B', { peso_effettivo: 0 })];
  verifica('un intervento senza peso: 400 a chi ha i chili, 0 a lui, e la pagina dice lo stesso', J(perIntervento(passivaV(senzaPeso))) === J({ 'FS A': 400, 'FS B': 0 }) && J(inPagina(senzaPeso)) === J(perIntervento(passivaV(senzaPeso))), J([perIntervento(passivaV(senzaPeso)), inPagina(senzaPeso)]));
  // Il surplus del trasporto resta su tutte le tonnellate.
  const s = [{ id: 'ts', nome: 'Accordo trasporti', origine: 'ACCORDO_COMMERCIALE', tipologia: 'EXTRA_RACCOLTA', prestazione: 'TRASPORTO_SECONDARIA', a_chi: 'tutti',
    euro_t_passiva: 2, euro_t_attiva: null, data_inizio_validita: '2026-09-01', data_fine_validita: '2026-12-31', stato: 'attivo' }];
  const ps = passivaV(due, { surplus: s });
  const costoPagina = due.reduce((x, r) => x + calc.calcExtraRaccolta(r, contestoV(due, s)).costo_totale, 0);
  verifica('col surplus del trasporto: 400 di viaggio e 24 di surplus sulle 12 t, in passiva e in pagina', ps.totali.trasporti_secondaria === 424 && ps.totali.surplus.trasporti_secondaria === 24 && Math.round(costoPagina * 100) / 100 === 424, J([ps.totali, costoPagina]));
});

await sezione('7. SENZA TARGA, E LO STESSO CAMION CON LA RETE: SI DICE', async () => {
  const senza = [viaggio('A', { automezzo: '' }), viaggio('B', { automezzo: '' })];
  const p = passivaV(senza);
  const an = p.anomalie.filter(x => /senza targa/.test(x.descrizione));
  verifica('senza targa, due interventi dello stesso giorno: un viaggio, 400, e l\'anomalia lo dice una volta', p.totali.trasporti_secondaria === 400 && an.length === 1
    && /Extra raccolta: tratta a 400,00 € a viaggio senza targa su 2 interventi dello stesso giorno \(FS A, FS B, 10\/09\/2026\): NAPPI SUD SRL → IRIGOM S.R.L./.test(an[0].descrizione) && an[0].tonnellate === 12, J(an));
  const uno = passivaV([viaggio('A', { automezzo: '' })]);
  verifica('un intervento solo senza targa non e\' un problema: niente anomalia', uno.anomalie.length === 0, J(uno.anomalie.map(x => x.descrizione)));
  // Lo stesso camion porta anche un formulario di rete: la passiva di rete paga
  // il viaggio intero e l'extra raccolta pure. Si dice, nella passiva dell'extra.
  const { tipo_movimento: _t, id_ordine: _o, ...reteR } = viaggio('R');
  const pm = passivaV([viaggio('A')], { rete: [reteR] });
  const mista = pm.anomalie.filter(x => /lo stesso camion/.test(x.descrizione));
  verifica('camion misto con la rete: l\'extra raccolta paga 400 e l\'anomalia dice che il viaggio si paga anche nella passiva di rete', pm.totali.trasporti_secondaria === 400 && mista.length === 1
    && /Extra raccolta: lo stesso camion \(GC599NL, 10\/09\/2026\) da NAPPI SUD SRL a IRIGOM S\.R\.L\. con TRANSAR SRL porta l'intervento FS A e anche 1 formulario di rete: a 400,00 € a viaggio il viaggio si paga qui e anche nella passiva di rete/.test(mista[0].descrizione), J(mista));
  const reteSola = passivaV([], { rete: [reteR], canale: 'RETE' });
  verifica('e la rete, per conto suo, paga lo stesso viaggio 400', reteSola.totali.trasporti_secondaria === 400, J(reteSola.totali));
  // Un formulario di rete su un altro camion non c'entra.
  const altrove = passivaV([viaggio('A')], { rete: [{ ...reteR, automezzo: 'FX123AB' }] });
  verifica('un formulario di rete su un altro camion: nessuna anomalia', !altrove.anomalie.some(x => /lo stesso camion/.test(x.descrizione)), J(altrove.anomalie.map(x => x.descrizione)));
  // Se la rete quel viaggio lo paga a tonnellata, il camion non si paga due volte.
  const reteATon = passivaV([viaggio('A')], { rete: [reteR], tariffe: [...TARIFFE_V.filter(t => t.id !== 't-tra-iri'), T('t-tra-iri-x', 'TRANSAR SRL', 'IRIGOM S.R.L.', 400, '€/viaggio', { tipologia: 'EXTRA_RACCOLTA' }), T('t-tra-iri-r', 'TRANSAR SRL', 'IRIGOM S.R.L.', 30, '€/t', { tipologia: 'RETE' })] });
  verifica('con la rete a tonnellata sulla tratta: nessuna anomalia del camion misto', reteATon.totali.trasporti_secondaria === 400 && !reteATon.anomalie.some(x => /lo stesso camion/.test(x.descrizione)), J([reteATon.totali.trasporti_secondaria, reteATon.anomalie.map(x => x.descrizione)]));
});

await sezione('8. IL FOGLIO DELL\'AMMINISTRAZIONE E LA SCHEDA DICONO LA QUOTA', async () => {
  const due = [viaggio('A'), viaggio('B')];
  const p = passivaV(due);
  // Il foglio raggruppa i viaggi da se': anche col contesto senza viaggi, come
  // glielo passa oggi il modulo della passiva.
  const ctxSenzaViaggi = calc.contestoPrezzi([], FORNITORI, [], subfornitori, TARIFFE_V);
  const b = bloccoExtraRaccolta(due, 2026, 'Settembre', ctxSenzaViaggi);
  verifica('il foglio: 200 + 200, il totale della passiva', J(b.righe.map(r => r.trasporto_viaggio)) === J([200, 200]) && b.totale_euro === p.totali.totale_complessivo, J([b.righe.map(r => r.trasporto_viaggio), b.totale_euro, p.totali.totale_complessivo]));
  const nota = (b.righe.find(r => r.numero_fir === 'FS A') || {}).note || '';
  verifica('la nota del foglio dice con chi divide il viaggio', /400,00 €\/viaggio; stesso viaggio di FS B \(camion GC599NL, 10\/09\/2026\): il viaggio si paga una volta, diviso per peso, qui 6,00 t delle 12,00: 200,00 €/.test(nota), nota);
  const b3 = bloccoExtraRaccolta([viaggio('A', { peso_effettivo: 7000 }), viaggio('B', { peso_effettivo: 3000 }), viaggio('C', { peso_effettivo: 3333 })], 2026, 'Settembre', ctxSenzaViaggi);
  verifica('tre interventi: 210,01 + 90,00 + 99,99 anche nel foglio', J(b3.righe.map(r => [r.numero_fir, r.trasporto_viaggio])) === J([['FS A', 210.01], ['FS B', 90], ['FS C', 99.99]]), J(b3.righe.map(r => [r.numero_fir, r.trasporto_viaggio])));
  // Le due regole scrivono la stessa chiave del viaggio e le stesse quote.
  const recs = [viaggio('A'), viaggio('B', { automezzo: 'gc-599 nl' }), viaggio('C', { trasporto_finito_il: '2026-09-10T22:30:00.000Z' }), viaggio('D', { destinazione: 'Irigom S.r.l.' }), viaggio('E', { automezzo: '' })];
  const kp = recs.map(r => passivaMod.chiaveViaggioExtra ? passivaMod.chiaveViaggioExtra(r, 'TRANSAR') : null);
  const kc = recs.map(r => calc.chiaveViaggioExtra ? calc.chiaveViaggioExtra(r, 'TRANSAR') : undefined);
  verifica('passiva e pagina scrivono la stessa chiave del viaggio', J(kp) === J(kc) && kp[0] === kp[1] && kp[0] !== kp[2] && kp[0] === kp[3] && kp[0] !== kp[4], J([kp, kc]));
  const griglia = [[400, [7000, 3000, 3333]], [350, [1, 1, 1]], [123.45, [0, 0]], [1000, [2500, 2500, 2500, 2500, 1]], [99.99, [13000, 0, 7]]];
  const quote = (mod) => griglia.map(([v, kg]) => (mod.quoteDelViaggio ? [...mod.quoteDelViaggio(v, kg.map((k, i) => ({ chiave: `k${i}`, kg: k }))).values()] : null));
  const qp = quote(passivaMod);
  verifica('passiva e pagina dividono il viaggio allo stesso modo, e la somma e\' sempre il prezzo', J(qp) === J(quote(calc)) && qp.every((q, i) => q && Math.round(q.reduce((s, x) => s + x, 0) * 100) === Math.round(griglia[i][0] * 100)), J([qp, quote(calc)]));
  // La scheda: la quota e con chi.
  const f = await caricaPagina('components/fatturazione/ExtraRaccoltaForm');
  globalThis.__CLIENTE_FINTO = clienteFinto({ archivi: { Fornitore: FORNITORI, Tariffa: [], ExtraRaccolta: [] } }).cliente;
  const r = f.monta(f.Componente, { open: true, initial: due[0], contesto: contestoV(due), interventi: due, onSave: () => {}, onCancel: () => {} });
  await aspetta(40);
  const t = testo(r.albero);
  verifica('la scheda dice che il viaggio porta anche FS B e la quota di questo', r.errori.length === 0
    && t.includes('Lo stesso viaggio (camion GC599NL, 10/09/2026) porta anche FS B: il viaggio si paga una volta, diviso per peso, qui 6,00 t delle 12,00 = € 200,00'), (t.match(/[^.]{0,60}Lo stesso viaggio[^.]{0,200}/g) || [String(r.errori[0] || '')]).join(' | '));
  // Una scheda cambiata e non ancora salvata conta coi valori di adesso.
  const cambiata = { ...due[0], peso_effettivo: 9000 };
  const tc = calc.trasportoIntervento(cambiata, contestoV(due));
  verifica('la scheda con il peso cambiato a 9.000 kg: 9 t delle 15, 240,00 €', tc.importo === 240 && tc.viaggio && tc.viaggio.kg_viaggio === 15000, J(tc));
});

// 9. IL FOGLIO DELLA PASSIVA RICEVE IL CONTRATTO DELLA TRATTA (chiusura del giro,
// 14/10/2026; script r5_foglio_senza_contratti.mjs della revisione D-B).
// PassivaModulo.jsx costruisce il contesto del blocco dell'extra raccolta con
// contestoPrezzi: senza il quinto argomento, le tariffe passive che legge gia',
// una secondaria col contratto della tratta (20 t x 30 €/t) valeva 0 nel foglio
// e 600 nella passiva. Qui la chiamata si prende dal sorgente della pagina e si
// esegue com'e' scritta, coi nomi delle sue letture.
await sezione('9. IL FOGLIO DELLA PASSIVA PAGA LA SECONDARIA COL CONTRATTO, COME LA PASSIVA', async () => {
  const { readFileSync } = await import('node:fs');
  const sorgente = readFileSync(new URL('../src/components/fatturazione/PassivaModulo.jsx', import.meta.url), 'utf8').replace(/\r/g, '');
  const chiamata = (sorgente.match(/bloccoExtraRaccolta\(interventi, periodo\.anno, periodo\.mese, (contestoPrezzi\([^;]*\))\);/) || [])[1] || '';
  verifica('il modulo della passiva chiama contestoPrezzi per il blocco dell\'extra raccolta', !!chiamata, chiamata);
  verifica('e le tariffe che gli passa sono quelle passive che legge, senza letture in piu\'', /const tariffe = await fetchAllClient\(base44\.entities\.Tariffa, \{ direzione: 'PASSIVA' \}/.test(sorgente)
    && (sorgente.match(/entities\.Tariffa\b/g) || []).length === 1, (sorgente.match(/entities\.Tariffa\b/g) || []).length);
  const S = [{ id: 'ts', nome: 'Accordo trasporti', origine: 'ACCORDO_COMMERCIALE', tipologia: 'EXTRA_RACCOLTA', prestazione: 'TRASPORTO_SECONDARIA', a_chi: 'tutti', euro_t_passiva: 2, euro_t_attiva: null, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31', stato: 'attivo' }];
  const r = sec('M', { trasporto_finito_il: '2026-10-12T08:00:00.000Z' });
  const p = passivaDi([r], { surplus: S, m: 9, mese: 'Ottobre' });
  const ctx = chiamata ? new Function('contestoPrezzi', 'fornitori', 'surplusAll', 'subfornitori', 'tariffe', `return ${chiamata};`)(calc.contestoPrezzi, FORNITORI, S, subfornitori, TARIFFE) : null;
  const b = ctx ? bloccoExtraRaccolta([r], 2026, 'Ottobre', ctx) : {};
  verifica('il foglio dice 600 + 40 = 640, come la passiva', b.totale_standard === 600 && b.totale_surplus === 40 && b.totale_euro === 640
    && p.totali.trasporti_secondaria === 640 && p.totali.surplus.trasporti_secondaria === 40, J([b.totale_standard, b.totale_surplus, b.totale_euro, p.totali.trasporti_secondaria]));
  verifica('e la nota non dice che il contratto della tratta non si e\' letto', !/non letto/.test(((b.righe || [])[0] || {}).note || ''), ((b.righe || [])[0] || {}).note);
});

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

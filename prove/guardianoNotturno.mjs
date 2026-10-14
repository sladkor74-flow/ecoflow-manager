// IL GUARDIANO NOTTURNO E LA MEMORIA DEI NUMERI
// (shared/indicatoriGiorno.ts, riepilogoDichiarazioni con registra, cruscotto).
//
// Due cose nella stessa riga, scritta una volta per notte:
//
// - IL GUARDIANO. La quadratura di impianti e stoccaggi della rete si rifa' ogni notte e la
//   mattina c'e' una riga sola. Finora un numero che non tornava lo scopriva
//   l'utente aprendo una pagina, o non lo scopriva nessuno: meglio che se ne
//   accorga il gestionale prima del consorzio.
// - LA MEMORIA. Il gestionale sa dire «com'e' adesso» e non «com'era a giugno»:
//   ogni numero si ricalcola sul presente e non resta niente. Il valore di
//   questa cosa e' il tempo che accumula, quindi si comincia a scrivere molto
//   prima di quando servira' leggere.
//
// Qui si prova la regola e le tre prudenze: una riga per giorno e non una per
// apertura di pagina, nessun anno cablato in uno scheduler, e un guardiano che
// smette di girare lo deve dire. Dalle decisioni dell'utente del 13/10/2026
// anche lo stoccaggio ACI (classe 9) che non quadra: «da guardare» e una voce
// sua in «Da gestire», mai insieme alla rete. npm run prove
import { fotografiaDelGiorno, vociSito, scostamenti, totaliGiorno, notaDelGiorno, leggiFotografia, giorniFa, mesiAperti, chiSiScosta } from '../base44/shared/indicatoriGiorno.ts';
// Dal 13/10/2026 (lo stoccaggio ACI in «Da gestire»): col codice di prima non
// ci sono, e la prova lo dice invece di fermarsi.
import * as G from '../base44/shared/indicatoriGiorno.ts';
const scostamentiAci = typeof G.scostamentiAci === 'function' ? G.scostamentiAci : () => [{ manca: 'scostamentiAci' }];
const notaAci = typeof G.notaAci === 'function' ? G.notaAci : () => 'manca notaAci';
import { cruscotto } from '../base44/shared/cruscotto.ts';
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sorgente = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// I siti come li calcola riepilogoDichiarazioni, coi numeri veri del 10/10/2026.
const sito = (p) => ({
  sito: 'X', chiave: 'x', tipo_destinazione: 'imp', dichiara_rete: true,
  giacenza_portale_t: 0, giacenza_calcolata_t: 0, scarto_t: 0, quadra: true,
  giacenze_canale: [], flussi: [], ...p,
});
const SITI = [
  sito({ sito: 'Irigom S.r.l.', chiave: 'irigom', giacenza_portale_t: 652.84, giacenza_calcolata_t: 652.84, scarto_t: 0, quadra: true,
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 652.84, entrato_t: 3545.16, dichiarato_caricato_t: 3277.68 }],
    flussi: [{ canale: 'RETE', resta_t: 652.84, uscito_t: 2892.32 }] }),
  sito({ sito: 'T-CYCLE INDUSTRIES SRL', chiave: 'tcycle', giacenza_portale_t: 364.8, giacenza_calcolata_t: 364.8, scarto_t: 0, quadra: true,
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 364.8, entrato_t: 707.44, dichiarato_caricato_t: 342.64 }],
    flussi: [{ canale: 'RETE', resta_t: 364.8, uscito_t: 342.64 }] }),
  sito({ sito: 'TECNOGUM SRL', chiave: 'tecnogum', dichiara_rete: false, giacenza_portale_t: null, giacenza_calcolata_t: 1833.43, scarto_t: null, quadra: null,
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 1833.43, entrato_t: 1833.43, dichiarato_caricato_t: 0 }] }),
  sito({ sito: 'NAPPI SUD SRL', chiave: 'nappisud', tipo_destinazione: 'stoc', giacenza_portale_t: 38.04, giacenza_calcolata_t: 38.04, scarto_t: 0, quadra: true,
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 38.04, entrato_t: 1664.86, dichiarato_caricato_t: 0 }] }),
];

console.log('UNA GIORNATA IN CUI TUTTO QUADRA');
{
  const f = fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026 });
  verifica('l esito e in linea', f.esito === 'in_linea', f.esito);
  verifica('e la nota conta solo chi ha un confronto col portale',
    f.nota === 'Tutti gli impianti con un confronto a portale quadrano (2).', f.nota);
  // Tecnogum non ha fotografia a portale: non si «scosta», e chiamarlo da
  // guardare sarebbe un avviso che non si puo' chiudere. La riga di Nappi Sud qui
  // non porta il canale nella chiave, come le righe di stoccaggio vere
  // («nappi sud|RETE»): senza canale non e' della rete e resta fuori. Dal
  // 12/10/2026 gli stoccaggi della rete col canale entrano nel verdetto: la
  // sezione «GLI STOCCAGGI DELLA RETE NEL VERDETTO», piu' sotto.
  verifica('chi non ha un confronto non entra nel conto', !/TECNOGUM|NAPPI/.test(f.nota));
  verifica('ma i loro numeri restano scritti lo stesso',
    JSON.parse(f.siti_json).length === 4 && JSON.parse(f.siti_json).some(s => s.sito === 'TECNOGUM SRL'));
  verifica('niente scostamenti', JSON.parse(f.scostamenti_json).length === 0);
}

console.log('UNA GIORNATA IN CUI QUALCOSA SI SCOSTA');
{
  const storti = SITI.map(s => (s.chiave === 'tcycle'
    ? { ...s, giacenza_calcolata_t: 366.0, scarto_t: 1.2, quadra: false } : s));
  const f = fotografiaDelGiorno(storti, { giorno: '2026-10-11', anno: 2026 });
  verifica('l esito lo dice', f.esito === 'da_guardare');
  verifica('e la nota fa il nome e il numero, non «1 anomalia»',
    f.nota === 'Un impianto si scosta dal portale: T-CYCLE INDUSTRIES SRL +1,20 t.', f.nota);
  const sc = JSON.parse(f.scostamenti_json);
  verifica('lo scostamento porta i due numeri che lo compongono',
    sc.length === 1 && sc[0].calcolata_t === 366 && sc[0].portale_t === 364.8);
  // Sotto la tolleranza della quadratura non e' uno scostamento: e' la stessa
  // tolleranza del resto del gestionale, non una seconda.
  const quasi = SITI.map(s => (s.chiave === 'tcycle' ? { ...s, scarto_t: 0.3, quadra: false } : s));
  verifica('mezzo quintale sotto tolleranza non sveglia nessuno',
    fotografiaDelGiorno(quasi, { giorno: '2026-10-11', anno: 2026 }).esito === 'in_linea');
  // Tre nomi, poi si contano.
  const tanti = ['a', 'b', 'c', 'd'].map((k, i) => sito({ sito: 'Sito ' + k, chiave: k, giacenza_portale_t: 10, giacenza_calcolata_t: 10 + i + 1, scarto_t: i + 1, quadra: false }));
  const n = notaDelGiorno(scostamenti(tanti.map(vociSito)), 4);
  verifica('oltre tre si contano gli altri, se no non e piu una riga',
    /4 impianti si scostano/.test(n) && /e altri 1\.$/.test(n), n);
}

console.log('I NUMERI CHE RESTANO');
{
  const f = fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026 });
  const tot = JSON.parse(f.totali_json);
  verifica('i totali sono per canale, mai sommati fra loro',
    Object.keys(tot).join() === 'RETE' && tot.RETE.giacenza_t === 2889.11, JSON.stringify(tot));
  const irigom = JSON.parse(f.siti_json).find(s => s.chiave === 'irigom');
  verifica('di ogni sito restano giacenza, portale, scarto e i canali',
    irigom.giacenza_portale_t === 652.84 && irigom.canali.RETE.entrato_t === 3545.16 && irigom.canali.RETE.resta_t === 652.84);
  verifica('e si sa chi non deve la dichiarazione, che fra sei mesi non si ricorda',
    JSON.parse(f.siti_json).find(s => s.chiave === 'tecnogum').dichiara_rete === false);
  // Rileggerla deve ridare la stessa cosa, anche se qualcuno ha rotto un JSON.
  const letta = leggiFotografia({ ...f });
  verifica('si rilegge uguale', letta.siti.length === 4 && letta.scostamenti.length === 0 && letta.nota === f.nota);
  verifica('e un JSON rotto non porta giu la pagina',
    leggiFotografia({ giorno: '2026-10-10', siti_json: '{rotto' }).siti.length === 0);
  verifica('senza riga non si inventa niente', leggiFotografia(null) === null);
}

console.log('QUANTI GIORNI FA');
verifica('ieri', giorniFa('2026-10-09', '2026-10-10') === 1);
verifica('stanotte', giorniFa('2026-10-10', '2026-10-10') === 0);
verifica('senza date non si inventa un numero', giorniFa('', '2026-10-10') === null);

console.log('LA MATTINA, IN CIMA ALLE COSE DA GESTIRE');
{
  const base = { oggi: '2026-10-10', adessoMs: Date.UTC(2026, 9, 10, 6, 0, 0), anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], riepilogoQualifica: null, richiesteEct: [] };
  const vociDi = (fotografiaGiorno) => cruscotto({ ...base, fotografiaGiorno }).da_gestire;
  const storta = leggiFotografia(fotografiaDelGiorno(
    SITI.map(s => (s.chiave === 'tcycle' ? { ...s, giacenza_calcolata_t: 366, scarto_t: 1.2, quadra: false } : s)),
    { giorno: '2026-10-10', anno: 2026 }));
  const v = vociDi(storta).find(x => x.area === 'Giacenze');
  verifica('uno scostamento si trova la mattina senza aprire niente', !!v, 'nessuna voce');
  verifica('col nome e il numero', v && /T-CYCLE INDUSTRIES SRL \+1,20 t/.test(v.dettaglio), v && v.dettaglio);
  verifica('e il giorno del controllo', v && /10\/10\/2026/.test(v.dettaglio), v && v.dettaglio);
  const buona = leggiFotografia(fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026 }));
  verifica('una notte tranquilla non dice niente', vociDi(buona).filter(x => x.area === 'Giacenze').length === 0);
  // UN GUARDIANO CHE DORME E UNO CHE NON TROVA NIENTE SI ASSOMIGLIANO TROPPO.
  const vecchia = { ...buona, giorno: '2026-10-05' };
  const m = vociDi(vecchia).find(x => x.area === 'Manutenzione');
  verifica('se il controllo ha smesso di girare lo si dice', !!m && /non gira da 5 giorni/.test(m.titolo), m && m.titolo);
  verifica('e si dice che cosa comporta', m && /uno scostamento nuovo non lo segnala nessuno/.test(m.dettaglio));
  verifica('di ieri invece va bene', vociDi({ ...buona, giorno: '2026-10-09' }).filter(x => x.area === 'Manutenzione').length === 0);
  verifica('e senza nessuna fotografia la dashboard non grida: puo non essere ancora partito',
    cruscotto(base).da_gestire.filter(x => x.area === 'Manutenzione' || x.area === 'Giacenze').length === 0);
}

console.log('GLI STOCCAGGI DELLA RETE NEL VERDETTO (12/10/2026)');
{
  // La pagina Dichiarazioni e la dashboard dicono la quadratura su impianti E
  // stoccaggi della rete (6 su 6, con Nappi Sud); il guardiano contava i soli
  // impianti, e uno stoccaggio della rete fuori di 1,20 t non diventava una voce
  // di «Da gestire». Le righe sono quelle vere di riepilogoDichiarazioni: un
  // piazzale ha una riga per canale, col canale in fondo alla chiave.
  const piazzale = (canale, p) => sito({ sito: 'NAPPI SUD SRL', chiave: `nappi sud|${canale}`, canale, tipo_destinazione: 'stoc', giacenza_portale_t: 25.88, giacenza_calcolata_t: 25.88, scarto_t: 0, quadra: true, ...p });
  const DUE = SITI.filter(s => s.tipo_destinazione !== 'stoc');
  const tutti = [...DUE, piazzale('RETE'), piazzale('ACI', { giacenza_portale_t: 0, giacenza_calcolata_t: 0 })];
  const f = fotografiaDelGiorno(tutti, { giorno: '2026-10-12', anno: 2026 });
  verifica('in linea: si contano gli impianti e lo stoccaggio della rete, non l ACI del piazzale',
    f.esito === 'in_linea' && f.nota === 'Tutti gli impianti e gli stoccaggi della rete con un confronto a portale quadrano (3).', f.nota);
  const storto = fotografiaDelGiorno([...DUE, piazzale('RETE', { giacenza_calcolata_t: 27.08, scarto_t: 1.2, quadra: false }), piazzale('ACI')], { giorno: '2026-10-12', anno: 2026 });
  verifica('uno stoccaggio della rete che non quadra fa «da guardare»', storto.esito === 'da_guardare', storto.esito);
  verifica('e la nota lo chiama stoccaggio, col nome e il numero', storto.nota === 'Uno stoccaggio si scosta dal portale: NAPPI SUD SRL +1,20 t.', storto.nota);
  const sc = JSON.parse(storto.scostamenti_json);
  verifica('lo scostamento porta il segno dello stoccaggio', sc.length === 1 && sc[0].stoccaggio === true && sc[0].chiave === 'nappi sud|RETE', J(sc));
  // Lo stoccaggio ACI (classe 9) che non quadra: fino al 13/10/2026 restava
  // fuori dal verdetto e da «Da gestire»; ora fa «da guardare» come uno della
  // rete, con la sua frase, e resta fuori dal conto della rete.
  const aciStorto = fotografiaDelGiorno([...DUE, piazzale('RETE'), piazzale('ACI', { giacenza_calcolata_t: 3, scarto_t: 3, quadra: false })], { giorno: '2026-10-12', anno: 2026 });
  verifica("lo stoccaggio ACI che non quadra fa «da guardare», con la sua frase dopo quella della rete", aciStorto.esito === 'da_guardare'
    && aciStorto.nota === 'Tutti gli impianti e gli stoccaggi della rete con un confronto a portale quadrano (3). Uno stoccaggio ACI (classe 9) si scosta dal portale: NAPPI SUD SRL +3,00 t.', aciStorto.nota);
  verifica('e non entra negli scostamenti della rete', JSON.parse(aciStorto.scostamenti_json).length === 0, aciStorto.scostamenti_json);
  const misto = fotografiaDelGiorno([
    ...DUE.map(s => (s.chiave === 'tcycle' ? { ...s, giacenza_calcolata_t: 366, scarto_t: 1.2, quadra: false } : s)),
    piazzale('RETE', { giacenza_calcolata_t: 25.08, scarto_t: -0.8, quadra: false }),
  ], { giorno: '2026-10-12', anno: 2026 });
  verifica('impianti e stoccaggi insieme: si dicono tutti e due, lo stoccaggio col suo ruolo',
    misto.nota === 'Un impianto e uno stoccaggio si scostano dal portale: T-CYCLE INDUSTRIES SRL +1,20 t, NAPPI SUD SRL (stoccaggio) -0,80 t.', misto.nota);
  // «Da gestire»: la voce degli scostamenti dice impianti o stoccaggi.
  const base = { oggi: '2026-10-12', adessoMs: Date.UTC(2026, 9, 12, 6, 0, 0), anno: 2026, tipiFile: [], alertAperti: [], uploadLogs: [], assegnatiRete: [], assegnatiAci: [], documenti: [], prefatture: [], riepilogoQualifica: null, richiesteEct: [] };
  const voceDi = (riga) => cruscotto({ ...base, fotografiaGiorno: leggiFotografia(riga) }).da_gestire.find(x => x.chiave === 'giacenze:scostamenti');
  const v1 = voceDi(storto);
  verifica('lo stoccaggio che non quadra diventa una voce di «Da gestire»', !!v1 && v1.titolo === 'Uno stoccaggio non quadra col portale' && /NAPPI SUD SRL \+1,20 t/.test(v1.dettaglio), v1 && `${v1.titolo} | ${v1.dettaglio}`);
  const v2 = voceDi(misto);
  verifica('e con un impianto: «Un impianto e uno stoccaggio non quadrano col portale»', !!v2 && v2.titolo === 'Un impianto e uno stoccaggio non quadrano col portale', v2 && v2.titolo);
  const v3 = voceDi(fotografiaDelGiorno(SITI.map(s => (s.chiave === 'tcycle' ? { ...s, giacenza_calcolata_t: 366, scarto_t: 1.2, quadra: false } : s)), { giorno: '2026-10-12', anno: 2026 }));
  verifica('un impianto solo resta «Un impianto non quadra col portale»', !!v3 && v3.titolo === 'Un impianto non quadra col portale', v3 && v3.titolo);
  // Una fotografia scritta prima del 12/10 (senza il segno) si legge lo stesso.
  verifica('uno scostamento di una riga vecchia, senza il segno, e\' un impianto', chiSiScosta([{ sito: 'Gatim', chiave: 'gatim' }]).testo === 'un impianto' && chiSiScosta([{ sito: 'NAPPI SUD SRL', chiave: 'nappi sud|RETE' }]).testo === 'uno stoccaggio');

  // LO STOCCAGGIO ACI IN «DA GESTIRE» (decisioni dell'utente del 13/10/2026,
  // gruppo B). Una voce sua, mai insieme alla rete: i canali non si mescolano.
  const tutteDi = (riga) => cruscotto({ ...base, fotografiaGiorno: leggiFotografia(riga) }).da_gestire;
  const aciDi = (riga) => tutteDi(riga).find(x => x.chiave === 'giacenze:scostamenti-aci');
  const va = aciDi(aciStorto);
  verifica('lo stoccaggio ACI che non quadra diventa una voce di «Da gestire», sua', !!va && va.titolo === 'Uno stoccaggio ACI non quadra col portale' && va.area === 'Giacenze' && va.gravita === 'attenzione' && va.sezione === 'impianti' && va.link === '/giacenze'
    && /^Uno stoccaggio ACI \(classe 9\) si scosta dal portale: NAPPI SUD SRL \+3,00 t\. /.test(va.dettaglio) && /Controllo del 12\/10\/2026\.$/.test(va.dettaglio), va && `${va.titolo} | ${va.dettaglio}`);
  verifica('e la voce della rete non c\'e\', perche\' la rete quadra', !tutteDi(aciStorto).some(x => x.chiave === 'giacenze:scostamenti'), J(tutteDi(aciStorto).map(x => x.chiave)));
  const tuttiEDue = fotografiaDelGiorno([...DUE, piazzale('RETE', { giacenza_calcolata_t: 27.08, scarto_t: 1.2, quadra: false }), piazzale('ACI', { giacenza_calcolata_t: 3, scarto_t: 3, quadra: false })], { giorno: '2026-10-12', anno: 2026 });
  const vr = voceDi(tuttiEDue), va2 = aciDi(tuttiEDue);
  verifica('rete e ACI fuori tutti e due: due voci, e ognuna dice solo il suo canale', !!vr && !!va2 && vr.titolo === 'Uno stoccaggio non quadra col portale'
    && vr.dettaglio === 'Uno stoccaggio si scosta dal portale: NAPPI SUD SRL +1,20 t. Controllo del 12/10/2026.' && !/ACI/.test(vr.dettaglio) && /\+3,00 t/.test(va2.dettaglio) && !/\+1,20 t/.test(va2.dettaglio), J([vr, va2]));
  verifica('lo stoccaggio ACI che quadra non dice niente', !aciDi(fotografiaDelGiorno([...DUE, piazzale('RETE'), piazzale('ACI')], { giorno: '2026-10-12', anno: 2026 })));
  // Dentro la tolleranza della quadratura non e' uno scostamento, come per la rete.
  verifica('dentro la tolleranza non e\' una voce', !aciDi(fotografiaDelGiorno([...DUE, piazzale('ACI', { giacenza_calcolata_t: 25.881, scarto_t: 0.001, quadra: false })], { giorno: '2026-10-12', anno: 2026 })));
  // Una fotografia scritta prima del 13/10/2026 ha le righe dei siti: la voce
  // si legge da li', anche se la sua nota non diceva niente dell'ACI.
  const vecchiaRiga = { ...aciStorto, esito: 'in_linea', nota: 'Tutti gli impianti e gli stoccaggi della rete con un confronto a portale quadrano (3).' };
  verifica('anche da una fotografia scritta prima', !!aciDi(vecchiaRiga), J(tutteDi(vecchiaRiga).map(x => x.chiave)));
  verifica('scostamentiAci prende solo le righe ACI con un confronto a portale', J(scostamentiAci(JSON.parse(tuttiEDue.siti_json)).map(x => [x.sito, x.chiave, x.canale, x.stoccaggio, x.scarto_t])) === J([['NAPPI SUD SRL', 'nappi sud|ACI', 'ACI', true, 3]])
    && scostamentiAci([{ sito: 'Y', chiave: 'y|ACI', ruolo: 'stoc', giacenza_portale_t: null, scarto_t: 4, quadra: false }]).length === 0);
  verifica('notaAci, al plurale e con gli altri', notaAci([]) === '' && notaAci([1, 2, 3, 4].map(i => ({ sito: `S${i}`, scarto_t: -i }))) === '4 stoccaggi ACI (classe 9) si scostano dal portale: S1 -1,00 t, S2 -2,00 t, S3 -3,00 t e altri 1.');
}

console.log('I MESI ANCORA APERTI, PER LA CHIUSURA DEL MESE (12/10/2026)');
{
  // La chiusura del mese li legge se ci sono (shared/chiusuraMese.ts): senza,
  // su ACI ed extra dava un rosso falso per tutto il mese dopo un arrivo.
  const mesi = (resti) => ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
    .map((mese, i) => ({ mese, da_dichiarare_kg: resti[i] || 0, resta_kg: resti[i] || 0 }));
  const tc = vociSito(sito({ sito: 'T-CYCLE INDUSTRIES SRL', chiave: 'tcycle', giacenze_canale: [{ canale: 'RETE', giacenza_t: 364.8, entrato_t: 707.44, dichiarato_caricato_t: 342.64 }],
    flussi: [{ canale: 'RETE', provenienza: '', resta_t: 364.8, uscito_t: 342.64, dall_anno_prima: null, mesi: mesi({ 5: 41980, 6: 108680, 7: 48420, 8: 124800, 9: 40920 }) }] }));
  verifica('T-Cycle rete: giugno 41,98 e poi luglio-ottobre, dal piu\' vecchio',
    J(tc.canali.RETE.mesi_aperti) === J([{ mese: 'Giugno', da_dichiarare_t: 41.98 }, { mese: 'Luglio', da_dichiarare_t: 108.68 }, { mese: 'Agosto', da_dichiarare_t: 48.42 }, { mese: 'Settembre', da_dichiarare_t: 124.8 }, { mese: 'Ottobre', da_dichiarare_t: 40.92 }]), J(tc.canali.RETE.mesi_aperti));
  const somma = tc.canali.RETE.mesi_aperti.reduce((s, m) => s + Math.round(m.da_dichiarare_t * 1000), 0);
  verifica('e la loro somma e\' il resto della colonna', somma === 364800, String(somma));
  const ap = mesiAperti([{ canale: 'RETE', dall_anno_prima: { da_dichiarare_kg: 30000 }, mesi: mesi({ 0: 5000 }) }]);
  verifica("in testa la casella dall'anno prima, come la tratta la pagina", J(ap) === J([{ mese: "dall'anno prima", da_dichiarare_t: 30 }, { mese: 'Gennaio', da_dichiarare_t: 5 }]), J(ap));
  const aci = mesiAperti([
    { canale: 'ACI', provenienza: 'primaria', mesi: mesi({ 8: 5000 }) },
    { canale: 'ACI', provenienza: 'secondaria', mesi: mesi({ 7: 3000, 8: 12820 }) },
  ]);
  verifica("l'ACI dice la provenienza, e i mesi vanno in ordine fra le due righe", J(aci) === J([
    { mese: 'Agosto', provenienza: 'secondaria', da_dichiarare_t: 3 },
    { mese: 'Settembre', provenienza: 'primaria', da_dichiarare_t: 5 },
    { mese: 'Settembre', provenienza: 'secondaria', da_dichiarare_t: 12.82 }]), J(aci));
  verifica('un canale tutto dichiarato ha l\'elenco vuoto: niente da dichiarare', J(mesiAperti([{ canale: 'RETE', mesi: mesi({}) }])) === '[]');
  verifica('righe senza i dodici mesi non dicono quali sono aperti: null, non vuoto', mesiAperti([{ canale: 'RETE', resta_t: 5 }]) === null
    && !('mesi_aperti' in JSON.parse(fotografiaDelGiorno(SITI, { giorno: '2026-10-10', anno: 2026 }).siti_json).find(s => s.chiave === 'irigom').canali.RETE));
  const tg = vociSito(sito({ sito: 'TECNOGUM SRL', chiave: 'tecnogum', dichiara_rete: false, giacenze_canale: [{ canale: 'RETE', giacenza_t: null, non_dovuta: true, entrato_t: 1833.43, dichiarato_caricato_t: 0 }],
    flussi: [{ canale: 'RETE', non_dovuta: true, resta_t: 1833.43, mesi: mesi({ 0: 100000 }) }] }));
  verifica('la rete non dovuta non ha mesi aperti', !('mesi_aperti' in tg.canali.RETE), J(tg.canali.RETE));
  // La chiusura del mese li legge: un resto ACI tutto di ottobre non apre settembre.
  const { passoDichiarazioni, periodoDelMese } = await import('../base44/shared/chiusuraMese.ts');
  const foto = leggiFotografia(fotografiaDelGiorno([sito({ sito: 'Gatim', chiave: 'gatim', giacenze_canale: [{ canale: 'ACI', giacenza_t: 5, entrato_t: 5, dichiarato_caricato_t: 0 }],
    flussi: [{ canale: 'ACI', provenienza: 'primaria', resta_t: 5, mesi: mesi({ 9: 5000 }) }] })], { giorno: '2026-10-12', anno: 2026 }));
  const p = passoDichiarazioni({ periodo: periodoDelMese(2026, 8), oggi: '2026-10-12', fotografia: foto, dichiarazioni: [] });
  verifica('con i mesi aperti scritti dal guardiano, la chiusura di settembre non vede un rosso falso su un arrivo di ottobre', p.stato === 'fatto' && /niente da dichiarare fino a settembre/.test(p.voci[0] && p.voci[0].testo), JSON.stringify(p.voci));
}

console.log('LE TRE PRUDENZE DELLA SCRITTURA');
{
  const f = sorgente('base44/functions/riepilogoDichiarazioni/entry.ts');
  // 1. Una riga per GIORNO, non una per apertura di pagina.
  verifica('scrive solo quando glielo si chiede', f.includes('const registraChiesto = corpo.registra === true;'));
  // e solo l'amministratore, sull'anno in corso: si prova sulla funzione vera in scrittureRiservate.mjs
  verifica("e solo se chi chiede e' l'amministratore", f.includes('const registra = registraChiesto && eAmministratore(user);'));
  verifica('e lo stesso giorno si riscrive, non si aggiunge',
    f.includes("const gia = await svc.IndicatoreGiorno.filter({ giorno });") && f.includes('await svc.IndicatoreGiorno.update(gia[0].id, riga);'));
  verifica('i doppioni nati prima si tolgono', f.includes('for (const d of gia.slice(1)) await svc.IndicatoreGiorno.delete(d.id)'));
  // 2. Nessun anno cablato: il 1° gennaio deve passare da se'.
  verifica('senza anno il lavoro notturno usa quello corrente',
    f.includes("const annoNum = Number(anno) || (registraChiesto ? Number(oggiRoma().slice(0, 4)) : 0);"));
  const w = sorgente('base44/workflows/GuardianoNotturno.jsonc');
  verifica('e nello scheduler non c e scritto nessun anno', !/"anno"\s*:/.test(w), w.slice(w.indexOf('args'), w.indexOf('args') + 80));
  verifica('gira ogni notte', /"cron_expression":\s*"0 5 \* \* \*"/.test(w));
  // 3. Il guardiano e' un servizio in piu', non un ostacolo: se non riesce a
  //    scrivere, la pagina risponde lo stesso.
  verifica('se la scrittura non riesce la risposta esce comunque',
    f.includes('scritta: false, errore:'));
}

console.log('');
console.log(ok + ' verifiche superate, ' + ko + ' fallite');
process.exit(ko ? 1 : 0);

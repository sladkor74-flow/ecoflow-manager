// IL GUARDIANO NOTTURNO E LA MEMORIA DEI NUMERI
// (shared/indicatoriGiorno.ts, riepilogoDichiarazioni con registra, cruscotto).
//
// Due cose nella stessa riga, scritta una volta per notte:
//
// - IL GUARDIANO. La quadratura di tutti gli impianti si rifa' ogni notte e la
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
// smette di girare lo deve dire. npm run prove
import { fotografiaDelGiorno, vociSito, scostamenti, totaliGiorno, notaDelGiorno, leggiFotografia, giorniFa } from '../base44/shared/indicatoriGiorno.ts';
import { cruscotto } from '../base44/shared/cruscotto.ts';
import { readFileSync } from 'node:fs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
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
  // Tecnogum non ha fotografia a portale e Nappi Sud e' un piazzale: nessuno
  // dei due si «scosta», e chiamarli da guardare sarebbe un avviso che non si
  // puo' chiudere.
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

console.log('LE TRE PRUDENZE DELLA SCRITTURA');
{
  const f = sorgente('base44/functions/riepilogoDichiarazioni/entry.ts');
  // 1. Una riga per GIORNO, non una per apertura di pagina.
  verifica('scrive solo quando glielo si chiede', f.includes('const registra = corpo.registra === true;'));
  verifica('e lo stesso giorno si riscrive, non si aggiunge',
    f.includes("const gia = await svc.IndicatoreGiorno.filter({ giorno });") && f.includes('await svc.IndicatoreGiorno.update(gia[0].id, riga);'));
  verifica('i doppioni nati prima si tolgono', f.includes('for (const d of gia.slice(1)) await svc.IndicatoreGiorno.delete(d.id)'));
  // 2. Nessun anno cablato: il 1° gennaio deve passare da se'.
  verifica('senza anno il lavoro notturno usa quello corrente',
    f.includes("const annoNum = Number(anno) || (registra ? Number(oggiRoma().slice(0, 4)) : 0);"));
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

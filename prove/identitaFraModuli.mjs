// Prova delle IDENTITA' FRA MODULI, CONTROLLATE OGNI NOTTE (chiusura dell'audit,
// 11/10/2026).
//
// Il catalogo (base44/shared/invarianti.ts) e la funzione del guardiano che lo fa
// girare (base44/functions/controllaInvarianti). Due parti:
// 1. il catalogo su risposte scritte a mano: ogni voce dice «torna» quando torna
//    e «non torna» coi due numeri e i due moduli quando non torna, senza gridare
//    sugli arrotondamenti;
// 2. LE FUNZIONI VERE - calcolaGiacenze, riepilogoDichiarazioni,
//    getDashboardRaccolta - chiamate da controllaInvarianti come le chiama la
//    piattaforma, su un archivio con i NUMERI VERI DI IRIGOM dell'11/10/2026
//    (apertura 385,36 t, 1.729 t arrivate nel 2025 agganciate dal report alle
//    dichiarazioni del 2026, giacenza del canale 652,84 t). Poi si rimette nel
//    codice, mentre si impacchetta, ciascuno dei difetti che le voci devono
//    trovare: la regressione di quel giorno (l'eccesso della casella dall'anno
//    prima che svuotava i mesi: riga 0 contro 652,84), una giacenza ACI diversa
//    fra i due moduli, un raccolto che conta anche l'anno prima. Ogni volta la
//    voce giusta si deve rompere, e solo lei.
// La revisione delle migliorie (11/10/2026) ha aggiunto tre cose:
// - un piazzale che le Dichiarazioni non elencano non e' «0,00 t nelle
//   Dichiarazioni»: e' un numero che manca (il 02/01/2027 sui dati veri);
// - un'identita' rotta non sparisce la notte dopo perche' una fonte non risponde:
//   resta rotta, «non riverificata», finche' una verifica non la trova a posto;
// - il motivo di una voce non verificata, che la dashboard mostra, nomina i
//   moduli e le voci in italiano, non gli identificativi e le funzioni.
// E l'ultimo giro della revisione (12/10/2026) altre due:
// - la rotta resta anche se a non riverificarla e' un controllo rifatto lo
//   stesso giorno, e le notti dopo finche' la fonte tace;
// - un piazzale con una giacenza che solo le Dichiarazioni elencano fa caso
//   come quello che solo le Giacenze elencano.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { VOCI_INVARIANTI, FONTI, verificaInvarianti, unisciInvarianti, fontiDelleVoci, TOLLERANZA_CENTESIMO_T, riportaRotte, motiviNonVerificate } from '../base44/shared/invarianti.ts';
import { vociPresidi } from '../base44/shared/presidi.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const voce = (esito, id) => (esito.voci || []).find(v => v.id === id) || {};

console.log('1. IL CATALOGO');
verifica('quattro voci, ciascuna con frase, moduli, fonti e tolleranza', VOCI_INVARIANTI.length === 4
  && VOCI_INVARIANTI.every(v => v.id && v.frase && v.moduli && v.moduli.length && v.servono.length && v.tolleranza !== undefined && typeof v.verifica === 'function'));
verifica('le fonti sono le tre funzioni vere', J(fontiDelleVoci().sort()) === J(['dashboard', 'dichiarazioni', 'giacenze']));
{
  // (a) Lo stoccaggio GATIM del 10/10/2026 e due casi che NON sono difetti:
  // l'arrotondamento a due e tre decimali, e «—» in tutti e due.
  const G = { righe: [
    { sito: 'GATIM SRL', tipo_destinazione: 'stoc', giacenza_rete_t: 12.35, giacenza_aci_t: 275.08, giacenza_extra_t: null },
    { sito: 'Alfa Recycling S.r.l.', tipo_destinazione: 'imp', giacenza_portale_t: 100.12, giacenza_aci_t: 3, giacenza_extra_t: 0.3 },
    { sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', giacenza_portale_t: null, giacenza_aci_t: 0, giacenza_extra_t: 0 },
  ] };
  const D = {
    siti: [
      { chiave: 'alfa recycling', sito: 'ALFA RECYCLING SRL', tipo_destinazione: 'imp', giacenza_portale_t: 100.124, giacenze_canale: [{ canale: 'RETE', giacenza_t: 99 }, { canale: 'ACI', giacenza_t: 3.004 }, { canale: 'EXTRA_RACCOLTA', giacenza_t: 0.3 }],
        flussi: [{ canale: 'RETE', provenienza: '', resta_t: 99 }, { canale: 'ACI', provenienza: 'primaria', resta_t: 3.004 }, { canale: 'EXTRA_RACCOLTA', provenienza: '', resta_t: 0.3 }] },
      { chiave: 'tecnogum', sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', giacenza_portale_t: null, giacenze_canale: [{ canale: 'RETE', giacenza_t: null }, { canale: 'ACI', giacenza_t: 0 }, { canale: 'EXTRA_RACCOLTA', giacenza_t: 0 }] },
    ],
    stoccaggi: [{ chiave: 'gatim', sito: 'GATIM SRL', canali: [{ canale: 'RETE', in_piazzale_t: 12.354 }, { canale: 'ACI', in_piazzale_t: 154.22 }] }],
  };
  const a = VOCI_INVARIANTI[0].verifica({ giacenze: G, dichiarazioni: D });
  verifica('(a) il caso GATIM: una sola coppia rotta, coi suoi due numeri', a.ok === false && a.casi.length === 1 && a.a === 275.08 && a.b === 154.22 && J(a.moduli) === J(['Giacenze', 'Dichiarazioni']), J(a));
  verifica('(a) il dettaglio dice sito, ruolo e canale', a.dettaglio === 'GATIM SRL (piazzale), ACI: 275,08 t nelle Giacenze, 154,22 t nelle Dichiarazioni', a.dettaglio);
  verifica('(a) l\'arrotondamento e «—» in tutti e due non sono difetti; i confronti sono nove', a.confronti === 9, String(a.confronti));
  const zeroControNiente = VOCI_INVARIANTI[0].verifica({ giacenze: { righe: [{ sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', giacenza_portale_t: 0, giacenza_aci_t: 0, giacenza_extra_t: 0 }] }, dichiarazioni: D });
  verifica('(a) 0 contro «—» e\' un difetto (la lezione di Tecnogum: uno zero dice «vuoto»)', zeroControNiente.ok === false && zeroControNiente.a === 0 && zeroControNiente.b === null && /— nelle Dichiarazioni/.test(zeroControNiente.dettaglio), J(zeroControNiente));

  // (b) La riga «Da dichiarare» di Irigom l'11/10/2026, dopo la pubblicazione.
  const rotta = { siti: [{ sito: 'IRIGOM SRL', chiave: 'irigom', tipo_destinazione: 'imp',
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 652.84 }, { canale: 'ACI', giacenza_t: 0 }, { canale: 'EXTRA_RACCOLTA', giacenza_t: 0 }],
    flussi: [{ canale: 'RETE', provenienza: '', resta_t: 0, uscito_oltre_kg: 652840, uscito_non_allocato_kg: 0 }] }] };
  const b = VOCI_INVARIANTI[1].verifica({ dichiarazioni: rotta });
  verifica('(b) la regressione di Irigom: riga 0, giacenza 652,84', b.ok === false && b.a === 0 && b.b === 652.84 && J(b.moduli) === J(['Da dichiarare', 'Giacenza del canale']), J(b));
  verifica('(b) e dice che cosa ne pensa il riepilogo', b.dettaglio === 'IRIGOM SRL, rete: la riga «Da dichiarare» somma 0,00 t, la giacenza del canale è 652,84 t (secondo il riepilogo il portale aggancia 652.840 kg più delle nostre dichiarazioni)', b.dettaglio);
  const nonDovuta = { siti: [{ sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', giacenze_canale: [{ canale: 'RETE', giacenza_t: null }], flussi: [{ canale: 'RETE', resta_t: 0, non_dovuta: true }] }] };
  verifica('(b) la rete di chi non la dichiara non si confronta', VOCI_INVARIANTI[1].verifica({ dichiarazioni: nonDovuta }).ok === true);
  const dueRighe = { siti: [{ sito: 'ALFA', tipo_destinazione: 'imp', giacenze_canale: [{ canale: 'ACI', giacenza_t: 5.002 }], flussi: [{ canale: 'ACI', provenienza: 'primaria', resta_t: 3.001 }, { canale: 'ACI', provenienza: 'secondaria', resta_t: 2.001 }] }] };
  verifica('(b) l\'ACI su due righe si somma sul canale', VOCI_INVARIANTI[1].verifica({ dichiarazioni: dueRighe }).ok === true);
  const senzaRiga = { siti: [{ sito: 'ALFA', tipo_destinazione: 'imp', giacenze_canale: [{ canale: 'ACI', giacenza_t: 4 }], flussi: [] }] };
  verifica('(b) una giacenza senza nessuna riga e\' un difetto', VOCI_INVARIANTI[1].verifica({ dichiarazioni: senzaRiga }).ok === false);

  // (c) Il raccolto di rete, 8.818,55 t in tre moduli. Le Giacenze sommano righe
  // arrotondate al centesimo: con 20 righe 4 centesimi di scarto non sono un difetto.
  const righe = Array.from({ length: 20 }, () => ({}));
  const c = (g, d, r) => VOCI_INVARIANTI[2].verifica({ giacenze: { righe, totali: { conferito_t: g } }, dichiarazioni: { totali: { conferito_t: d } }, dashboard: { kpi: { raccolto_rete_anno: r } } });
  verifica('(c) uguali, e uguali a meno degli arrotondamenti delle righe', c(8818.55, 8818.55, 8818.549999).ok === true && c(8818.59, 8818.55, 8818.55).ok === true);
  const cRotto = c(8818.55, 8818.55, 8918.55);
  verifica('(c) la Dashboard con 100 t in piu\': rotta, coi due moduli che si scostano di piu\'', cRotto.ok === false && J(cRotto.moduli) === J(['Dashboard', 'Giacenze']) && cRotto.a === 8918.55 && cRotto.b === 8818.55, J(cRotto));
  verifica('(c) la tolleranza e\' scritta: un centesimo piu\' mezzo per riga', VOCI_INVARIANTI[2].tolleranza({ giacenze: { righe } }) === 0.11 && TOLLERANZA_CENTESIMO_T === 0.01);

  // Le fonti che mancano: la voce non e' ne' rotta ne' in linea, e dice perche'.
  const parz = verificaInvarianti({ giacenze: G, dichiarazioni: D }, { errori: { dashboard: 'Rate limit exceeded' }, giorno: '2026-10-11', anno: 2026 });
  verifica('senza la dashboard: il raccolto non e\' verificato, col motivo detto col nome del modulo', voce(parz, 'raccolto_rete').verificata === false && voce(parz, 'raccolto_rete').motivo === 'la Dashboard non ha risposto: Rate limit exceeded', J(voce(parz, 'raccolto_rete')));
  verifica('e l\'esito dice «rotte» perche\' (a) e\' rotta', parz.esito === 'rotte' && /^Un'identità fra moduli si è rotta: GATIM SRL \(piazzale\), ACI/.test(parz.nota) && /Una non si è potuta verificare: la Dashboard non ha risposto/.test(parz.nota), parz.nota);

  // Un passo che controlla solo alcune voci non cancella le altre dello stesso giorno.
  const solo = verificaInvarianti({ dichiarazioni: rotta }, { voci: [VOCI_INVARIANTI[1]], giorno: '2026-10-11' });
  const unito = unisciInvarianti(parz, solo);
  verifica('l\'esito di un passo si unisce a quello del giorno, nell\'ordine del catalogo', J(unito.voci.map(v => v.id)) === J(['giacenze_uguali', 'riga_da_dichiarare', 'raccolto_rete', 'nessun_doppione']) && voce(unito, 'riga_da_dichiarare').ok === false, J(unito.voci.map(v => [v.id, v.ok])));
  verifica('di un altro giorno non si tiene niente', unisciInvarianti({ ...parz, giorno: '2026-10-10' }, solo) === solo);
}

// Gli identificativi del catalogo e i nomi delle funzioni: a video non ci vanno.
const INTERNI = /giacenze_uguali|riga_da_dichiarare|raccolto_rete|nessun_doppione|calcolaGiacenze|riepilogoDichiarazioni|getDashboardRaccolta/;

console.log('1b. UN PIAZZALE CHE LE DICHIARAZIONI NON ELENCANO NON E\' UNO ZERO');
{
  // Il 02/01/2027 sulla copia dei dati veri, col 2027 non ancora preparato: le
  // Dichiarazioni non elencano nessun sito, le Giacenze danno 25,88 t di rete al
  // piazzale Nappi Sud e 0 agli altri piazzali. Si leggeva, in rosso,
  // «25,88 t nelle Giacenze, 0,00 t nelle Dichiarazioni»: uno zero che nessun
  // modulo scrive.
  const G = { righe: [
    { sito: 'Nappi Sud Srl A Socio Unico', tipo_destinazione: 'stoc', giacenza_rete_t: 25.88, giacenza_aci_t: 0, giacenza_extra_t: null },
    { sito: 'GATIM S.R.L.', tipo_destinazione: 'stoc', giacenza_rete_t: 0, giacenza_aci_t: 0, giacenza_extra_t: null },
    { sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', giacenza_portale_t: 652.84, giacenza_aci_t: 0, giacenza_extra_t: 0 },
  ] };
  const vuote = { siti: [], stoccaggi: [] };
  const a = VOCI_INVARIANTI[0].verifica({ giacenze: G, dichiarazioni: vuote });
  verifica('(a) il piazzale che non compare: un caso solo, col numero che manca, non 0', a.ok === false && a.casi.length === 1 && a.a === 25.88 && a.b === null && a.casi[0].assente === true, J(a));
  verifica('(a) e lo dice: «nelle Dichiarazioni il piazzale non compare», non «0,00 t»', a.dettaglio === 'Nappi Sud Srl A Socio Unico (piazzale), rete: 25,88 t nelle Giacenze, mentre nelle Dichiarazioni il piazzale non compare' && !/0,00 t nelle Dichiarazioni/.test(a.dettaglio), a.dettaglio);
  verifica('(a) dove le Giacenze non hanno niente non c\'e\' niente da confrontare (GATIM a 0, l\'ACI a 0, l\'extra «—», l\'impianto non elencato)', a.confronti === 1, String(a.confronti));
  // I piazzali a 0 che le Dichiarazioni non elencano (Green Tyre e GATIM sui dati
  // veri dell'11/10/2026) non sono un difetto.
  verifica('(a) un piazzale a 0 assente dalle Dichiarazioni: niente', VOCI_INVARIANTI[0].verifica({ giacenze: { righe: [G.righe[1]] }, dichiarazioni: vuote }).ok === true);
  // Lo zero resta per il canale che manca a un piazzale elencato.
  const elencato = { siti: [], stoccaggi: [{ chiave: 'nappi sud', sito: 'NAPPI SUD SRL', canali: [{ canale: 'RETE', in_piazzale_t: 25.88 }] }] };
  const conAci = VOCI_INVARIANTI[0].verifica({ giacenze: { righe: [{ ...G.righe[0], giacenza_aci_t: 4 }] }, dichiarazioni: elencato });
  verifica('(a) un piazzale elencato senza un canale: quel canale vale 0', conAci.ok === false && conAci.a === 4 && conAci.b === 0 && /4,00 t nelle Giacenze, 0,00 t nelle Dichiarazioni/.test(conAci.dettaglio), J(conAci));
  // Fra un numero che manca e uno diverso, in cima va quello che pesa di piu'.
  const misto = VOCI_INVARIANTI[0].verifica({
    giacenze: { righe: [G.righe[0], { sito: 'GATIM SRL', tipo_destinazione: 'stoc', giacenza_rete_t: 0, giacenza_aci_t: 275.08, giacenza_extra_t: null }] },
    dichiarazioni: { siti: [], stoccaggi: [{ chiave: 'gatim', sito: 'GATIM SRL', canali: [{ canale: 'ACI', in_piazzale_t: 154.22 }] }] },
  });
  verifica('(a) in cima il caso che pesa di piu\': 120,86 t di scarto prima di 25,88 t che mancano', misto.a === 275.08 && misto.b === 154.22 && misto.casi.length === 2 && misto.casi[1].assente === true, J(misto));
  const es = verificaInvarianti({ giacenze: G, dichiarazioni: vuote }, { voci: [VOCI_INVARIANTI[0]], giorno: '2027-01-02', anno: 2027 });
  const d = vociPresidi({ indicatore: { giorno: '2027-01-02', invarianti_json: JSON.stringify(es) }, oggi: '2027-01-02', adessoMs: Date.parse('2027-01-02T08:00:00Z') });
  verifica('nella dashboard: «Giacenze 25,88 t, Dichiarazioni —», detto per quello che e\'', d.length === 1 && d[0].titolo === "Un'identità fra moduli si è rotta: Giacenze 25,88 t, Dichiarazioni —"
    && /il piazzale non compare/.test(d[0].dettaglio) && /Un modulo dice un numero e l'altro non lo dice/.test(d[0].dettaglio) && !/0,00 t/.test(d[0].titolo + d[0].dettaglio), J(d));

  // E DALL'ALTRA PARTE (revisione delle migliorie, 11/10/2026): un piazzale con
  // 40 t di ACI che solo le Dichiarazioni elencano. Si girava solo sulle righe
  // delle Giacenze, e la voce diceva «torna».
  const soloD = { siti: [], stoccaggi: [{ chiave: 'piazzale nuovo', sito: 'PIAZZALE NUOVO SRL', canali: [{ canale: 'RETE', in_piazzale_t: 0 }, { canale: 'ACI', in_piazzale_t: 40 }, { canale: 'EXTRA_RACCOLTA', in_piazzale_t: null }] }] };
  const s = VOCI_INVARIANTI[0].verifica({ giacenze: G, dichiarazioni: soloD });
  const sN = s.casi.find(c => c.sito === 'PIAZZALE NUOVO SRL');
  verifica('(a) un piazzale che le Giacenze non elencano: un caso per il canale con la giacenza, col numero che manca dalle Giacenze', s.ok === false && s.casi.length === 2 && sN && sN.a === null && sN.b === 40 && sN.canale === 'ACI' && sN.assente_in === 'Giacenze', J(s));
  verifica('(a) in cima perche\' pesa di piu\' (40 t contro 25,88), e lo dice: «nelle Giacenze il piazzale non compare»', s.a === null && s.b === 40
    && s.dettaglio === 'PIAZZALE NUOVO SRL (piazzale), ACI: 40,00 t nelle Dichiarazioni, mentre nelle Giacenze il piazzale non compare; e un altro caso', s.dettaglio);
  verifica('(a) il suo 0 e il suo «—» non fanno caso: i confronti sono due', s.confronti === 2, String(s.confronti));
  verifica('(a) un piazzale delle Dichiarazioni a 0 o «—» che le Giacenze non elencano: niente', VOCI_INVARIANTI[0].verifica({ giacenze: { righe: [] }, dichiarazioni: { siti: [], stoccaggi: [{ ...soloD.stoccaggi[0], canali: [{ canale: 'RETE', in_piazzale_t: 0 }, { canale: 'ACI', in_piazzale_t: null }] }] } }).ok === true);
  verifica('(a) un piazzale che tutti e due elencano non si conta due volte', VOCI_INVARIANTI[0].verifica({ giacenze: { righe: [{ sito: 'Piazzale Nuovo S.r.l.', tipo_destinazione: 'stoc', giacenza_rete_t: 0, giacenza_aci_t: 40, giacenza_extra_t: null }] }, dichiarazioni: soloD }).ok === true);
  const ds = vociPresidi({ indicatore: { giorno: '2026-10-11', invarianti_json: JSON.stringify(verificaInvarianti({ giacenze: { righe: [] }, dichiarazioni: soloD }, { voci: [VOCI_INVARIANTI[0]], giorno: '2026-10-11', anno: 2026 })) }, oggi: '2026-10-11', adessoMs: Date.parse('2026-10-11T08:00:00Z') });
  verifica('nella dashboard: «Giacenze —, Dichiarazioni 40,00 t»', ds.length === 1 && ds[0].titolo === "Un'identità fra moduli si è rotta: Giacenze —, Dichiarazioni 40,00 t" && /Un modulo dice un numero e l'altro non lo dice/.test(ds[0].dettaglio), J(ds));
}

console.log('1c. IL MOTIVO DI UNA VOCE NON VERIFICATA, IN ITALIANO');
{
  // Una voce nuova del catalogo senza il suo nome breve, o una fonte nuova senza
  // il modo di dirla, finirebbe a video con l'identificativo o la funzione.
  verifica('ogni voce del catalogo ha il suo nome breve, ogni fonte come la si dice a video, in italiano', VOCI_INVARIANTI.every(v => typeof v.breve === 'string' && v.breve && !INTERNI.test(v.breve) && !INTERNI.test(v.frase))
    && Object.values(FONTI).every(f => typeof f.nonRisponde === 'string' && f.nonRisponde.includes(f.modulo) && !INTERNI.test(f.nonRisponde)), J([VOCI_INVARIANTI.map(v => v.breve), Object.values(FONTI).map(f => f.nonRisponde)]));
  // La notte del 14/10 sui dati veri le Giacenze non rispondono: la dashboard
  // diceva «giacenze_uguali: calcolaGiacenze non ha risposto: timeout; raccolto_rete: ...».
  const D = { siti: [], stoccaggi: [], doppioni: [], totali: { conferito_t: 1 } };
  const es = verificaInvarianti({ dichiarazioni: D, dashboard: { kpi: { raccolto_rete_anno: 1 } } }, { errori: { giacenze: 'timeout' }, giorno: '2026-10-14', anno: 2026 });
  const m = motiviNonVerificate(es.voci);
  verifica('il motivo nomina il modulo, e le voci col loro nome; lo stesso motivo si dice una volta', m === 'le Giacenze non hanno risposto: timeout (la giacenza nei due moduli, il raccolto di rete)', m);
  verifica('nessun identificativo del catalogo ne\' nome di funzione: nei motivi, nella nota, nel motivo di ogni voce', !INTERNI.test(m) && !INTERNI.test(es.nota) && es.voci.every(v => !INTERNI.test(v.motivo || '')), J([m, es.nota]));
  const tutte = verificaInvarianti({}, { errori: { giacenze: 'timeout', dichiarazioni: 'Rate limit exceeded', dashboard: 'Rate limit exceeded' }, giorno: '2026-10-14', anno: 2026 });
  verifica('tre fonti mute: «le Dichiarazioni», «la Dashboard», al singolare e al plurale giusti', /la Dashboard non ha risposto: Rate limit exceeded/.test(motiviNonVerificate(tutte.voci)) && /le Dichiarazioni non hanno risposto: Rate limit exceeded/.test(motiviNonVerificate(tutte.voci)) && !INTERNI.test(motiviNonVerificate(tutte.voci)), motiviNonVerificate(tutte.voci));
  verifica('nessuna voce non verificata: niente da dire', motiviNonVerificate([]) === '' && motiviNonVerificate(verificaInvarianti(D ? { dichiarazioni: D } : {}, { voci: [VOCI_INVARIANTI[3]] }).voci) === '');
}

console.log('1d. UNA ROTTA NON SPARISCE PERCHE\' NON SI E\' POTUTA RIVERIFICARE');
{
  // La riga di Irigom rotta la notte del 12/10; la notte del 13/10 le
  // Dichiarazioni non rispondono. Prima il 13/10 la voce rossa spariva.
  const rotta = { siti: [{ sito: 'IRIGOM SRL', chiave: 'irigom', tipo_destinazione: 'imp',
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 652.84 }], flussi: [{ canale: 'RETE', provenienza: '', resta_t: 0, uscito_oltre_kg: 652840 }] }] };
  const buona = { siti: [{ ...rotta.siti[0], flussi: [{ canale: 'RETE', provenienza: '', resta_t: 652.84 }] }] };
  const B = [VOCI_INVARIANTI[1]];
  const notteDi = (giorno, dati, errori = {}, anno = 2026) => verificaInvarianti(dati, { errori, voci: B, giorno, anno });
  const muta = (giorno, anno = 2026) => notteDi(giorno, {}, { dichiarazioni: 'Rate limit exceeded' }, anno);
  const g12 = notteDi('2026-10-12', { dichiarazioni: rotta });
  const r13 = riportaRotte(muta('2026-10-13'), [g12]);
  const v13 = voce(r13, 'riga_da_dichiarare');
  verifica('il 13/10 la voce resta rotta, coi numeri e il giorno della verifica', v13.rotta_il === '2026-10-12' && v13.a === 0 && v13.b === 652.84 && v13.dettaglio === voce(g12, 'riga_da_dichiarare').dettaglio && r13.esito === 'rotte', J(v13));
  verifica('e resta non verificata, col motivo di stanotte: il battito del controllo dice che non riesce', v13.verificata === false && v13.ok === null && v13.motivo === 'le Dichiarazioni non hanno risposto: Rate limit exceeded', J(v13));
  verifica('la nota dice che e\' rotta e che non si e\' riverificata', /si è rotta: IRIGOM SRL, rete: .*\(al controllo del 12\/10\/2026, non riverificata\)\./.test(r13.nota) && /Una non si è potuta verificare: le Dichiarazioni non hanno risposto/.test(r13.nota), r13.nota);
  const r14 = riportaRotte(muta('2026-10-14'), [r13, g12]);
  verifica('la notte dopo ancora muta: resta, col giorno della verifica vera', voce(r14, 'riga_da_dichiarare').rotta_il === '2026-10-12', J(voce(r14, 'riga_da_dichiarare')));
  verifica('anche se il giorno della verifica e\' fuori dalle righe lette: la rotta riportata basta', voce(riportaRotte(muta('2026-10-14'), [r13]), 'riga_da_dichiarare').rotta_il === '2026-10-12');
  const nonScritta = muta('2026-10-13'); // un giorno in cui nemmeno la lettura di prima e' riuscita
  verifica('un giorno muto senza niente da riportare si salta: si risale alla verifica', voce(riportaRotte(muta('2026-10-14'), [nonScritta, g12]), 'riga_da_dichiarare').rotta_il === '2026-10-12');
  const g15 = notteDi('2026-10-15', { dichiarazioni: buona });
  verifica('una verifica che la trova a posto: tutto verificato, niente da riportare', riportaRotte(g15, [r14, r13, g12]) === g15 && voce(g15, 'riga_da_dichiarare').ok === true);
  const r16 = riportaRotte(muta('2026-10-16'), [g15, r14, r13, g12]);
  verifica('e dopo, se torna muta, non risuscita la rotta vecchia', !voce(r16, 'riga_da_dichiarare').rotta_il && r16.esito === 'non_verificate', J(voce(r16, 'riga_da_dichiarare')));
  verifica('una a posto all\'ultima verifica non diventa rotta', !voce(riportaRotte(muta('2026-10-13'), [notteDi('2026-10-12', { dichiarazioni: buona })]), 'riga_da_dichiarare').rotta_il);
  verifica('un anno non si porta nell\'altro: il controllo guarda l\'anno in corso', !voce(riportaRotte(muta('2027-01-01', 2027), [notteDi('2026-12-31', { dichiarazioni: rotta })]), 'riga_da_dichiarare').rotta_il);
  verifica('una riga dello stesso giorno senza istante non conta: non si sa se viene prima', !voce(riportaRotte(muta('2026-10-12'), [g12]), 'riga_da_dichiarare').rotta_il);
  verifica('le righe dei giorni dopo non contano', !voce(riportaRotte(muta('2026-10-12'), [notteDi('2026-10-13', { dichiarazioni: rotta })]), 'riga_da_dichiarare').rotta_il);

  // IL CONTROLLO RIFATTO LO STESSO GIORNO (revisione delle migliorie,
  // 11/10/2026). Rotta alle 5; alle 11 il controllo si rilancia, proprio per
  // vedere se una correzione l'ha sistemata, e le Dichiarazioni non rispondono.
  // La voce non verificata delle 11 prendeva il posto di quella rotta delle 5
  // (unisciInvarianti) e qui si guardavano solo i giorni prima: la rotta
  // spariva subito, e non tornava le notti dopo finche' la fonte taceva.
  const alle = (e, il) => ({ ...e, il });
  const g12delle5 = alle(g12, '2026-10-12T03:00:40.000Z');
  const m12delle11 = alle(muta('2026-10-12'), '2026-10-12T09:00:00.000Z');
  const r12 = riportaRotte(unisciInvarianti(g12delle5, m12delle11), [g12delle5]);
  const v12 = voce(r12, 'riga_da_dichiarare');
  verifica('rilanciato alle 11 con una fonte muta: la rotta delle 5 resta, coi suoi numeri e il suo giorno', r12.esito === 'rotte' && v12.rotta_il === '2026-10-12' && v12.a === 0 && v12.b === 652.84
    && v12.verificata === false && v12.motivo === 'le Dichiarazioni non hanno risposto: Rate limit exceeded' && r12.il === '2026-10-12T09:00:00.000Z', J(r12));
  const r13dopo = riportaRotte(muta('2026-10-13'), [r12]);
  verifica('e la notte dopo, con la fonte ancora muta, resta: rotta al controllo del 12/10', voce(r13dopo, 'riga_da_dichiarare').rotta_il === '2026-10-12' && r13dopo.esito === 'rotte', J(voce(r13dopo, 'riga_da_dichiarare')));
  verifica('un esito dello stesso giorno scritto dopo non conta', !voce(riportaRotte(alle(muta('2026-10-12'), '2026-10-12T02:00:00.000Z'), [g12delle5]), 'riga_da_dichiarare').rotta_il);
  const buona12 = (il) => alle(notteDi('2026-10-12', { dichiarazioni: buona }), il);
  const rotta12 = (il) => alle(notteDi('2026-10-12', { dichiarazioni: rotta }), il);
  verifica('vale l\'esito piu\' recente: a posto alle 5, rotta il giorno prima: a posto', !voce(riportaRotte(m12delle11, [notteDi('2026-10-11', { dichiarazioni: rotta }), buona12('2026-10-12T03:00:40.000Z')]), 'riga_da_dichiarare').rotta_il);
  verifica('due esiti dello stesso giorno: a posto alle 5, rotta alle 7, vale quello delle 7', voce(riportaRotte(m12delle11, [buona12('2026-10-12T03:00:40.000Z'), rotta12('2026-10-12T05:00:00.000Z')]), 'riga_da_dichiarare').rotta_il === '2026-10-12');
  verifica('e il contrario: rotta alle 5, a posto alle 7, niente', !voce(riportaRotte(m12delle11, [rotta12('2026-10-12T03:00:40.000Z'), buona12('2026-10-12T05:00:00.000Z')]), 'riga_da_dichiarare').rotta_il);
  const d13 = vociPresidi({ indicatore: { giorno: '2026-10-13', invarianti_json: JSON.stringify(r13) }, oggi: '2026-10-13', adessoMs: Date.parse('2026-10-13T08:00:00Z') });
  verifica('la mattina del 13/10 la dashboard la dice ancora, «non riverificata stanotte»', d13.length === 1 && d13[0].gravita === 'critico'
    && d13[0].titolo === "Un'identità fra moduli si è rotta: Da dichiarare 0,00 t, Giacenza del canale 652,84 t (non riverificata stanotte)", J(d13));
}

console.log('2. LE FUNZIONI VERE, SUI NUMERI DI IRIGOM');
// --- L'SDK finto: archivio in memoria, $in/$gte/$lte, le chiamate fra funzioni ---
const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if ('$in' in v) return v.$in.includes(r[k]);
    if ('$gte' in v && !(r[k] != null && String(r[k]) >= String(v.$gte))) return false;
    if ('$lte' in v && !(r[k] != null && String(r[k]) <= String(v.$lte))) return false;
    return true;
  }
  if (v === null) return r[k] === null || r[k] === undefined || r[k] === '';
  return r[k] === v;
});
const tab = (n) => (globalThis.__DB[n] = globalThis.__DB[n] || []);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
let progressivo = 0;
const scrivi = (x) => globalThis.__SCRITTE.push(x);
const entita = (n) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(tab(n)).slice(skip, skip + lim).map(r => ({ ...r })),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina(tab(n).filter(r => soddisfa(r, f))).slice(skip, skip + lim).map(r => ({ ...r })),
  get: async (id) => ({ ...tab(n).find(r => r.id === id) }),
  create: async (r) => { const x = { id: n + '-n' + (++progressivo), ...r }; tab(n).push(x); scrivi({ op: 'create', entita: n, dati: r }); return { ...x }; },
  bulkCreate: async (rr) => { for (const r of rr) tab(n).push({ id: n + '-n' + (++progressivo), ...r }); scrivi({ op: 'bulkCreate', entita: n }); return rr; },
  update: async (id, r) => { const x = tab(n).find(y => y.id === id); if (x) Object.assign(x, r); scrivi({ op: 'update', entita: n, id, dati: r }); return { ...x }; },
  delete: async (id) => { const t = tab(n); const i = t.findIndex(y => y.id === id); if (i >= 0) t.splice(i, 1); scrivi({ op: 'delete', entita: n, id }); return {}; },
});
const entities = new Proxy({}, { get: (_t, n) => entita(String(n)) });
const functions = { invoke: async (nome, corpo) => globalThis.__INVOCA(nome, corpo) };
export function createClientFromRequest() {
  return { auth: { me: async () => (globalThis.__RUOLO ? { role: globalThis.__RUOLO, email: 'prova@prova' } : null) }, asServiceRole: { entities, functions }, entities, functions };
}`;
// guasti: { 'nomeFile.ts': [vecchio, nuovo] } riscrive un file mentre si impacchetta.
const impacchetta = async (nome, guasti = {}) => {
  const usati = new Set();
  const pacchetto = await build({
    entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
    bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
    plugins: [{ name: 'sdk-finto', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
      b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      b.onLoad({ filter: /\.ts$/ }, async (args) => {
        const chiave = Object.keys(guasti).find(k => args.path.replace(/\\/g, '/').endsWith(k));
        if (!chiave) return null;
        const s = (await readFile(args.path, 'utf8')).replace(/\r/g, '');
        const [vecchio, nuovo] = guasti[chiave];
        if (!s.includes(vecchio)) throw new Error(`il guasto non trova il codice in ${chiave}`);
        usati.add(chiave);
        return { contents: s.replace(vecchio, nuovo), loader: 'ts' };
      });
    } }],
  });
  for (const k of Object.keys(guasti)) if (!usati.has(k)) throw new Error(`guasto non applicato: ${k} in ${nome}`);
  return import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
};

// Le quattro funzioni si impacchettano una volta; per un guasto si rifa' solo
// quella che lo contiene, e poi si rimette la buona.
const FUNZIONI = {};
const BUONE = {};
const carica = async (guasti = {}) => {
  for (const nome of ['controllaInvarianti', 'calcolaGiacenze', 'riepilogoDichiarazioni', 'getDashboardRaccolta']) {
    const suoi = Object.fromEntries(Object.entries(guasti).filter(([, g]) => g.in === nome).map(([k, g]) => [k, g.cambio]));
    if (Object.keys(suoi).length) FUNZIONI[nome] = await impacchetta(nome, suoi);
    else FUNZIONI[nome] = BUONE[nome] || (BUONE[nome] = await impacchetta(nome));
  }
};
globalThis.__INVOCA = async (nome, corpo) => {
  globalThis.__INVOCATE.push(nome);
  // Un 500, non un 429: sul 429 il client ripete la chiamata dopo una pausa (limiteRichieste.ts).
  if (globalThis.__NON_RISPONDE === nome) throw Object.assign(new Error('Request failed with status code 500'), { response: { status: 500, data: { error: 'database non raggiungibile' } } });
  const r = await FUNZIONI[nome].default({ json: async () => corpo });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error('Request failed with status code ' + r.status), { response: { status: r.status, data: j } });
  return { data: j };
};

// --- L'orologio fermo: domenica 11/10/2026, le 10 a Roma ---
const OraVera = Date;
const ADESSO = OraVera.parse('2026-10-11T08:00:00Z');
// Un'altra ora, per il controllo rifatto lo stesso giorno: `ora` in millisecondi.
const conOra = async (f, ora = ADESSO) => {
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ora); } static now() { return ora; } };
  try { return await f(); } finally { globalThis.Date = OraVera; }
};

// --- L'archivio ---
const IRI = 'IRIGOM SRL', NAP = 'NAPPI SUD SRL', ALFA = 'ALFA RECYCLING SRL', TEC = 'TECNOGUM SRL';
// Irigom, 2026: gli arrivi di ogni mese e quello che il report ne dice uscito (11/10/2026).
const IR_CONFERITO = [375000, 361880, 392740, 368000, 343780, 423780, 499540, 272380, 375140, 132920];
const IR_REPORT = [375000, 361880, 392740, 368000, 343780, 423780, 499540, 113280, 0, 0];
const mm = (i) => String(i + 1).padStart(2, '0');
const g8 = (giorno) => `${giorno}T08:00:00Z`;
const primaria = (id, dest, kg, giorno, extra = {}) => ({
  id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest, tipo_destinazione: 'imp', stato: 'terminato',
  peso_effettivo: kg, trasportatore: 'RACCOLTA SRL', provincia: 'NA', ordine_immesso_il: g8(giorno), trasporto_iniziato_il: g8(giorno), trasporto_finito_il: g8(giorno), ordine_chiuso_il: g8(giorno), ...extra,
});
const dich = (sito, mese, canale, kg, caricata_il, extra = {}) => ({ sito, anno: 2026, mese, canale, provenienza: '', operazione: 'R3', quantita_kg: kg, caricata_inviata: !!caricata_il, caricata_il: caricata_il || '', ...extra });
const riga = (ordine, dest, kg, fine, quando) => ({ ordine_primaria: ordine, prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: dest, fine_trasporto: fine, data_dichiarazione: quando, peso_associato_kg: kg, id_dichiarazione: 'D-' + ordine });
const nelFile = (ordine, dest, kg, fine) => ({ ordine_primaria: ordine, destinazione: dest, prodotto: '.class1', peso_non_dichiarato_kg: kg, created_date: '2026-10-05T06:00:00Z', fine_trasporto: fine });
let seq = 0;
const conId = (righe) => righe.map(r => ({ id: 'r' + String(++seq).padStart(5, '0'), ...r }));
const archivio = () => ({
  GiacenzaSito: conId([
    { sito: IRI, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, tipologia_trattamento: 'Frantumazione', giacenza_riferimento_t: 385.36, apertura_del: '2025-12-31' },
    { sito: ALFA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, tipologia_trattamento: 'EoW' },
    { sito: NAP, tipo_destinazione: 'stoc', anno: 2026 },
    { sito: TEC, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
  ]),
  GiacenzaStoccaggio: conId([{ sito: NAP, data_rilevazione: '2025-12-31', class1_kg: 20000, class2_kg: 0, class3_kg: 0, class4_kg: 0, class9_kg: 5000, created_date: '2026-01-02T09:00:00Z' }]),
  PrimariaRete: conId([
    ...IR_CONFERITO.map((kg, i) => primaria(`ET26IRI${mm(i)}`, IRI, kg, `2026-${mm(i)}-10`)),
    // Un carico dell'anno prima: il raccolto del 2026 non lo deve contare.
    primaria('ET25IRI11', IRI, 100000, '2025-11-10'),
    primaria('ET26NAP04', NAP, 8000, '2026-04-10', { tipo_destinazione: 'stoc' }),
    primaria('ET26TEC05', TEC, 30000, '2026-05-10'),
  ]),
  PrimariaAci: conId([{ ...primaria('ET26ALFA04', ALFA, 5000, '2026-04-05'), classe: 'PFU Autodemolizione', prodotto: '.class9' }]),
  ExtraRaccolta: conId([{ ...primaria('PHX0001', ALFA, 400, '2026-05-11'), tipo_movimento: 'primaria' }]),
  Secondaria: conId([{ ...primaria('SEC26NAP06', ALFA, 3000, '2026-06-10'), stoccaggio: NAP }]),
  Terziaria: [],
  DichiarazioneSito: conId([
    // Irigom ha dichiarato e caricato 3.277,68 t: 385,36 + 3.545,16 - 652,84.
    dich(IRI, 'Febbraio', 'RETE', 1000000, '2026-02-20', { operazione: 'R1' }),
    dich(IRI, 'Giugno', 'RETE', 1277680, '2026-06-25', { operazione: 'R1' }),
    dich(IRI, 'Settembre', 'RETE', 1000000, '2026-09-25', { operazione: 'R1' }),
    dich(ALFA, 'Aprile', 'ACI', 2000, '2026-04-30', { provenienza: 'primaria' }),
    dich(ALFA, 'Maggio', 'EXTRA_RACCOLTA', 100, '2026-05-30'),
  ]),
  DichiarazioneTrattamento: conId([
    // Il report aggancia alle dichiarazioni del 2026 1.729 t arrivate nel 2025...
    riga('ET25IRI-VARI', IRI, 1729000, '2025-11-10', '2026-02-20'),
    // ...e dei carichi del 2026 quello che IR_REPORT dice.
    ...IR_REPORT.map((kg, i) => (kg ? riga(`ET26IRI${mm(i)}`, IRI, kg, `2026-${mm(i)}-10`, i < 7 ? '2026-06-25' : '2026-09-25') : null)).filter(Boolean),
  ]),
  OrdineNonDichiarato: conId([
    nelFile('ET26IRI08', IRI, 144780, '2026-08-10'),
    nelFile('ET26IRI09', IRI, 375140, '2026-09-10'),
    nelFile('ET26IRI10', IRI, 132920, '2026-10-10'),
  ]),
  // La fotografia di stanotte, scritta dal guardiano alle 5.
  IndicatoreGiorno: [{ id: 'ig-oggi', giorno: '2026-10-11', anno: 2026, esito: 'in_linea', nota: 'Tutti gli impianti con un confronto a portale quadrano (1).' }],
  UploadLog: [], ImpiantoTargetSecondaria: [], TargetRaccoglitore: [], TargetMensile: [], CommessaEcotyre: [], EsecuzioneLavoro: [],
});
const notte = async ({ ruolo = 'admin', db = archivio(), corpo = {}, nonRisponde = null, ora = ADESSO } = {}) => {
  globalThis.__DB = db; globalThis.__SCRITTE = []; globalThis.__INVOCATE = []; globalThis.__RUOLO = ruolo; globalThis.__NON_RISPONDE = nonRisponde;
  const r = await conOra(() => FUNZIONI.controllaInvarianti.default({ json: async () => corpo }), ora);
  return { stato: r.status, j: await r.json(), db, scritte: [...globalThis.__SCRITTE], invocate: [...globalThis.__INVOCATE] };
};
const scritto = (n) => JSON.parse((n.db.IndicatoreGiorno[0] || {}).invarianti_json || 'null');
const battito = (n) => (n.db.EsecuzioneLavoro || []).find(e => e.lavoro === 'controllaInvarianti') || null;

await carica();
{
  const n = await notte();
  const e = scritto(n);
  verifica('la notte buona: 200, scritto nella riga di oggi, tutte in linea', n.stato === 200 && n.j.invarianti && n.j.invarianti.scritte === true && e && e.giorno === '2026-10-11' && e.esito === 'in_linea', J({ s: n.stato, j: n.j.invarianti }));
  verifica('tutte e quattro verificate e in linea', e && e.voci.length === 4 && e.voci.every(v => v.verificata && v.ok === true), J(e && e.voci.map(v => [v.id, v.ok, v.dettaglio || v.motivo])));
  verifica('le tre funzioni vere, una volta ciascuna', J([...n.invocate].sort()) === J(['calcolaGiacenze', 'getDashboardRaccolta', 'riepilogoDichiarazioni']), J(n.invocate));
  verifica('nella riga di oggi si aggiunge il campo, il resto della fotografia resta', n.db.IndicatoreGiorno.length === 1 && n.db.IndicatoreGiorno[0].nota.startsWith('Tutti gli impianti')
    && n.scritte.filter(w => w.entita === 'IndicatoreGiorno').every(w => w.op === 'update' && J(Object.keys(w.dati)) === J(['invarianti_json'])), J(n.scritte));
  const riga2 = e && voce(e, 'riga_da_dichiarare');
  verifica('Irigom col report vero: la riga torna con la giacenza (confronti fatti)', riga2 && riga2.confronti >= 3, J(riga2));
  const g = e && voce(e, 'giacenze_uguali');
  verifica('Giacenze e Dichiarazioni: impianti e piazzale confrontati', g && g.confronti >= 12, J(g && g.confronti));
  const racc = e && voce(e, 'raccolto_rete');
  verifica('il raccolto di rete: 3.583,16 t in tutti e tre, senza il carico del 2025', racc && J(racc.casi.map(c => c.t)) === J([3583.16, 3583.16, 3583.16]), J(racc && racc.casi));
  const b = battito(n);
  verifica('e il controllo lascia il suo battito: riuscito', b && b.ultimo_esito === 'riuscito' && /Le 4 identità fra moduli tornano/.test(b.sintesi), J(b));
  verifica('una notte buona non da\' nessuna voce alla dashboard', J(vociPresidi({ esecuzioni: n.db.EsecuzioneLavoro, indicatore: n.db.IndicatoreGiorno[0], oggi: '2026-10-11', adessoMs: ADESSO })) === '[]');
}

console.log('3. I DIFETTI RIMESSI NEL CODICE: OGNI VOLTA SI ROMPE LA VOCE GIUSTA');
const GUASTI = {
  // La regressione dell'11/10/2026 (prima di 7607980): l'eccesso della casella
  // dall'anno prima trattato come un aggancio caduto nel mese sbagliato.
  riga_da_dichiarare: { 'shared/usciteDichiarate.ts': { in: 'riepilogoDichiarazioni', cambio: ['if (q > c) { if (i === 0) oltrePrima += q - c; else fuoriMese += q - c; q = c; }', 'if (q > c) { fuoriMese += q - c; q = c; }'] } },
  // Le Giacenze che contano due volte il dichiarato ACI di un impianto.
  giacenze_uguali: { 'functions/calcolaGiacenze/entry.ts': { in: 'calcolaGiacenze', cambio: ["giacenza_aci_t = aperturaAci + conferito_aci_t + secondarie_aci_in_t - dichiaratoCanale(ns, 'ACI');", "giacenza_aci_t = aperturaAci + conferito_aci_t + secondarie_aci_in_t - 2 * dichiaratoCanale(ns, 'ACI');"] } },
  // La dashboard che conta le primarie di ogni anno.
  raccolto_rete: { 'functions/getDashboardRaccolta/entry.ts': { in: 'getDashboardRaccolta', cambio: ['const reteAnno = rete.filter(r => anni.includes(getAnno(r)));', 'const reteAnno = rete;'] } },
};
for (const [id, guasti] of Object.entries(GUASTI)) {
  await carica(guasti);
  const n = await notte();
  const e = scritto(n);
  const rotte = e ? e.voci.filter(v => v.verificata && v.ok === false).map(v => v.id) : [];
  verifica(`${id}: si rompe lei, e solo lei`, J(rotte) === J([id]), J(e && e.voci.map(v => [v.id, v.ok, v.dettaglio])));
  const v = e && voce(e, id);
  const presidi = vociPresidi({ esecuzioni: n.db.EsecuzioneLavoro, indicatore: n.db.IndicatoreGiorno[0], oggi: '2026-10-11', adessoMs: ADESSO });
  const d = presidi.find(x => x.chiave === `invariante:${id}`);
  if (id === 'riga_da_dichiarare') {
    verifica('la regressione di Irigom: riga 0, giacenza 652,84, come sul sito', v && v.a === 0 && v.b === 652.84 && /^IRIGOM SRL, rete: la riga «Da dichiarare» somma 0,00 t, la giacenza del canale è 652,84 t \(secondo il riepilogo il portale aggancia 652\.840 kg più delle nostre dichiarazioni, /.test(v.dettaglio), J(v));
    verifica('e la mattina dopo la dashboard lo dice coi due numeri', d && d.titolo === "Un'identità fra moduli si è rotta: Da dichiarare 0,00 t, Giacenza del canale 652,84 t" && d.gravita === 'critico' && d.link === '/dichiarazioni-impianti', J(d));
  }
  if (id === 'giacenze_uguali') {
    verifica('l\'ACI di Alfa: 1 t nelle Giacenze, 3 nelle Dichiarazioni', v && v.a === 1 && v.b === 3 && v.dettaglio === 'ALFA RECYCLING SRL, ACI: 1,00 t nelle Giacenze, 3,00 t nelle Dichiarazioni', J(v));
    verifica('e la dashboard: «Giacenze 1,00 t, Dichiarazioni 3,00 t»', d && d.titolo === "Un'identità fra moduli si è rotta: Giacenze 1,00 t, Dichiarazioni 3,00 t", J(d));
  }
  if (id === 'raccolto_rete') {
    verifica('il raccolto: la Dashboard conta anche le 100 t del 2025', v && J(v.moduli) === J(['Dashboard', 'Giacenze']) && v.a === 3683.16 && v.b === 3583.16, J(v));
  }
  verifica(`${id}: il controllo e' riuscito (ha trovato il difetto, non e' un guasto suo)`, battito(n) && battito(n).ultimo_esito === 'riuscito', J(battito(n)));
}
await carica();

console.log('4. LE PRUDENZE');
{
  const db = archivio();
  db.UploadLog = [{ id: 'u1', tipo_file: 'primarie', esito: 'in_corso', modalita: 'sostituzione', created_date: new OraVera(ADESSO - 2 * 60000).toISOString().replace('Z', ''), nome_file: 'PRIMARIE.xlsx' }];
  const n = await notte({ db });
  verifica('un caricamento a meta\': 409 «rinviato», col motivo', n.stato === 409 && n.j.rinviato === true && /primarie/.test(n.j.error || '') && n.j.invarianti && n.j.invarianti.rinviate === true, J(n.j).slice(0, 300));
  verifica('e niente: nessuna funzione chiamata, nessuna scrittura, nemmeno il battito', n.invocate.length === 0 && n.scritte.length === 0, J([n.invocate, n.scritte]));
}
{
  const n = await notte({ ruolo: 'user' });
  verifica('chi non e\' amministratore: sola lettura, senza chiamare niente e senza scrivere', n.stato === 403 && n.j.sola_lettura === true && n.invocate.length === 0 && n.scritte.length === 0, J(n));
}
{
  const db = archivio();
  db.IndicatoreGiorno = [{ id: 'ig-ieri', giorno: '2026-10-10', anno: 2026, esito: 'in_linea' }];
  const n = await notte({ db });
  verifica('senza la fotografia di oggi non se ne crea una mezza', n.stato === 200 && n.j.invarianti.scritte === false && /non c'è/.test(n.j.invarianti.motivo)
    && db.IndicatoreGiorno.length === 1 && !db.IndicatoreGiorno[0].invarianti_json && n.invocate.length === 0, J(n.j));
  verifica('e il battito dice che il giro non e\' riuscito, e perche\'', battito(n) && battito(n).ultimo_esito === 'fallito' && /fotografia del giorno/.test(battito(n).errore), J(battito(n)));
}
{
  const n = await notte({ nonRisponde: 'getDashboardRaccolta' });
  const e = scritto(n);
  verifica('una funzione che non risponde: le voci che non la usano si verificano lo stesso', e && voce(e, 'giacenze_uguali').ok === true && voce(e, 'riga_da_dichiarare').ok === true
    && voce(e, 'raccolto_rete').verificata === false && voce(e, 'raccolto_rete').motivo === 'la Dashboard non ha risposto: database non raggiungibile' && e.esito === 'non_verificate', J(e && e.voci.map(v => [v.id, v.ok, v.motivo])));
  verifica('non e\' una voce rossa, ma il battito del controllo dice che non e\' riuscito', J(vociPresidi({ indicatore: n.db.IndicatoreGiorno[0], oggi: '2026-10-11', adessoMs: ADESSO })) === '[]'
    && battito(n) && battito(n).ultimo_esito === 'fallito' && battito(n).errore === 'la Dashboard non ha risposto: database non raggiungibile (il raccolto di rete)', J(battito(n)));
  // L'errore del battito la dashboard lo mostra: niente identificativi del
  // catalogo ne' nomi di funzioni (revisione delle migliorie, 11/10/2026).
  verifica('l\'errore del battito, che si vede a video, e\' in italiano: il modulo e la voce', battito(n) && !INTERNI.test(battito(n).errore) && !INTERNI.test(n.j.invarianti.motivi) && !INTERNI.test(e.nota), J([battito(n) && battito(n).errore, n.j.invarianti.motivi, e.nota]));
}
{
  // UNA ROTTA NON SPARISCE PERCHE' STANOTTE NON SI E' POTUTA RIVERIFICARE
  // (revisione delle migliorie, 11/10/2026), con la funzione vera. Ieri sera la
  // riga «Da dichiarare» di Irigom era rotta (la regressione dell'11/10); stanotte
  // le Dichiarazioni non rispondono, e nessuna delle quattro voci si verifica.
  // Prima la riga di oggi non aveva nessuna voce rotta e la dashboard taceva
  // fino a che il battito non contava due notti.
  const ieri = verificaInvarianti({ dichiarazioni: { siti: [{ sito: IRI, chiave: 'irigom', tipo_destinazione: 'imp',
    giacenze_canale: [{ canale: 'RETE', giacenza_t: 652.84 }], flussi: [{ canale: 'RETE', provenienza: '', resta_t: 0, uscito_oltre_kg: 652840 }] }], stoccaggi: [], doppioni: [] } },
  { voci: [VOCI_INVARIANTI[1]], giorno: '2026-10-10', anno: 2026 });
  const db = archivio();
  db.IndicatoreGiorno = [
    { id: 'ig-ieri', giorno: '2026-10-10', anno: 2026, esito: 'in_linea', invarianti_json: JSON.stringify(ieri) },
    // Una riga dell'anno prima con la stessa voce rotta: non conta.
    { id: 'ig-2025', giorno: '2025-12-31', anno: 2025, esito: 'in_linea', invarianti_json: JSON.stringify({ ...ieri, giorno: '2025-12-31', anno: 2025 }) },
    ...db.IndicatoreGiorno,
  ];
  const n = await notte({ db, nonRisponde: 'riepilogoDichiarazioni' });
  const oggi = db.IndicatoreGiorno.find(r => r.giorno === '2026-10-11');
  const e = JSON.parse((oggi && oggi.invarianti_json) || 'null');
  const r = e && voce(e, 'riga_da_dichiarare');
  verifica('stanotte non verificata, ma la voce rotta di ieri resta: coi numeri e il giorno di quella verifica', n.stato === 200 && e && e.esito === 'rotte'
    && r.verificata === false && r.rotta_il === '2026-10-10' && r.a === 0 && r.b === 652.84 && r.motivo === 'le Dichiarazioni non hanno risposto: database non raggiungibile', J(r));
  verifica('le altre voci, che ieri non erano rotte, restano solo non verificate', e && e.voci.filter(v => v.rotta_il).length === 1 && e.voci.every(v => v.verificata === false), J(e && e.voci.map(v => [v.id, v.rotta_il])));
  verifica('la risposta la dice rotta e non riverificata', n.j.invarianti.esito === 'rotte' && n.j.invarianti.rotte.length === 1 && n.j.invarianti.rotte[0].non_riverificata === true && n.j.invarianti.rotte[0].rotta_il === '2026-10-10', J(n.j.invarianti));
  verifica('e il battito del controllo dice che non e\' riuscito', battito(n) && battito(n).ultimo_esito === 'fallito' && /^le Dichiarazioni non hanno risposto: database non raggiungibile \(/.test(battito(n).errore), J(battito(n)));
  verifica('le altre fotografie non si toccano', db.IndicatoreGiorno.find(x => x.id === 'ig-ieri').invarianti_json === JSON.stringify(ieri)
    && n.scritte.filter(w => w.entita === 'IndicatoreGiorno').every(w => w.op === 'update' && w.id === 'ig-oggi'), J(n.scritte));
  const d = vociPresidi({ esecuzioni: db.EsecuzioneLavoro, indicatore: oggi, oggi: '2026-10-11', adessoMs: ADESSO });
  verifica('la mattina la dashboard la dice ancora, rossa, «non riverificata stanotte»', d.length === 1 && d[0].gravita === 'critico' && d[0].chiave === 'invariante:riga_da_dichiarare'
    && d[0].titolo === "Un'identità fra moduli si è rotta: Da dichiarare 0,00 t, Giacenza del canale 652,84 t (non riverificata stanotte)"
    && d[0].dettaglio.includes('Rotta al controllo del 10/10/2026; stanotte non si è potuta riverificare (le Dichiarazioni non hanno risposto: database non raggiungibile)') && !INTERNI.test(d[0].dettaglio), J(d));
  // La notte dopo, con le Dichiarazioni che rispondono e il conto a posto: la voce va via.
  const db2 = archivio();
  db2.IndicatoreGiorno = [{ id: 'ig-ieri', giorno: '2026-10-10', anno: 2026, esito: 'in_linea', invarianti_json: JSON.stringify(ieri) }, ...db2.IndicatoreGiorno];
  const n2 = await notte({ db: db2 });
  const e2 = JSON.parse(db2.IndicatoreGiorno.find(x => x.giorno === '2026-10-11').invarianti_json);
  verifica('una verifica che la trova a posto la toglie', e2.esito === 'in_linea' && !e2.voci.some(v => v.rotta_il) && J(vociPresidi({ indicatore: db2.IndicatoreGiorno.find(x => x.giorno === '2026-10-11'), oggi: '2026-10-11', adessoMs: ADESSO })) === '[]', J(n2.j.invarianti));
}
{
  // IL CONTROLLO RIFATTO LO STESSO GIORNO, con la funzione vera (revisione delle
  // migliorie, 11/10/2026). Alle 5 la riga «Da dichiarare» di Irigom e' rotta (la
  // regressione dell'11/10); alle 11 il controllo si rilancia per vedere se e'
  // sistemata, e le Dichiarazioni non rispondono. Prima la rotta spariva alle
  // 11, e la notte dopo, con la fonte ancora muta, non tornava.
  const db = archivio();
  await carica(GUASTI.riga_da_dichiarare);
  const n5 = await notte({ db, ora: OraVera.parse('2026-10-11T03:00:40Z') });
  await carica();
  const e5 = scritto(n5);
  verifica('alle 5 la riga di Irigom e\' rotta', e5 && e5.esito === 'rotte' && voce(e5, 'riga_da_dichiarare').ok === false && e5.il === '2026-10-11T03:00:40.000Z', J(e5 && e5.voci.map(v => [v.id, v.ok])));
  const n11 = await notte({ db, nonRisponde: 'riepilogoDichiarazioni', ora: OraVera.parse('2026-10-11T09:00:00Z') });
  const e11 = scritto(n11);
  const v11 = e11 ? voce(e11, 'riga_da_dichiarare') : {};
  verifica('rilanciato alle 11 con le Dichiarazioni mute: la rotta delle 5 resta, coi suoi numeri', n11.stato === 200 && e11 && e11.esito === 'rotte' && e11.il === '2026-10-11T09:00:00.000Z'
    && v11.verificata === false && v11.rotta_il === '2026-10-11' && v11.a === 0 && v11.b === 652.84 && v11.motivo === 'le Dichiarazioni non hanno risposto: database non raggiungibile', J(v11));
  verifica('la risposta la dice rotta e non riverificata, e il battito dice che il giro non e\' riuscito', n11.j.invarianti.esito === 'rotte'
    && n11.j.invarianti.rotte.some(x => x.id === 'riga_da_dichiarare' && x.non_riverificata === true && x.rotta_il === '2026-10-11') && battito(n11) && battito(n11).ultimo_esito === 'fallito', J(n11.j.invarianti));
  const d12 = vociPresidi({ esecuzioni: db.EsecuzioneLavoro, indicatore: db.IndicatoreGiorno.find(r => r.giorno === '2026-10-11'), oggi: '2026-10-11', adessoMs: OraVera.parse('2026-10-11T10:00:00Z') });
  verifica('alle 12 la dashboard la dice ancora, rossa: «non riverificata oggi alle 11:00»', d12.length === 1 && d12[0].gravita === 'critico' && d12[0].chiave === 'invariante:riga_da_dichiarare'
    && d12[0].titolo === "Un'identità fra moduli si è rotta: Da dichiarare 0,00 t, Giacenza del canale 652,84 t (non riverificata oggi alle 11:00)", J(d12));
  // La notte dopo il guardiano scrive la riga del 12/10; le Dichiarazioni ancora mute.
  db.IndicatoreGiorno.push({ id: 'ig-12', giorno: '2026-10-12', anno: 2026, esito: 'in_linea' });
  const n12 = await notte({ db, nonRisponde: 'riepilogoDichiarazioni', ora: OraVera.parse('2026-10-12T03:00:40Z') });
  const riga12 = db.IndicatoreGiorno.find(r => r.giorno === '2026-10-12');
  const e12 = JSON.parse((riga12 && riga12.invarianti_json) || 'null');
  verifica('e la notte dopo, con la fonte ancora muta, resta: rotta al controllo dell\'11/10', n12.stato === 200 && e12 && e12.esito === 'rotte' && voce(e12, 'riga_da_dichiarare').rotta_il === '2026-10-11', J(e12 && voce(e12, 'riga_da_dichiarare')));
  const d13 = vociPresidi({ indicatore: riga12, oggi: '2026-10-12', adessoMs: OraVera.parse('2026-10-12T08:00:00Z') });
  verifica('la mattina dopo: «non riverificata stanotte»', d13.length === 1 && / \(non riverificata stanotte\)$/.test(d13[0].titolo) && d13[0].dettaglio.includes('Rotta al controllo del 11/10/2026; stanotte'), J(d13));
}
{
  const n = await notte({ corpo: { voci: ['riga_da_dichiarare'] } });
  verifica('un passo per una voce sola chiama solo la sua funzione', J(n.invocate) === J(['riepilogoDichiarazioni']) && scritto(n).voci.length === 1, J(n.invocate));
}

// 5. GLI ANNI PASSATI (decisioni dell'utente del 13/10/2026). Il guardiano
// controlla l'anno in corso; un anno passato lo guarda chi apre le pagine, e i
// due moduli devono dire lo stesso numero anche li', con la stessa regola. Sul
// 2025 dei dati veri non lo dicevano: Irigom 652,84 t nelle Giacenze (il
// portale di oggi) contro 4.439,08 nelle Dichiarazioni (tutto l'arrivato),
// Tecnogum 1.833,43 contro 2.007,08, Innorec 0 contro 1.254,41; sul 2024 Green
// Tyre 337,96 contro 0. Le regole sono in shared/giacenzaPortale.ts:
// - un anno chiuso si legge con la lettura del 31/12 salvata dalla chiusura
//   (letturaDelTrentuno), in tutti e due i moduli, non col portale di oggi;
// - un anno chiuso mai aperto nel gestionale (nessun sito dell'anno,
//   annoPrimaDelGestionale) non si ricostruisce: «—» in tutti e due, con lo
//   stesso perche'.
// Gli stessi confronti di confrontaTutto: la voce (a) del catalogo, e la
// giacenza del canale delle Dichiarazioni contro il numero delle Giacenze.
console.log('5. GLI ANNI PASSATI: LO STESSO NUMERO, O «—» IN TUTTI E DUE COL PERCHE\'');
const CAMPO_G = { RETE: 'giacenza_portale_t', ACI: 'giacenza_aci_t', EXTRA_RACCOLTA: 'giacenza_extra_t' };
const t2 = (x) => (x === null || x === undefined ? null : Math.round(Number(x) * 100) / 100);
const normSito = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/srl$/, '');
// I due moduli su un anno, con l'orologio e l'archivio dati.
const dueModuli = async (db, anno, ora = ADESSO) => {
  globalThis.__DB = db; globalThis.__SCRITTE = []; globalThis.__RUOLO = 'admin';
  const chiama = async (nome) => (await conOra(() => FUNZIONI[nome].default({ json: async () => ({ anno }) }), ora)).json();
  return { G: await chiama('calcolaGiacenze'), R: await chiama('riepilogoDichiarazioni') };
};
// Impianto per impianto e canale per canale: la giacenza del canale delle
// Dichiarazioni e il numero delle Giacenze (lo script del revisore R6).
const diversiFra = (G, R) => {
  const out = [];
  for (const s of (R.siti || []).filter(x => x.tipo_destinazione !== 'stoc')) {
    const g = (G.righe || []).find(x => x.tipo_destinazione !== 'stoc' && normSito(x.sito) === normSito(s.sito));
    for (const c of s.giacenze_canale || []) if (!g || t2(g[CAMPO_G[c.canale]]) !== t2(c.giacenza_t)) out.push(`${s.sito} ${c.canale}: Giacenze ${g ? g[CAMPO_G[c.canale]] : 'manca'}, Dichiarazioni ${c.giacenza_t}`);
  }
  return out;
};
await carica();
{
  // 5a. Il 2025 dell'archivio di Irigom: nessun sito del 2025, un anno prima del gestionale.
  const { G, R } = await dueModuli(archivio(), 2025);
  const a = VOCI_INVARIANTI[0].verifica({ giacenze: G, dichiarazioni: R });
  verifica('5a. un anno prima del gestionale: le Giacenze e le Dichiarazioni lo dicono tutte e due', G.totali && G.totali.prima_del_gestionale === true && R.prima_del_gestionale === true && R.totali.prima_del_gestionale === true, J([G.totali && G.totali.prima_del_gestionale, R.prima_del_gestionale]));
  verifica('5a. con lo stesso perche\', parola per parola', !!R.perche_prima_del_gestionale && G.totali.perche_prima_del_gestionale === R.perche_prima_del_gestionale && /^Il 2025 e' prima del gestionale/.test(R.perche_prima_del_gestionale), J([G.totali.perche_prima_del_gestionale, R.perche_prima_del_gestionale]));
  const irG = (G.righe || []).find(x => x.tipo_destinazione === 'imp' && normSito(x.sito) === normSito(IRI)) || {};
  const irR = (R.siti || []).find(x => x.tipo_destinazione !== 'stoc' && normSito(x.sito) === normSito(IRI)) || {};
  verifica('5a. Irigom: «—» sui tre canali nelle Giacenze (era il portale di oggi)', irG.giacenza_portale_t === null && irG.giacenza_aci_t === null && irG.giacenza_extra_t === null, J([irG.giacenza_portale_t, irG.giacenza_aci_t, irG.giacenza_extra_t]));
  verifica('5a. e nelle Dichiarazioni: la giacenza del canale, la calcolata e il portale, tutti «—»', (irR.giacenze_canale || []).length === 3 && irR.giacenze_canale.every(c => c.giacenza_t === null && c.perche === R.perche_prima_del_gestionale)
    && irR.giacenza_calcolata_t === null && irR.giacenza_portale_t === null && irR.quadra === null, J([irR.giacenze_canale, irR.giacenza_calcolata_t, irR.giacenza_portale_t]));
  verifica('5a. il perche\' della riga delle Giacenze e dei canali e\' quello delle Dichiarazioni', irG.perche_senza_giacenza === R.perche_prima_del_gestionale && irG.perche_canali && irG.perche_canali.ACI === R.perche_prima_del_gestionale && irG.perche_canali.EXTRA_RACCOLTA === R.perche_prima_del_gestionale, J([irG.perche_senza_giacenza, irG.perche_canali]));
  verifica('5a. la riga «Da dichiarare» non dice un numero che non c\'e\'', (irR.flussi || []).every(f => f.resta_t === null && f.prima_del_gestionale === true && f.mesi.every(m => m.giacenza_fine_kg === null && m.resta_kg === null)), J((irR.flussi || []).map(f => [f.canale, f.resta_t])));
  verifica('5a. e la sua storia dice perche\', non «Oggi non resta niente da dichiarare»', (irR.flussi || []).every(f => (f.racconto || []).some(x => x.startsWith("Il 2025 è prima del gestionale: quell'anno non è stato aperto qui")) && !(f.racconto || []).some(x => /^Oggi /.test(x))), J((irR.flussi || []).map(f => f.racconto)));
  verifica('5a. la voce (a) del catalogo torna, e la giacenza del canale e\' quella delle Giacenze', a.ok === true && !diversiFra(G, R).length, J([a.dettaglio, diversiFra(G, R)]));
  const b = VOCI_INVARIANTI[1].verifica({ dichiarazioni: R });
  verifica('5a. e la voce (b) non grida su un anno che non ha giacenze', b.ok === true, J(b.dettaglio));
  verifica('5a. i totali delle Giacenze sono «—», non zero', G.totali.giacenza_portale_t === null && G.totali.giacenza_aci_t === null && G.totali.giacenza_extra_t === null, J([G.totali.giacenza_portale_t, G.totali.giacenza_aci_t, G.totali.giacenza_extra_t]));
}
{
  // 5b. Lo stesso 2025, ma aperto nel gestionale: i siti del 2025 ci sono, e la
  // chiusura ha salvato la lettura del 31/12/2025 (Irigom 385,36 t, apertura del
  // 2026). Le Giacenze dicevano il portale di oggi su qualunque anno; ora la
  // lettura, come la Quadratura delle Dichiarazioni.
  const db = archivio();
  db.GiacenzaSito.push(
    { id: 'gs25-iri', sito: IRI, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true, tipologia_trattamento: 'Frantumazione' },
    { id: 'gs25-alfa', sito: ALFA, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true },
    { id: 'gs25-tec', sito: TEC, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: false },
  );
  const { G, R } = await dueModuli(db, 2025);
  const irG = (G.righe || []).find(x => x.tipo_destinazione === 'imp' && normSito(x.sito) === normSito(IRI)) || {};
  const irR = (R.siti || []).find(x => x.tipo_destinazione !== 'stoc' && normSito(x.sito) === normSito(IRI)) || {};
  verifica('5b. un anno chiuso aperto nel gestionale non e\' «prima del gestionale»', G.totali.prima_del_gestionale === false && !R.prima_del_gestionale, J([G.totali.prima_del_gestionale, R.prima_del_gestionale]));
  verifica('5b. Irigom a portale: la lettura del 31/12/2025, 385,36 t, nelle Giacenze come nelle Dichiarazioni (non le 652,84 di oggi)', irG.giacenza_portale_t === 385.36 && irR.giacenza_portale_t === 385.36 && irG.fotografia && irG.fotografia.del === '2025-12-31', J([irG.giacenza_portale_t, irR.giacenza_portale_t, irG.fotografia]));
  const a = VOCI_INVARIANTI[0].verifica({ giacenze: G, dichiarazioni: R });
  verifica('5b. la voce (a) del catalogo torna', a.ok === true && a.confronti > 0, J([a.confronti, a.dettaglio]));
  // Senza la lettura salvata: «—» in tutti e due, non il portale di oggi.
  const senza = archivio();
  senza.GiacenzaSito = senza.GiacenzaSito.map(x => ({ ...x, apertura_del: undefined }));
  senza.GiacenzaSito.push({ id: 'gs25-iri', sito: IRI, tipo_destinazione: 'imp', anno: 2025, dichiara_rete: true });
  const s2 = await dueModuli(senza, 2025);
  const irG2 = (s2.G.righe || []).find(x => x.tipo_destinazione === 'imp' && normSito(x.sito) === normSito(IRI)) || {};
  const irR2 = (s2.R.siti || []).find(x => x.tipo_destinazione !== 'stoc' && normSito(x.sito) === normSito(IRI)) || {};
  verifica('5b. senza la lettura del 31/12 salvata: «—» in tutti e due, col perche\'', irG2.giacenza_portale_t === null && irR2.giacenza_portale_t === null && /lettura del 31\/12\/2025/.test(irG2.perche_senza_giacenza || ''), J([irG2.giacenza_portale_t, irR2.giacenza_portale_t, irG2.perche_senza_giacenza]));
}
{
  // 5c. L'anno in corso non e' mai «prima del gestionale», anche senza siti preparati.
  const db = archivio();
  db.GiacenzaSito = [];
  const { G, R } = await dueModuli(db, 2026);
  verifica('5c. l\'anno in corso senza siti non e\' un anno prima del gestionale', G.totali.prima_del_gestionale === false && !R.prima_del_gestionale, J([G.totali.prima_del_gestionale, R.prima_del_gestionale]));
}
{
  // 5e. L'anno appena chiuso guardato prima della chiusura (revisione del
  // 14/10/2026): il 2026 il 05/01/2027, senza la lettura del 31/12. Le righe di
  // Irigom e di Alfa sono «—» in tutti e due i moduli; il totale delle Giacenze
  // contava solo il piazzale e quello a portale delle Dichiarazioni diceva 0.
  // Ora tutti e due «—», con le stesse parole (prove/totaleSenzaRighe.mjs).
  const { G, R } = await dueModuli(archivio(), 2026, OraVera.parse('2027-01-05T10:00:00Z'));
  const a = VOCI_INVARIANTI[0].verifica({ giacenze: G, dichiarazioni: R });
  verifica('5e. il 2026 guardato il 05/01/2027: la voce (a) torna', a.ok === true && a.confronti > 0, J([a.confronti, a.dettaglio]));
  const pG = G.totali.perche_totali && G.totali.perche_totali.RETE, pR = R.totali.perche_totali && R.totali.perche_totali.RETE;
  verifica('5e. e i due totali a portale sono «—», non zero, col perche\' detto con le stesse parole',
    G.totali.giacenza_portale_t === null && R.totali.giacenza_portale_t === null && !!pG && pG === pR && /^Il totale non si fa: 2 righe non hanno il numero \(ALFA RECYCLING SRL, IRIGOM SRL\)/.test(pG) && /lettura del 31\/12\/2026/.test(pG),
    J([G.totali.giacenza_portale_t, R.totali.giacenza_portale_t, pG, pR]));
}
{
  // 5d. Sui dati veri (../dati-veri/, se c'e'): il 2024 e il 2025, e l'anno in corso
  // che non cambia di un chilo (lo dice prove/datiVeri.mjs, 158 numeri).
  const { existsSync, readdirSync, readFileSync } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  const CARTELLA = process.env.DATI_VERI || qui('../../dati-veri/');
  const copie = existsSync(CARTELLA) ? readdirSync(CARTELLA).filter(n => /^treadrider-dati-veri-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(n)).sort() : [];
  if (!copie.length) console.log(`  nessuna copia dei dati veri in ${CARTELLA}: 5d saltata`);
  else {
    const DATI = JSON.parse(gunzipSync(readFileSync(CARTELLA + copie[copie.length - 1])).toString('utf8'));
    const ORA = OraVera.parse(DATI.meta.letto_fino_al);
    const ANNO = Number(String(DATI.meta.letto_fino_al).slice(0, 4));
    for (const anno of [ANNO - 2, ANNO - 1, ANNO]) {
      const { G, R } = await dueModuli(DATI.archivi, anno, ORA);
      const a = VOCI_INVARIANTI[0].verifica({ giacenze: G, dichiarazioni: R });
      const diversi = diversiFra(G, R);
      verifica(`5d. dati veri, ${anno}: la voce (a) torna e la giacenza del canale e' quella delle Giacenze, impianto per impianto`, a.ok === true && a.confronti > 0 && !diversi.length, J([a.confronti, a.dettaglio, diversi.slice(0, 6)]));
      const sitiAnno = (DATI.archivi.GiacenzaSito || []).filter(x => Number(x.anno) === anno).length;
      const atteso = anno < ANNO && !sitiAnno;
      verifica(`5d. dati veri, ${anno}: ${atteso ? 'prima del gestionale, detto da tutti e due' : "aperto nel gestionale, nessun «prima del gestionale»"}`,
        G.totali.prima_del_gestionale === atteso && !!R.prima_del_gestionale === atteso && (!atteso || G.totali.perche_prima_del_gestionale === R.perche_prima_del_gestionale), J([G.totali.prima_del_gestionale, R.prima_del_gestionale]));
    }
    verifica('5d. sui dati veri niente scritto', !(globalThis.__SCRITTE || []).length, J(globalThis.__SCRITTE));
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

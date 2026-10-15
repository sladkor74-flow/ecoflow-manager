// Prova dell'APERTURA AL NETTO DI QUELLO CHE SI DICHIARA DOPO, 10/10/2026.
//
// Trovato dalla revisione delle correzioni del 10/10/2026, ed era il difetto
// piu' serio: la chiusura scrive come apertura dell'anno dopo la lettura del
// 31/12, cioe' il peso non ancora dichiarato quel giorno. Ma dicembre (e spesso
// novembre) si dichiara a gennaio, con DichiarazioneSito dell'anno chiuso, e
// l'anno nuovo sottrae solo le dichiarazioni dei suoi mesi. Senza correzione,
// nel 2027 la giacenza di rete restava 8 t mentre il portale diceva 0 - per
// tutto l'anno, su ogni impianto - e l'ACI restava gonfiata in tutti e due i
// moduli senza che nessuno lo vedesse.
//
// Qui girano le due funzioni vere (riepilogoDichiarazioni e calcolaGiacenze)
// sugli stessi archivi, e si guarda che dicano lo stesso numero, quello giusto.
// npm run prove
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { apertureDegliImpianti } from '../base44/shared/chiusuraAnno.ts';
import { aperturaNetta, aperturaDelSito, sitiDellAnno } from '../base44/shared/giacenzaPortale.ts';
import { quadratura } from '../base44/shared/dichiarazioniImpianti.ts';
import { normalizzaRagioneSociale as n } from '../base44/shared/normalizzaRagioneSociale.ts';

const qui = (p) => fileURLToPath(new URL(p, import.meta.url));
let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

console.log('LA REGOLA, DA SOLA');
{
  const dich = [
    { sito: 'Gamma Tyres S.r.l.', anno: 2026, mese: 'Dicembre', canale: 'RETE', quantita_kg: 8000, caricata_inviata: true, caricata_il: '2027-01-15' },
    { sito: 'GAMMA TYRES SRL', anno: 2026, mese: 'Novembre', canale: 'RETE', quantita_kg: 10000, caricata_inviata: true, caricata_il: '2026-12-10' }, // prima della lettura: gia' fuori
    { sito: 'GAMMA TYRES SRL', anno: 2027, mese: 'Gennaio', canale: 'RETE', quantita_kg: 500, caricata_inviata: true, caricata_il: '2027-02-10' },   // del 2027: la sottrae il 2027
    { sito: 'GAMMA TYRES SRL', anno: 2026, mese: 'Dicembre', canale: 'ACI', quantita_kg: 3000, caricata_inviata: true, caricata_il: '2027-01-20' },
    { sito: 'GAMMA TYRES SRL', anno: 2026, mese: 'Dicembre', canale: 'RETE', quantita_kg: 999, caricata_inviata: false },                          // non caricata: non conta
    { sito: 'ALTRO SRL', anno: 2026, mese: 'Dicembre', canale: 'RETE', quantita_kg: 4000, caricata_inviata: true, caricata_il: '2027-01-15' },     // un altro impianto
  ];
  const riga = { sito: 'GAMMA TYRES SRL', anno: 2027, giacenza_riferimento_t: 8, giacenza_riferimento_aci_t: 3, apertura_del: '2026-12-31' };
  const r = aperturaNetta(riga, 'RETE', dich, n), a = aperturaNetta(riga, 'ACI', dich, n);
  verifica('rete: 8 t lette, 8 t di dicembre dichiarate dopo, 0 t di apertura', r.lorda_t === 8 && r.dichiarato_dopo_t === 8 && r.netta_t === 0, JSON.stringify(r));
  verifica("l'ACI per conto suo: 3 - 3 = 0, rete e ACI non si mescolano", a.netta_t === 0 && a.dichiarato_dopo_t === 3, JSON.stringify(a));
  const aMano = aperturaNetta({ ...riga, apertura_del: undefined }, 'RETE', dich, n);
  verifica("un'apertura scritta a mano non e' una lettura: resta quella", aMano.netta_t === 8 && aMano.dichiarato_dopo_t === 0, JSON.stringify(aMano));
  const senzaData = aperturaNetta(riga, 'RETE', [{ sito: 'GAMMA TYRES SRL', anno: 2026, canale: 'RETE', quantita_kg: 100, caricata_inviata: true }], n);
  verifica('una caricata senza giorno non si sottrae, e si conta a parte', senzaData.netta_t === 8 && senzaData.senza_data === 1, JSON.stringify(senzaData));
  const troppo = aperturaNetta({ ...riga, giacenza_riferimento_t: 5 }, 'RETE', dich, n);
  verifica("se dopo si e' dichiarato piu' di quanto si e' letto, il negativo si vede", troppo.netta_t === -3, JSON.stringify(troppo));
}

// UN'APERTURA MAI LETTA NON VALE ZERO (15/10/2026, prova generale del cambio
// d'anno, difetto 6). Gatim, 5 t di ACI di dicembre non dichiarate al
// 31/12/2026: a portale l'ACI non c'e', la casella della chiusura restava vuota,
// e il 2027 ripartiva da 0 il 02/01 e da -5 t il 15/01, quando arrivava la
// dichiarazione di dicembre. E con l'anno copiato ma la chiusura non ancora
// salvata ogni impianto ripartiva da zero.
console.log("UN'APERTURA MAI LETTA E' «—» COL PERCHE', MAI ZERO NE' SOTTO ZERO");
{
  const dich = [{ sito: 'GATIM SRL', anno: 2026, mese: 'Dicembre', canale: 'ACI', provenienza: 'primaria', quantita_kg: 5000, caricata_inviata: true, caricata_il: '2027-01-15' }];
  // La chiusura ha letto la rete e non l'ACI: il campo ACI non c'e'.
  const soloRete = { sito: 'GATIM SRL', tipo_destinazione: 'imp', anno: 2027, giacenza_riferimento_t: 261.62, apertura_del: '2026-12-31' };
  const aci = aperturaNetta(soloRete, 'ACI', dich, n);
  verifica("l'ACI mai scritta: netta null, non 0 e non -5", aci.netta_t === null && aci.manca === true, JSON.stringify(aci));
  verifica("e dice perche': l'ACI non e' stata letta nella chiusura del 2026", /ACI di questo impianto non e' stata letta nella chiusura del 2026/.test(aci.perche || ''), aci.perche);
  verifica('la rete, letta, resta quella', aperturaNetta(soloRete, 'RETE', dich, n).netta_t === 261.62);
  const zeroLetto = aperturaNetta({ ...soloRete, giacenza_riferimento_aci_t: 0 }, 'ACI', [], n);
  verifica('uno zero letto (scritto, con il giorno) resta zero', zeroLetto.netta_t === 0 && !zeroLetto.manca, JSON.stringify(zeroLetto));
  const letta = aperturaNetta({ ...soloRete, giacenza_riferimento_aci_t: 5 }, 'ACI', dich, n);
  verifica('letta 5, dichiarata dopo 5: netta 0', letta.netta_t === 0 && letta.dichiarato_dopo_t === 5, JSON.stringify(letta));
  // L'anno copiato senza la chiusura: la riga c'e', nessun campo d'apertura.
  const copiata = { sito: 'IRIGOM SRL', tipo_destinazione: 'imp', anno: 2027, note: 'copiato dal 2026, da confermare' };
  const senza = aperturaNetta(copiata, 'RETE', [], n, { annoPrimaNelGestionale: true });
  verifica("l'anno copiato senza chiusura: «—» e «manca l'apertura del 31/12/2026»", senza.netta_t === null && /Manca l'apertura del 31\/12\/2026/.test(senza.perche || ''), JSON.stringify(senza));
  verifica('il 2026, che il 2025 nel gestionale non ce l\'ha, resta com\'era: un campo vuoto vale zero',
    aperturaNetta({ ...copiata, anno: 2026 }, 'RETE', [], n).netta_t === 0);
  verifica('un piazzale non ha un\'apertura da impianto: resta com\'era',
    aperturaNetta({ ...copiata, tipo_destinazione: 'stoc' }, 'RETE', [], n, { annoPrimaNelGestionale: true }).netta_t === 0);
  verifica('la rete di chi non la dichiara non manca mai',
    aperturaNetta({ ...copiata, dichiara_rete: false }, 'RETE', [], n, { annoPrimaNelGestionale: true }).netta_t === 0);
  // Il sito, da tutte le sue righe: la regola che chiedono i due moduli.
  const sito = aperturaDelSito([soloRete], 'ACI', dich, n);
  verifica('aperturaDelSito dice «—» se una riga manca', sito.netta_t === null && sito.manca, JSON.stringify(sito));
  verifica('senza righe resta zero, come prima (un sito nuovo)', aperturaDelSito([], 'ACI', dich, n).netta_t === 0);
}

// SOLO PER UN SITO CHE L'ANNO PRIMA C'ERA; E UNO ZERO SENZA IL GIORNO NON E' UNA
// LETTURA (revisione del 15/10/2026). Un impianto NUOVO del 2027 aggiunto da
// Giacenze › Siti aveva l'ACI «—» per tutto l'anno, senza modo di sistemarla; e
// una modifica qualsiasi della riga di Irigom 2027 nella scheda Siti scriveva
// giacenza_riferimento_t 0 e riportava l'apertura a zero (il difetto 6 di nuovo).
console.log("UN SITO NUOVO RIPARTE DA ZERO; UNO ZERO SENZA IL GIORNO NON E' UNA LETTURA");
{
  const siti = sitiDellAnno([
    { sito: 'IRIGOM SRL', tipo_destinazione: 'imp', anno: 2026 },
    { sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', anno: 2026 },
    { sito: 'IRIGOM SRL', tipo_destinazione: 'imp', anno: 2027, note: 'copiato dal 2026, da confermare' },
    // Il nuovo impianto, come lo scrive TargetManager.jsx (save): rete 0, ACI mai.
    { sito: 'NUOVO RECYCLING SRL', tipo_destinazione: 'imp', anno: 2027, giacenza_riferimento_t: 0, tipologia_trattamento: 'EoW', note: '' },
  ], 2027, { chiaveDi: n, annoDiOggi: 2027 });
  const nuovo = siti.righe.find(g => g.sito === 'NUOVO RECYCLING SRL');
  const iri = siti.righe.find(g => g.sito === 'IRIGOM SRL');
  const ha = typeof siti.haLAnnoPrima === 'function' ? siti.haLAnnoPrima : () => siti.annoPrimaNelGestionale;
  verifica("haLAnnoPrima: Irigom si', il nuovo impianto no", ha(iri) === true && ha(nuovo) === false);
  const opz = { annoPrimaNelGestionale: ha };
  verifica("il nuovo impianto: l'ACI mai scritta vale zero, non «—»", aperturaNetta(nuovo, 'ACI', [], n, opz).netta_t === 0 && !aperturaNetta(nuovo, 'ACI', [], n, opz).manca);
  verifica('e la sua rete scritta 0 dalla scheda Siti resta 0', aperturaNetta(nuovo, 'RETE', [], n, opz).netta_t === 0);
  verifica("Irigom copiato, mai scritto: «—» su rete e ACI", aperturaNetta(iri, 'RETE', [], n, opz).manca === true && aperturaNetta(iri, 'ACI', [], n, opz).manca === true);
  // La scheda Siti ha salvato la riga di Irigom 2027 (tipologia cambiata): rete 0, senza il giorno.
  const toccata = { ...iri, giacenza_riferimento_t: 0, tipologia_trattamento: 'Frantumazione/R1' };
  const z = aperturaNetta(toccata, 'RETE', [], n, opz);
  verifica("Irigom dopo la scheda Siti: lo zero senza il giorno non e' una lettura, resta «—» col perche'", z.netta_t === null && z.manca && /Manca l'apertura del 31\/12\/2026/.test(z.perche || ''), JSON.stringify(z));
  verifica('uno zero col giorno (scritto dalla chiusura) e\' una lettura', aperturaNetta({ ...toccata, apertura_del: '2026-12-31' }, 'RETE', [], n, opz).netta_t === 0);
  verifica('una giacenza scritta a mano diversa da zero resta quella', aperturaNetta({ ...iri, giacenza_riferimento_t: 650 }, 'RETE', [], n, opz).netta_t === 650);
  // La riga scritta dalla chiusura per un impianto senza lettura, che la riga
  // dell'anno prima non l'aveva (INNOREC sui dati veri): quell'anno c'era, coi suoi
  // movimenti, e un'apertura mai letta resta «—».
  const innorec = { sito: 'INNOREC SRL', tipo_destinazione: 'imp', anno: 2027, note: 'copiato dal 2026, da confermare · dalla chiusura del 31/12/2026' };
  verifica("la riga della chiusura senza lettura, anche senza la riga dell'anno prima: «—»", ha(innorec) === true && aperturaNetta(innorec, 'ACI', [], n, opz).manca === true);
  verifica('nel 2026 (il 2025 nel gestionale non c\'e\') uno zero scritto resta zero',
    aperturaNetta({ sito: 'GATIM SRL', tipo_destinazione: 'imp', anno: 2026, giacenza_riferimento_t: 0 }, 'RETE', [], n, { annoPrimaNelGestionale: sitiDellAnno([], 2026).haLAnnoPrima }).netta_t === 0);
  verifica("prima del 1° gennaio l'anno dopo non e' cominciato: nessun sito «ha l'anno prima»",
    sitiDellAnno([{ sito: 'IRIGOM SRL', anno: 2026 }, { sito: 'IRIGOM SRL', anno: 2027 }], 2027, { chiaveDi: n, annoDiOggi: 2026 }).haLAnnoPrima?.({ sito: 'IRIGOM SRL', anno: 2027 }) === false);
}

// I CARICHI DI DICEMBRE CHIUSI A PORTALE A GENNAIO (15/10/2026, difetto 5). La
// chiusura salvata la sera del 31/12 non li ha; arrivano dopo, e l'apertura li
// deve contenere, una volta sola.
console.log("L'APERTURA SALVATA DALLA CHIUSURA SI LEGGE COI CARICHI ARRIVATI DOPO");
{
  const mov = (id, kg, finito, chiuso, canale = 'RETE') => ({ id_ordine: id, numero_fir: 'F' + id, canale, verso: 'ingresso', classe: canale === 'ACI' ? 'ACI' : 'P', kg, finito_il: finito, chiuso_il: chiuso });
  const arrivati = [
    mov('TRS1', 6000, '2026-12-30', '2027-01-04'),
    mov('TRS2', 3000, '2026-12-31', '2027-01-05'),
    mov('TRS0', 2000, '2026-12-20', '2026-12-22'),   // chiuso prima del file: il file ce l'ha
    mov('TRS9', 1500, '2026-12-29', '2027-01-03'),   // gia' contato dalla chiusura
    mov('TRA1', 700, '2026-12-30', '2027-01-04', 'ACI'),
    mov('TRA2', 300, '2026-12-28', '2026-12-29', 'ACI'),  // gia' contato
  ];
  const arrivi = (k, c) => arrivati.filter(m => m.canale === c);
  const riga = {
    sito: 'T.R.S. SRL', tipo_destinazione: 'imp', anno: 2027, giacenza_riferimento_t: 1.5, giacenza_riferimento_aci_t: 0.3, apertura_del: '2026-12-31',
    apertura_salvata_il: '2026-12-31T22:30:00.000Z',
    apertura_rettificate_json: JSON.stringify({ fotografia_del: '2026-12-31', voci: ['ingresso|TRS9'], voci_aci: ['ingresso|TRA2'] }),
  };
  const r = aperturaNetta(riga, 'RETE', [], n, { arrivi });
  verifica('rete: 1,5 lette + 9 arrivate dopo la chiusura = 10,5 (non il carico che il file aveva, non quello gia\' contato)', r.netta_t === 10.5 && r.arrivati_dopo === 2 && r.arrivati_dopo_t === 9, JSON.stringify(r));
  const a = aperturaNetta(riga, 'ACI', [], n, { arrivi });
  verifica("ACI: 0,3 calcolate + 0,7 arrivate dopo = 1 (l'ACI non ha un file: conta che cosa la chiusura ha contato)", a.netta_t === 1 && a.arrivati_dopo === 1, JSON.stringify(a));
  const dich = [{ sito: 'T.R.S. SRL', anno: 2026, mese: 'Dicembre', canale: 'RETE', quantita_kg: 10500, caricata_inviata: true, caricata_il: '2027-02-05' }];
  verifica('e la dichiarazione di dicembre, quando arriva, la porta a zero', aperturaNetta(riga, 'RETE', dich, n, { arrivi }).netta_t === 0);
  verifica("un'apertura scritta prima di questo giorno, senza l'istante del salvataggio, resta com'e'",
    aperturaNetta({ ...riga, apertura_salvata_il: undefined }, 'RETE', [], n, { arrivi }).netta_t === 1.5);
  // Un file scaricato dopo il 31/12 (una chiusura salvata a gennaio): le
  // dichiarazioni caricate fra il 31/12 e il file il file non le ha piu'.
  const tardi = { ...riga, apertura_rettificate_json: JSON.stringify({ fotografia_del: '2027-01-05', voci: [] }) };
  const dichTra = [{ sito: 'T.R.S. SRL', anno: 2026, mese: 'Novembre', canale: 'RETE', quantita_kg: 500, caricata_inviata: true, caricata_il: '2027-01-03' }];
  verifica('col file del 05/01 non si toglie due volte una dichiarazione caricata il 03/01, e i carichi chiusi entro il 05/01 il file li ha',
    aperturaNetta(tardi, 'RETE', dichTra, n, { arrivi }).netta_t === 1.5, JSON.stringify(aperturaNetta(tardi, 'RETE', dichTra, n, { arrivi })));
}

console.log('LE DUE FUNZIONI VERE, NEL 2027');
{
  const ARCHIVI = {};
  globalThis.__ARCHIVI_APERTURA = ARCHIVI;
  const SDK_FINTO = `
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
const ordina = (righe) => [...righe].sort((a, b) => String(a.id).localeCompare(String(b.id)));
const entita = (nome) => ({
  list: async (_o, lim = 1e9, skip = 0) => ordina(globalThis.__ARCHIVI_APERTURA[nome] || []).slice(skip, skip + lim),
  filter: async (f, _o, lim = 1e9, skip = 0) => ordina((globalThis.__ARCHIVI_APERTURA[nome] || []).filter(r => soddisfa(r, f))).slice(skip, skip + lim),
  create: async (r) => r, update: async (_id, r) => r, delete: async () => ({}),
});
const entities = new Proxy({}, { get: (_t, nome) => entita(String(nome)) });
export function createClientFromRequest() {
  return { auth: { me: async () => ({ role: 'admin', email: 'prova' }) }, asServiceRole: { entities }, entities };
}`;
  const funzione = async (nome) => {
    const pacchetto = await build({
      entryPoints: [qui(`../base44/functions/${nome}/entry.ts`)],
      bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
      plugins: [{ name: 'sdk-finto', setup(b) {
        b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'sdk-finto' }));
        b.onLoad({ filter: /.*/, namespace: 'sdk-finto' }, () => ({ contents: SDK_FINTO, loader: 'js' }));
      } }],
    });
    const modulo = await import('data:text/javascript;base64,' + Buffer.from(pacchetto.outputFiles[0].text).toString('base64'));
    return async (corpo) => (await modulo.default({ json: async () => corpo })).json();
  };
  let seq = 0;
  const con = (nome, righe) => { ARCHIVI[nome] = righe.map(r => ({ id: 'r' + String(++seq).padStart(4, '0'), ...r })); };
  const g = (giorno) => `${giorno}T08:00:00Z`;
  const primaria = (id, dest, kg, giorno, extra = {}) => ({
    id_ordine: id, numero_fir: 'FIR' + id, classe: 'P - fino a 35 kg', prodotto: '.class1', destinazione: dest,
    tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: kg, trasporto_finito_il: g(giorno), ordine_chiuso_il: g(giorno), ...extra,
  });
  for (const v of ['Terziaria', 'ImpiantoTargetSecondaria', 'TargetRaccoglitore', 'TargetMensile',
    'GiacenzaStoccaggio', 'IndicatoreGiorno', 'ExtraRaccolta', 'Secondaria']) con(v, []);
  const GAMMA = 'GAMMA TYRES SRL';
  con('DichiarazioneTrattamento', [
    { ordine_primaria: 'ET26000101', prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: GAMMA, data_dichiarazione: '2026-12-10', fine_trasporto: '2026-11-15', peso_associato_kg: 10000, id_dichiarazione: 'D11' },
    { ordine_primaria: 'ET26000102', prodotto: '.class1', partner_operativo: 'SMOCO S.r.l.', destinazione: GAMMA, data_dichiarazione: '2027-01-15', fine_trasporto: '2026-12-10', peso_associato_kg: 8000, id_dichiarazione: 'D12' },
  ]);
  con('PrimariaRete', [primaria('ET26000101', GAMMA, 10000, '2026-11-15'), primaria('ET26000102', GAMMA, 8000, '2026-12-10')]);
  con('PrimariaAci', [{ id_ordine: 'EA26000201', numero_fir: 'FA201', classe: 'C', destinazione: GAMMA, tipo_destinazione: 'imp', stato: 'terminato', peso_effettivo: 3000, trasporto_finito_il: g('2026-12-05'), ordine_chiuso_il: g('2026-12-05') }]);
  con('DichiarazioneSito', [
    { sito: GAMMA, anno: 2026, mese: 'Novembre', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 10000, caricata_inviata: true, caricata_il: '2026-12-10' },
    { sito: GAMMA, anno: 2026, mese: 'Dicembre', canale: 'RETE', provenienza: '', operazione: 'R3', quantita_kg: 8000, caricata_inviata: true, caricata_il: '2027-01-15' },
    { sito: GAMMA, anno: 2026, mese: 'Dicembre', canale: 'ACI', provenienza: 'primaria', operazione: 'R3', quantita_kg: 3000, caricata_inviata: true, caricata_il: '2027-01-20' },
  ]);
  // Il file dei non dichiarati del 31/12/2026: dicembre c'e' ancora.
  con('OrdineNonDichiarato', [{ ordine_primaria: 'ET26000102', destinazione: GAMMA, prodotto: '.class1', peso_non_dichiarato_kg: 8000, created_date: '2026-12-31T17:00:00Z', fine_trasporto: '2026-12-10' }]);
  const riga26 = { sito: GAMMA, tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, giacenza_riferimento_t: 0 };
  // La chiusura del 2026 con le letture di quel giorno: 8.000 kg di rete, 3.000 di ACI.
  const ap = apertureDegliImpianti({ anno: 2026, impianti: [{ chiave: n(GAMMA), nome: GAMMA }], letture_impianti: { [n(GAMMA)]: { pfu_kg: 8000, aci_kg: 3000 } }, siti: [riga26], chiave: n });
  verifica('la chiusura scrive la lettura com\'e\': 8 t di rete e 3 di ACI, dal 31/12', ap.piano[0].dati.giacenza_riferimento_t === 8 && ap.piano[0].dati.giacenza_riferimento_aci_t === 3 && ap.piano[0].dati.apertura_del === '2026-12-31', JSON.stringify(ap.piano[0].dati));
  con('GiacenzaSito', [riga26, { ...ap.piano[0].dati }]);

  const riepilogo = await funzione('riepilogoDichiarazioni');
  const giacenze = await funzione('calcolaGiacenze');
  const d27 = await riepilogo({ anno: 2027 });
  const g27 = await giacenze({ anno: 2027 });
  verifica('le due funzioni rispondono', !d27.error && !g27.error, `${d27.error || ''} ${g27.error || ''}`);
  const s27 = (d27.siti || []).find(s => s.sito === GAMMA) || {};
  const canale = (c) => (s27.giacenze_canale || []).find(x => x.canale === c) || {};
  const R = canale('RETE'), A = canale('ACI');
  verifica('Dichiarazioni 2027, rete: apertura 0 (8 lette - 8 dichiarate a gennaio), giacenza 0', R.apertura_t === 0 && R.giacenza_t === 0, JSON.stringify(R));
  verifica("e la pagina sa perche': 8 lette, 8 dichiarate dopo", R.apertura_letta_t === 8 && R.dichiarato_dopo_apertura_t === 8, JSON.stringify(R));
  verifica('Dichiarazioni 2027, ACI: 3 - 3 = 0, non 3 per tutto l\'anno', A.apertura_t === 0 && A.giacenza_t === 0, JSON.stringify(A));
  const q = quadratura(s27);
  verifica('la quadratura col portale del 2027 torna', q && q.quadra === true, JSON.stringify(q));
  const G = (g27.righe || []).find(r => r.sito === GAMMA && r.tipo_destinazione === 'imp') || {};
  verifica('Giacenze 2027: la colonna dell\'apertura dice 0 come Dichiarazioni', G.giacenza_riferimento_t === 0, String(G.giacenza_riferimento_t));
  verifica('Giacenze 2027: ACI 0, come Dichiarazioni', G.giacenza_aci_t === 0, String(G.giacenza_aci_t));

  // LA CHIUSURA HA LETTO LA RETE E NON L'ACI (15/10/2026, difetto 6): la
  // dichiarazione ACI di dicembre arriva il 20/01. Prima: ACI 0 e poi -3 t, in
  // tutti e due i moduli. Ora «—» col perche', lo stesso nei due moduli.
  const soloRete = { ...ap.piano[0].dati };
  delete soloRete.giacenza_riferimento_aci_t;
  con('GiacenzaSito', [riga26, soloRete]);
  const d27b = await riepilogo({ anno: 2027 });
  const g27b = await giacenze({ anno: 2027 });
  const sb = (d27b.siti || []).find(s => s.sito === GAMMA) || {};
  const Ab = (sb.giacenze_canale || []).find(x => x.canale === 'ACI') || {};
  const Gb = (g27b.righe || []).find(r => r.sito === GAMMA && r.tipo_destinazione === 'imp') || {};
  verifica("Dichiarazioni 2027, l'ACI non letta: «—», non -3", Ab.giacenza_t === null && Ab.senza_apertura === true, JSON.stringify(Ab));
  verifica("Giacenze 2027, l'ACI non letta: «—», non -3", Gb.giacenza_aci_t === null, String(Gb.giacenza_aci_t));
  verifica("e il perche' e' lo stesso nei due moduli", !!Ab.perche && Gb.perche_canali && Gb.perche_canali.ACI === Ab.perche, JSON.stringify([Ab.perche, Gb.perche_canali]));
  verifica('la riga ACI «Da dichiarare» e\' «—» come la giacenza', (sb.flussi || []).filter(f => f.canale === 'ACI').every(f => f.resta_t === null), JSON.stringify((sb.flussi || []).filter(f => f.canale === 'ACI').map(f => f.resta_t)));
  verifica('la rete, letta, quadra ancora', sb.quadra === true, JSON.stringify([sb.giacenza_calcolata_t, sb.giacenza_portale_t]));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

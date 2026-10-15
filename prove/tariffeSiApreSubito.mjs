// TARIFFE & ANAGRAFICHE SI APRE SUBITO, E LA SEZIONE DEI SURPLUS SI TROVA
// (il surplus sulle tariffe, 13/10/2026).
//
// Dopo la pubblicazione del surplus l'utente: «non ho trovato la voce
// 'surplus'». La sezione sta nella linguetta «Surplus» dentro Fatturazione ›
// Tariffe & Anagrafiche, e la scheda impiegava circa 14 secondi a mostrarsi:
// all'apertura leggeva tutte le primarie (10.487 l'11/10/2026) e le secondarie,
// che servono solo agli elenchi di province, destinazioni e stoccaggi del modulo
// delle tariffe. Senza un surplus in corso, poi, la fascia in cima alle tariffe
// si nascondeva e restava solo la linguetta.
//
// Qui la pagina vera gira col React finto di prove/dati/paginaFinta.mjs, un
// client finto che fa aspettare ogni lettura sull'orologio finto quanto la
// piattaforma (le primarie 4 s a pagina da 5000) e conta le richieste:
//   1. la scheda si mostra appena ha tariffe, fornitori e surplus (meno di 1 s
//      finto; prima ~12,6 s), e primarie e secondarie partono dopo;
//   2. il modulo delle tariffe aperto prima degli elenchi lo dice e si riempie
//      quando arrivano; se non si leggono, riprova all'apertura dopo;
//   3. le letture sono le stesse di prima, e dopo un salvataggio non si
//      rileggono primarie e secondarie;
//   4. la fascia breve senza surplus, «Scrivi il Fuel Surcharge» che apre la
//      linguetta col modulo, il conto dei surplus in corso sulla linguetta, il
//      collegamento ?tab=tariffe&sezione=surplus;
//   5. la scheda Surplus apre il modulo del Fuel Surcharge chiesto dalla fascia,
//      una volta sola.
//
// La prova generale del cambio d'anno (15/10/2026) ha aggiunto:
//   6. il 02/01/2027, con le tariffe tutte finite il 31/12/2026, l'elenco vuoto
//      dice «Nessuna tariffa in vigore oggi» e come si preparano le nuove, non
//      «Nessuna tariffa. Clicca Aggiungi tariffa» (difetto 32);
//   7. «Riapri» di una tariffa di rete o ACI la riapre al piu' fino al 31/12 del
//      suo anno, e una tariffa del 2026 non si riapre sul 2027 (difetto 7);
//   8. il modulo propone come «Al» il 31/12 dell'anno del «Dal» per rete, ACI e
//      TUTTE, e dice l'errore sotto il campo (difetto 7).
//
// node prove/tariffeSiApreSubito.mjs
import { caricaPagina, clienteFinto, trova, testo, aspetta, orologioFinto, nomeDi } from './dati/paginaFinta.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = (x) => JSON.stringify(x);
const sezione = async (titolo, corpo) => {
  console.log(titolo);
  try { await corpo(); } catch (e) { ko++; console.log('  FALLITA: la sezione si e\' fermata: ' + String(e && e.stack ? e.stack : e).slice(0, 500)); }
};

// Gli archivi finti, coi numeri dell'11/10/2026: 10.487 primarie.
const PROV = ['NA', 'SA', 'AV', 'BN', 'CE'];
const PRIMARIE = Array.from({ length: 10487 }, (_, i) => ({ id: `p${String(i).padStart(5, '0')}`, provincia: PROV[i % 5], destinazione: i % 2 ? 'Tecnogum' : 'Irigom' }));
const SECONDARIE = Array.from({ length: 1200 }, (_, i) => ({ id: `s${String(i).padStart(4, '0')}`, stoccaggio: i % 2 ? 'T-Cycle' : 'Nappi Sud', destinazione: i % 2 ? 'Gatim' : 'Irigom' }));
const TARIFFE = [
  { id: 't1', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'f1', fornitore_nome: 'EMMESSE SRLS', valore: 85, unita_misura: '€/t', data_inizio_validita: '2026-01-01', stato: 'attivo' },
  { id: 't2', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202, unita_misura: '€/t', data_inizio_validita: '2026-01-01', stato: 'attivo' },
];
const FORNITORI = [{ id: 'f1', ragione_sociale: 'EMMESSE SRLS', stato: 'attivo', ruolo_raccolta: true }];
// Un surplus in corso in qualunque giorno si lanci la prova (la pagina prende oggi dall'orologio vero).
const IN_CORSO = ['RETE', 'ACI', 'EXTRA_RACCOLTA'].map((c, i) => ({
  id: `u${i}`, gruppo: 'g-fuel', nome: 'Fuel Surcharge', origine: 'CONSORZIO', tipologia: c, prestazione: 'RACCOLTA', a_chi: 'tutti',
  euro_t_passiva: 5, euro_t_attiva: 5, data_inizio_validita: '2026-01-01', data_fine_validita: '2099-12-31', stato: 'attivo',
}));

// Quanto aspetta ogni lettura sulla piattaforma, in millisecondi finti.
const RITARDI = { Tariffa: 400, Fornitore: 300, SurplusTariffa: 250, PrimariaRete: 4000, Secondaria: 1500 };

const orologio = orologioFinto().installa();
const attesa = (ms) => new Promise(r => setTimeout(r, ms));

/** Il client finto con le letture lente; rotte: { Entita: quante volte fallire }. */
function clienteLento(archivi, rotte = {}) {
  const base = clienteFinto({ archivi });
  const letture = [];
  const daRompere = { ...rotte };
  const entities = new Proxy({}, {
    get: (_t, nome) => {
      if (typeof nome !== 'string') return undefined;
      const e = base.cliente.entities[nome];
      const lento = (metodo) => async (...a) => {
        const voce = { nome, metodo, inizio: orologio.adesso, fine: null };
        letture.push(voce);
        await attesa(RITARDI[nome] || 100);
        voce.fine = orologio.adesso;
        if (daRompere[nome] > 0) { daRompere[nome]--; throw new Error('lettura non riuscita'); }
        return e[metodo](...a);
      };
      return { ...e, list: lento('list'), filter: lento('filter') };
    },
  });
  return {
    cliente: { ...base.cliente, entities },
    letture,
    conta: (nome) => letture.filter(l => l.nome === nome).length,
  };
}

const PAGINA = await caricaPagina('src/components/fatturazione/TariffeUnificate.jsx', { reali: ['@/components/ui/use-toast'] });

const scheda = (r) => trova(r.albero, 'Tabs')[0] || null;
const elemento = (r, nome) => trova(r.albero, nome)[0] || null;
// I messaggi a comparsa: lo stato del gancio dei toast, fra quelli della pagina.
const toast = (r) => { const h = r.hooks.find(x => x && x.valore && Array.isArray(x.valore.toasts)); return h ? h.valore.toasts : null; };
async function finoA(cond, limite = 40000, passo = 50) {
  const fine = orologio.adesso + limite;
  while (orologio.adesso <= fine) { if (cond()) return orologio.adesso; await orologio.avanza(passo); }
  return null;
}
function apri(archivi, { props = {}, rotte = {} } = {}) {
  const c = clienteLento(archivi, rotte);
  globalThis.__CLIENTE_FINTO = c.cliente;
  const inizio = orologio.adesso;
  const r = PAGINA.monta(PAGINA.Componente, props);
  return { r, c, inizio };
}
const ARCHIVI = (surplus) => ({ Tariffa: TARIFFE, Fornitore: FORNITORI, SurplusTariffa: surplus, PrimariaRete: PRIMARIE, Secondaria: SECONDARIE });

await sezione('1. LA SCHEDA SI MOSTRA APPENA HA TARIFFE, FORNITORI E SURPLUS', async () => {
  const { r, c, inizio } = apri(ARCHIVI(IN_CORSO));
  verifica('all\'apertura si aspetta (la rotella), senza la scheda', !scheda(r));
  const mostrata = await finoA(() => !!scheda(r));
  const dopo = mostrata === null ? null : mostrata - inizio;
  console.log(`  la scheda si mostra dopo ${dopo === null ? 'mai' : (dopo / 1000).toFixed(2).replace('.', ',')} s finti`);
  verifica('la scheda si mostra entro 1 s finto (tariffe 0,4 s, fornitori 0,3 s, surplus 0,25 s)', dopo !== null && dopo <= 1000, String(dopo));
  const form = elemento(r, 'TariffeForm');
  verifica('in quel momento il modulo delle tariffe c\'e\', con gli elenchi ancora vuoti', !!form && J(form.props.province) === '[]' && J(form.props.destinazioniRaccolta) === '[]', J(form && form.props.province));
  const tabella = trova(r.albero, 'table').length;
  verifica('e la tabella delle tariffe e la fascia del surplus ci sono', tabella === 1 && !!elemento(r, 'FasciaSurplus'));
  const elenchi = c.letture.filter(l => l.nome === 'PrimariaRete' || l.nome === 'Secondaria');
  const principali = c.letture.filter(l => ['Tariffa', 'Fornitore', 'SurplusTariffa'].includes(l.nome));
  const ultimaPrincipale = Math.max(...principali.map(l => l.fine ?? Infinity));
  verifica('primarie e secondarie partono dopo tariffe, fornitori e surplus', elenchi.length > 0 && elenchi.every(l => l.inizio >= ultimaPrincipale),
    J(c.letture.map(l => [l.nome, l.inizio, l.fine])));
  const pronti = await finoA(() => (elemento(r, 'TariffeForm') || { props: {} }).props.province?.length > 0);
  console.log(`  gli elenchi del modulo arrivano dopo ${pronti === null ? 'mai' : ((pronti - inizio) / 1000).toFixed(2).replace('.', ',')} s finti`);
  const f2 = elemento(r, 'TariffeForm').props;
  verifica('poi gli elenchi si riempiono: province, destinazioni, stoccaggi',
    J(f2.province) === J(['AV', 'BN', 'CE', 'NA', 'SA']) && J(f2.destinazioniRaccolta) === J(['Irigom', 'Tecnogum']) && J(f2.stoccaggi) === J(['Nappi Sud', 'T-Cycle']) && J(f2.destinazioniSecondaria) === J(['Gatim', 'Irigom']), J(f2.province));
  await orologio.avanza(5000);
  verifica('letture all\'apertura uguali a prima: Tariffa 1, Fornitore 1, SurplusTariffa 1, PrimariaRete 3 (pagine da 5000), Secondaria 1',
    c.conta('Tariffa') === 1 && c.conta('Fornitore') === 1 && c.conta('SurplusTariffa') === 1 && c.conta('PrimariaRete') === 3 && c.conta('Secondaria') === 1,
    J(['Tariffa', 'Fornitore', 'SurplusTariffa', 'PrimariaRete', 'Secondaria'].map(n => [n, c.conta(n)])));

  // Dopo il salvataggio di una tariffa si rileggono tariffe, fornitori e surplus, non gli elenchi.
  const prima = c.letture.length;
  elemento(r, 'TariffeForm').props.onSaved();
  const riaperta = await finoA(() => c.letture.length > prima && !!scheda(r));
  await orologio.avanza(20000);
  const nuove = c.letture.slice(prima).map(l => l.nome).sort();
  verifica('dopo un salvataggio si rileggono solo tariffe, fornitori e surplus: niente primarie e secondarie',
    riaperta !== null && J(nuove) === J(['Fornitore', 'SurplusTariffa', 'Tariffa']), J(nuove));
  verifica('e gli elenchi restano quelli letti', (elemento(r, 'TariffeForm').props.province || []).length === 5);
  r.smonta();
});

await sezione('2. IL MODULO DELLE TARIFFE APERTO PRIMA DEGLI ELENCHI LO DICE', async () => {
  const { r, c } = apri(ARCHIVI([]));
  await finoA(() => !!scheda(r));
  const aggiungi = trova(r.albero, el => nomeDi(el) === 'Button' && testo(el).includes('Aggiungi tariffa'))[0];
  verifica('c\'e\' «Aggiungi tariffa»', !!aggiungi);
  aggiungi.props.onClick();
  await aspetta();
  const form = elemento(r, 'TariffeForm').props;
  const t = toast(r) || [];
  verifica('il modulo si apre subito', form.open === true);
  verifica('e un messaggio dice che province e destinazioni sono in arrivo, e che il modulo funziona gia\'',
    t.length === 1 && t[0].title === 'Province e destinazioni in arrivo' && /Il modulo funziona già/.test(t[0].description || ''), J(t.map(x => [x.title, x.description])));
  await finoA(() => (elemento(r, 'TariffeForm').props.province || []).length > 0);
  verifica('il modulo aperto si riempie quando arrivano', elemento(r, 'TariffeForm').props.open === true && elemento(r, 'TariffeForm').props.province.length === 5);
  // Ad elenchi arrivati, aprire il modulo non dice niente.
  elemento(r, 'TariffeForm').props.onClose();
  await aspetta();
  trova(r.albero, el => nomeDi(el) === 'Button' && testo(el).includes('Aggiungi tariffa'))[0].props.onClick();
  await aspetta();
  verifica('con gli elenchi gia\' letti nessun messaggio in piu\'', (toast(r) || []).length === 1, J((toast(r) || []).map(x => x.title)));
  verifica('e nessuna lettura in piu\'', c.conta('PrimariaRete') === 3 && c.conta('Secondaria') === 1);
  r.smonta();

  // Le primarie non si leggono: la scheda c'e' lo stesso, e il modulo riprova all'apertura.
  const rotta = apri(ARCHIVI([]), { rotte: { PrimariaRete: 1 } });
  await finoA(() => !!scheda(rotta.r));
  await orologio.avanza(10000);
  verifica('con le primarie non lette la scheda c\'e\' e il modulo resta senza elenchi', !!scheda(rotta.r) && (elemento(rotta.r, 'TariffeForm').props.province || []).length === 0);
  const giaLette = rotta.c.conta('PrimariaRete');
  trova(rotta.r.albero, el => nomeDi(el) === 'Button' && testo(el).includes('Aggiungi tariffa'))[0].props.onClick();
  await aspetta();
  const t2 = toast(rotta.r) || [];
  verifica('aprendo il modulo lo dice e si rileggono', t2.some(x => x.title === 'Province e destinazioni non lette') && rotta.c.conta('PrimariaRete') === giaLette + 1, J([t2.map(x => x.title), giaLette, rotta.c.conta('PrimariaRete')]));
  await finoA(() => (elemento(rotta.r, 'TariffeForm').props.province || []).length > 0);
  verifica('e quando arrivano il modulo si riempie', (elemento(rotta.r, 'TariffeForm').props.province || []).length === 5);
  rotta.r.smonta();
});

await sezione('3. LA SEZIONE DEI SURPLUS SI TROVA', async () => {
  // Nessun surplus scritto: la fascia breve, con «Scrivi il Fuel Surcharge» all'amministratore.
  const { r } = apri(ARCHIVI([]));
  await finoA(() => !!scheda(r) && !!(elemento(r, 'FasciaSurplus') || { props: {} }).props.onScrivi);
  const fascia = elemento(r, 'FasciaSurplus');
  verifica('la fascia riceve i surplus letti (nessuno) e sa che sono letti', !!fascia && J(fascia.props.schede) === '[]' && fascia.props.letti === true, J(fascia && Object.keys(fascia.props)));
  verifica('all\'amministratore offre «Scrivi il Fuel Surcharge»', !!fascia && typeof fascia.props.onScrivi === 'function');
  if (fascia && typeof fascia.props.onScrivi === 'function') {
    fascia.props.onScrivi();
    await aspetta();
    const sez = elemento(r, 'SurplusSezione');
    verifica('«Scrivi il Fuel Surcharge» apre la linguetta Surplus e le chiede il modulo del Fuel Surcharge',
      scheda(r).props.value === 'surplus' && !!sez && J(sez.props.richiesta) === J({ cosa: 'fuel' }), J([scheda(r).props.value, sez && sez.props.richiesta]));
    sez.props.onRichiestaFatta();
    await aspetta();
    verifica('fatta la richiesta, la scheda non la ripete', elemento(r, 'SurplusSezione').props.richiesta === null);
  }
  r.smonta();

  // I surplus non letti: la fascia non dice «nessuno».
  const rotti = apri(ARCHIVI([]), { rotte: { SurplusTariffa: 1 } });
  await finoA(() => !!scheda(rotti.r));
  verifica('se i surplus non si leggono la fascia lo sa (letti falso)', elemento(rotti.r, 'FasciaSurplus').props.letti === false);
  rotti.r.smonta();

  // Il Fuel Surcharge in corso: il conto sulla linguetta.
  const conFuel = apri(ARCHIVI(IN_CORSO));
  await finoA(() => !!scheda(conFuel.r));
  const linguetta = trova(conFuel.r.albero, el => nomeDi(el) === 'TabsTrigger' && el.props.value === 'surplus')[0];
  verifica('la linguetta «Surplus» dice quanti surplus sono in corso', !!linguetta && testo(linguetta).replace(/\s+/g, ' ').trim() === 'Surplus1 in corso', J(linguetta && testo(linguetta)));
  conFuel.r.smonta();

  // Il collegamento ?tab=tariffe&sezione=surplus: la scheda si apre sulla linguetta Surplus.
  const daLink = apri(ARCHIVI([]), { props: { sezione: 'surplus' } });
  await finoA(() => !!scheda(daLink.r));
  verifica('con sezione «surplus» la scheda si apre sui surplus', scheda(daLink.r).props.value === 'surplus', scheda(daLink.r) && scheda(daLink.r).props.value);
  daLink.r.smonta();
  const senzaLink = apri(ARCHIVI([]), { props: { sezione: null } });
  await finoA(() => !!scheda(senzaLink.r));
  verifica('senza, sulle tariffe come sempre', scheda(senzaLink.r).props.value === 'tariffe');
  senzaLink.r.smonta();
});

await sezione('4. LA SCHEDA SURPLUS APRE IL MODULO CHIESTO DALLA FASCIA, UNA VOLTA', async () => {
  const SEZ = await caricaPagina('src/components/fatturazione/SurplusSezione.jsx');
  let fatte = 0;
  const props = { surplus: [], fornitori: [], isAdmin: true, oggi: '2026-10-13', richiesta: { cosa: 'fuel' }, onRichiestaFatta: () => { fatte++; } };
  const r = SEZ.monta(SEZ.Componente, props);
  await aspetta();
  const modulo = trova(r.albero, 'SurplusForm')[0];
  verifica('si apre il modulo del Fuel Surcharge, dal 01/10/2026 al 31/12/2026, con le date da confermare',
    !!modulo && modulo.props.aperto === true && modulo.props.fuel === true && modulo.props.bozzaIniziale.nome === 'Fuel Surcharge'
      && modulo.props.bozzaIniziale.dal === '2026-10-01' && modulo.props.bozzaIniziale.al === '2026-12-31' && !!modulo.props.bozzaIniziale.proposta,
    J(modulo && { aperto: modulo.props.aperto, fuel: modulo.props.fuel, dal: modulo.props.bozzaIniziale && modulo.props.bozzaIniziale.dal }));
  verifica('e lo dice a chi l\'ha chiesto, una volta', fatte === 1, String(fatte));
  // La linguetta rimontata senza richiesta non riapre niente.
  const r2 = SEZ.monta(SEZ.Componente, { ...props, richiesta: null });
  await aspetta();
  verifica('senza richiesta il modulo resta chiuso', trova(r2.albero, 'SurplusForm')[0].props.aperto === false && fatte === 1);
  // A chi non e' amministratore il modulo non si apre, ma la richiesta si chiude.
  const r3 = SEZ.monta(SEZ.Componente, { ...props, isAdmin: false });
  await aspetta();
  verifica('a chi non e\' amministratore non si apre', !trova(r3.albero, 'SurplusForm').length && fatte === 2, String(fatte));
  // Negli anni dopo la scorciatoia guarda i surplus gia' scritti.
  const r4 = SEZ.monta(SEZ.Componente, { ...props, oggi: '2027-02-10', surplus: IN_CORSO.map(x => ({ ...x, data_inizio_validita: '2026-10-01', data_fine_validita: '2026-12-31' })) });
  await aspetta();
  const m4 = trova(r4.albero, 'SurplusForm')[0];
  verifica('nel 2027 propone le date del Fuel Surcharge del 2026 spostate al 2027', !!m4 && m4.props.bozzaIniziale && m4.props.bozzaIniziale.dal === '2027-10-01' && m4.props.bozzaIniziale.al === '2027-12-31',
    J(m4 && m4.props.bozzaIniziale && [m4.props.bozzaIniziale.dal, m4.props.bozzaIniziale.al]));
  [r, r2, r3, r4].forEach(x => x.smonta());
});

// Un giorno fermo per le sezioni del cambio d'anno: la pagina legge oggi con
// new Date() e oggiRoma(). Si rimette il vero alla fine della sezione.
const OraVera = Date;
function fermaIlGiorno(iso) {
  const ms = OraVera.parse(iso);
  globalThis.Date = class extends OraVera { constructor(...a) { if (a.length) super(...a); else super(ms); } static now() { return ms; } };
  return () => { globalThis.Date = OraVera; };
}
const t26 = (p) => ({ unita_misura: '€/t', stato: 'attivo', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', ...p });
const TARIFFE_2026 = [
  t26({ id: 'r26', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', valore: 202 }),
  t26({ id: 'a26', direzione: 'ATTIVA', tipologia: 'ACI', cliente: 'ECOTYRE', regione: 'Calabria', valore: 230 }),
  t26({ id: 'g26', direzione: 'PASSIVA', tipologia: 'RETE', prestazione: 'RACCOLTA', fornitore_id: 'f1', fornitore_nome: 'EMMESSE SRLS', valore: 85 }),
];
// La pagina con un client che registra le chiamate alle funzioni.
async function apriIl(giorno, tariffe) {
  const c = clienteFinto({ archivi: { Tariffa: tariffe, Fornitore: FORNITORI, SurplusTariffa: [], PrimariaRete: [], Secondaria: [] }, funzioni: { gestisciAnagrafiche: async () => ({}) } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const r = PAGINA.monta(PAGINA.Componente, {});
  await orologio.avanza(5000);
  return { r, c };
}
const messaggioTabella = (r) => {
  const td = trova(r.albero, el => el.type === 'td' && el.props.colSpan === 13)[0];
  return td ? testo(td).replace(/\s+/g, ' ').trim() : '';
};

await sezione("6. IL 02/01/2027 L'ELENCO VUOTO DICE CHE LE TARIFFE SONO FINITE E COME SI PREPARANO LE NUOVE (difetto 32)", async () => {
  const ripristina = fermaIlGiorno('2027-01-02T09:00:00Z');
  try {
    const { r } = await apriIl('2027-01-02', TARIFFE_2026);
    const m = messaggioTabella(r);
    verifica('«Nessuna tariffa in vigore oggi: 3 tariffe sono scadute il 31/12/2026»', /^Nessuna tariffa in vigore oggi: 3 tariffe sono scadute il 31\/12\/2026\./.test(m), m);
    verifica('e come si preparano: Target & Status › Nuovo anno › «Prepara le tariffe», oppure «Mostra archiviate»', /Per l’anno nuovo: Target & Status › Nuovo anno › «Prepara le tariffe», oppure «Mostra archiviate»\./.test(m), m);
    verifica('non piu\' «Clicca "Aggiungi tariffa" per iniziare»', !/Clicca "Aggiungi tariffa"/.test(m), m);
    const link = trova(r.albero, el => nomeDi(el) === 'Link' && /Prepara le tariffe/.test(testo(el)))[0];
    // La scheda Nuovo anno prepara l'anno dopo quello scelto, come dal
    // collegamento della dashboard: per il 2027 si apre col 2026.
    verifica('il collegamento apre la scheda Nuovo anno che prepara il 2027, con l\'anno calcolato', !!link && link.props.to === '/target-status?tab=nuovo-anno&anno=2026', J(link && link.props.to));
    const mostra = trova(r.albero, el => el.type === 'button' && /«Mostra archiviate»/.test(testo(el)))[0];
    mostra.props.onClick();
    await aspetta();
    verifica('«Mostra archiviate» le fa vedere', trova(r.albero, el => el.type === 'tr' && ['r26', 'a26', 'g26'].includes(el.key)).length === 3 && !messaggioTabella(r), messaggioTabella(r));
    r.smonta();
    // la controprova: con una tariffa 2027 il messaggio non c'e'
    const con27 = await apriIl('2027-01-02', [...TARIFFE_2026, { ...TARIFFE_2026[0], id: 'r27', data_inizio_validita: '2027-01-01', data_fine_validita: '2027-12-31', valore: 205 }]);
    verifica('controprova: con la tariffa 2027 l\'elenco la mostra e il messaggio non c\'e\'', trova(con27.r.albero, el => el.type === 'tr' && el.key === 'r27').length === 1 && !messaggioTabella(con27.r), messaggioTabella(con27.r));
    con27.r.smonta();
    // e con l'archivio vuoto resta il messaggio di sempre
    const vuoto = await apriIl('2027-01-02', []);
    verifica('con l\'archivio vuoto resta «Nessuna tariffa. Clicca "Aggiungi tariffa" per iniziare.»', messaggioTabella(vuoto.r) === 'Nessuna tariffa. Clicca "Aggiungi tariffa" per iniziare.', messaggioTabella(vuoto.r));
    vuoto.r.smonta();
  } finally { ripristina(); }
});

await sezione('7. «RIAPRI» DI UNA TARIFFA DI RETE O ACI: AL PIU\' FINO AL 31/12 DEL SUO ANNO (difetto 7)', async () => {
  const ripristina = fermaIlGiorno('2027-01-02T09:00:00Z');
  const avvisi = [], domande = [];
  const prima = { alert: globalThis.alert, confirm: globalThis.confirm };
  globalThis.alert = (m) => { avvisi.push(String(m)); };
  globalThis.confirm = (m) => { domande.push(String(m)); return true; };
  try {
    const tariffe = [
      ...TARIFFE_2026,
      t26({ id: 'r26b', direzione: 'ATTIVA', tipologia: 'RETE', cliente: 'ECOTYRE', classe_materiale: 'G1', valore: 210, data_fine_validita: '2026-06-30' }),
      t26({ id: 'x26', direzione: 'ATTIVA', tipologia: 'EXTRA_RACCOLTA', cliente: 'ECOTYRE', valore: 202, data_fine_validita: '2026-06-30' }),
    ];
    const { r, c } = await apriIl('2027-01-02', tariffe);
    trova(r.albero, el => el.type === 'button' && /«Mostra archiviate»/.test(testo(el)))[0].props.onClick();
    await aspetta();
    const riapri = (id) => (trova(r.albero, el => el.type === 'tr' && el.key === id)[0] ? trova(trova(r.albero, el => el.type === 'tr' && el.key === id)[0], el => el.type === 'button' && el.props.title === 'Riapri')[0] : null);
    const invocate = () => c.chiamate.filter(x => x.tipo === 'funzione' && x.nome === 'gestisciAnagrafiche').map(x => x.payload);
    await riapri('r26').props.onClick();
    await aspetta();
    verifica('la rete 2026 finita il 31/12/2026 non si riapre sul 2027: niente mandato', invocate().length === 0, J(invocate()));
    verifica('e lo dice, con dove si prepara quella del 2027', avvisi.length === 1 && /vale già fino al 31\/12\/2026/.test(avvisi[0]) && /Per il 2027 serve la sua tariffa/.test(avvisi[0]) && /Prepara le tariffe/.test(avvisi[0]), J(avvisi));
    await riapri('r26b').props.onClick();
    await aspetta();
    const p1 = invocate()[0] || {};
    verifica('una rete 2026 chiusa a giugno si riapre fino al 31/12/2026, non senza fine', p1.id === 'r26b' && p1.dati && p1.dati.data_fine_validita === '2026-12-31' && p1.dati.stato === 'attivo', J(p1));
    verifica('e la domanda dice fino a quando', /fino al 31\/12\/2026/.test(domande[domande.length - 1] || ''), J(domande));
    await riapri('x26').props.onClick();
    await aspetta();
    const p2 = invocate()[1] || {};
    verifica('l\'extra raccolta resta libera: si riapre senza data di fine', p2.id === 'x26' && p2.dati && p2.dati.data_fine_validita === null, J(p2));
    r.smonta();
  } finally {
    globalThis.alert = prima.alert; globalThis.confirm = prima.confirm;
    ripristina();
  }
});

await sezione('8. IL MODULO PROPONE «AL» AL 31/12 DELL\'ANNO DEL «DAL» E DICE L\'ERRORE SOTTO IL CAMPO (difetto 7)', async () => {
  const FORM = await caricaPagina('src/components/fatturazione/TariffeForm.jsx');
  const invocate = [];
  const c = clienteFinto({ funzioni: { gestisciAnagrafiche: async (p) => { invocate.push(p); return {}; } } });
  globalThis.__CLIENTE_FINTO = c.cliente;
  const r = FORM.monta(FORM.Componente, { open: true, onClose: () => {}, onSaved: () => {}, editing: null, duplicating: null, excludePrestazione: '', fornitori: [], province: [], destinazioniRaccolta: [], stoccaggi: [], destinazioniSecondaria: [], switchToRuoliTab: () => {} });
  await aspetta();
  const tipologia = () => trova(r.albero, el => nomeDi(el) === 'Select' && trova(el.props.children, x => nomeDi(x) === 'SelectValue' && x.props.placeholder === 'Seleziona tipologia').length > 0)[0];
  const date = () => trova(r.albero, el => nomeDi(el) === 'Input' && el.props.type === 'date');
  const salva = async () => { trova(r.albero, el => nomeDi(el) === 'Button' && /Salva/.test(testo(el)))[0].props.onClick(); await aspetta(); };
  const sotto = () => trova(r.albero, el => el.type === 'p' && /text-destructive/.test(el.props.className || '')).map(testo).join(' ');
  tipologia().props.onValueChange('RETE');
  await aspetta();
  date()[0].props.onChange({ target: { value: '2027-01-01' } });
  await aspetta();
  verifica('rete, «Dal» 01/01/2027: «Al» proposto 31/12/2027', date()[1].props.value === '2027-12-31', J(date().map(d => d.props.value)));
  date()[1].props.onChange({ target: { value: '' } });
  await aspetta();
  await salva();
  verifica('«Al» vuoto: non si manda niente, e l\'errore sta sotto il campo', invocate.length === 0 && /Manca la data di fine validità/.test(sotto()) && /31\/12\/2027/.test(sotto()), J({ invocate, sotto: sotto() }));
  date()[1].props.onChange({ target: { value: '2028-06-30' } });
  await aspetta();
  await salva();
  verifica('«Al» 30/06/2028: non si manda, «finirebbe il 30/06/2028»', invocate.length === 0 && /finirebbe il 30\/06\/2028/.test(sotto()), sotto());
  date()[1].props.onChange({ target: { value: '2027-06-30' } });
  await aspetta();
  date()[0].props.onChange({ target: { value: '2027-02-01' } });
  await aspetta();
  verifica('una fine scritta a mano non si tocca cambiando il «Dal»', date()[1].props.value === '2027-06-30', J(date().map(d => d.props.value)));
  date()[1].props.onChange({ target: { value: '2027-12-31' } });
  await aspetta();
  await salva();
  verifica('controprova: dal 01/02 al 31/12/2027 si manda, con la fine', invocate.length === 1 && invocate[0].dati.data_fine_validita === '2027-12-31' && invocate[0].dati.data_inizio_validita === '2027-02-01', J(invocate));
  r.smonta();
  // L'extra raccolta resta libera: «Al» vuoto si manda com'e'.
  const r2 = FORM.monta(FORM.Componente, { open: true, onClose: () => {}, onSaved: () => {}, editing: null, duplicating: null, excludePrestazione: '', fornitori: [], province: [], destinazioniRaccolta: [], stoccaggi: [], destinazioniSecondaria: [], switchToRuoliTab: () => {} });
  await aspetta();
  trova(r2.albero, el => nomeDi(el) === 'Select' && trova(el.props.children, x => nomeDi(x) === 'SelectValue' && x.props.placeholder === 'Seleziona tipologia').length > 0)[0].props.onValueChange('EXTRA_RACCOLTA');
  await aspetta();
  trova(r2.albero, el => nomeDi(el) === 'Input' && el.props.type === 'date')[0].props.onChange({ target: { value: '2027-01-01' } });
  await aspetta();
  verifica('extra raccolta: «Al» resta vuoto', trova(r2.albero, el => nomeDi(el) === 'Input' && el.props.type === 'date')[1].props.value === '');
  trova(r2.albero, el => nomeDi(el) === 'Button' && /Salva/.test(testo(el)))[0].props.onClick();
  await aspetta();
  verifica('e si manda senza data di fine', invocate.length === 2 && invocate[1].dati.tipologia === 'EXTRA_RACCOLTA' && invocate[1].dati.data_fine_validita === undefined, J(invocate));
  r2.smonta();
});

orologio.ripristina();
console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

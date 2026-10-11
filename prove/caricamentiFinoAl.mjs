// Prova di FINO A CHE GIORNO ARRIVANO I DATI (utente, 10/10/2026).
//
// EcoTyna sapeva quando un file era stato caricato, non fino a che giorno
// arrivavano i dati dentro: alla domanda rispondeva «lo strumento non fornisce
// tale informazione». Un file caricato il 9 puo' fermarsi al 6. Ora lo strumento
// dei caricamenti dice, archivio per archivio, l'ultimo giorno che c'e' dentro:
// l'ultima fine trasporto dei terminati, il giorno della fotografia del portale,
// l'ultima dichiarazione, l'ultimo ordine assegnato. Sul giorno italiano.
//
// UNA REGOLA SOLA CON LA DASHBOARD (revisione W4, chiusura dell'audit 11/10/2026).
// Lo strumento aveva una sua regola: l'ultimo caricamento era la prima riga del
// registro senza «err» nell'esito, quindi anche una riscrittura «parziale» o una
// riga ancora «in_corso». Ora legge il registro con leggiRegistro e lo giudica con
// statoDelRegistro (registroCaricamenti.ts), dice l'archivio inaffidabile col
// testo della dashboard (avvisoCaricamento), e il «fino al» viene da datiFinoAl
// (statoArchivi.ts). L'ultima parte confronta lo strumento con freschezzaArchivi,
// la funzione della dashboard, sugli stessi registri.
// npm run prove
const R = new URL('../base44/shared/', import.meta.url).href;
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');
const { freschezzaArchivi } = await import(R + 'cruscotto.ts');
const { datiFinoAl } = await import(R + 'statoArchivi.ts');

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const ARCHIVI = {
  UploadLog: [{ id: 'u1', tipo_file: 'primarie', created_date: '2026-10-09T08:00:00Z', nome_file: 'primarie.xlsx', righe_importate: 120, esito: 'ok' }],
  PrimariaRete: [
    { id: 'p1', stato: 'terminato', trasporto_finito_il: '2026-10-05T00:00:00.000Z' },
    { id: 'p2', stato: 'terminato', trasporto_finito_il: '2026-10-06T23:30:00.000Z' },   // a Roma e' gia' il 7
    { id: 'p3', stato: 'eseguito', trasporto_finito_il: '2026-10-08T10:00:00.000Z' },    // non terminato: non conta
    { id: 'p4', stato: 'terminato' },                                                    // senza fine trasporto
  ],
  PrimariaAci: [{ id: 'a1', stato: 'terminato', trasporto_finito_il: '2026-09-30T00:00:00.000Z' }],
  Secondaria: [],
  OrdineNonDichiarato: [{ id: 'o1', created_date: '2026-10-09T06:00:00Z' }, { id: 'o2', created_date: '2026-10-02T06:00:00Z' }],
  // Il report porta anche le dichiarazioni degli altri partner operativi: una di
  // Baucina piu' recente delle nostre non deve spostare la data (11/10/2026).
  DichiarazioneTrattamento: [
    { id: 'd1', data_dichiarazione: '2026-10-03', partner_operativo: 'SMOCO SRL' },
    { id: 'd2', data_dichiarazione: '2026-10-08', partner_operativo: 'BAUCINA RECYCLING TYRES SRL' },
    { id: 'd3', data_dichiarazione: '2026-09-20' },
  ],
  Assegnato: [{ id: 'as1', ordine_immesso_il: '2026-10-08T09:00:00Z' }],
};
const ordina = (righe, sort) => {
  const campo = String(sort || 'id').replace(/^[-+]/, '');
  const giu = String(sort || '').startsWith('-');
  // come il database: chi non ha il campo va in fondo
  return [...righe].sort((a, b) => {
    const x = a[campo], y = b[campo];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return giu ? String(y).localeCompare(String(x)) : String(x).localeCompare(String(y));
  });
};
// Come il database: un valore, oppure { $in: [...] } (leggiRegistro legge tutti i
// tipi di file con una lettura sola).
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => (v && Array.isArray(v.$in) ? v.$in.includes(r[k]) : r[k] === v));
const finto = {
  asServiceRole: {
    entities: new Proxy({}, {
      get: (_t, nome) => ({
        list: async (sort, lim = 1e9, skip = 0) => {
          if (nome === 'Terziaria') throw new Error('rate limit exceeded');
          return ordina(ARCHIVI[nome] || [], sort).slice(skip, skip + lim);
        },
        filter: async (f, sort, lim = 1e9, skip = 0) => {
          if (nome === 'Terziaria') throw new Error('rate limit exceeded');
          return ordina((ARCHIVI[nome] || []).filter(r => soddisfa(r, f)), sort).slice(skip, skip + lim);
        },
      }),
    }),
  },
};
const d = (await STRUMENTI.find(s => s.nome === 'caricamenti').esegui(finto, {})).dati;
const di = (a) => (d.dati_fino_al || []).find(x => x.archivio === a) || {};

console.log('FINO A CHE GIORNO ARRIVANO I DATI');
verifica('il caricamento c\'e\' ancora', d.caricamenti && d.caricamenti[0] && d.caricamenti[0].quando === '2026-10-09', JSON.stringify(d.caricamenti));
verifica("primarie di rete: l'ultima fine trasporto dei terminati, sul giorno italiano (il 7, non il 6 ne' l'8 dell'eseguito)", di('primarie di rete').dati_fino_al === '2026-10-07', JSON.stringify(di('primarie di rete')));
verifica('primarie ACI: il 30 settembre', di('primarie ACI').dati_fino_al === '2026-09-30', JSON.stringify(di('primarie ACI')));
verifica('secondarie vuote: si dice vuoto, non una data', di('secondarie').dati_fino_al === null && di('secondarie').vuoto === true, JSON.stringify(di('secondarie')));
verifica('terziarie che non si leggono: lettura non riuscita, non vuoto', di('terziarie').lettura_non_riuscita === true && !di('terziarie').vuoto, JSON.stringify(di('terziarie')));
verifica('il file dei non dichiarati: il giorno della fotografia piu\' recente', di('ordini non dichiarati (fotografia del portale)').dati_fino_al === '2026-10-09', JSON.stringify(di('ordini non dichiarati (fotografia del portale)')));
verifica("il report delle dichiarazioni: l'ultima dichiarazione nostra, non quella di Baucina dell'8", di('report delle dichiarazioni di trattamento').dati_fino_al === '2026-10-03', JSON.stringify(di('report delle dichiarazioni di trattamento')));
verifica("gli assegnati: l'ultimo ordine immesso", di('assegnati di rete').dati_fino_al === '2026-10-08');
verifica('e la nota dice che caricamento e dati sono due giorni diversi', /due cose diverse/.test(d.nota_fino_al || ''));

console.log('IL REPORT DELLE DICHIARAZIONI GUARDA SOLO IL PARTNER SMOCO');
{
  const report = 'report delle dichiarazioni di trattamento';
  const giorno = (i) => `2026-10-${String(1 + (i % 9)).padStart(2, '0')}`;
  // Sessanta righe di un altro partner, tutte piu' recenti della nostra: la
  // nostra sta oltre la prima pagina e va trovata lo stesso.
  ARCHIVI.DichiarazioneTrattamento = [
    ...Array.from({ length: 60 }, (_, i) => ({ id: 'b' + i, data_dichiarazione: giorno(i).replace('2026-10-0', '2026-10-1'), partner_operativo: 'Baucina Recycling Tyres' })),
    { id: 'n1', data_dichiarazione: '2026-09-25', partner_operativo: 'Smoco S.r.l.' },
  ];
  const d2 = (await STRUMENTI.find(s => s.nome === 'caricamenti').esegui(finto, {})).dati;
  const r2 = (d2.dati_fino_al || []).find(x => x.archivio === report) || {};
  verifica('la nostra oltre la prima pagina si trova', r2.dati_fino_al === '2026-09-25', JSON.stringify(r2));
  // Solo righe di altri partner: la data non si puo' dire, e non e' «vuoto».
  ARCHIVI.DichiarazioneTrattamento = [{ id: 'b1', data_dichiarazione: '2026-10-08', partner_operativo: 'BAUCINA RECYCLING TYRES SRL' }];
  const d3 = (await STRUMENTI.find(s => s.nome === 'caricamenti').esegui(finto, {})).dati;
  const r3 = (d3.dati_fino_al || []).find(x => x.archivio === report) || {};
  verifica('nessuna riga nostra: nessuna data, e non si dice vuoto', r3.dati_fino_al === null && r3.nessuna_riga_nostra === true && !r3.vuoto && /partner operativo SMOCO/.test(r3.avviso || ''), JSON.stringify(r3));
  // Gli altri archivi non cambiano lettura: righe senza il campo restano «vuoto».
  verifica('un archivio senza filtro del partner si legge come prima', (d3.dati_fino_al || []).find(x => x.archivio === 'secondarie').vuoto === true);
}

console.log('UNA REGOLA SOLA CON LA DASHBOARD SULLO STATO DI UN ARCHIVIO');
{
  const eco = async () => (await STRUMENTI.find(s => s.nome === 'caricamenti').esegui(finto, {})).dati;
  const TIPI = ['primarie', 'secondarie', 'terziarie', 'ordini_non_dichiarati', 'dichiarazioni_trattamento', 'pdr'];
  // La dashboard sugli stessi registri: freschezzaArchivi di cruscotto.ts.
  const dashboard = () => freschezzaArchivi(ARCHIVI.UploadLog, '2026-10-11', Date.now(), TIPI);
  const primarieDi = (d) => (d.caricamenti || []).find(c => c.tipo === 'primarie') || null;
  const stessoStato = (d, dash) => JSON.stringify((d.caricamenti_da_ripetere_o_in_corso || []).map(x => x.titolo).sort())
    === JSON.stringify(dash.in_corso.map(x => x.avviso.titolo).sort());

  // 1. Il caso della revisione: primarie riuscite il 05/10, riscrittura delle
  // primarie finita «parziale» il 09/10. La dashboard: «caricate il 05/10,
  // Caricamento non riuscito: ricarica il file». EcoTyna diceva «caricate il
  // 09/10, esito parziale», e nessun tentativo fallito.
  ARCHIVI.UploadLog = [
    { id: 'u1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: '2026-10-05T08:00:00', nome_file: 'primarie_05.xlsx', righe_importate: 41000 },
    { id: 'u2', tipo_file: 'primarie', esito: 'parziale', modalita: 'sostituzione', created_date: '2026-10-09T08:00:00', nome_file: 'primarie_09.xlsx', messaggio: '200 righe non scritte' },
  ];
  let d = await eco();
  let dash = dashboard();
  const p = primarieDi(d);
  verifica('riscrittura parziale: l\'ultimo caricamento delle primarie e\' quello riuscito del 05/10, come in dashboard',
    p && p.quando === '2026-10-05' && p.file === 'primarie_05.xlsx' && p.righe === 41000 && dash.archivi.find(a => a.tipo_file === 'primarie').il === '2026-10-05', JSON.stringify(d.caricamenti));
  const nr = (d.caricamenti_da_ripetere_o_in_corso || [])[0] || {};
  verifica('e la riscrittura del 09/10 si dice non riuscita, da ricaricare', nr.tipo === 'primarie' && nr.stato === 'non_riuscito' && nr.quando === '2026-10-09' && /ricarica il file/.test(nr.titolo || ''), JSON.stringify(d.caricamenti_da_ripetere_o_in_corso));
  verifica('con lo stesso titolo della dashboard', stessoStato(d, dash), JSON.stringify({ eco: d.caricamenti_da_ripetere_o_in_corso, dash: dash.in_corso.map(x => x.avviso.titolo) }));
  verifica('e una nota che dice che i numeri di quell\'archivio non sono affidabili', /non sono affidabili/.test(d.nota_caricamenti || ''));
  verifica('il vecchio campo dei «tentativi falliti» non c\'e\' piu\'', !('tentativi_falliti_dopo_l_ultimo_riuscito' in d));

  // 2. Un rifiuto a dati intatti (un file sbagliato scartato prima di toccare
  // l'archivio): non rende l'archivio inaffidabile, per la dashboard e per EcoTyna.
  ARCHIVI.UploadLog = [
    { id: 'u1', tipo_file: 'primarie', esito: 'successo', modalita: 'sostituzione', created_date: '2026-10-05T08:00:00Z', nome_file: 'primarie_05.xlsx' },
    { id: 'u2', tipo_file: 'primarie', esito: 'errore', created_date: '2026-10-09T08:00:00Z', nome_file: 'secondarie.xlsx', messaggio: 'Il file caricato sembra di tipo SECONDARIE' },
  ];
  d = await eco();
  dash = dashboard();
  verifica('rifiuto a dati intatti: l\'archivio resta quello del 05/10 e niente da ripetere', primarieDi(d).quando === '2026-10-05' && !d.caricamenti_da_ripetere_o_in_corso && stessoStato(d, dash), JSON.stringify(d));

  // 3. Una riga ancora aperta: da due minuti e' qualcuno che sta caricando, da
  // ieri e' un caricamento interrotto. La vecchia regola la prendeva per l'ultimo
  // caricamento (nel suo esito non c'e' «err»).
  const fa = (ms) => new Date(Date.now() - ms).toISOString();
  ARCHIVI.UploadLog = [
    { id: 's1', tipo_file: 'secondarie', esito: 'successo', modalita: 'sostituzione', created_date: '2026-10-01T08:00:00Z', nome_file: 'sec_01.xlsx' },
    { id: 's2', tipo_file: 'secondarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(2 * 60 * 1000), nome_file: 'sec_oggi.xlsx', utente: 'Ufficio' },
    { id: 't1', tipo_file: 'terziarie', esito: 'successo', modalita: 'sostituzione', created_date: '2026-10-01T08:00:00Z', nome_file: 'ter_01.xlsx' },
    { id: 't2', tipo_file: 'terziarie', esito: 'in_corso', modalita: 'sostituzione', created_date: fa(26 * 3600 * 1000), nome_file: 'ter_ieri.xlsx' },
  ];
  d = await eco();
  dash = dashboard();
  const di2 = (t) => (d.caricamenti || []).find(c => c.tipo === t) || {};
  const aperti = Object.fromEntries((d.caricamenti_da_ripetere_o_in_corso || []).map(x => [x.tipo, x]));
  verifica('una riga in_corso non e\' l\'ultimo caricamento: secondarie e terziarie restano al 01/10', di2('secondarie').quando === '2026-10-01' && di2('terziarie').quando === '2026-10-01', JSON.stringify(d.caricamenti));
  verifica('da due minuti: archivio in caricamento', aperti.secondarie && aperti.secondarie.stato === 'in_corso' && /in caricamento/.test(aperti.secondarie.titolo), JSON.stringify(aperti.secondarie));
  verifica('da ieri: caricamento interrotto', aperti.terziarie && aperti.terziarie.stato === 'interrotto', JSON.stringify(aperti.terziarie));
  verifica('gli stessi due avvisi della dashboard', stessoStato(d, dash), JSON.stringify({ eco: Object.keys(aperti), dash: dash.in_corso.map(x => x.avviso.titolo) }));

  // 4. Un caricamento riuscito dopo quello rimasto aperto lo supera: non si dice piu'.
  ARCHIVI.UploadLog.push({ id: 't3', tipo_file: 'terziarie', esito: 'successo', modalita: 'sostituzione', created_date: fa(3600 * 1000), nome_file: 'ter_oggi.xlsx' });
  d = await eco();
  verifica('superato da un caricamento riuscito, l\'interrotto non si dice piu\'', !(d.caricamenti_da_ripetere_o_in_corso || []).some(x => x.tipo === 'terziarie') && (d.caricamenti || []).find(c => c.tipo === 'terziarie').file === 'ter_oggi.xlsx', JSON.stringify(d));

  // 5. Solo caricamenti non riusciti: nessun ultimo caricamento, e lo si dice.
  ARCHIVI.UploadLog = [
    { id: 'o1', tipo_file: 'ordini_non_dichiarati', esito: 'errore', modalita: 'sostituzione', created_date: '2026-10-08T08:00:00Z', nome_file: 'ond.xlsx' },
  ];
  d = await eco();
  const nessuno = (d.nessun_caricamento_riuscito || [])[0] || {};
  verifica('solo caricamenti non riusciti: nessuna data inventata, e lo si dice', !(d.caricamenti || []).some(c => c.tipo === 'ordini_non_dichiarati') && nessuno.tipo === 'ordini_non_dichiarati' && /non riusciti/.test(nessuno.avviso || ''), JSON.stringify(d));
  verifica('e la riscrittura in errore e\' da ripetere', (d.caricamenti_da_ripetere_o_in_corso || []).some(x => x.tipo === 'ordini_non_dichiarati' && x.stato === 'non_riuscito'), JSON.stringify(d.caricamenti_da_ripetere_o_in_corso));
}

{
  // E chi risponde lo deve dire: la regola della risposta, nel sorgente (senza \r).
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../base44/functions/chiediAssistente/entry.ts', import.meta.url), 'utf8').replace(/\r/g, '');
  verifica('le regole della risposta: un caricamento da ripetere si dice sempre, e l\'ultimo e\' il riuscito',
    /'3-quindecies\. Se lo strumento caricamenti porta caricamenti_da_ripetere_o_in_corso, dillo sempre[^\n]*l\\'ultimo riuscito/.test(src));
}

console.log('IL «FINO AL» E\' QUELLO DELLA DASHBOARD');
{
  // La fotografia del portale con created_date senza la Z, come la salva il
  // database: e' UTC. Le 22:30 del 9 sono gia' il 10 a Roma. La copia di EcoTyna
  // la leggeva nel fuso della macchina: sul server (UTC) tornava, altrove no.
  ARCHIVI.OrdineNonDichiarato = [{ id: 'o1', created_date: '2026-10-09T22:30:00' }];
  const d = (await STRUMENTI.find(s => s.nome === 'caricamenti').esegui(finto, {})).dati;
  const foto = (d.dati_fino_al || []).find(x => x.archivio === 'ordini non dichiarati (fotografia del portale)') || {};
  verifica('created_date senza la Z letto in UTC: il 10/10 a Roma', foto.dati_fino_al === '2026-10-10', JSON.stringify(foto));
  const comune = await datiFinoAl(finto.asServiceRole.entities);
  verifica('le stesse voci di datiFinoAl (statoArchivi.ts), con entita e tipo_file', JSON.stringify(d.dati_fino_al) === JSON.stringify(comune) && d.dati_fino_al.every(v => v.entita && v.tipo_file), JSON.stringify({ eco: d.dati_fino_al, comune }).slice(0, 400));
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

// Prova di FINO A CHE GIORNO ARRIVANO I DATI (utente, 10/10/2026).
//
// EcoTyna sapeva quando un file era stato caricato, non fino a che giorno
// arrivavano i dati dentro: alla domanda rispondeva «lo strumento non fornisce
// tale informazione». Un file caricato il 9 puo' fermarsi al 6. Ora lo strumento
// dei caricamenti dice, archivio per archivio, l'ultimo giorno che c'e' dentro:
// l'ultima fine trasporto dei terminati, il giorno della fotografia del portale,
// l'ultima dichiarazione, l'ultimo ordine assegnato. Sul giorno italiano.
// npm run prove
const R = new URL('../base44/shared/', import.meta.url).href;
const { STRUMENTI } = await import(R + 'strumentiAssistente.ts');

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
  DichiarazioneTrattamento: [{ id: 'd1', data_dichiarazione: '2026-10-03' }],
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
const soddisfa = (r, f) => Object.entries(f || {}).every(([k, v]) => r[k] === v);
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
verifica("il report delle dichiarazioni: l'ultima dichiarazione", di('report delle dichiarazioni di trattamento').dati_fino_al === '2026-10-03');
verifica("gli assegnati: l'ultimo ordine immesso", di('assegnati di rete').dati_fino_al === '2026-10-08');
verifica('e la nota dice che caricamento e dati sono due giorni diversi', /due cose diverse/.test(d.nota_fino_al || ''));

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

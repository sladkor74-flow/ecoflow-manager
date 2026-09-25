// Prova dello storico conservato al caricamento (base44/shared/storicoConservato.ts).
// Un file che comincia dal 2025 conserva i terminati con la fine trasporto nel
// 2024: non sono mancanti e non si cancellano. L'anno e' sempre quello della
// fine trasporto. npm run prove
import { annoInizioFile, ordiniDaConservare, cancellatiDaLasciare, svuotaTranne } from '../base44/shared/storicoConservato.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

const t = (id, fine, extra = {}) => ({ id_ordine: id, stato: 'Terminato', trasporto_finito_il: fine, ordine_immesso_il: '2024-11-01T08:00:00Z', ...extra });

console.log("L'ANNO DA CUI COMINCIA IL FILE");
verifica('la prima fine trasporto dei terminati', annoInizioFile([t('A', '2025-01-03T09:00:00Z'), t('B', '2026-02-01T09:00:00Z')]) === 2025);
verifica('gli assegnati, senza fine, non lo spostano', annoInizioFile([t('A', '2025-01-03T09:00:00Z'), { id_ordine: 'X', stato: 'Assegnato', ordine_immesso_il: '2023-05-01T08:00:00Z' }]) === 2025);
verifica('l\'immissione non conta: immesso nel 2024, finito nel 2025, il file comincia dal 2025', annoInizioFile([t('A', '2025-01-02T09:00:00Z', { ordine_immesso_il: '2024-12-20T08:00:00Z' })]) === 2025);
verifica('capodanno italiano: 23:30Z del 31/12/2024 e\' gia\' 2025', annoInizioFile([t('A', '2024-12-31T23:30:00Z')]) === 2025);
verifica('senza terminati con la fine, nessun anno: non si conserva niente', annoInizioFile([{ id_ordine: 'X', stato: 'Assegnato' }]) === null);

console.log('CHE COSA SI CONSERVA');
const archivio = [
  t('V1', '2024-06-10T08:00:00Z'), t('V1', '2024-06-10T08:00:00Z'), // due righe dello stesso ordine
  t('V2', '2024-12-30T08:00:00Z'),
  t('N1', '2025-03-01T08:00:00Z'),
  t('SF', null),                                                   // terminato senza fine trasporto
  { id_ordine: 'AS', stato: 'Assegnato', ordine_immesso_il: '2024-10-01T08:00:00Z' },
  t('MX', '2024-12-20T08:00:00Z'), t('MX', '2025-01-02T08:00:00Z'), // righe a cavallo
  t('F24', '2024-05-01T08:00:00Z'),                                 // del 2024, ma anche nel file
];
const idFile = new Set(['N1', 'F24']);
const c = ordiniDaConservare(archivio, 2025, idFile);
verifica('si conservano i terminati del 2024 assenti dal file, con tutte le righe', c.ordini.has('V1') && c.ordini.has('V2') && c.righe === 3, JSON.stringify([...c.ordini]));
verifica('il senza fine trasporto non ha anno: non si conserva', !c.ordini.has('SF'));
verifica('un assegnato non si conserva mai', !c.ordini.has('AS'));
verifica('un ordine con una riga nel 2025 non si conserva', !c.ordini.has('MX'));
verifica('quello che il file contiene non si conserva: lo riscrive il file', !c.ordini.has('F24') && !c.ordini.has('N1'));
verifica('senza anno di inizio non si conserva niente', ordiniDaConservare(archivio, null, idFile).ordini.size === 0);

console.log('I CANCELLATI DEGLI ANNI PRIMA SI LASCIANO ANDARE');
const canc = (id, immesso) => ({ id_ordine: id, stato: 'Cancellato', ordine_immesso_il: immesso });
const archivioCanc = [canc('C24', '2024-07-01T08:00:00Z'), canc('C25', '2025-02-01T08:00:00Z'), canc('C24F', '2024-03-01T08:00:00Z'), t('V1', '2024-06-10T08:00:00Z')];
const lasciati = cancellatiDaLasciare(archivioCanc, 2025, new Set(['C24F']));
verifica('un cancellato del 2024 assente dal file non serve piu\'', lasciati.has('C24'));
verifica('uno del 2025 resta nel controllo: serve come statistica', !lasciati.has('C25'));
verifica('uno che il file contiene lo riscrive il file', !lasciati.has('C24F'));
verifica('un terminato non e\' un cancellato', !lasciati.has('V1'));
verifica('e non si conserva: non e\' storico', !ordiniDaConservare(archivioCanc, 2025, new Set(['C24F'])).ordini.has('C24'));
verifica('senza anno di inizio non si lascia andare niente', cancellatiDaLasciare(archivioCanc, null, new Set()).size === 0);

console.log("LO SVUOTAMENTO TRANNE LO STORICO");
// Un archivio finto con la stessa interfaccia della piattaforma.
const finto = (righe) => {
  const stato = { righe: [...righe], chiamate: [] };
  const corrisponde = (r, q) => Object.entries(q).every(([k, v]) => (v && v.$in ? v.$in.includes(r[k]) : r[k] === v));
  stato.ent = {
    async deleteMany(q) { stato.chiamate.push(q); const prima = stato.righe.length; stato.righe = stato.righe.filter(r => !corrisponde(r, q)); return { deleted: prima - stato.righe.length }; },
    async filter(q) { return stato.righe.filter(r => corrisponde(r, q)); },
  };
  return stato;
};
const a1 = finto(archivio);
await svuotaTranne(a1.ent, archivio, c.ordini);
verifica('restano solo le righe conservate', a1.righe.length === 3 && a1.righe.every(r => c.ordini.has(r.id_ordine)), JSON.stringify(a1.righe.map(r => r.id_ordine)));
verifica('non si usa mai il deleteMany({}) quando c\'e\' da conservare', a1.chiamate.every(q => Object.keys(q).length > 0));
const a2 = finto(archivio);
await svuotaTranne(a2.ent, archivio, new Set());
verifica('senza niente da conservare e\' lo svuotamento di sempre', a2.righe.length === 0 && JSON.stringify(a2.chiamate) === '[{}]');
// Una piattaforma che non capisce il filtro: restituisce tutto a ogni query.
const a3 = finto(archivio);
a3.ent.filter = async () => a3.righe;
let fermato = false;
try { await svuotaTranne(a3.ent, archivio, c.ordini); } catch { fermato = true; }
verifica('se il filtro non e\' affidabile ci si ferma senza cancellare niente', fermato && a3.righe.length === archivio.length && a3.chiamate.length === 0);
// Molti ordini: si cancella a blocchi.
const tanti = Array.from({ length: 450 }, (_, i) => t('N' + i, '2025-02-01T08:00:00Z')).concat([t('V9', '2024-02-01T08:00:00Z')]);
const a4 = finto(tanti);
await svuotaTranne(a4.ent, tanti, new Set(['V9']));
verifica('a blocchi da 200 ID', a4.chiamate.length === 3 && a4.righe.length === 1 && a4.righe[0].id_ordine === 'V9', String(a4.chiamate.length));

console.log(`\n${ok} verifiche superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

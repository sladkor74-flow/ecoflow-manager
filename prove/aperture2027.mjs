// Prova del PASSAGGIO AL 2027: LE APERTURE DEGLI IMPIANTI, 10/10/2026.
//
// Trovato dall'audit del 10/10/2026, ed era il piu' serio. L'apertura di un
// impianto - il peso non dichiarato del 31 dicembre, rete e ACI, da cui l'anno
// dopo riparte - non la scriveva nessuno:
//   - la chiusura chiedeva le due letture, le confrontava con la lettera di
//     Ecotyre, e poi le buttava; salvava solo i piazzali;
//   - la copia d'anno crea le righe dell'anno nuovo SENZA apertura, apposta
//     (copiare quella del 2026 nel 2027 sarebbe sbagliato);
//   - la lista dell'anno nuovo non aveva una voce per controllarla;
//   - l'unico che la scriveva era un campo a mano in Giacenze.
// Il 2 gennaio ogni impianto sarebbe ripartito da zero mentre il portale si porta
// dietro la giacenza vera: con i numeri del 10/10/2026, circa 1.617 t di scarto
// su quattro impianti, e il guardiano notturno che li segnala tutti.
//
// E due voci della lista dell'anno nuovo, scritta lo stesso giorno, mentivano:
// quella dei target contava un archivio che non ha mai avuto una riga, e quella
// del contratto dava per pronto un contratto solo copiato.
//
// La parte piu' importante di questa prova e' l'ORDINE: chiusura e copia d'anno
// si possono fare in tutti e due i modi, e nessuno dei due deve rompere l'altro.
// npm run prove
import { apertureDegliImpianti, rigaDellaChiusura } from '../base44/shared/chiusuraAnno.ts';
import { listaAnno, confermaTariffa, tariffeDaConfermare, copiaTariffa } from '../base44/shared/inizializzazioneAnno.ts';
import { pianoCopiaAnno, daConfermare, notaCopia } from '../base44/shared/annoTarget.ts';
import { normalizzaRagioneSociale as n } from '../base44/shared/normalizzaRagioneSociale.ts';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };

// --- Il caso: i siti del 2026 come sono in produzione ---
const SITI_2026 = [
  { id: 's1', sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true, tipologia_trattamento: 'Frantumazione', giacenza_riferimento_t: 385.36 },
  { id: 's2', sito: 'T-CYCLE INDUSTRIES SRL', tipo_destinazione: 'imp', anno: 2026, dichiara_rete: true },
  { id: 's3', sito: 'TECNOGUM SRL', tipo_destinazione: 'imp', anno: 2026, dichiara_rete: false },
  { id: 's4', sito: 'NAPPI SUD SRL', tipo_destinazione: 'stoc', anno: 2026, giacenza_riferimento_t: 34.96 },
  { id: 's5', sito: 'Irigom S.r.l.', tipo_destinazione: 'stoc', anno: 2026 },
];
const IMPIANTI = ['Irigom S.r.l.', 'T-CYCLE INDUSTRIES SRL', 'TECNOGUM SRL'].map(nome => ({ chiave: n(nome), nome }));
// Le letture del 31/12/2026, dal file degli ordini non dichiarati: i numeri del 10/10.
const LETTURE = {
  [n('Irigom S.r.l.')]: { pfu_kg: 652840, aci_kg: 0 },
  [n('T-CYCLE INDUSTRIES SRL')]: { pfu_kg: '364800' },     // arriva anche come testo
  [n('TECNOGUM SRL')]: { pfu_kg: 0, aci_kg: 1820 },         // uno zero LETTO e' un'apertura
};

console.log('LA CHIUSURA SCRIVE LE APERTURE DEGLI IMPIANTI');
{
  const a = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI, letture_impianti: LETTURE, siti: SITI_2026, chiave: n });
  verifica("sono dell'anno dopo, dal 31 dicembre", a.anno === 2027 && a.al === '2026-12-31');
  verifica('tre impianti, tre righe da creare (il 2027 non ce le ha ancora)',
    a.piano.length === 3 && a.piano.every(x => x.azione === 'crea'), JSON.stringify(a.piano.map(x => x.azione)));
  const ir = a.piano.find(x => x.sito === 'Irigom S.r.l.');
  verifica('i chili diventano tonnellate: 652.840 kg = 652,84 t', ir && ir.dati.giacenza_riferimento_t === 652.84, ir && String(ir.dati.giacenza_riferimento_t));
  verifica("e l'ACI ha la sua, a parte: rete e ACI non si sommano", ir && ir.dati.giacenza_riferimento_aci_t === 0);
  verifica("la riga dice di che giorno e' l'apertura", ir && ir.dati.apertura_del === '2026-12-31');
  verifica("e porta i campi del sito dell'anno prima, come la copia", ir && ir.dati.dichiara_rete === true && ir.dati.tipologia_trattamento === 'Frantumazione' && ir.dati.tipo_destinazione === 'imp');
  const tc = a.piano.find(x => x.sito === 'T-CYCLE INDUSTRIES SRL');
  verifica('una lettura arrivata come testo vale lo stesso', tc && tc.dati.giacenza_riferimento_t === 364.8);
  verifica("senza lettura ACI l'ACI non si inventa: il campo non c'e'", tc && !('giacenza_riferimento_aci_t' in tc.dati));
  const te = a.piano.find(x => x.sito === 'TECNOGUM SRL');
  verifica('uno zero letto e\' un\'apertura, non un vuoto', te && te.dati.giacenza_riferimento_t === 0 && te.dati.apertura_del === '2026-12-31');
  verifica("e Tecnogum, che la rete non la dichiara, la conserva com'e'", te && te.dati.dichiara_rete === false);
  verifica('i piazzali non c\'entrano: hanno la loro fotografia', !a.piano.some(x => /NAPPI/.test(x.sito)));
}

console.log('SI SCRIVE SOLO QUELLO CHE E\' STATO LETTO');
{
  const a = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI, letture_impianti: { [n('Irigom S.r.l.')]: { pfu_kg: 652840 } }, siti: SITI_2026, chiave: n });
  verifica('chi non ha la lettura non riceve un numero dedotto', a.piano.length === 1 && a.senza_lettura.length === 2);
  verifica('e si dice chi e\'', a.senza_lettura.includes('TECNOGUM SRL') && a.senza_lettura.includes('T-CYCLE INDUSTRIES SRL'));
  const vuote = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI, letture_impianti: { [n('Irigom S.r.l.')]: { pfu_kg: '', aci_kg: null } }, siti: SITI_2026, chiave: n });
  verifica('una casella vuota non e\' uno zero', vuote.piano.length === 0 && vuote.senza_lettura.length === 3);
}

console.log('SE LA RIGA DEL 2027 C\'E\' GIA\', SI AGGIORNA');
{
  const siti = [...SITI_2026, { id: 'n1', sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', anno: 2027, note: notaCopia(2027) }];
  const a = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI.slice(0, 1), letture_impianti: LETTURE, siti, chiave: n });
  verifica('aggiorna quella, non ne crea una seconda', a.piano.length === 1 && a.piano[0].azione === 'aggiorna' && a.piano[0].id === 'n1');
  verifica('e scrive solo i campi dell\'apertura', Object.keys(a.piano[0].dati).sort().join() === 'apertura_del,giacenza_riferimento_aci_t,giacenza_riferimento_t');
  // Un'apertura gia' scritta da una chiusura e' il punto da cui riparte un anno:
  // non si cambia per sbaglio.
  const scritta = [...SITI_2026, { id: 'n1', sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', anno: 2027, apertura_del: '2026-12-31', giacenza_riferimento_t: 600, giacenza_riferimento_aci_t: 0 }];
  const b = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI.slice(0, 1), letture_impianti: LETTURE, siti: scritta, chiave: n });
  verifica("un'apertura diversa gia' scritta non si cambia senza conferma", b.piano.length === 0 && b.gia_scritte.length === 1 && /sostituzione/.test(b.gia_scritte[0].motivo), JSON.stringify(b.gia_scritte));
  const c = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI.slice(0, 1), letture_impianti: LETTURE, siti: scritta, chiave: n, sostituisci: true });
  verifica('con la conferma si cambia, e si ricorda il prima', c.piano.length === 1 && c.piano[0].prima.rete_t === 600);
  const uguale = [...SITI_2026, { id: 'n1', sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', anno: 2027, apertura_del: '2026-12-31', giacenza_riferimento_t: 652.84, giacenza_riferimento_aci_t: 0 }];
  const d = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI.slice(0, 1), letture_impianti: LETTURE, siti: uguale, chiave: n });
  verifica('rifare la chiusura con gli stessi numeri non riscrive niente', d.piano.length === 0 && /uguale/.test(d.gia_scritte[0].motivo));
}

console.log('L\'ORDINE NON CONTA: PRIMA LA CHIUSURA, POI LA COPIA D\'ANNO');
{
  // La chiusura crea le righe 2027 degli impianti. Poi l'amministratore copia
  // l'anno: la copia deve riconoscere quelle righe come sue e completare gli
  // ALTRI siti, non fermarsi.
  const a = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI, letture_impianti: LETTURE, siti: SITI_2026, chiave: n });
  const create = a.piano.map((x, i) => ({ id: 'c' + i, ...x.dati }));
  verifica('le righe create dalla chiusura sono «da confermare», come quelle della copia', create.every(daConfermare) && create.every(rigaDellaChiusura));
  const piano = pianoCopiaAnno({ anno: 2027, sorgente: { siti: SITI_2026 }, esistenti: { siti: create }, chiave: n });
  const creati = piano.siti.map(s => `${s.sito}|${s.tipo_destinazione}`).sort();
  verifica('la copia completa i piazzali', creati.includes('NAPPI SUD SRL|stoc') && creati.includes('Irigom S.r.l.|stoc'), JSON.stringify(creati));
  verifica('e non rifa\' gli impianti che la chiusura ha gia\' creato', !creati.some(x => x.endsWith('|imp')), JSON.stringify(creati));
  verifica('niente salti di categoria: la copia non pensa che i siti siano gia\' compilati', !piano.saltati.siti_gia_compilati, JSON.stringify(piano.saltati));
}

console.log('E AL CONTRARIO: PRIMA LA COPIA, POI LA CHIUSURA');
{
  const piano = pianoCopiaAnno({ anno: 2027, sorgente: { siti: SITI_2026 }, esistenti: { siti: [] }, chiave: n });
  const copiati = piano.siti.map((s, i) => ({ id: 'k' + i, ...s }));
  verifica('la copia crea le righe 2027 senza apertura (apposta)', copiati.length === 5 && copiati.every(s => !s.apertura_del && !s.giacenza_riferimento_t), JSON.stringify(copiati.map(s => [s.sito, s.giacenza_riferimento_t])));
  const a = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI, letture_impianti: LETTURE, siti: [...SITI_2026, ...copiati], chiave: n });
  verifica('la chiusura aggiorna quelle tre, non ne crea altre', a.piano.length === 3 && a.piano.every(x => x.azione === 'aggiorna'), JSON.stringify(a.piano.map(x => x.azione)));
}

console.log('LA LISTA DELL\'ANNO NUOVO CONTROLLA LE APERTURE');
{
  const base = { anno: 2027, tariffe: [], piazzali: [], rilevazioni: [], oggi: '2026-12-31' };
  const voce = (siti) => listaAnno({ ...base, giacenzeSito: siti }).voci.find(v => v.chiave === 'aperture_impianti');
  const nessuna = voce(SITI_2026);
  verifica("senza nessuna riga 2027 la voce manca", nessuna.stato === 'manca' && /Nessuno dei 3 impianti/.test(nessuna.dettaglio), nessuna.dettaglio);
  verifica('e dice dove si fa: la chiusura', /Chiusura anno/.test(nessuna.dove));
  const a = apertureDegliImpianti({ anno: 2026, impianti: IMPIANTI, letture_impianti: LETTURE, siti: SITI_2026, chiave: n });
  const create = a.piano.map((x, i) => ({ id: 'c' + i, ...x.dati }));
  const tutte = voce([...SITI_2026, ...create]);
  verifica('dopo la chiusura e\' pronta, Tecnogum a zero compreso', tutte.stato === 'pronto' && tutte.quante === 3, tutte.dettaglio);
  const due = voce([...SITI_2026, ...create.slice(0, 2)]);
  verifica('con un impianto senza apertura e\' parziale, e dice quanti', due.stato === 'parziale' && /mancano 1/.test(due.dettaglio), due.dettaglio);
  // LA CONTROPROVA DELLO ZERO: una riga copiata a zero senza la data non e'
  // un'apertura, anche se il numero e' lo stesso di Tecnogum.
  const copiaSenzaData = voce([...SITI_2026, ...SITI_2026.filter(s => s.tipo_destinazione === 'imp').map(s => ({ ...s, id: s.id + 'x', anno: 2027, giacenza_riferimento_t: 0, note: notaCopia(2027) }))]);
  verifica('uno zero mai scritto non vale come uno zero letto', copiaSenzaData.stato === 'manca', copiaSenzaData.dettaglio);
  const aMano = voce([...SITI_2026, { sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', anno: 2027, giacenza_riferimento_t: 650 }]);
  verifica('un valore messo a mano conta', aMano.quante === 1);
}

console.log('LA VOCE DEI TARGET GUARDA L\'ARCHIVIO CHE LA COPIA SCRIVE');
{
  const base = { anno: 2027, tariffe: [], piazzali: [], rilevazioni: [], oggi: '2026-12-31', giacenzeSito: [{ anno: 2027, sito: 'X' }] };
  const voce = (extra) => listaAnno({ ...base, ...extra }).voci.find(v => v.chiave === 'target_e_siti');
  const piano = pianoCopiaAnno({
    anno: 2027,
    sorgente: { raccoglitori: [{ raccoglitore: 'SMOCO S.r.l.', regione: 'Puglia', anno: 2026, target_tonnellate: 1850 }], siti: SITI_2026 },
    esistenti: {}, chiave: n,
  });
  const copiati = piano.raccoglitori.map((r, i) => ({ id: 'r' + i, ...r }));
  verifica('la copia d\'anno scrive i target dei raccoglitori', copiati.length === 1 && copiati[0].anno === 2027);
  const dopoCopia = voce({ targetRaccoglitori: copiati });
  verifica('dopo la copia la voce non dice piu\' «manca»', dopoCopia.stato !== 'manca', dopoCopia.stato);
  verifica('ma «parziale»: sono copiati, vanno confermati sul contratto nuovo', dopoCopia.stato === 'parziale' && /copiati dal 2026/.test(dopoCopia.dettaglio), dopoCopia.dettaglio);
  // Confermare un target in Target & Status aggiunge una voce allo storico: e' la
  // nota piu' recente a dire se e' ancora una copia (la prima versione di questa
  // prova toglieva solo il campo note, e la voce restava gialla - giustamente).
  const confermati = voce({
    targetRaccoglitori: copiati.map(r => ({
      ...r, note: '',
      storico_json: JSON.stringify([...JSON.parse(r.storico_json || '[]'), { il: '2026-12-15', da: 'admin', nota: 'confermato sul contratto 2027', prima: 1850 }]),
    })),
  });
  verifica('confermati, e\' pronta', confermati.stato === 'pronto', confermati.dettaglio);
  // LA CONTROPROVA DEL DIFETTO: la voce di prima contava ImpiantoTarget, che non
  // ha mai avuto una riga e che la copia non scrive. Passarglielo adesso non
  // cambia niente: non e' piu' quello che si guarda.
  const comePrima = voce({ impiantiTarget: [{ anno: 2027 }], targetRaccoglitori: [] });
  verifica("l'archivio vuoto di prima non decide piu' niente", comePrima.stato === 'parziale' && /0 target dei raccoglitori/.test(comePrima.dettaglio), comePrima.dettaglio);
  verifica("e la copia d'anno ImpiantoTarget non lo scrive: per questo la voce restava rossa", !('impiantiTarget' in piano) && Array.isArray(piano.impianti));
}

console.log('UN CONTRATTO COPIATO NON E\' «PRONTO»');
{
  const voce = (commesse) => listaAnno({ anno: 2027, commesse, tariffe: [], piazzali: [], rilevazioni: [], oggi: '2026-12-31' }).voci.find(v => v.chiave === 'contratto_ecotyre');
  const copiato = voce([{ anno: 2027, target_annuo_t: 11550, note: notaCopia(2027) }]);
  verifica('copiato dall\'anno prima: parziale, come una tariffa copiata', copiato.stato === 'parziale', copiato.stato);
  verifica('e dice che cosa va preso dal contratto nuovo', /target, regioni e prezzi/.test(copiato.dettaglio), copiato.dettaglio);
  verifica('confermato, e\' pronto', voce([{ anno: 2027, target_annuo_t: 12000, note: '' }]).stato === 'pronto');
  verifica('e senza contratto manca', voce([]).stato === 'manca');
}

console.log('LE TARIFFE COPIATE SI CONFERMANO, E RESTA SCRITTO DA CHI');
{
  const t = copiaTariffa({ id: 't1', direzione: 'ATTIVA', tipologia: 'ACI', regione: 'Puglia', valore: 240, unita_misura: '€/t', data_inizio_validita: '2026-01-01', data_fine_validita: '2026-12-31', note: 'Allegato B' }, 2027);
  verifica('la tariffa copiata e\' da confermare', daConfermare(t) && tariffeDaConfermare([t], 2027, 'ATTIVA').length === 1);
  const c = { ...t, ...confermaTariffa(t, { il: '2026-12-15', da: 'admin@smoco', anno: 2027 }) };
  verifica('confermata, non e\' piu\' da confermare', !daConfermare(c) && tariffeDaConfermare([c], 2027, 'ATTIVA').length === 0);
  verifica('e resta scritto chi e quando', /Confermata sul contratto 2027 il 15\/12\/2026 da admin@smoco/.test(c.note), c.note);
  verifica('la nota di prima non si perde', /Allegato B/.test(c.note), c.note);
  const voce = listaAnno({ anno: 2027, tariffe: [c], piazzali: [], rilevazioni: [], oggi: '2026-12-31' }).voci.find(v => v.chiave === 'tariffe_attive');
  verifica('e la voce torna verde', voce.stato === 'pronto', voce.stato);
}

console.log('LA CONTROPROVA: UNA RIGA CREATA SENZA LA NOTA DELLA COPIA FERMA TUTTO');
{
  // Il motivo per cui la chiusura scrive la nota «da confermare»: una riga 2027
  // creata senza, la copia d'anno la scambia per un elenco gia' compilato a mano
  // e salta TUTTI gli altri siti. I piazzali resterebbero senza riga 2027.
  const senzaNota = [{ id: 'x', sito: 'Irigom S.r.l.', tipo_destinazione: 'imp', anno: 2027, apertura_del: '2026-12-31', giacenza_riferimento_t: 652.84 }];
  const piano = pianoCopiaAnno({ anno: 2027, sorgente: { siti: SITI_2026 }, esistenti: { siti: senzaNota }, chiave: n });
  verifica('senza la nota, la copia salta i siti: per questo la nota c\'e\'', piano.siti.length === 0 && piano.saltati.siti_gia_compilati > 0, JSON.stringify([piano.siti.length, piano.saltati]));
}

console.log(`\n${ok} verifiche passate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

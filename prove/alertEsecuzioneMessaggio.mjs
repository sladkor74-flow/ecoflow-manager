// IL MESSAGGIO DOPO «ESEGUI» NEL MOTORE DEGLI ALERT (revisione del 13/10/2026).
//
// Dal 12/10/2026 (A54) il motore controlla l'anno in corso e quello prima, ma la
// pagina scriveva solo «su 3104 record del 2026 controllati»: vero, muto
// sull'anno prima (a gennaio il piu' pesante) e senza il punto delle migliaia.
// Ora il messaggio (messaggioEsecuzione, src/lib/messaggioMotoreAlert.js) dice:
//   1. i record dell'anno in corso e quelli dell'anno prima, e a che cosa
//      servono: tenere aggiornati e chiudere i suoi alert, e fino a febbraio
//      aprirne di nuovi, non con le regole di tratta create o cambiate
//      quest'anno (revisione del 13/10/2026: prima diceva «tranne le tratte»);
//   2. quanti alert il gestionale non controlla piu' da solo e restano aperti,
//      da chiudere a mano (alerts_anni_non_controllati);
//   3. ogni numero all'italiana, col punto delle migliaia;
//   4. con la risposta di prima (senza record_per_anno) quello che diceva prima;
//   5. che «Esegui» lo usi;
//   6. che dica quello che il motore vero ha fatto sulle tratte dell'anno prima
//      (runAlertEngine sul banco, prove/dati/bancoFunzioni.mjs, con la data
//      finta): la regola del 2026 mai toccata apre il 05/01/2027 l'alert del
//      viaggio del 30/12/2026, e il messaggio non dice piu' «tranne le tratte»;
//      la regola rifatta nel 2027 lascia aperto l'alert di un viaggio del 2026,
//      che non e' «di un periodo non piu' controllato».
// La pagina, caricata, chiede il browser e il contesto dell'utente: si prova la
// funzione del messaggio, che sta in src/lib, e si guarda nel sorgente della
// pagina che «Esegui» la usi.
//
// node prove/alertEsecuzioneMessaggio.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caricaLibPagine } from './dati/libPagine.mjs';
import { caricaFunzione, chiama } from './dati/bancoFunzioni.mjs';

let ok = 0, ko = 0;
const verifica = (nome, cond, extra = '') => { if (cond) ok++; else { ko++; console.log('  FALLITA: ' + nome + ' ' + extra); } };
const J = JSON.stringify;

let messaggio = null;
try {
  ({ messaggioEsecuzione: messaggio = null } = await caricaLibPagine('lib/messaggioMotoreAlert'));
} catch (e) { verifica('src/lib/messaggioMotoreAlert.js si carica', false, e.message); }
verifica('e da\' messaggioEsecuzione', typeof messaggio === 'function');
const m = (d) => (messaggio ? messaggio(d) : '');

console.log("1. L'ANNO IN CORSO E QUELLO PRIMA");
{
  const ottobre = m({ modulo: 'primarie_rete', anno: 2026, anni_controllati: [2025, 2026], anni_alert_nuovi: [2026], record_scansionati: 3104,
    record_per_anno: { 2025: 3734, 2026: 3104 }, alerts_creati: 2, alerts_aggiornati: 1, alerts_chiusi: 1234, alerts_anni_non_controllati: 0 });
  verifica('ottobre: i record del 2026 e quelli del 2025 per i suoi alert, non con le regole di tratta del 2026', ottobre.startsWith('2 alert creati, 1 aggiornati e 1.234 chiusi perché superati o doppi, su 3.104 record del 2026 controllati, e 3.734 del 2025 per tenere aggiornati e chiudere i suoi alert (non con le regole di tratta create o cambiate nel 2026).'), J(ottobre));
  verifica('a ottobre il 2025 non apre alert nuovi, e non lo dice', !/aprirne di nuovi/.test(ottobre), J(ottobre));
  verifica('nessun alert fuori controllo: non se ne parla', !/non più controllat|non controlla più/.test(ottobre), J(ottobre));

  const gennaio = m({ anno: 2027, anni_alert_nuovi: [2026, 2027], record_scansionati: 12, record_per_anno: { 2026: 10487, 2027: 12 }, alerts_creati: 0, alerts_aggiornati: 0, alerts_chiusi: 0 });
  verifica('gennaio: il 2026 serve anche ad aprire alert nuovi, non con le regole di tratta create o cambiate nel 2027', gennaio.startsWith('0 alert creati, 0 aggiornati e 0 chiusi perché superati o doppi, su 12 record del 2027 controllati, e 10.487 del 2026 per tenere aggiornati e chiudere i suoi alert e, fino a febbraio, per aprirne di nuovi (non con le regole di tratta create o cambiate nel 2027).'), J(gennaio));
  verifica('e non dice piu\' «tranne le tratte»: le regole di tratta scritte prima del 01/01 aprono', !/tranne le tratte/.test(gennaio), J(gennaio));
}

console.log('2. GLI ALERT CHE IL GESTIONALE NON CONTROLLA PIU\' DA SOLO');
{
  const tanti = m({ anno: 2028, record_scansionati: 5, record_per_anno: { 2027: 1500, 2028: 5 }, alerts_creati: 0, alerts_aggiornati: 0, alerts_chiusi: 1, alerts_anni_non_controllati: 1203 });
  verifica('quanti restano aperti, da chiudere a mano', / 1\.203 alert che il gestionale non controlla più da solo restano aperti: si chiudono a mano\./.test(tanti), J(tanti));
  const uno = m({ anno: 2028, record_scansionati: 5, record_per_anno: { 2027: 1500, 2028: 5 }, alerts_creati: 0, alerts_aggiornati: 0, alerts_chiusi: 0, alerts_anni_non_controllati: 1 });
  verifica('al singolare', / 1 alert che il gestionale non controlla più da solo resta aperto: si chiude a mano\./.test(uno), J(uno));
  verifica('e non li chiama «di periodi non piu\' controllati»: fra loro ci sono quelli di regole di tratta nuove su un anno controllato', !/periodi? non più controllat/.test(tanti + uno), J([tanti, uno]));
}

console.log('3. TUTTI I NUMERI ALL\'ITALIANA');
{
  const d = m({ anno: 2026, record_scansionati: 3104, record_per_anno: { 2025: 3734, 2026: 3104 }, alerts_creati: 1500, alerts_aggiornati: 2000, alerts_chiusi: 0,
    alerts_da_aggiornare: 1100, alerts_da_chiudere: 4321,
    terminati_senza_fine_trasporto: [{ canale: 'rete', quanti: 1234, esempi: ['ET26000001'] }, { canale: 'ACI', quanti: 1, esempi: [] }],
    date_obbligatorie: [{ canale: 'rete', ordini: 2500, senza_fine: 1234 }] });
  verifica('creati, aggiornati e quelli che restano da scrivere', /^1\.500 alert creati, 2\.000 aggiornati/.test(d) && /Restano 1\.100 alert da aggiornare e 4\.321 alert da chiudere: esegui di nuovo il controllo\./.test(d), J(d));
  verifica('i terminati senza fine trasporto, per canale', /Rete: 1\.234 terminati senza fine trasporto \(es\. ET26000001\); ACI: 1 terminato senza fine trasporto\./.test(d), J(d));
  verifica('le date obbligatorie', /rete: 2\.500 ordini, di cui 1\.234 senza fine trasporto\./.test(d), J(d));
  verifica('nessun numero di quattro cifre senza il punto', !/\b\d{4,}\b/.test(d.replace(/\b20\d\d\b/g, '').replace(/ET\d+/g, '')), J(d));
}

console.log('4. LA RISPOSTA DI PRIMA');
{
  const vecchia = m({ anno: 2026, record_scansionati: 3104, alerts_creati: 0, alerts_aggiornati: 0, alerts_chiusi: 0 });
  verifica('senza record_per_anno dice l\'anno solo', vecchia === '0 alert creati, 0 aggiornati e 0 chiusi perché superati o doppi, su 3.104 record del 2026 controllati.', J(vecchia));
}

console.log('5. «ESEGUI» USA IL MESSAGGIO');
{
  const sorgente = readFileSync(fileURLToPath(new URL('../src/pages/AlertEngine.jsx', import.meta.url)), 'utf8').replace(/\r/g, '');
  const handleRun = (sorgente.match(/const handleRun = async[\s\S]*?\n {2}\};\n/) || [''])[0];
  verifica('la pagina importa il messaggio dalla libreria', /import \{ messaggioEsecuzione \} from '@\/lib\/messaggioMotoreAlert';/.test(sorgente));
  verifica('handleRun mostra messaggioEsecuzione(d)', /alert\(messaggioEsecuzione\(d\)\);/.test(handleRun), handleRun.slice(0, 200));
  verifica('e non compone piu\' il testo da se\'', !/record_scansionati/.test(handleRun), handleRun.slice(0, 200));
}

// Il motore vero, sul banco, con la data finta: il messaggio deve dire quello
// che il motore ha fatto (revisione del 13/10/2026, rilievo della revisione di
// R1, script r1_messaggio_tratte.mjs). Con «(tranne le tratte)» il messaggio
// diceva che sull'anno prima non nascevano alert di tratta proprio mentre il
// motore ne apriva uno.
console.log("6. IL MESSAGGIO DICE QUELLO CHE IL MOTORE HA FATTO SULLE TRATTE DELL'ANNO PRIMA");
{
  let motore = null;
  try { motore = await caricaFunzione('runAlertEngine'); } catch (e) { verifica('runAlertEngine si impacchetta', false, e.message); }
  const VeraData = Date;
  const conOggi = async (iso, fn) => {
    const fisso = VeraData.parse(iso);
    class Finto extends VeraData { constructor(...a) { if (a.length === 0) super(fisso); else super(...a); } static now() { return fisso; } }
    globalThis.Date = Finto;
    try { return await fn(); } finally { globalThis.Date = VeraData; }
  };
  const giro = (iso, db) => conOggi(iso, () => chiama(motore, { db: { UploadLog: [], Alert: [], ...db }, corpo: { modulo: 'secondarie' } }));
  const viaggio = (i, giorno, destinazione) => ({ id: 's-' + giorno.slice(2, 4) + i, id_ordine: `ET${giorno.slice(2, 4)}S` + String(i).padStart(4, '0'), numero_fir: 'FIRS' + i,
    stato: 'terminato', peso_effettivo: 20000, ordine_immesso_il: giorno + 'T08:00:00Z', trasporto_iniziato_il: giorno + 'T08:00:00Z', trasporto_finito_il: giorno + 'T10:00:00Z',
    stoccaggio: 'NAPPI SUD SRL', destinazione, trasportatore: 'NAPPI SUD SRL' });
  // la regola con le date della piattaforma, senza fuso
  const tratta = (ammesse, scritta) => ({ id: 'rt', modulo: 'secondarie', attiva: true, tipo_regola: 'tratta_autorizzata', severita: 'warning', nome: 'Tratta Nappi Sud',
    created_date: scritta, updated_date: scritta,
    config: { campo_origine: 'stoccaggio', valore_origine: 'NAPPI SUD SRL', campo_destinazione: 'destinazione', destinazioni_ammesse: ammesse } });
  const apertoSu = (id_ordine) => ({ id: 'at', modulo: 'secondarie', stato: 'aperto', record_id: id_ordine, regola_id: 'rt', regola_nome: 'Tratta Nappi Sud', entity_type: 'Secondaria',
    titolo: 'Destinazione non autorizzata per NAPPI SUD SRL', descrizione: `Record ${id_ordine}: origine "NAPPI SUD SRL" con destinazione non ammessa "GATIM SRL". Destinazioni ammesse: IRIGOM SRL.`,
    severita: 'warning', created_date: '2026-12-04T10:00:00.000000', updated_date: '2026-12-04T10:00:00.000000' });
  const alertDi = (r, id) => (r.db.Alert || []).find(a => a.id === id) || {};
  const irigom = viaggio(1, '2026-06-10', 'IRIGOM SRL');

  if (motore) {
    // Il caso della revisione: la regola del 2026 mai toccata, il viaggio del
    // 30/12/2026 verso Gatim registrato a gennaio, il motore il 05/01/2027.
    const a = await giro('2027-01-05T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL'], '2026-03-01T09:00:00.000000')], Secondaria: [irigom, viaggio(99, '2026-12-30', 'GATIM SRL')] });
    const nati = (a.db.Alert || []).filter(x => x.regola_id === 'rt' && x.record_id === 'ET26S0099');
    const testoA = m(a.j);
    verifica('regola del 2026 mai toccata: il 05/01/2027 il motore apre l\'alert di tratta del viaggio del 30/12/2026', a.stato === 200 && nati.length === 1 && a.j.alerts_creati === 1,
      J([a.j.error, nati.length, a.j.alerts_creati]));
    verifica('e il messaggio non dice «tranne le tratte»: dice quali regole di tratta il 2026 non lo misurano',
      !/tranne le tratte/.test(testoA) && /del 2026 per tenere aggiornati e chiudere i suoi alert e, fino a febbraio, per aprirne di nuovi \(non con le regole di tratta create o cambiate nel 2027\)\./.test(testoA)
      && /^1 alert creati/.test(testoA), J(testoA));

    // La regola rifatta il 03/01/2027 ammette Gatim: l'alert aperto sul viaggio
    // del 03/12/2026 resta com'e' e si conta. Il 2026, a gennaio 2027, si
    // controlla: e' la regola che non lo misura.
    const b = await giro('2027-01-05T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL', 'GATIM SRL'], '2027-01-03T09:00:00.000000')],
      Secondaria: [irigom, viaggio(50, '2026-12-03', 'GATIM SRL')], Alert: [apertoSu('ET26S0050')] });
    const testoB = m(b.j);
    verifica('regola rifatta nel 2027: l\'alert del viaggio del 2026 resta aperto, com\'era, e si conta', b.stato === 200 && alertDi(b, 'at').stato === 'aperto'
      && b.j.alerts_anni_non_controllati === 1 && (b.j.anni_controllati || []).includes(2026), J([b.j.error, alertDi(b, 'at').stato, b.j.alerts_anni_non_controllati, b.j.anni_controllati]));
    verifica('e il messaggio lo dice da chiudere a mano, senza chiamarlo «di un periodo non più controllato»',
      / 1 alert che il gestionale non controlla più da solo resta aperto: si chiude a mano\./.test(testoB) && !/periodo non più controllato/.test(testoB)
      && /\(non con le regole di tratta create o cambiate nel 2027\)\./.test(testoB), J(testoB));

    // A ottobre l'anno prima non apre alert nuovi, ma la regola creata nel 2026
    // non tiene aggiornati ne' chiude gli alert di tratta del 2025: la riserva
    // vale anche li'.
    const c = await giro('2026-10-12T10:00:00Z', { RegolaAlert: [tratta(['IRIGOM SRL'], '2026-03-01T09:00:00.000000')],
      Secondaria: [irigom, viaggio(50, '2025-12-03', 'IRIGOM SRL')], Alert: [apertoSu('ET25S0050')] });
    const testoC = m(c.j);
    verifica('ottobre 2026, regola creata nel 2026: corretto il viaggio del 2025, l\'alert non si chiude e si conta', c.stato === 200 && alertDi(c, 'at').stato === 'aperto'
      && c.j.alerts_anni_non_controllati === 1 && (c.j.record_per_anno || {})[2025] === 1, J([c.j.error, alertDi(c, 'at').stato, c.j.alerts_anni_non_controllati, c.j.record_per_anno]));
    verifica('e il messaggio lo dice: il 2025 non con le regole di tratta del 2026, e un alert da chiudere a mano',
      /e 1 del 2025 per tenere aggiornati e chiudere i suoi alert \(non con le regole di tratta create o cambiate nel 2026\)\. 1 alert che il gestionale non controlla più da solo resta aperto: si chiude a mano\./.test(testoC)
      && !/aprirne di nuovi/.test(testoC), J(testoC));
  }
}

console.log(`\n${ok} superate, ${ko} fallite`);
process.exit(ko ? 1 : 0);

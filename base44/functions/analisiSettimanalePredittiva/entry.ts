import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fineProgrammazione } from "../../shared/fineProgrammazione.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { formatoKg } from "../../shared/formato.ts";
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { fetchAll } from "../../shared/fetchAll.ts";
import { canaleMovimento } from "../../shared/movimenti.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento } from "../../shared/reportSettimanali.ts";
import { giaArrivatoDiRete, residuoDiRete, sitiDellaPredittivita, dateDaSistemareDiRete, riassuntoDate } from "../../shared/proiezioneSecondarie.ts";

// Media reale di un viaggio di secondaria: 13,5 tonnellate.
const KG_PER_VIAGGIO = 13500;
// L'anno di lavoro e' quello in corso (giorno italiano); la fine della
// programmazione, se l'impianto non ne ha una sua, viene da
// base44/shared/fineProgrammazione.ts (il 18 dicembre vale solo per il 2026). Prima c'erano scritti "2026" e "2026-12-18": dal 19 dicembre 2026
// il modulo si sarebbe spento senza dirlo, e nel 2027 avrebbe continuato a
// leggere il 2026.
const annoRiferimento = () => Number(oggiRoma().slice(0, 4));
const dataFineDefault = () => fineProgrammazione(annoRiferimento()).data;

// Le settimane si contano sui giorni italiani 'AAAA-MM-GG', con l'aritmetica in
// UTC che non ha ora legale. getMonday lavorava con setHours/getDay nel fuso del
// server: una secondaria finita lunedi' e salvata a mezzanotte italiana (22:00Z
// della domenica) finiva nella settimana prima, e anche "oggi" poteva esserlo.
const aUtc = (g) => new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10)));
function piuGiorni(g, n) { const d = aUtc(g); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const lunediDi = (g) => piuGiorni(g, -((aUtc(g).getUTCDay() + 6) % 7));
const it = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');

// La predittivita' e' SOLO della rete (regola dell'utente, 22/09/2026): ACI ed
// extra raccolta non entrano ne' nel consuntivo ne' nella settimana. L'extra
// raccolta sta in un archivio suo e non si legge; primarie e secondarie si
// tengono solo se il canale e' la rete, con la regola condivisa.
const soloRete = (righe, archivio) => righe.filter(r => canaleMovimento(r, archivio) === 'RETE');

// Il suggerimento e' uno per settimana. Ogni lunedi' se ne scriveva uno nuovo e
// quelli prima restavano aperti con i loro consuntivi, mai ricalcolati: si
// accumulavano fra gli alert aperti del cruscotto e l'agente poteva leggere i
// numeri di un mese fa. Adesso quello della settimana si aggiorna al suo posto
// e i precedenti si chiudono come superati. Il titolo vecchio, senza regola_id,
// si riconosce dal testo.
const REGOLA = 'suggerimento_predittivita_settimanale';
const TITOLO = 'Suggerimento Predittività Settimanale · solo rete';
const eSuggerimento = (a) => a.regola_id === REGOLA || String(a.titolo || '').startsWith('Suggerimento Predittività Settimanale');

// Un caricamento delle primarie o delle secondarie aperto (o rimasto
// interrotto) vuol dire un archivio a meta': il suggerimento non si scrive,
// si risponde 409 col nome del caricamento e resta quello di prima. Stessa
// finestra di dieci minuti di importaBlocco e di dopoCaricamento.
// Si usa la regola condivisa di base44/shared/reportSettimanali.ts: un
// caricamento rimasto aperto non conta piu' se dopo un caricamento riuscito ha
// riscritto gli stessi archivi. Un "primarie_rete" storico, che nessuna scheda
// di Caricamento Dati scrive piu' ne' chiude, altrimenti bloccava per sempre il
// piano, il suggerimento del lunedi' e la proiezione.
// Lo stato si legge prima e dopo gli archivi (caricamentiDuranteLettura): la
// lettura di migliaia di primarie e secondarie dura secondi, e un caricamento
// partito o concluso intanto, con una lettura sola fatta prima, non si vedeva:
// il suggerimento si sarebbe scritto su un archivio a meta'. Se lo stato non si
// legge non si sa se gli archivi sono interi, e si rinvia lo stesso.
const TIPI_LETTI = ['primarie', 'primarie_rete', 'secondarie'];
const leggiStato = (base44) => statoCaricamenti(base44, TIPI_LETTI).catch(() => null);
const NON_LETTO = "lo stato dei caricamenti non si e' potuto leggere, e non si sa se primarie e secondarie sono complete";
const rinvio = (motivo, caricamenti = []) => Response.json({
  error: `Rinviato: ${motivo}. Il suggerimento della settimana non si scrive: resta quello di prima e si rifa' al prossimo caricamento concluso.`,
  rinviato: true,
  caricamenti_in_corso: caricamenti,
}, { status: 409 });

// Funzione richiamata dal workflow del lunedì: analizza la settimana appena
// conclusa e genera un suggerimento proattivo salvato come Alert (modulo
// secondarie) consultabile dall'agente. Risponde 200 solo quando l'ha scritto,
// 409 quando rinvia per un caricamento aperto, 500 quando qualcosa non riesce.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    // L'automazione del lunedi' gira senza utente; se invece la chiama una persona,
    // solo l'amministratore puo' scrivere il suggerimento.
    const chiamante = await base44.auth.me().catch(() => null);
    if (chiamante && !eAmministratore(chiamante)) return rispostaSolaLettura();
    const b = base44.asServiceRole;

    const primaDegliArchivi = await leggiStato(base44);
    if (!primaDegliArchivi) return rinvio(NON_LETTO);
    if (primaDegliArchivi.in_corso.length) return rinvio(primaDegliArchivi.in_corso.map(descriviCaricamento).join('; '), primaDegliArchivi.in_corso);

    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    // i fornitori registrati servono solo a sapere quali stoccaggi guardare per
    // le date dei formulari, come fanno la Dashboard e la Proiezione
    const fornitori = await b.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    // Solo rete: il target di un impianto e' della rete e ACI ed extra raccolta
    // non lo consumano. Le secondarie ACI stanno nello stesso archivio e si
    // riconoscono dalla classe.
    const [primarie, secondarie] = await Promise.all([
      fetchAll(b.entities.PrimariaRete, { stato: 'terminato' }).then(r => soloRete(r, 'PrimariaRete')),
      fetchAll(b.entities.Secondaria, { stato: 'terminato' }).then(r => soloRete(r, 'Secondaria')),
    ]);
    // la seconda lettura dello stato, a archivi letti (vedi leggiStato)
    const dopoGliArchivi = await leggiStato(base44);
    if (!dopoGliArchivi) return rinvio(NON_LETTO);
    const durante = caricamentiDuranteLettura(primaDegliArchivi, dopoGliArchivi);
    if (durante.length) return rinvio(durante.map(descriviCaricamento).join('; '), durante);

    // Settimana appena conclusa = lunedì-domenica della settimana scorsa, sul
    // calendario italiano
    const anno = annoRiferimento();
    const oggi = oggiRoma();
    const thisMonday = lunediDi(oggi);
    const lastMonday = piuGiorni(thisMonday, -7);
    const lastSunday = piuGiorni(thisMonday, -1);

    // Il gia' arrivato di rete di ogni impianto seguito e' il conto condiviso
    // (giaArrivatoDiRete, shared/proiezioneSecondarie.ts), lo stesso della
    // Dashboard e della Proiezione a fine anno (regola dell'utente, 22/09/2026):
    // primarie arrivate al sito dell'impianto, anche quelle scaricate nel suo
    // piazzale, piu' secondarie da altri stoccaggi. Il piazzale conta al netto
    // di quello che riparte per altri impianti: nella settimana le ripartite
    // sono movimenti in negativo, sul giorno della partenza. Qui prima c'era un
    // conto a parte che contava anche le secondarie dal piazzale dell'impianto a
    // se stesso: quei PFU valevano due volte, all'arrivo in primaria e al
    // trasbordo.
    // Solo rete, solo terminati, sull'anno della fine trasporto (giorno
    // italiano, mai la chiusura a portale).
    const chiaviImpianti = impianti.map(imp => normalizzaRagioneSociale(imp.nome_impianto));
    const arrivati = giaArrivatoDiRete(chiaviImpianti, primarie, secondarie, anno, normalizzaRagioneSociale);
    // La settimana conclusa puo' cominciare nell'anno prima (lunedi' 5 gennaio,
    // la settimana 29 dicembre-4 gennaio): i suoi giorni di dicembre stanno nel
    // gia' arrivato di quell'anno, e con lo stesso conto si prendono da li'.
    const annoLunedi = Number(lastMonday.slice(0, 4));
    const arrivatiPrima = annoLunedi < anno ? giaArrivatoDiRete(chiaviImpianti, primarie, secondarie, annoLunedi, normalizzaRagioneSociale) : null;

    // Le date obbligatorie dei formulari (regola dell'utente, 22/09/2026):
    // immissione, inizio e fine trasporto. Chi ne ha una mancante o incoerente
    // si dice in fondo; chi non ha la fine trasporto non si colloca in nessuna
    // settimana e resta fuori dal gia' arrivato. Prima si contavano solo i senza
    // fine trasporto. Gli stessi formulari della Dashboard e della Proiezione.
    const siti = sitiDellaPredittivita(impianti, fornitori, secondarie, anno, normalizzaRagioneSociale);
    const dateDaSistemare = dateDaSistemareDiRete(primarie, secondarie, siti.tutti, anno, normalizzaRagioneSociale);
    const senzaFine = dateDaSistemare.senza_fine;

    const kg = (movimenti) => movimenti.reduce((s, m) => s + (Number(m.kg) || 0), 0);
    const parti = [];
    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const arrivato = arrivati.get(impNorm);
      const suoi = [
        ...((arrivatiPrima && arrivatiPrima.get(impNorm)) ? arrivatiPrima.get(impNorm).movimenti : []),
        ...(arrivato ? arrivato.movimenti : []),
      ];
      const settimana = suoi.filter(m => m.giorno >= lastMonday && m.giorno <= lastSunday);
      const secSett = settimana.filter(m => m.flusso === 'secondaria');
      const primSett = settimana.filter(m => m.flusso === 'primaria');
      const ripSett = settimana.filter(m => m.flusso === 'ripartita');
      const execSett = kg(settimana);
      const viaggiSett = secSett.length;

      // Il gia' arrivato si confronta col target dell'anno: solo quello finito
      // quest'anno, e lo garantisce il conto condiviso. Il residuo e' quello di
      // tutte le pagine, anche sotto zero se il target e' superato; per i kg a
      // settimana conta solo quanto manca davvero.
      const consuntivoTot = arrivato ? arrivato.totale_kg : 0;
      const target = imp.target || 0;
      const residuoMostrato = residuoDiRete(target, arrivato);
      const residuo = Math.max(0, residuoMostrato);

      // settimane rimanenti fino alla data obiettivo dell'impianto
      const dataFine = imp.data_fine || dataFineDefault();
      let settRim = 0;
      for (let cur = thisMonday; cur <= dataFine; cur = piuGiorni(cur, 7)) settRim++;
      const kgPerSett = settRim > 0 ? Math.round(residuo / settRim) : 0;
      const viaggiPerSett = Math.ceil(kgPerSett / KG_PER_VIAGGIO);

      // PREV stimata per la settimana conclusa (costanza al momento del calcolo)
      // non avendo lo storico PREV esatto, usiamo kgPerSett come riferimento
      const prevSett = kgPerSett;
      const deltaSett = execSett - prevSett;
      const deltaViaggi = Math.round(deltaSett / KG_PER_VIAGGIO);
      const ripartitiSett = ripSett.length ? `, meno ${formatoKg(-kg(ripSett))} kg ripartiti dal piazzale per altri impianti` : '';
      const arrivatiSett = `${formatoKg(execSett)} kg arrivati (primaria ${formatoKg(kg(primSett))} kg, secondaria da altri stoccaggi ${formatoKg(kg(secSett))} kg in ${viaggiSett} ${viaggiSett === 1 ? 'viaggio' : 'viaggi'}${ripartitiSett})`;
      // Il numero si chiama "Gia' arrivato di rete" in tutte le pagine, ed e' lo
      // stesso conto della Dashboard e della Proiezione. Si dice di cosa e'
      // fatto: le primarie, con la parte scaricata nel piazzale al netto di
      // quello che ne e' ripartito per altri impianti, e le secondarie da altri
      // stoccaggi.
      const ripartito = arrivato && arrivato.piazzale_ripartito_kg ? `, al netto di ${formatoKg(arrivato.piazzale_ripartito_kg)} kg ripartiti per altri impianti` : '';
      const piazzale = arrivato && arrivato.primaria_piazzale_kg ? `, di cui ${formatoKg(arrivato.primaria_piazzale_netta_kg)} kg nel piazzale dell'impianto${ripartito}` : '';
      const composizione = `primarie ${formatoKg(arrivato ? arrivato.primaria_kg : 0)} kg${piazzale}; secondarie da altri stoccaggi ${formatoKg(arrivato ? arrivato.secondaria_kg : 0)} kg`;
      const oltre = residuoMostrato < 0 ? ' (target superato)' : '';
      const coda = `Già arrivato di rete nel ${anno}: ${formatoKg(consuntivoTot)} kg (${composizione}) su un target di ${formatoKg(target)} kg. Residuo: ${formatoKg(residuoMostrato)} kg${oltre}.`;

      let frase;
      if (settRim === 0) {
        frase = `${imp.nome_impianto}: la programmazione si e' chiusa il ${it(dataFine)}. ${coda}`;
      } else if (execSett === 0) {
        frase = `${imp.nome_impianto}: nessun arrivo di rete registrato nella settimana ${it(lastMonday)}→${it(lastSunday)}. Recupero previsto: ${formatoKg(kgPerSett)} kg/settimana (pari a ${viaggiPerSett} viaggi da 13,5 t) per le ${settRim} settimane rimanenti. ${coda}`;
      } else if (Math.abs(deltaSett) <= KG_PER_VIAGGIO) {
        frase = `${imp.nome_impianto}: settimana in linea — ${arrivatiSett} contro ${formatoKg(prevSett)} kg previsti. Mantieni ${formatoKg(kgPerSett)} kg/settimana (pari a ${viaggiPerSett} viaggi da 13,5 t) per le ${settRim} settimane rimanenti. ${coda}`;
      } else if (deltaSett > 0) {
        const nuovaPrev = Math.max(0, kgPerSett - Math.round(deltaSett / settRim));
        frase = `${imp.nome_impianto}: anticipo di ${formatoKg(deltaSett)} kg (${deltaViaggi} viaggi) — ${arrivatiSett} contro ${formatoKg(prevSett)} kg previsti. Suggerisco di ridurre le settimane rimanenti a ~${formatoKg(nuovaPrev)} kg/settimana per mantenere la costanza. ${coda}`;
      } else {
        const nuovaPrev = kgPerSett + Math.round(Math.abs(deltaSett) / Math.max(1, settRim));
        frase = `${imp.nome_impianto}: ritardo di ${formatoKg(Math.abs(deltaSett))} kg (${Math.abs(deltaViaggi)} viaggi) — ${arrivatiSett} contro ${formatoKg(prevSett)} kg previsti. Suggerisco di aumentare le settimane rimanenti a ~${formatoKg(nuovaPrev)} kg/settimana. ${coda}`;
      }
      parti.push(frase);
    }

    // I formulari con le date obbligatorie da sistemare, in fondo: quelli senza
    // fine trasporto sono fuori dal conto, gli altri dentro, e si dice.
    if (dateDaSistemare.avviso) parti.push(dateDaSistemare.avviso);
    const suggestion = `Suggerimento settimanale della predittività delle secondarie (settimana ${it(lastMonday)}→${it(lastSunday)}, calcolato il ${it(oggi)}). Solo rete: ACI ed extra raccolta non entrano nella predittività. Già arrivato e residuo sono gli stessi della Dashboard, della Proiezione a fine anno e dell'assistente: le primarie di rete arrivate al sito dell'impianto, anche quelle scaricate nel suo piazzale, più le secondarie di rete arrivate da altri stoccaggi. Il piazzale conta al netto di quello che ne riparte per altri impianti, che lo contano loro. Le secondarie dal piazzale dell'impianto all'impianto stesso non si contano: quei PFU sono già contati come primarie.\n\n` + parti.join('\n\n');

    // Salva come Alert consultabile dall'agente: uno per settimana, i precedenti superati.
    const Alert = b.entities.Alert;
    const aperti = (await fetchAll(Alert, { modulo: 'secondarie', stato: 'aperto' })).filter(eSuggerimento);
    const diQuesta = aperti.find(a => a.regola_id === REGOLA && a.record_id === lastMonday) || null;
    const dati = {
      titolo: TITOLO,
      descrizione: suggestion,
      severita: 'info',
      modulo: 'secondarie',
      entity_type: 'PianificazioneSettimanale',
      record_id: lastMonday,
      regola_id: REGOLA,
      regola_nome: 'Suggerimento settimanale della predittività (solo rete)',
      stato: 'aperto',
    };
    if (diQuesta) await Alert.update(diQuesta.id, dati);
    else await Alert.create(dati);
    let superati = 0;
    for (const a of aperti) {
      if (diQuesta && a.id === diQuesta.id) continue;
      await Alert.update(a.id, { stato: 'risolto', risolto_note: `Superato il ${it(oggi)} dal suggerimento della settimana ${it(lastMonday)}→${it(lastSunday)}: i numeri di questo non erano piu' aggiornati.` });
      superati++;
    }

    return Response.json({ ok: true, canale: 'RETE', suggestion, data_riferimento: lastMonday, senza_fine_trasporto: senzaFine, date_da_sistemare: riassuntoDate(dateDaSistemare), suggerimenti_superati: superati });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

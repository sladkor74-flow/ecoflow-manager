import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { fineProgrammazione } from "../../shared/fineProgrammazione.ts";
import { oggiRoma, giornoRoma, annoRoma } from "../../shared/giornoItaliano.ts";
import { normalizzaRagioneSociale } from '../../shared/normalizzaRagioneSociale.ts';
import { fetchAll } from "../../shared/fetchAll.ts";
import { quoteDaStoccaggio } from "../../shared/rotteConferimenti.ts";
import { canaleMovimento } from "../../shared/movimenti.ts";
import { formatoKgInTonnellate } from "../../shared/formato.ts";
import { eAmministratore } from "../../shared/permessi.ts";
import { statoCaricamenti, caricamentiDuranteLettura, descriviCaricamento } from "../../shared/reportSettimanali.ts";
import { giaArrivatoDiRete, residuoDiRete, noteGiaArrivato, sitiDellaPredittivita, dateDaSistemareDiRete, riassuntoDate } from "../../shared/proiezioneSecondarie.ts";

// Il gia' arrivato e il residuo di ogni impianto sono quelli di
// giaArrivatoDiRete (shared/proiezioneSecondarie.ts), lo stesso conto della
// Proiezione a fine anno e del suggerimento del lunedi' (regola dell'utente,
// 22/09/2026): primarie arrivate al sito dell'impianto, anche quelle scaricate
// nel suo piazzale (al netto di quello che dal piazzale riparte per altri
// impianti, che lo contano loro), piu' secondarie da altri stoccaggi. Qui prima
// si contavano solo le primarie scaricate all'impianto (tipo_destinazione
// diverso da 'stoc'), e l'impianto che non era doppio ruolo aveva come
// consuntivo la somma dei soli fornitori configurati: tre numeri diversi per la
// stessa cosa.
//
// La predittivita' delle secondarie e' SOLO della rete (regola dell'utente,
// 22/09/2026): target, consuntivi, primarie, secondarie, stoccaggi e piano
// settimanale. L'ACI ha un contratto suo senza target e l'extra raccolta non ha
// target: qui non entrano, nemmeno come conteggio. L'extra raccolta sta in un
// archivio suo e non si legge; primarie e secondarie si tengono solo se il
// canale e' la rete, con la regola condivisa (canaleMovimento / eAci).
const soloRete = (righe, archivio) => righe.filter(r => canaleMovimento(r, archivio) === 'RETE');

// Un caricamento delle primarie o delle secondarie aperto (o rimasto
// interrotto) vuol dire un archivio a meta': i numeri si mostrano con
// l'avviso, ma il piano settimanale non si salva, altrimenti restano scritti
// consuntivi e settimane "congelate" contati su mezzo file. La pagina si
// ricalcola da sola quando il caricamento si chiude. Stessa finestra di dieci
// minuti di importaBlocco e di dopoCaricamento.
// Si usa la regola condivisa di base44/shared/reportSettimanali.ts: un
// caricamento rimasto aperto non conta piu' se dopo un caricamento riuscito ha
// riscritto gli stessi archivi. Un "primarie_rete" storico, che nessuna scheda
// di Caricamento Dati scrive piu' ne' chiude, altrimenti bloccava per sempre il
// piano, il suggerimento del lunedi' e la proiezione.
// Lo stato si legge prima e dopo gli archivi (caricamentiDuranteLettura): la
// lettura di migliaia di primarie e secondarie dura secondi, e un caricamento
// partito o concluso intanto, con una lettura sola fatta prima, non si vedeva.
// Se lo stato non si legge non si sa se gli archivi sono interi: si dice, e il
// piano non si salva.
const TIPI_LETTI = ['primarie', 'primarie_rete', 'secondarie'];
const leggiStato = (base44) => statoCaricamenti(base44, TIPI_LETTI).catch(() => null);
function caricamentoDurante(prima, dopo) {
  if (!prima || !dopo) return "Lo stato dei caricamenti non si e' potuto leggere: non si sa se primarie e secondarie sono complete.";
  const durante = caricamentiDuranteLettura(prima, dopo);
  return durante.length ? durante.map(descriviCaricamento).join('; ') : null;
}

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
// Media reale di un viaggio di secondaria: 13,5 tonnellate.
const KG_PER_VIAGGIO = 13500;
// L'anno di lavoro e' quello in corso (giorno italiano); la fine della
// programmazione, se l'impianto non ne ha una sua, viene da
// base44/shared/fineProgrammazione.ts (il 18 dicembre vale solo per il 2026). Prima c'erano scritti "2026" e "2026-12-18": dal 19 dicembre 2026
// il modulo si sarebbe spento senza dirlo, e nel 2027 avrebbe continuato a
// leggere il 2026.
const annoRiferimento = () => Number(oggiRoma().slice(0, 4));
const dataFineDefault = () => fineProgrammazione(annoRiferimento()).data;

// Settimane e anni si contano sul giorno italiano della fine trasporto, come
// stringhe 'AAAA-MM-GG' con l'aritmetica in UTC che non ha ora legale.
// getMonday e yearOf lavoravano nel fuso del server: un trasporto finito lunedi'
// 14/09 e salvato a mezzanotte italiana (13/09 22:00Z) finiva nella settimana
// del 07/09, che risultava "congelata" con kg in piu' e veniva salvata cosi' in
// PianificazioneSettimanale.
const aUtc = (g) => new Date(Date.UTC(+g.slice(0, 4), +g.slice(5, 7) - 1, +g.slice(8, 10)));
function piuGiorni(g, n) { const d = aUtc(g); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const lunediDi = (g) => piuGiorni(g, -((aUtc(g).getUTCDay() + 6) % 7));
// Il lunedi' della settimana in cui e' finito il trasporto; null se la data manca.
const settimanaDi = (r) => { const g = giornoRoma(r.trasporto_finito_il); return g ? lunediDi(g) : null; };
const yearOf = (dt) => annoRoma(dt);
const it = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');
function statoNorm(s) { return String(s || '').toLowerCase().trim(); }
function tipoNorm(s) { return String(s || '').toLowerCase().trim(); }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // La pianificazione si ricalcola a ogni apertura della pagina: tutti la
    // vedono, ma solo l'amministratore la salva.
    const puoScrivere = eAmministratore(user);
    const b = base44.asServiceRole;

    const primaDegliArchivi = await leggiStato(base44);
    const impianti = await b.entities.ImpiantoTargetSecondaria.filter({ stato: 'attivo' });
    const fornitori = await b.entities.FornitoreSecondaria.filter({ stato: 'attivo' });
    // Solo rete: i target degli impianti e dei raccoglitori sono della rete, e
    // ACI ed extra raccolta non li consumano. Le secondarie ACI stanno nello
    // stesso archivio di quelle di rete e si riconoscono dalla classe; una primaria di
    // classe 9 finita fra quelle di rete si scarta con la stessa regola.
    const primarie = soloRete(await fetchAll(b.entities.PrimariaRete, { stato: 'terminato' }), 'PrimariaRete');
    const secondarie = soloRete(await fetchAll(b.entities.Secondaria, { stato: 'terminato' }), 'Secondaria');
    const existingPlans = await b.entities.PianificazioneSettimanale.list('-created_date', 5000);
    // la seconda lettura dello stato, a archivi letti (vedi leggiStato)
    const caricamentoInCorso = caricamentoDurante(primaDegliArchivi, await leggiStato(base44));

    // === FONTE UNICA TARGET: TargetRaccoglitore (anno di riferimento) ===
    // Aggrega (somma) i record con stesso raccoglitore normalizzato indipendentemente
    // dalla regione, cosi' uno split regionale (es. Smoco Puglia/Calabria/Basilicata)
    // contribuisce con un unico totale al target del fornitore.
    const targetRaccogli = await b.entities.TargetRaccoglitore.filter({ anno: annoRiferimento() });
    const targetByNome = {};
    for (const t of targetRaccogli) {
      const key = normalizzaRagioneSociale(t.raccoglitore);
      if (key) targetByNome[key] = (targetByNome[key] || 0) + (t.target_tonnellate || 0) * 1000;
    }

    // === RUOLO-BASE: stoccaggi = ruolo stoccaggio o doppio_ruolo ===
    // Chi spedisce secondarie a un impianto, per quell'impianto e' uno stoccaggio,
    // qualunque cosa dica l'anagrafica. La correzione va fatta PRIMA di costruire
    // plafond e metriche, altrimenti un fornitore corretto piu' avanti si ritrova
    // senza metriche e con il piano a zero.
    const spedisceSecondarie = new Set();
    for (const r of secondarie) {
      if (statoNorm(r.stato) !== 'terminato') continue;
      if (yearOf(r.trasporto_finito_il) !== annoRiferimento()) continue;
      const o = normalizzaRagioneSociale(r.stoccaggio);
      if (o) spedisceSecondarie.add(o);
    }
    const eStoccaggio = (f) => f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo'
      || (!f.ruolo && tipoNorm(f.tipo) === 'stoccaggio')
      || spedisceSecondarie.has(normalizzaRagioneSociale(f.nome));
    const stoccaggiFornitori = fornitori.filter(eStoccaggio);
    const stoccaggioNames = new Set(stoccaggiFornitori.map(f => normalizzaRagioneSociale(f.nome)));

    // Map impianti normalizzati
    const impNormMap = {};
    for (const imp of impianti) impNormMap[normalizzaRagioneSociale(imp.nome_impianto)] = imp;

    // Settimane: dal lunedì della settimana corrente (in Italia) fino alla fine
    // della programmazione di ciascun impianto, la sua se ce l'ha, come nel
    // suggerimento del lunedi' e nella Proiezione a fine anno. Prima il residuo
    // si spalmava per tutti fino alla data di default, e un impianto con una
    // data sua aveva qui kg a settimana diversi da quelli del suggerimento.
    // L'elenco comune arriva alla data piu' lontana; le settimane di un impianto
    // ne sono l'inizio, fino alla sua data.
    const fineDi = (imp) => String(imp.data_fine || '').slice(0, 10) || dataFineDefault();
    const dataFine = impianti.map(fineDi).reduce((a, g) => (g > a ? g : a), dataFineDefault());
    const settimane = [];
    let wn = 1;
    for (let cur = lunediDi(oggiRoma()); cur <= dataFine; cur = piuGiorni(cur, 7)) {
      const fineSett = piuGiorni(cur, 6);
      settimane.push({ numero: wn, data_inizio: cur, data_fine: fineSett > dataFine ? dataFine : fineSett, mese: MESI[Number(cur.slice(5, 7)) - 1] });
      wn++;
    }
    const settimaneFino = (fine) => settimane.filter(s => s.data_inizio <= fine)
      .map(s => (s.data_fine > fine ? { ...s, data_fine: fine } : s));

    // Le date obbligatorie dei formulari (regola dell'utente, 22/09/2026):
    // immissione, inizio e fine trasporto. Un terminato a cui ne manca una, o con
    // le date nell'ordine sbagliato, si dice fra le anomalie, dicendo quali date
    // mancano. Senza la fine trasporto non si colloca in nessuna settimana e in
    // nessun anno (mai ripiegando sulla chiusura): resta fuori dal gia' arrivato
    // e dalle settimane, di qualunque anno sia. Prima qui si contavano solo i
    // senza fine trasporto, di tutta la rete; adesso si guardano i formulari
    // degli impianti seguiti e dei loro stoccaggi, gli stessi della Proiezione e
    // del suggerimento del lunedi' (sitiDellaPredittivita).
    const siti = sitiDellaPredittivita(impianti, fornitori, secondarie, annoRiferimento(), normalizzaRagioneSociale);
    const dateDaSistemare = dateDaSistemareDiRete(primarie, secondarie, siti.tutti, annoRiferimento(), normalizzaRagioneSociale);
    const senzaFineTrasporto = dateDaSistemare.senza_fine;

    // Il gia' arrivato di rete di ogni impianto seguito, il conto condiviso.
    const arrivati = giaArrivatoDiRete(impianti.map(i => normalizzaRagioneSociale(i.nome_impianto)), primarie, secondarie, annoRiferimento(), normalizzaRagioneSociale);
    const arrivatoDi = (imp) => arrivati.get(normalizzaRagioneSociale(imp.nome_impianto));
    const residuoDi = (imp) => residuoDiRete(imp.target, arrivatoDi(imp));
    // I nomi da mostrare nelle note, come li scrivono i movimenti o la configurazione.
    const nomeDi = (k) => {
      const imp = impianti.find(i => normalizzaRagioneSociale(i.nome_impianto) === k);
      if (imp) return imp.nome_impianto;
      const f = fornitori.find(x => normalizzaRagioneSociale(x.nome) === k);
      return f ? f.nome : k;
    };

    // Terminati dell'anno di lavoro, per il giorno italiano della fine trasporto
    const prim2026 = primarie.filter(r => {
      if (statoNorm(r.stato) !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      if (yearOf(r.trasporto_finito_il) !== annoRiferimento()) return false;
      return true;
    });
    const sec2026 = secondarie.filter(r => {
      if (statoNorm(r.stato) !== 'terminato') return false;
      if (!r.trasporto_finito_il) return false;
      if (yearOf(r.trasporto_finito_il) !== annoRiferimento()) return false;
      return true;
    });

    // Una primaria scaricata in un piazzale (con fallback per record storici
    // senza tipo_destinazione). Serve solo a dire quanto e' entrato in uno
    // stoccaggio: per il gia' arrivato di un impianto e per i suoi fornitori il
    // piazzale e l'impianto sono lo stesso sito (regola del 22/09/2026), e il
    // filtro sulle sole primarie all'impianto (isImp) non c'e' piu'.
    const isStoc = (r) => {
      if (r.tipo_destinazione) return statoNorm(r.tipo_destinazione) === 'stoc';
      return stoccaggioNames.has(normalizzaRagioneSociale(r.destinazione));
    };

    // === METRICHE STOCCAGGI GENERALIZZATE ===
    const stoccaggiMetriche = {}; // stocNorm -> metriche
    for (const s of stoccaggiFornitori) {
      const sNorm = normalizzaRagioneSociale(s.nome);
      if (!stoccaggiMetriche[sNorm]) {
        const plafond = s.plafond_stoccaggio_kg && s.plafond_stoccaggio_kg > 0 ? s.plafond_stoccaggio_kg : (targetByNome[sNorm] || 0);
        const kgEntrati = prim2026
          .filter(r => normalizzaRagioneSociale(r.destinazione) === sNorm && isStoc(r))
          .reduce((sum, r) => sum + (r.peso_effettivo || 0), 0);
        // Il plafond di un piazzale e' quello che spedisce agli altri impianti:
        // per T-Cycle i 250.000 kg accanto alla quota impianto di 1.050.000
        // (migraTCycleImpianto). I trasbordi dal piazzale all'impianto dello
        // stesso soggetto non lo consumano (22/09/2026): sono la quota
        // dell'impianto, gia' contata nel suo gia' arrivato. Contati fra i
        // partiti, il plafond di T-Cycle risultava speso da quello che T-Cycle
        // porta a se stesso, e a Tecnogum restava un piano piu' piccolo del vero.
        // Si tengono a parte, per mostrarli.
        const partitiDaQui = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === sNorm && impNormMap[normalizzaRagioneSociale(r.destinazione)]);
        const kgPartiti = partitiDaQui
          .filter(r => normalizzaRagioneSociale(r.destinazione) !== sNorm)
          .reduce((sum, r) => sum + (r.peso_effettivo || 0), 0);
        const kgTrasbordati = partitiDaQui
          .filter(r => normalizzaRagioneSociale(r.destinazione) === sNorm)
          .reduce((sum, r) => sum + (r.peso_effettivo || 0), 0);
        stoccaggiMetriche[sNorm] = {
          nome: s.nome, plafond, kg_entrati: kgEntrati, kg_partiti: kgPartiti,
          kg_trasbordati_a_se: kgTrasbordati,
          residuo_plafond: plafond - kgPartiti,
        };
      }
    }

    // === RILEVAMENTO DOPPIO RUOLO (basato su ruolo + match nome) ===
    // Un impianto e' doppio ruolo se il suo nome normalizzato coincide con un
    // FornitoreSecondaria con ruolo=doppio_ruolo (es. T-CYCLE impianto = T-CYCLE fornitore)
    const doubleRoleNames = new Set(
      fornitori.filter(f => f.ruolo === 'doppio_ruolo').map(f => normalizzaRagioneSociale(f.nome))
    );
    const doubleRoleImpianti = new Set();
    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      if (doubleRoleNames.has(impNorm) || stoccaggioNames.has(impNorm)) doubleRoleImpianti.add(imp.id);
    }

    const result = [];
    const anomalie = [];
    if (dateDaSistemare.avviso) {
      anomalie.push({ tipo: 'date_da_sistemare', testo: dateDaSistemare.avviso });
    }

    // Un fornitore registrato qui che nell'anno non ha ne' un target di rete ne'
    // un movimento di rete (non raccoglie, non riceve primarie, non spedisce
    // secondarie) non ha niente da fare nella predittivita': o lavora solo per
    // l'ACI o l'extra raccolta, che qui non entrano, o non e' contrattualizzato
    // (RPN nel 2026). I conti lo lasciano gia' a zero; si dice, perche' la
    // configurazione non resti a raccontare un canale che non c'e'.
    const attiviSullaRete = new Set(Object.keys(targetByNome));
    for (const r of prim2026) { attiviSullaRete.add(normalizzaRagioneSociale(r.trasportatore)); attiviSullaRete.add(normalizzaRagioneSociale(r.destinazione)); }
    for (const r of sec2026) attiviSullaRete.add(normalizzaRagioneSociale(r.stoccaggio));
    const fuoriRete = new Map(); // nome normalizzato -> { nome, impianti }
    for (const f of fornitori) {
      const k = normalizzaRagioneSociale(f.nome);
      if (!k || attiviSullaRete.has(k)) continue;
      if (!fuoriRete.has(k)) fuoriRete.set(k, { nome: f.nome, impianti: [] });
      if (f.impianto_nome) fuoriRete.get(k).impianti.push(f.impianto_nome);
    }
    for (const x of fuoriRete.values()) {
      anomalie.push({
        tipo: 'fornitore_senza_rete',
        fornitore: x.nome,
        testo: `${x.nome} e' registrato nella predittivita'${x.impianti.length ? ` (per ${x.impianti.join(', ')})` : ''} ma nel ${annoRiferimento()} non ha un target di rete ne' movimenti di rete. La predittivita' e' solo della rete: se lavora solo per l'ACI o l'extra raccolta, o non e' contrattualizzato quest'anno, toglilo dalla configurazione.`,
      });
    }

    // Uno stoccaggio che spedisce a piu' impianti ha un target di raccolta solo,
    // e quel target non puo' comparire per intero sotto ciascuno: Nappi Sud, con
    // 2.100 t di target, risultava avere 2.100 t di residuo sotto Irigom e altre
    // 2.100 sotto Tecnogum, cioe' il doppio di quello che deve raccogliere. Si
    // divide fra gli impianti in proporzione alle secondarie che ciascuno riceve
    // da lui, che e' il criterio deciso dalla direzione il 19/09/2026.
    // Il trasbordo dal piazzale di un impianto all'impianto stesso resta nel
    // riparto (correzione del 22/09/2026): e' la parte della raccolta del
    // soggetto che rimane al suo impianto. Tolto, con T-Cycle che spedisce solo
    // a Tecnogum oltre che a se stesso il riparto vedeva un impianto solo, la
    // quota non si creava e Tecnogum mostrava come suo l'intero target di
    // raccolta di T-Cycle: se T-Cycle e' registrato anche come raccoglitore del
    // proprio impianto, lo stesso target compariva intero sotto tutti e due. Con
    // il trasbordo dentro, a Tecnogum tocca la parte in proporzione a quello che
    // riceve sul totale che parte dal piazzale, come nel controllo delle rotte
    // (controlloRotte, stessa quoteDaStoccaggio). Il trasbordo non fa invece di
    // T-Cycle un impianto che il piazzale alimenta, per il riparto del plafond
    // (secVersoAltri, piu' sotto).
    const secVersoAltri = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) !== normalizzaRagioneSociale(r.destinazione));
    const quotaTargetPerImpianto = new Map(); // "stoccaggio|impianto" -> quota
    const nomiStoccaggio = [...new Set(sec2026.map(r => String(r.stoccaggio || '').trim()).filter(Boolean))];
    for (const nome of nomiStoccaggio) {
      const q = quoteDaStoccaggio(sec2026, nome);
      if (q.impianti.length < 2) continue;
      for (const imp of q.impianti) {
        quotaTargetPerImpianto.set(normalizzaRagioneSociale(nome) + '|' + normalizzaRagioneSociale(imp.impianto), imp.quota);
      }
    }
    const creates = [];
    const updates = [];
    const stoccaggiResult = [];

    // Build stoccaggi result array
    for (const sNorm of Object.keys(stoccaggiMetriche)) {
      const m = stoccaggiMetriche[sNorm];
      stoccaggiResult.push({
        nome: m.nome, nome_normalizzato: sNorm,
        plafond: m.plafond, kg_entrati: m.kg_entrati, kg_partiti: m.kg_partiti,
        kg_trasbordati_a_se: m.kg_trasbordati_a_se,
        residuo_plafond: m.residuo_plafond,
        impianti_collegati: stoccaggiFornitori.filter(f => normalizzaRagioneSociale(f.nome) === sNorm).map(f => f.impianto_nome),
      });
    }

    for (const imp of impianti) {
      const impNorm = normalizzaRagioneSociale(imp.nome_impianto);
      const impFornitori = fornitori.filter(f => f.impianto_id === imp.id);
      const isDoubleRole = doubleRoleImpianti.has(imp.id);
      const settimaneImp = settimaneFino(fineDi(imp));
      if (!settimaneImp.length) {
        anomalie.push({
          tipo: 'programmazione_chiusa',
          impianto: imp.nome_impianto,
          testo: `La programmazione di ${imp.nome_impianto} si e' chiusa il ${it(fineDi(imp))}: non ci sono settimane da pianificare. Se non e' cosi', correggi la data di fine nella configurazione dell'impianto.`,
        });
      }

      // Il gia' arrivato di rete dell'impianto e il suo residuo: il conto
      // condiviso, per ogni impianto e non solo per i doppi ruoli. Prima un
      // impianto senza doppio ruolo aveva come consuntivo la somma dei soli
      // fornitori configurati, e chi non era configurato non contava.
      const arrivato = arrivatoDi(imp);
      const impConsuntivo = arrivato ? arrivato.totale_kg : 0;
      const impConsuntivoPrim = arrivato ? arrivato.primaria_kg : 0;
      const impConsuntivoSec = arrivato ? arrivato.secondaria_kg : 0;
      let impConsuntivoFornitori = 0, impTotalePianificato = 0;
      const fornitoriResult = [];
      let conferitoriResult = [];

      // === DOPPIO RUOLO: scoperta conferitori dinamica ===
      if (isDoubleRole) {
        // Le primarie arrivate al sito, all'impianto o al suo piazzale (regola
        // del 22/09/2026): sono quelle del gia' arrivato.
        const primImp = arrivato ? arrivato.movimenti.filter(m => m.flusso === 'primaria').map(m => m.record) : [];

        // Scoperta conferitori non configurati
        const configuredNorms = new Set(impFornitori.map(f => normalizzaRagioneSociale(f.nome)));
        const conferitoriMap = {};
        for (const r of primImp) {
          const cNorm = normalizzaRagioneSociale(r.trasportatore);
          if (!cNorm || configuredNorms.has(cNorm)) continue;
          if (!conferitoriMap[cNorm]) conferitoriMap[cNorm] = { nome: r.trasportatore, consuntivo: 0, record: [] };
          conferitoriMap[cNorm].consuntivo += (r.peso_effettivo || 0);
          conferitoriMap[cNorm].record.push(r);
        }

        const nSett = settimaneImp.length;
        for (const cNorm of Object.keys(conferitoriMap)) {
          const c = conferitoriMap[cNorm];
          const targetConf = targetByNome[cNorm] || 0;
          const residuoConf = targetConf - c.consuntivo;
          const PREV = residuoConf > 0 && nSett > 0 ? Math.round(residuoConf / nSett) : 0;
          const viaggiPerSett = Math.ceil(PREV / KG_PER_VIAGGIO);

          const execByWeek = {};
          for (const r of c.record) {
            const key = settimanaDi(r);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }

          const piano = [];
          for (const s of settimaneImp) {
            const exec = execByWeek[s.data_inizio] || 0;
            const congelata = exec > 0;
            const prev = congelata ? exec : PREV;
            const delta = prev - exec;
            const viaggiPrev = Math.ceil(prev / KG_PER_VIAGGIO);
            const viaggiEff = exec > 0 ? Math.ceil(exec / KG_PER_VIAGGIO) : 0;
            piano.push({ ...s, prev, exec, delta, viaggi_prev: viaggiPrev, viaggi_eff: viaggiEff, congelata });
          }
          const totalePianificato = piano.reduce((s, w) => s + w.prev, 0);
          impTotalePianificato += totalePianificato;

          conferitoriResult.push({
            id: 'auto_' + cNorm, nome: c.nome, tipo: 'primaria_diretta',
            target_raccoglitore_kg: targetConf, consuntivo: c.consuntivo,
            residuo: residuoConf, kg_per_settimana: PREV, viaggi_per_settimana: viaggiPerSett,
            totale_pianificato: totalePianificato, piano_settimanale: piano,
            scoperto_automaticamente: true,
          });
        }
      }

      // === FORNITORI CONFIGURATI (logica generalizzata) ===
      for (const f of impFornitori) {
        const fNorm = normalizzaRagioneSociale(f.nome);
        const fRuoloScritto = f.ruolo || (tipoNorm(f.tipo) === 'stoccaggio' ? 'stoccaggio' : 'raccoglitore');

        // Il ruolo scritto in anagrafica puo' non corrispondere a quello che il
        // fornitore fa davvero, e allora il consuntivo esce a zero: un raccoglitore
        // si conta sulle primarie che porta all'impianto, uno stoccaggio sulle
        // secondarie che gli spedisce. Nappi Sud e' l'una e l'altra cosa: raccoglie
        // dai punti di raccolta con un target suo e spedisce secondarie a Irigom e a
        // Tecnogum. Segnata come solo raccoglitore risultava a zero su tutti e due,
        // perche' le sue primarie le porta al proprio piazzale, non agli impianti.
        // Qui vincono i fatti, e la discordanza si segnala.
        // Le primarie verso il sito contano anche se scaricate nel piazzale
        // dell'impianto (regola del 22/09/2026); le secondarie dal piazzale
        // dell'impianto a se stesso no, perche' quei PFU sono gia' fra le primarie.
        const suoSito = (r) => normalizzaRagioneSociale(r.destinazione) === impNorm;
        const daAltroStoccaggio = (r) => normalizzaRagioneSociale(r.stoccaggio) !== impNorm;
        const primDiQuesto = prim2026.filter(r => normalizzaRagioneSociale(r.trasportatore) === fNorm && suoSito(r)).length;
        const secDiQuesto = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && suoSito(r) && daAltroStoccaggio(r)).length;
        const fRuolo = (fRuoloScritto === 'raccoglitore' && !primDiQuesto && secDiQuesto) ? 'doppio_ruolo' : fRuoloScritto;
        // (stessa regola di eStoccaggio, calcolata sopra prima delle metriche)
        if (fRuolo !== fRuoloScritto) {
          anomalie.push({
            tipo: 'ruolo_discorde',
            fornitore: f.nome,
            impianto: imp.nome_impianto,
            testo: f.nome + " e' registrato come solo raccoglitore per " + imp.nome_impianto + ", ma verso questo impianto non e' un raccoglitore: e' il produttore delle " + secDiQuesto + " secondarie che partono dal suo piazzale. Raccoglie in primaria per conto proprio, con un target suo, e conferisce al proprio sito; agli altri impianti ci arriva in secondaria. E' un doppio ruolo e come tale lo conto, altrimenti il suo consuntivo resterebbe a zero. Correggilo nella configurazione.",
          });
        }
        const isStoccaggio = fRuolo === 'stoccaggio' || fRuolo === 'doppio_ruolo';
        // Il piazzale dell'impianto registrato come stoccaggio dell'impianto
        // stesso: i suoi viaggi verso l'impianto non abbassano il residuo, perche'
        // le primarie scaricate li' sono gia' nel gia' arrivato (regola del
        // 22/09/2026). Gli si pianificavano lo stesso le settimane col plafond,
        // come se coprissero il target; la Proiezione quel piazzale lo toglie
        // gia' dalle fonti. Qui il piano resta a zero e si dice.
        const piazzaleProprio = isStoccaggio && fNorm === impNorm;
        if (piazzaleProprio) {
          anomalie.push({
            tipo: 'piazzale_proprio',
            fornitore: f.nome,
            impianto: imp.nome_impianto,
            testo: `${f.nome} e' registrato come stoccaggio di se stesso per ${imp.nome_impianto}. Le secondarie dal suo piazzale all'impianto non abbassano il residuo: le primarie scaricate nel piazzale sono gia' nel gia' arrivato di rete, e contarle anche al trasbordo le farebbe valere due volte. Non gli pianifico viaggi: se raccoglie in primaria registralo come raccoglitore, altrimenti toglilo dai fornitori di ${imp.nome_impianto}.`,
          });
        }
        // Il target di un fornitore che alimenta piu' impianti si divide fra
        // loro: quello che gli appartiene una volta sola non si conta due volte.
        // Si divide solo un target che c'e': un piazzale senza target di raccolta
        // (T-Cycle non raccoglie in primaria) con la quota avrebbe mostrato un
        // residuo a zero, invece di quello dell'impianto che deve coprire.
        const targetPieno = targetByNome[fNorm] || 0;
        const quotaTarget = targetPieno > 0 ? quotaTargetPerImpianto.get(fNorm + '|' + impNorm) : undefined;
        const targetRaccoglitoreKg = quotaTarget != null ? Math.round(targetPieno * quotaTarget) : targetPieno;

        let consuntivo = 0, consuntivoPrim = 0, consuntivoSec = 0;
        let residuo = 0, residuoImpianto = null, PREV = 0, viaggiPerSett = 0;
        const execByWeek = {};
        let quotaPlafondImpianto = 0;
        let baseCascata = 0;
        let plafondUsato = 0;

        if (isStoccaggio) {
          const m = stoccaggiMetriche[fNorm] || {};
          plafondUsato = m.plafond || (f.plafond_stoccaggio_kg && f.plafond_stoccaggio_kg > 0 ? f.plafond_stoccaggio_kg : targetRaccoglitoreKg);
          const fSec = sec2026.filter(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && suoSito(r) && daAltroStoccaggio(r));
          consuntivoSec = fSec.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
          consuntivo = consuntivoSec;
          for (const r of fSec) {
            const key = settimanaDi(r);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }
          // Riparto plafond residuo proporzionale al residuo target di questo
          // impianto. Il residuo e' quello condiviso, target meno tutto il gia'
          // arrivato di rete: la predittivita' delle secondarie «si basa sul
          // residuo totale che diminuisce anche con le primarie» (l'utente,
          // 22/09/2026). Prima qui si toglievano dal target le sole secondarie di
          // questo stoccaggio, e il residuo mostrato per lo stoccaggio - che e'
          // quello dell'impianto - era piu' grande del vero di tutte le primarie.
          const resTargetImp = residuoDi(imp);
          // Gli impianti da cui parte il riparto sono quelli a cui questo
          // piazzale spedisce davvero, piu' quello in corso: prendendoli dal solo
          // ruolo scritto, un fornitore corretto sui fatti restava con un
          // denominatore parziale e la quota poteva superare il 100%. Il
          // trasbordo del piazzale all'impianto dello stesso soggetto non fa di
          // quell'impianto uno che il piazzale alimenta (vedi secVersoAltri).
          const stocImpiantiIds = [...new Set([
            ...stoccaggiFornitori.filter(sf => normalizzaRagioneSociale(sf.nome) === fNorm).map(sf => sf.impianto_id),
            ...impianti.filter(i => secVersoAltri.some(r => normalizzaRagioneSociale(r.stoccaggio) === fNorm && normalizzaRagioneSociale(r.destinazione) === normalizzaRagioneSociale(i.nome_impianto))).map(i => i.id),
            imp.id,
          ].filter(Boolean))];
          let sumResiduoTargetStoc = 0;
          for (const sImpId of stocImpiantiIds) {
            const sImp = impianti.find(i => i.id === sImpId);
            // l'impianto dello stesso soggetto del piazzale non ne prende una
            // quota, anche se e' registrato fra i suoi (vedi piazzaleProprio)
            if (!sImp || normalizzaRagioneSociale(sImp.nome_impianto) === fNorm) continue;
            // lo stesso residuo condiviso, per ciascuno degli impianti che
            // attingono a questo piazzale
            const sRes = residuoDi(sImp);
            if (sRes > 0) sumResiduoTargetStoc += sRes;
          }
          quotaPlafondImpianto = !piazzaleProprio && sumResiduoTargetStoc > 0 && resTargetImp > 0
            ? Math.min(m.residuo_plafond || 0, (m.residuo_plafond || 0) * (resTargetImp / sumResiduoTargetStoc))
            : 0;
          // Per uno stoccaggio il residuo mostrato e' sempre stato quello
          // dell'impianto: quanto manca a lui, che questo piazzale dovrebbe
          // coprire. Da quando il target di un fornitore condiviso si divide
          // fra gli impianti, quel numero accanto al target diviso non si
          // legge piu': Nappi Sud mostrava "target 1.125.993, residuo
          // 1.470.100", un residuo piu' grande del target. Quando la quota
          // c'e', il residuo e' il suo: quanto le manca da portare a questo
          // impianto. Quello dell'impianto resta, in un campo che lo dice.
          residuoImpianto = resTargetImp;
          residuo = quotaTarget != null ? Math.max(0, targetRaccoglitoreKg - consuntivoSec) : resTargetImp;
          // Il piano settimanale nasce dal residuo di questo fornitore, non da un
          // secondo riparto: con due criteri diversi il residuo mostrato e i kg a
          // settimana raccontavano due storie. Il plafond resta un tetto, non la
          // base del conto.
          baseCascata = quotaTarget != null
            ? Math.min(residuo, quotaPlafondImpianto > 0 ? quotaPlafondImpianto : residuo)
            : quotaPlafondImpianto;
        } else {
          // Le primarie di questo raccoglitore arrivate al sito, anche quelle
          // scaricate nel piazzale dell'impianto (regola del 22/09/2026): prima
          // si tenevano solo quelle scaricate all'impianto, e chi scarica nello
          // stoccaggio di Irigom restava indietro sul suo target senza esserlo.
          const fPrim = prim2026.filter(r => normalizzaRagioneSociale(r.trasportatore) === fNorm && suoSito(r));
          consuntivoPrim = fPrim.reduce((s, r) => s + (r.peso_effettivo || 0), 0);
          consuntivo = consuntivoPrim;
          for (const r of fPrim) {
            const key = settimanaDi(r);
            execByWeek[key] = (execByWeek[key] || 0) + (r.peso_effettivo || 0);
          }
          const ipotesi = f.ipotesi_mese_corrente || 0;
          residuo = targetRaccoglitoreKg - consuntivo - ipotesi;
          baseCascata = residuo;
        }

        const nSett = settimaneImp.length;
        const settimaneRimanenti = settimaneImp.filter(s => !(execByWeek[s.data_inizio] > 0)).length;
        if (isStoccaggio) {
          PREV = quotaPlafondImpianto > 0 && settimaneRimanenti > 0 ? Math.round(quotaPlafondImpianto / settimaneRimanenti) : 0;
        } else {
          PREV = residuo > 0 && nSett > 0 ? Math.round(residuo / nSett) : 0;
        }
        viaggiPerSett = Math.ceil(PREV / KG_PER_VIAGGIO);

        const piano = [];
        let cumulative = 0;
        for (const s of settimaneImp) {
          const exec = execByWeek[s.data_inizio] || 0;
          const congelata = exec > 0;
          const override = existingPlans.find(p => p.fornitore_id === f.id && p.data_inizio === s.data_inizio && p.modificato_manuale);
          let prev;
          if (override && override.kg_previsti != null) prev = override.kg_previsti;
          else if (congelata) prev = exec;
          else prev = PREV;
          const delta = prev - exec;
          const viaggiPrev = Math.ceil(prev / KG_PER_VIAGGIO);
          const viaggiEff = exec > 0 ? Math.ceil(exec / KG_PER_VIAGGIO) : 0;
          cumulative += congelata ? exec : prev;
          const residuoCascata = baseCascata - cumulative;

          const existing = existingPlans.find(p => p.fornitore_id === f.id && p.data_inizio === s.data_inizio);
          let recordId = null;
          if (!existing) {
            creates.push({
              impianto_id: imp.id, impianto_nome: imp.nome_impianto,
              fornitore_id: f.id, fornitore_nome: f.nome,
              settimana_numero: s.numero, data_inizio: s.data_inizio, data_fine: s.data_fine,
              kg_previsti: prev, kg_effettivi: exec, viaggi_previsti: viaggiPrev, viaggi_effettivi: viaggiEff,
              stato: congelata ? 'completato' : 'da_programmare', anno: annoRiferimento(), modificato_manuale: false,
            });
          } else {
            recordId = existing.id;
            if (!existing.modificato_manuale) {
              if (existing.kg_previsti !== prev || existing.kg_effettivi !== exec || existing.viaggi_previsti !== viaggiPrev) {
                updates.push({ id: existing.id, kg_previsti: prev, kg_effettivi: exec, viaggi_previsti: viaggiPrev, viaggi_effettivi: viaggiEff, stato: congelata ? 'completato' : 'da_programmare' });
              }
            } else if (existing.kg_effettivi !== exec) {
              updates.push({ id: existing.id, kg_effettivi: exec, viaggi_effettivi: viaggiEff });
            }
          }
          piano.push({ ...s, prev, exec, delta, viaggi_prev: viaggiPrev, viaggi_eff: viaggiEff, congelata, override: !!override, record_id: recordId, residuo_cascata: residuoCascata });
        }

        const totalePianificato = piano.reduce((s, w) => s + w.prev, 0);
        // La somma dei fornitori configurati resta, ma solo come controllo: il
        // gia' arrivato dell'impianto e' il conto condiviso qui sopra.
        impConsuntivoFornitori += consuntivo;
        impTotalePianificato += totalePianificato;

        const fr = {
          id: f.id, nome: f.nome, ruolo: fRuolo, tipo: isStoccaggio ? 'stoccaggio' : 'primaria_diretta',
          target_raccoglitore_kg: targetRaccoglitoreKg,
          ...(residuoImpianto != null ? { residuo_impianto_kg: Math.round(residuoImpianto) } : {}),
          ...(quotaTarget != null ? {
            target_raccoglitore_intero_kg: targetPieno,
            quota_target: Math.round(quotaTarget * 1000) / 1000,
            // le tonnellate con la virgola e due decimali, come ovunque; e se nel
            // riparto c'e' il trasbordo all'impianto dello stesso soggetto, si dice
            nota_quota: `${f.nome} alimenta piu' di un impianto: del suo target di raccolta, ${formatoKgInTonnellate(targetPieno)} t, a questo impianto ne compete il ${Math.round(quotaTarget * 100)}%, in proporzione alle secondarie che riceve sul totale partito dal piazzale${quotaTargetPerImpianto.has(fNorm + '|' + fNorm) ? `, compresi i trasbordi all'impianto ${f.nome} stesso` : ''}.`,
          } : {}),
          quota_target_deprecato: f.quota_target || 0,
          ipotesi_mese_corrente: f.ipotesi_mese_corrente || 0,
          consuntivo, consuntivo_primarie: consuntivoPrim, consuntivo_secondarie: consuntivoSec,
          residuo, kg_per_settimana: PREV, viaggi_per_settimana: viaggiPerSett,
          settimane_rimanenti: settimaneRimanenti, totale_pianificato: totalePianificato,
          piano_settimanale: piano,
        };
        if (isStoccaggio) {
          fr.plafond = plafondUsato;
          fr.kg_entrati_stoccaggio = stoccaggiMetriche[fNorm]?.kg_entrati || 0;
          fr.residuo_plafond = stoccaggiMetriche[fNorm]?.residuo_plafond || 0;
          fr.quota_plafond_impianto = Math.round(quotaPlafondImpianto);
        }
        fornitoriResult.push(fr);
      }

      result.push({
        impianto: {
          id: imp.id, nome: imp.nome_impianto, target: imp.target || 0,
          totale_capacity: imp.totale_capacity_kg || 0, data_fine: fineDi(imp),
          is_double_role: isDoubleRole,
        },
        // consuntivo e' il gia' arrivato di rete (il nome del campo resta per chi
        // lo legge gia'), residuo = target - gia' arrivato: gli stessi numeri
        // della Proiezione e del suggerimento del lunedi'.
        consuntivo: impConsuntivo,
        gia_arrivato: impConsuntivo,
        consuntivo_primarie: impConsuntivoPrim, consuntivo_secondarie: impConsuntivoSec,
        // Le primarie scaricate nel piazzale, quante ne sono ripartite per altri
        // impianti (tolte dal gia' arrivato: le contano loro) e quante restano;
        // arrivato al sito e' tutto quello che e' entrato, per la capacita'.
        consuntivo_primarie_impianto: arrivato ? arrivato.primaria_impianto_kg : 0,
        consuntivo_primarie_piazzale: arrivato ? arrivato.primaria_piazzale_kg : 0,
        consuntivo_piazzale_ripartito: arrivato ? arrivato.piazzale_ripartito_kg : 0,
        consuntivo_primarie_piazzale_netta: arrivato ? arrivato.primaria_piazzale_netta_kg : 0,
        gia_arrivato_al_sito: arrivato ? arrivato.arrivato_al_sito_kg : 0,
        secondarie_da_se_escluse: arrivato ? arrivato.da_se_stesso : { viaggi: 0, kg: 0 },
        consuntivo_fornitori_configurati: Math.round(impConsuntivoFornitori),
        residuo: residuoDi(imp),
        note: noteGiaArrivato(arrivato, nomeDi, annoRiferimento()),
        totale_pianificato: impTotalePianificato,
        fornitori: fornitoriResult,
        conferitori: conferitoriResult,
      });
    }

    // Persistenza chunked, riservata all'amministratore, e mai su un archivio a
    // meta' (vedi leggiStato): il piano si salva alla prossima apertura.
    const salvato = puoScrivere && !caricamentoInCorso;
    if (salvato) {
      for (let i = 0; i < creates.length; i += 100) {
        await b.entities.PianificazioneSettimanale.bulkCreate(creates.slice(i, i + 100));
        await new Promise(r => setTimeout(r, 200));
      }
      for (let i = 0; i < updates.length; i += 100) {
        await b.entities.PianificazioneSettimanale.bulkUpdate(updates.slice(i, i + 100));
        await new Promise(r => setTimeout(r, 200));
      }
    }

    return Response.json({
      canale: 'RETE',
      anomalie,
      senza_fine_trasporto: senzaFineTrasporto,
      date_da_sistemare: riassuntoDate(dateDaSistemare),
      caricamento_in_corso: caricamentoInCorso || '',
      piano_salvato: salvato,
      kg_per_viaggio: KG_PER_VIAGGIO,
      impianti: result,
      stoccaggi: stoccaggiResult,
      settimane,
      data_inizio: settimane[0] ? settimane[0].data_inizio : null,
      data_fine: dataFine,
      num_settimane: settimane.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
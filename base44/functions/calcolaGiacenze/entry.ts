import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { targetRigaGiacenze, testoTargetDaPortare, ripartisciTargetPrimarie, conferitiPerRipartizione } from "../../shared/targetImpianti.ts";
import { recordDellAnno, annoChiuso, annoCorrenteRoma } from "../../shared/annoTarget.ts";
import { annoRoma, giornoRoma } from "../../shared/giornoItaliano.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { momentoRilevazione, dopoLaRilevazione, movimentoStoccaggio, verificaRilevazione, saldoMovimentiInArchivio, riconciliazionePiazzale, ancoraDellAnno, annoDellaLettura, puntoDiPartenza, anomaliaRilevazione, classePfu, canaleEClasse, ordiniDellaGiacenza, kgReteDiRilevazione, kgAciDiRilevazione, PERCHE_PIAZZALE_SENZA_LETTURA, PERCHE_PIAZZALE_SENZA_INIZIO } from "../../shared/giacenzaStoccaggi.ts";
import { giornoFotografia, ordiniNotiAlPortale, dichiaratoDopoLaFotografia, aperturaNetta, nostraRiga, formulariDaSistemare, avvisoSenzaFine, ORDINE_GRUPPI, PERCHE_SENZA_FOTOGRAFIA, giornoAlPiazzale, nellAttesaDellAnno, letturaDelTrentuno, PERCHE_SENZA_LETTURA_DEL_TRENTUNO, annoPrimaDelGestionale, PERCHE_ANNO_PRIMA_DEL_GESTIONALE, partenzeDegliStoccaggi, attesaChiusaPerNoi, totaleDellaColonna } from "../../shared/giacenzaPortale.ts";
import { ingressoMovimento } from "../../shared/ingressoMovimento.ts";
import { carichiNonNelFile } from "../../shared/riconciliazioneDaDichiarare.ts";
import { leggiDichiarazioni } from "../../shared/dichiarazioniImpianti.ts";

// Calcola la situazione delle giacenze di impianti e stoccaggi per l'anno richiesto.
//
// DUE ASSI TEMPORALI:
// - GIACENZA (stock): calcolata su tutto lo storico, senza filtro d'anno
// - CONFERITO e TARGET (flusso): calcolati sull'anno richiesto
//
// Tre regole dell'utente, senza eccezioni (21/09/2026): ogni ragionamento sulla
// FINE DEL TRASPORTO, mai sulla chiusura a portale; ogni caricamento aggiorna
// tutto; rete, ACI ed extra raccolta mai mescolati.
//
// Dal 22/09/2026 un'altra regola dell'utente: immissione, inizio e fine trasporto
// sono obbligatorie. Un terminato a cui ne manca una si segnala sul soggetto a cui
// arriva o da cui parte, canale per canale (sezione 1e); senza fine trasporto
// resta fuori da ogni periodo e da ogni giacenza calcolata, e lo si dice.
//
// Fonti dati:
//   OrdineNonDichiarato  -> fotografia della giacenza a portale (impianti), ordini da dichiarare, arretrato per anno di fine trasporto, in_attesa_dichiarazione (stoccaggi)
//   GiacenzaStoccaggio   -> rilevazioni degli stoccaggi (per classe: 1-4 rete, 9 ACI): l'ancora dell'anno da cui parte la giacenza, le altre come riscontro
//   DichiarazioneTrattamento -> dichiarato e derivati (anno di fine trasporto dell'ordine)
//   DichiarazioneSito    -> dichiarazioni caricate a portale dopo la fotografia
//
// La giacenza a portale degli impianti segue i caricamenti, con la regola di
// Dichiarazioni Impianti (shared/giacenzaPortale.ts): fotografia, piu' i carichi
// di rete che il file non contiene, meno le dichiarazioni caricate dopo.
//   PrimariaRete/Aci, ExtraRaccolta, Secondaria, Terziaria -> movimentazione (stato terminato, trasporto_finito_il nell'anno)
//   GiacenzaSito -> elenco dei siti dell'anno e tipologia trattamento
//   ImpiantoTargetSecondaria -> target dell'impianto, di esattamente quell'anno (Target & Status)
//   TargetRaccoglitore -> target delle primarie del sito: somma dei raccoglitori legati al sito
//
// Dal 27/09/2026 i target si scrivono solo in Target & Status (decisione
// dell'utente): Giacenze li legge da li'. Finche' un target e' scritto solo nel
// vecchio campo di GiacenzaSito si usa quello, con l'anomalia 'target_da_portare'.
//
// RUOLO DEDOTTO DALL'ORDINE PRIMARIO:
//   I report OrdineNonDichiarato e DichiarazioneTrattamento non contengono Tipo_Destinazione,
//   ma ordine_primaria corrisponde a id_ordine di PrimariaRete/Aci. Si costruisce una mappa
//   id_ordine -> tipo_destinazione e la si usa per attribuire il ruolo.
//
//   Regola di attribuzione (per OrdineNonDichiarato e DichiarazioneTrattamento):
//   - se destinazione_secondaria e' valorizzato: attribuisci a destinazione_secondaria con ruolo "imp"
//   - altrimenti attribuisci a destinazione, con ruolo dalla mappa ordini
//   - se l'ordine non ha riscontro nella mappa: ruolo "imp" + anomalia
//
// NOTA: i campi giacenza_fisica_t e divergenza_t sono stati rimossi perche' non attendibili.
// La giacenza fisica veniva calcolata come bilancio dei movimenti meno il dichiarato, ma i
// due insiemi coprono periodi diversi: PrimariaRete e PrimariaAci contengono ordini terminati
// a partire da gennaio 2024, mentre DichiarazioneTrattamento comprende dichiarazioni riferite
// a ordini chiusi gia' dal 2023. Il bilancio sottraeva dichiarazioni relative a materiale mai
// conteggiato in ingresso, con uno squilibrio complessivo di circa settemila tonnellate.
// La giacenza attendibile e' quella a portale, che il portale stesso calcola ordine per ordine.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno } = await req.json();
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const annoNum = Number(anno);
    const annoTargetChiuso = annoChiuso(annoNum);

    const norm = normalizzaRagioneSociale;
    // Tonnellate arrotondate ai kg: la terza cifra decimale non si perde.
    const r2 = (v) => Math.round(v * 1000) / 1000;
    const tdNorm = (v) => String(v || '').toLowerCase().trim();

    // Carica tutte le sorgenti dati in parallelo
    // ImpiantoTargetSecondaria si legge tutto e si filtra con annoDelRecord: un
    // record senza anno vale il 2026, e un filtro per anno lo perderebbe.
    // Per un anno chiuso servono anche i siti dell'anno dopo: le loro aperture
    // sono la lettura del 31/12 che la chiusura ha salvato, il numero a portale
    // di quell'anno (letturaDelTrentuno, decisioni dell'utente del 13/10/2026).
    // Una lettura sola in piu', e solo per un anno chiuso, come nel riepilogo.
    const [nonDichiarati, dichiarazioni, reteAll, aciAll, extraAll, secAll, terzAll, giacenzeSito, giacenzeStoccaggio, dichiarazioniSito, impiantiTarget, targetRaccoglitori, targetMensili, giacenzeAnnoDopo] = await Promise.all([
      fetchAll(base44.asServiceRole.entities.OrdineNonDichiarato),
      fetchAll(base44.asServiceRole.entities.DichiarazioneTrattamento),
      fetchAll(base44.asServiceRole.entities.PrimariaRete),
      fetchAll(base44.asServiceRole.entities.PrimariaAci),
      fetchAll(base44.asServiceRole.entities.ExtraRaccolta),
      fetchAll(base44.asServiceRole.entities.Secondaria),
      fetchAll(base44.asServiceRole.entities.Terziaria),
      fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno: annoNum }),
      fetchAll(base44.asServiceRole.entities.GiacenzaStoccaggio),
      fetchAll(base44.asServiceRole.entities.DichiarazioneSito),
      fetchAll(base44.asServiceRole.entities.ImpiantoTargetSecondaria),
      fetchAll(base44.asServiceRole.entities.TargetRaccoglitore),
      // i target mensili dicono di che mese e' quale pezzo di target, e su quale
      // impianto l'utente lo ha scritto: li legge la ripartizione
      fetchAll(base44.asServiceRole.entities.TargetMensile),
      annoTargetChiuso ? fetchAll(base44.asServiceRole.entities.GiacenzaSito, { anno: annoNum + 1 }) : Promise.resolve([]),
    ]);
    // Gli impianti di Target & Status di quell'anno con un target: compaiono anche
    // senza movimenti, come prima quelli con il target scritto in Giacenze.
    const impiantiConTarget = recordDellAnno(impiantiTarget, annoNum)
      .filter(r => r.stato !== 'non_attivo' && Number(r.target) > 0 && norm(r.nome_impianto));

    // --- Classi dei PFU, come nel portale: P, M, G1, G2 e ACI (autodemolizione) ---
    // Il prodotto arriva come "P - fino a 35 kg", ".class1" o "PFU Autodemolizione".
    const CLASSI = ['P', 'M', 'G1', 'G2', 'ACI'];
    // La regola delle classi sta in un punto solo, shared/giacenzaStoccaggi.ts:
    // qui ce n'era una copia, e una copia della Chiusura d'anno, e le due si
    // erano gia' scostate - una classe 9 nell'archivio di rete finiva in un
    // canale per le Giacenze e in un altro per la Chiusura.
    const classeDa = classePfu;
    const classiVuote = () => ({ P: 0, M: 0, G1: 0, G2: 0, ACI: 0, ND: 0 });
    // momentoRilevazione e dopoLaRilevazione stanno in shared/giacenzaStoccaggi.ts:
    // la regola della rilevazione e' una sola, per fine trasporto, e la usa anche
    // la Predittivita' delle secondarie.

    // --- Filtri temporali per movimentazione ---
    function isTerminato(r) { return String(r.stato || '').trim().toLowerCase() === 'terminato'; }
    // L'anno e' quello del giorno italiano: un trasporto finito alle 23 del 31
    // dicembre appartiene all'anno che si chiude, non a quello che comincia.
    function inYear(dateField) {
      return annoRoma(dateField) === annoNum;
    }

    // === 0a. NOMI DEI SITI DA MOSTRARE ===
    // La chiave di aggregazione e' la ragione sociale normalizzata: tutta
    // minuscola, senza punteggiatura e senza forma societaria. Va benissimo per
    // riconoscere lo stesso sito scritto in modi diversi, ma a video e' illeggibile
    // e finora compariva ogni volta che il sito non aveva un target da cui pescare
    // il nome. Si raccoglie quindi, per ogni chiave, la forma piu' completa fra
    // quelle presenti nelle sorgenti, che e' di norma quella del portale.
    const nomiSito = new Map();
    const nomiVisti = new Set();
    function registraNome(raw) {
      const s = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!s || nomiVisti.has(s)) return;
      nomiVisti.add(s);
      const ns = norm(s);
      if (!ns) return;
      const attuale = nomiSito.get(ns);
      if (!attuale || s.length > attuale.length) nomiSito.set(ns, s);
    }
    for (const r of nonDichiarati) { registraNome(r.destinazione); registraNome(r.destinazione_secondaria); }
    // Solo le righe nostre, con SMOCO partner operativo: i nomi degli impianti di
    // un altro partner non devono diventare righe (revisione del 10/10/2026).
    for (const r of dichiarazioni) { if (!nostraRiga(r)) continue; registraNome(r.destinazione); registraNome(r.destinazione_secondaria); }
    for (const r of reteAll) registraNome(r.destinazione);
    for (const r of aciAll) registraNome(r.destinazione);
    for (const r of extraAll) registraNome(r.destinazione);
    for (const r of secAll) { registraNome(r.destinazione); registraNome(r.stoccaggio); }
    for (const r of terzAll) { registraNome(r.unita_locale_origine); registraNome(r.ragione_sociale); }
    for (const g of giacenzeSito) registraNome(g.sito);
    for (const r of giacenzeStoccaggio) registraNome(r.sito);
    for (const r of impiantiConTarget) registraNome(r.nome_impianto);

    // === 0. MAPPA ORDINE -> TIPO_DESTINAZIONE (da PrimariaRete + PrimariaAci) ===
    const ordineTipoMap = new Map(); // id_ordine -> tipo_destinazione normalizzato
    for (const r of [...reteAll, ...aciAll]) {
      const id = String(r.id_ordine || '').trim();
      const td = tdNorm(r.tipo_destinazione);
      if (id && td) ordineTipoMap.set(id, td);
    }

    // --- Funzione attribuzione: restituisce { sito, td, anomalia } ---
    function attribuisci(r) {
      const sec = String(r.destinazione_secondaria || '').trim();
      if (sec) return { sito: sec, td: 'imp', anomalia: false };
      const dest = String(r.destinazione || '').trim();
      const ordineId = String(r.ordine_primaria || '').trim();
      const td = ordineTipoMap.get(ordineId);
      if (td) return { sito: dest, td, anomalia: false };
      return { sito: dest, td: 'imp', anomalia: true };
    }

    // === 1. GIACENZA A PORTALE (OrdineNonDichiarato, tutto lo storico, per ns|td) ===
    // Per IMP: il peso non dichiarato e' la giacenza a portale dell'impianto.
    // Per STOC: il peso non dichiarato NON e' giacenza dello stoccaggio (e' materiale partito verso
    //   un impianto, in attesa che l'impianto ricevente presenti la dichiarazione). Viene raccolto
    //   in inAttesaMap; la giacenza reale dello stoccaggio viene dalla rilevazione manuale (sezione 1b).
    const anomalie = [];
    const giacPortaleMap = new Map();   // ns|imp -> t
    const ordiniMap = new Map();        // ns|td -> count
    const arretratoAnniMap = new Map(); // ns|td -> { anno: t }
    const inAttesaMap = new Map();      // ns -> t (peso non dichiarato attribuito a stoccaggi)
    const primoInAttesa = new Map();    // ns -> giorno del primo carico in attesa arrivato al piazzale
    const inAttesaSenzaGiorno = new Set(); // stoccaggi con un carico in attesa senza giorno di arrivo
    const ordiniSenzaRiscontro = new Set();

    const classiImpiantoMap = new Map(); // ns|imp -> kg per classe degli ordini non dichiarati
    // La fotografia: il giorno dell'ultimo file degli ordini non dichiarati, e gli
    // ordini che il portale conosce (per numero, non per data).
    const giornoFoto = giornoFotografia(nonDichiarati);
    const portaleConosce = ordiniNotiAlPortale();
    let senzaFineTrasporto = 0;
    let senzaFineTrasportoKg = 0;
    let senzaFineNelFile = 0;
    let fineDalGestionale = 0;
    // Una riga del file senza fine trasporto prende quella della sua primaria nel
    // gestionale, se c'e': sempre la fine trasporto, mai la chiusura. Stessa
    // regola di Dichiarazioni Impianti e degli ordini da dichiarare (22/09/2026).
    const fineRete = new Map(); // id della primaria terminata -> giorno di fine trasporto
    for (const r of reteAll) {
      const id = String(r.id_ordine || '').trim();
      const g = isTerminato(r) ? giornoRoma(r.trasporto_finito_il) : '';
      if (id && g) fineRete.set(id, g);
    }
    // L'anno di oggi, per l'attesa del portale di un anno che non e' quello in
    // corso (nellAttesaDellAnno): letto una volta.
    const annoDiOggi = annoCorrenteRoma();
    // UN ANNO PRIMA DEL GESTIONALE (decisioni dell'utente del 13/10/2026): un
    // anno chiuso che qui non e' mai stato aperto, senza siti ne' dichiarazioni.
    // La giacenza dei suoi impianti non si ricostruisce, e tutti e due i moduli
    // lo dicono con lo stesso perche' (annoPrimaDelGestionale).
    const primaDelGestionale = annoPrimaDelGestionale({ anno: annoNum, annoDiOggi, sitiDellAnno: giacenzeSito });
    const fineAnnoChiuso = `${annoNum}-12-31`;
    for (const r of nonDichiarati) {
      portaleConosce.segna(r);
      const { sito, td, anomalia } = attribuisci(r);
      const ns = norm(sito);
      // Il file degli ordini non dichiarati e' della rete: una riga ACI, se mai ci
      // fosse, non entra in una giacenza di rete.
      if (!ns || eAci({ prodotto: r.prodotto })) continue;
      const key = ns + '|' + td;
      if (anomalia) ordiniSenzaRiscontro.add(r.ordine_primaria);
      const kg = Number(r.peso_non_dichiarato_kg) || 0;
      const t = kg / 1000;
      // Gli ordini della riga si contano con le sue tonnellate: sullo stoccaggio,
      // solo quelli in attesa dell'anno guardato (qui sotto).
      let contaOrdine = true;
      if (td === 'stoc') {
        // L'ATTESA SU UN ANNO CHE NON E' QUELLO IN CORSO (seconda revisione del
        // 13/10/2026): il file e' di oggi, e le Giacenze del 2025 dicevano 860,099
        // t in attesa su Nappi Sud e 181,299 su T-Cycle, tutti carichi del 2026.
        // Su un altro anno contano solo i carichi arrivati al piazzale in
        // quell'anno, come in riepilogoDichiarazioni (nellAttesaDellAnno).
        // E GLI ORDINI CON LORO (revisione finale del 13/10/2026): accanto alle
        // 0 t in attesa del 2025 la riga diceva «Ordini da dichiarare 397» su
        // Nappi Sud e 72 su T-Cycle, gli ordini del file di oggi. Ora la stessa
        // regola vale per le tonnellate e per il numero degli ordini.
        const alPiazzale = giornoAlPiazzale(r, (id) => fineRete.get(id) || '');
        contaOrdine = nellAttesaDellAnno(alPiazzale, annoNum, annoDiOggi);
        if (contaOrdine) {
          inAttesaMap.set(ns, (inAttesaMap.get(ns) || 0) + t);
          // Da quando il portale aspetta, come in collocaFotografia: serve a dire
          // se quei carichi sono andati tutti a chi la rete non la dichiara
          // (attesaChiusaPerNoi, decisioni dell'utente del 13/10/2026).
          if (!alPiazzale) inAttesaSenzaGiorno.add(ns);
          else if (!primoInAttesa.has(ns) || alPiazzale < primoInAttesa.get(ns)) primoInAttesa.set(ns, alPiazzale);
        }
      } else {
        giacPortaleMap.set(key, (giacPortaleMap.get(key) || 0) + t);
        if (!classiImpiantoMap.has(key)) classiImpiantoMap.set(key, classiVuote());
        classiImpiantoMap.get(key)[classeDa(r.prodotto)] += kg;
      }
      if (contaOrdine) ordiniMap.set(key, (ordiniMap.get(key) || 0) + 1);

      // Arretrato per anno di fine trasporto: mai per data di chiusura a portale.
      const fineFile = giornoRoma(r.fine_trasporto);
      const fineGest = fineFile ? '' : (fineRete.get(String(r.ordine_primaria || '').trim()) || '');
      if (!fineFile) { senzaFineNelFile++; if (fineGest) fineDalGestionale++; }
      const annoFine = annoRoma(fineFile || fineGest);
      if (annoFine === null) { senzaFineTrasporto++; senzaFineTrasportoKg += kg; continue; }
      if (!arretratoAnniMap.has(key)) arretratoAnniMap.set(key, {});
      const perAnno = arretratoAnniMap.get(key);
      perAnno[annoFine] = (perAnno[annoFine] || 0) + t;
    }
    // Righe del FILE DEL PORTALE senza fine trasporto: quelle che non la trovano
    // nemmeno nel gestionale sono nella giacenza a portale ma in nessun anno
    // dell'arretrato. Si dicono, con il peso (22/09/2026); e si dice quante hanno
    // preso la data dal gestionale.
    if (senzaFineNelFile) anomalie.push({ tipo: 'ordini_senza_fine_trasporto', n: senzaFineTrasporto, kg: Math.round(senzaFineTrasportoKg), nel_file: senzaFineNelFile, dal_gestionale: fineDalGestionale });

    // === 1b. RILEVAZIONI GIACENZA STOCCAGGIO (saldo del portale per classe) ===
    // Per ogni stoccaggio, la rilevazione piu' recente; a parita' di giorno quella
    // registrata per ultima.
    const stocRilevMap = new Map(); // ns -> { record, dataStr }
    for (const r of giacenzeStoccaggio) {
      const ns = norm(r.sito);
      if (!ns) continue;
      const dataStr = momentoRilevazione(r);
      const existing = stocRilevMap.get(ns);
      if (!existing || dataStr > existing.dataStr
        || (dataStr === existing.dataStr && String(r.created_date || '') > String(existing.record.created_date || ''))) {
        stocRilevMap.set(ns, { record: r, dataStr });
      }
    }
    // Le rilevazioni di ciascuno stoccaggio in ordine: il controllo della piu'
    // recente parte da quella prima di lei (23/09/2026).
    const rilevPerStoc = new Map(); // ns -> rilevazioni dalla piu' vecchia alla piu' recente
    for (const r of giacenzeStoccaggio) {
      const ns = norm(r.sito);
      if (!ns) continue;
      if (!rilevPerStoc.has(ns)) rilevPerStoc.set(ns, []);
      rilevPerStoc.get(ns).push(r);
    }
    for (const elenco of rilevPerStoc.values()) {
      elenco.sort((a, b) => momentoRilevazione(a).localeCompare(momentoRilevazione(b))
        || String(a.created_date || '').localeCompare(String(b.created_date || '')));
    }
    // Da dove parte il numero di ciascun piazzale: l'ancora dell'anno, non
    // l'ultima lettura (regola della direzione, 24/09/2026). L'ultima lettura
    // (stocRilevMap) resta il riscontro: la sua data, se e' vecchia, se torna.
    const partenzaMap = new Map(); // ns -> { record, dataStr }
    for (const [ns, elenco] of rilevPerStoc) {
      const record = puntoDiPartenza(elenco);
      if (record) partenzaMap.set(ns, { record, dataStr: momentoRilevazione(record) });
    }

    // === 1c. MOVIMENTI DEGLI STOCCAGGI DOPO L'ANCORA, UN CANALE PER VOLTA ===
    // All'ancora dell'anno si aggiungono gli ingressi e si tolgono le uscite
    // finiti dopo, per fine trasporto (shared/giacenzaStoccaggi.ts). Rete, ACI ed
    // extra raccolta hanno ciascuno il suo saldo: la rilevazione ha le classi 1-4
    // per la rete e la 9 per l'ACI, l'extra raccolta a portale non c'e'.
    // DOVE ENTRA UN MOVIMENTO lo dice shared/ingressoMovimento.ts, lo stesso file
    // che chiede il modulo Dichiarazioni (chiusura dell'audit, 11/10/2026): chi
    // riceve, con che ruolo, su che canale, e per una secondaria da quale
    // piazzale parte. Qui sotto non si decide piu' niente di tutto questo da se'.
    const dove = (r, archivio) => ingressoMovimento(r, archivio, norm);
    const alPiazzale = (d) => !!(d.arrivo && d.arrivo.ruolo === 'stoc');
    const saldoVuoto = () => ({ ingressi: classiVuote(), uscite: classiVuote(), nIngressi: 0, nUscite: 0 });
    const movStoc = new Map(); // ns -> { giorno, RETE, ACI }
    for (const [ns, partenza] of partenzaMap) movStoc.set(ns, { giorno: partenza.dataStr, RETE: saldoVuoto(), ACI: saldoVuoto() });
    // Il canale e la classe li decide chi chiama, con canaleEClasse: il canale
    // ACI vale se e solo se la classe e' ACI, altrimenti i chili finiscono in
    // una casella che nessuno legge. I kg sono interi, come ovunque.
    const contaMovimento = (r, ns, canale, verso, classe) => {
      const m = movStoc.get(ns);
      if (!m || !dopoLaRilevazione(r, m.giorno)) return;
      const saldo = m[canale];
      saldo[verso][classe] += Math.round(Number(r.peso_effettivo) || 0);
      if (verso === 'ingressi') saldo.nIngressi++; else saldo.nUscite++;
    };
    // Fin dove arrivano i movimenti caricati: l'ultima fine trasporto, giorno italiano.
    const oggi = giornoRoma(new Date().toISOString());
    let datiAggiornatiAl = '';
    for (const r of [...reteAll, ...aciAll, ...extraAll, ...secAll]) {
      const g = isTerminato(r) ? giornoRoma(r.trasporto_finito_il) : '';
      if (g && g > datiAggiornatiAl && g <= oggi) datiAggiornatiAl = g;
    }
    // Una primaria di CLASSE 9 che sta nell'archivio della rete e' ACI: decide
    // il materiale, non l'archivio (decisione dell'utente, 28/09/2026). Prima
    // quei chili entravano nel saldo della rete sotto la classe ACI, che nessun
    // conto legge: uscivano dalla giacenza dell'ACI senza entrare in quella
    // della rete, cioe' sparivano.
    for (const r of reteAll) {
      const d = dove(r, 'PrimariaRete');
      if (!isTerminato(r) || !alPiazzale(d)) continue;
      const { canale, classe } = canaleEClasse(r);
      contaMovimento(r, d.arrivo.chiave, canale, 'ingressi', classe);
    }
    for (const r of aciAll) { const d = dove(r, 'PrimariaAci'); if (isTerminato(r) && alPiazzale(d)) contaMovimento(r, d.arrivo.chiave, 'ACI', 'ingressi', 'ACI'); }
    // Le partenze di rete di ogni stoccaggio, verso chi e quando: dicono se
    // l'attesa del portale e' un giro chiuso per noi (decisioni dell'utente del
    // 13/10/2026, attesaChiusaPerNoi). La stessa raccolta del riepilogo.
    const partenzeStoc = partenzeDegliStoccaggi();
    for (const r of secAll) {
      if (!isTerminato(r)) continue;
      const d = dove(r, 'Secondaria');
      partenzeStoc.segna(r, d);
      const { canale, classe } = canaleEClasse(r, { aci: eAci(r) });
      if (alPiazzale(d)) contaMovimento(r, d.arrivo.chiave, canale, 'ingressi', classe);
      if (d.partenza) contaMovimento(r, d.partenza.chiave, canale, 'uscite', classe);
    }
    // L'extra raccolta in piazzale, a parte: entrate e partenze dell'anno.
    // UNA SECONDARIA DI EXTRA RACCOLTA PUO' ARRIVARE A UN PIAZZALE (chiusura
    // dell'audit, 11/10/2026): qui toglieva dal piazzale che spedisce e non
    // aggiungeva niente a quello che riceve, perche' il ramo del piazzale era
    // solo delle primarie. Il piazzale che riceveva la contava nel conferito e
    // non nella giacenza; e nelle Dichiarazioni diventava un impianto (C9). Ora
    // entra dove dice il formulario, come una secondaria di rete.
    const extraStoc = new Map(); // ns -> t
    for (const r of extraAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const t = (Number(r.peso_effettivo) || 0) / 1000;
      const d = dove(r, 'ExtraRaccolta');
      if (d.partenza) extraStoc.set(d.partenza.chiave, (extraStoc.get(d.partenza.chiave) || 0) - t);
      if (alPiazzale(d)) extraStoc.set(d.arrivo.chiave, (extraStoc.get(d.arrivo.chiave) || 0) + t);
    }

    // === 1c-bis. TUTTI I MOVIMENTI DEL PIAZZALE, IN FORMA COMPATTA ===
    // Servono a due conti che sorvegliano la rilevazione (23/09/2026): il
    // controllo di quella appena inserita - che cosa ci si aspettava di leggere -
    // e la somma dei soli movimenti in archivio, da mostrare accanto alla
    // giacenza. Qui si raccolgono tutti, non solo quelli dopo la rilevazione, e
    // ciascuno resta nel suo canale: rete, ACI ed extra raccolta non si mescolano.
    const daChi = (r) => r.trasportatore || r.ragione_sociale || '';
    const movArchivio = new Map(); // ns -> movimenti del piazzale
    // L'archivio di provenienza si porta dietro: chi apre un numero e trova la
    // riga deve sapere dove andarla a cercare - terminati di rete, terminati ACI,
    // secondarie, extra raccolta.
    const raccogli = (r, ns, canale, verso, classe, controparte, archivio) => {
      if (!ns) return;
      if (!movArchivio.has(ns)) movArchivio.set(ns, []);
      movArchivio.get(ns).push(movimentoStoccaggio(r, { canale, verso, classe, controparte, archivio }));
    };
    for (const r of reteAll) {
      const d = dove(r, 'PrimariaRete');
      if (!isTerminato(r) || !alPiazzale(d)) continue;
      const { canale, classe } = canaleEClasse(r);
      raccogli(r, d.arrivo.chiave, canale, 'ingresso', classe, daChi(r), 'terminati_rete');
    }
    for (const r of aciAll) { const d = dove(r, 'PrimariaAci'); if (isTerminato(r) && alPiazzale(d)) raccogli(r, d.arrivo.chiave, 'ACI', 'ingresso', 'ACI', daChi(r), 'terminati_aci'); }
    for (const r of secAll) {
      if (!isTerminato(r)) continue;
      const d = dove(r, 'Secondaria');
      const { canale, classe } = canaleEClasse(r, { aci: eAci(r) });
      if (alPiazzale(d)) raccogli(r, d.arrivo.chiave, canale, 'ingresso', classe, r.stoccaggio, 'secondarie');
      if (d.partenza) raccogli(r, d.partenza.chiave, canale, 'uscita', classe, r.destinazione, 'secondarie');
    }
    // Anche qui una secondaria di extra raccolta entra nel piazzale che la
    // riceve, oltre a uscire da quello che la spedisce (11/10/2026, C9).
    for (const r of extraAll) {
      if (!isTerminato(r)) continue;
      const d = dove(r, 'ExtraRaccolta');
      const classe = classeDa(r.classe, r.prodotto);
      if (d.partenza) raccogli(r, d.partenza.chiave, 'EXTRA_RACCOLTA', 'uscita', classe, r.destinazione, 'extra_raccolta');
      if (alPiazzale(d)) raccogli(r, d.arrivo.chiave, 'EXTRA_RACCOLTA', 'ingresso', classe, d.tipo === 'secondaria' ? r.stoccaggio : daChi(r), 'extra_raccolta');
    }

    // L'APERTURA DI UN PIAZZALE CHE HA LETTURE VIENE DALL'ANCORA, COME NEL
    // MODULO DICHIARAZIONI (revisione della chiusura dell'audit, 11/10/2026). La
    // colonna dell'apertura dei piazzali leggeva il campo scritto in GiacenzaSito,
    // che per l'anno nuovo nessuno scrive piu' (la chiusura salva la rilevazione
    // del 31/12, non quel campo) e che il numero del piazzale non usa: il modulo
    // Dichiarazioni partiva gia' dall'ancora portata al 31/12 dell'anno prima, coi
    // movimenti in mezzo, in avanti o all'indietro. Ora i due moduli dicono la
    // stessa apertura. Per un anno chiuso l'ancora e' quella di quell'anno, se
    // c'e', come nel riepilogo. Il campo scritto resta per i piazzali senza
    // nessuna lettura: null qui vuol dire «non ha letture».
    // L'ancora di un anno chiuso: una lettura di quell'anno che non sia quella
    // del 31/12, che lo chiude e non lo puo' aprire (revisione finale
    // dell'11/10/2026). La stessa regola del riepilogo (senzaAncoraChiuso).
    const ancoraPropria = (ns) => ancoraDellAnno((rilevPerStoc.get(ns) || []).filter(l => momentoRilevazione(l) !== fineAnnoChiuso), annoNum);
    const aperturaPiazzale = (ns, canale) => {
      const partenza = partenzaMap.get(ns);
      if (!partenza) return null;
      // Per un anno chiuso la lettura del 31/12 lo chiude e non lo puo' aprire: senza
      // un'altra lettura dell'anno l'apertura non si conosce (null), come nel
      // riepilogo (senzaAncoraChiuso, revisione finale dell'11/10/2026).
      const propria = annoTargetChiuso ? ancoraPropria(ns) : null;
      if (annoTargetChiuso && !propria) return null;
      const base = propria || partenza.record;
      const da = momentoRilevazione(base);
      const al = `${annoNum - 1}-12-31`;
      // Il saldo fra i due giorni, estremo sinistro escluso; all'indietro col segno cambiato.
      const [dopo, fino, segno] = da <= al ? [da, al, 1] : [al, da, -1];
      const saldo = (movArchivio.get(ns) || []).reduce((s, m) => (m.canale === canale && m.finito_il > dopo && m.finito_il <= fino
        ? s + (m.verso === 'uscita' ? -m.kg : m.kg) : s), 0);
      const kg = canale === 'ACI' ? kgAciDiRilevazione(base) : kgReteDiRilevazione(base);
      return Math.round(kg + segno * saldo) / 1000;
    };

    // === 1d. GIACENZA A PORTALE DEGLI IMPIANTI, AGGIORNATA AI CARICAMENTI ===
    // Alla fotografia si aggiungono i carichi di rete arrivati all'impianto - in
    // primaria o in secondaria - che il file non contiene ancora, riconosciuti dal
    // numero d'ordine, da inizioAggiunti (l'anno della fotografia, o i 60 giorni
    // prima a inizio anno) in avanti: la stessa regola del modulo Dichiarazioni.
    // Poi si tolgono le dichiarazioni di rete caricate a portale dopo la fotografia.
    // Dal report delle dichiarazioni: il portale li conosce, ma nella sua
    // giacenza non li conta piu' (serve a dire la differenza per chi non ha la
    // fine trasporto, sezione 1e).
    for (const d of dichiarazioni) portaleConosce.segna(d, 'dichiarazioni');
    const aggiuntiMap = new Map(); // ns|imp -> { kg, classi, n }
    // Chi la rete non la dichiara per accordo (dichiara_rete falso in Giacenze,
    // oggi Tecnogum: il trattamento non lo paghiamo noi) non ha una giacenza di
    // rete che il portale tenga per noi: i suoi carichi non sono 'in ritardo nel
    // file', non ci sono proprio. Aggiungerli faceva comparire a Tecnogum 1.706,76 t
    // a portale contro le 0 del file (22/09/2026).
    const nonDichiaraRete = new Set(giacenzeSito.filter(g => g.dichiara_rete === false).map(g => norm(g.sito)));
    // Gli stessi, col nome scritto nella scheda dei siti: lo dice l'attesa che per
    // noi e' un giro chiuso (decisioni dell'utente del 13/10/2026).
    const nonDichiaranoNomi = new Map(giacenzeSito.filter(g => g.dichiara_rete === false).map(g => [norm(g.sito), String(g.sito || '').trim()]));
    // QUALI CARICHI IL FILE NON HA ANCORA LO DECIDE UNA REGOLA SOLA (revisione
    // della chiusura dell'audit, 11/10/2026): carichiNonNelFile, la stessa del
    // riepilogo delle dichiarazioni e della riga di riconciliazione dell'elenco
    // «Da dichiarare». Qui la si riscriveva - terminato, rete, arrivato
    // all'impianto, da inizioAggiunti, ignoto al portale, non di chi la rete non
    // la dichiara - e tre copie con lo stesso esito restano uguali solo finche'
    // nessuno ne cambia una. Le classi dei carichi aggiunti servono solo qui, e
    // si tengono qui, sulla stessa decisione.
    const carichiNonNoti = carichiNonNelFile({ foto: giornoFoto, portaleConosce, chiaveDi: norm, nonDichiaraRete });
    const aggiungiNonNoto = (r, tipo) => {
      const ns = carichiNonNoti.segna(r, tipo);
      if (!ns) return;
      const key = ns + '|imp';
      if (!aggiuntiMap.has(key)) aggiuntiMap.set(key, { kg: 0, classi: classiVuote(), n: 0 });
      const a = aggiuntiMap.get(key);
      const kg = Number(r.peso_effettivo) || 0;
      a.kg += kg;
      a.classi[classeDa(r.classe, r.prodotto)] += kg;
      a.n++;
    };
    // La giacenza a portale di un impianto e' della RETE (il portale l'ACI degli
    // impianti non la tiene per noi): una riga di classe 9 non ci entra, qualunque
    // archivio la porti. Le secondarie ACI erano gia' escluse.
    // Una secondaria arrivata al PIAZZALE di un sito che e' anche impianto non e'
    // un carico dell'impianto: sta nella giacenza del piazzale, coi movimenti dopo
    // la rilevazione. Aggiunta anche qui, quei chili si contavano due volte - sul
    // piazzale e nella giacenza a portale dell'impianto (chiusura dell'audit,
    // 11/10/2026, C2). Il modulo Dichiarazioni fa lo stesso. Tutte e due le
    // esclusioni ora le fa carichiNonNelFile, con ingressoMovimento.
    for (const r of reteAll) aggiungiNonNoto(r, 'primaria');
    for (const r of secAll) aggiungiNonNoto(r, 'secondaria');
    const dichiaratoDopoMap = dichiaratoDopoLaFotografia(dichiarazioniSito, giornoFoto, norm); // ns -> kg

    // === 1e. TERMINATI CON LE DATE DA SISTEMARE (regola dell'utente, 22/09/2026) ===
    // "Le date immissione, inizio e fine trasporto sono obbligatorie nei
    // formulari, se non ci sono vanno segnalate". Un terminato a cui ne manca
    // una, o con le date in ordine sbagliato, si segnala sul soggetto a cui arriva
    // o da cui parte, un canale per volta; le terziarie, che un canale non ce
    // l'hanno, stanno in un gruppo loro (piu' sotto). Senza fine trasporto non e' nel
    // conferito, ne' fra i movimenti dopo la rilevazione, ne' fra i carichi
    // aggiunti alla fotografia (qui sopra lo escludono inYear, dopoLaRilevazione e
    // aggiungiNonNoto, che senza giorno non contano): se il portale lo conosce,
    // nella giacenza a portale c'e' e il gestionale non lo colloca. La differenza
    // si dice con i numeri, non si nasconde.
    const daSistemare = formulariDaSistemare({ anno: annoNum, chiaveDi: norm });
    // Ogni formulario si segnala dove arriva e, se e' una secondaria o una
    // terziaria, da dove parte. Chi, con che ruolo e su che canale lo dice
    // ingressoMovimento, come per i conti: il canale e' quello del materiale (una
    // classe 9 si segnala sotto ACI anche se sta nell'archivio della rete) e una
    // secondaria arrivata a un piazzale si segnala sul piazzale. Le terziarie,
    // che partono verso le cementerie e non sono un movimento di canale, hanno il
    // gruppo TERZIARIE: lo decide formulariDaSistemare, non chi chiama.
    const segnaDate = (r, archivio) => {
      const d = dove(r, archivio);
      if (d.arrivo) daSistemare.segna(r, { tipo: d.tipo, canale: d.canale, ruolo: d.arrivo.ruolo, verso: 'arrivo', sito: d.arrivo.sito, controparte: d.tipo === 'secondaria' ? r.stoccaggio : daChi(r) });
      if (d.partenza) daSistemare.segna(r, { tipo: d.tipo, canale: d.canale, ruolo: d.partenza.ruolo, verso: 'partenza', sito: d.partenza.sito, controparte: r.destinazione });
    };
    for (const r of reteAll) segnaDate(r, 'PrimariaRete');
    for (const r of aciAll) segnaDate(r, 'PrimariaAci');
    for (const r of extraAll) segnaDate(r, 'ExtraRaccolta');
    for (const r of secAll) segnaDate(r, 'Secondaria');
    for (const r of terzAll) segnaDate(r, 'Terziaria');
    const datePerRiga = new Map(); // ns|td -> gruppi di quel soggetto, uno per canale piu' le terziarie
    for (const g of daSistemare.gruppi(portaleConosce)) {
      const k = g.chiave + '|' + g.ruolo;
      if (!datePerRiga.has(k)) datePerRiga.set(k, []);
      datePerRiga.get(k).push(g);
    }
    for (const gruppi of datePerRiga.values()) gruppi.sort((a, b) => ORDINE_GRUPPI.indexOf(a.canale) - ORDINE_GRUPPI.indexOf(b.canale));

    // === 2. DICHIARATO (DichiarazioneTrattamento, per ns|td) ===
    // IL DICHIARATO PER CANALE, DALLE NOSTRE RIGHE MENSILI.
    //
    // dichiaratoMap qui sotto viene dal report del portale e l'ACI lo scarta: a
    // portale l'ACI non e' gestito e l'extra raccolta non c'e' affatto. Per quei
    // due canali il dichiarato lo sa solo DichiarazioneSito, cioe' le righe che
    // l'amministratore segna a mano trascrivendo le dichiarazioni cartacee.
    //
    // E' la stessa sorgente che usa il modulo Dichiarazioni Impianti: i due moduli
    // devono dire gli stessi numeri su tutti e tre i canali (regola dell'utente,
    // 03/10/2026). Conta solo quello che e' segnato come caricato, come li'.
    //
    // La chiave e' soggetto|canale e il ruolo non c'entra: una dichiarazione e'
    // del soggetto. Chi la legge deve ricordarsene, perche' un soggetto che e'
    // impianto e piazzale ha due righe e la troverebbe su entrambe: va sulla riga
    // dell'impianto, che e' chi tratta.
    //
    // LETTE COME LE LEGGE IL RIEPILOGO, CON LA STESSA FUNZIONE (chiusura
    // dell'audit, 11/10/2026, C4). Qui si sommavano tutte le righe caricate dello
    // stesso soggetto e canale; il riepilogo le unisce mese per mese e di una
    // gemella di rete o di ACI tiene la prima. Con due ACI di aprile da 2 t, tutte
    // e due caricate, le Giacenze dicevano dichiarato 4 e giacenza 1, le
    // Dichiarazioni 2 e 3. Ora i due moduli chiamano leggiDichiarazioni
    // (shared/dichiarazioniImpianti.ts): la gemella resta un doppione da sistemare
    // - il riepilogo la elenca - ma non sposta piu' i numeri da una parte sola.
    // L'extra raccolta si somma, campagna per campagna, coi soli chili caricati.
    const dichiarazioniLette = leggiDichiarazioni(dichiarazioniSito, { anno: annoNum, chiaveDi: norm });
    const dichiaratoCanale = (ns, canale) => dichiarazioniLette.kgCaricati(ns, canale) / 1000; // t

    // Anno di competenza: quello della fine del trasporto dell'ordine, mai della
    // chiusura a portale. Solo rete: una riga ACI non entra.
    const dichiaratoMap = new Map();   // ns|td -> t (anno corrente)
    const derivatiMap = new Map();     // ns|td -> { granulo, fibre, metallo, cippato, ciabattato } (anno corrente)

    for (const d of dichiarazioni) {
      // Solo SMOCO partner operativo, come nel modulo Dichiarazioni: le righe di
      // Baucina con un nostro impianto come secondaria gonfiavano il dichiarato
      // del 2024 e del 2025 (revisione del 10/10/2026).
      if (!nostraRiga(d)) continue;
      if (eAci({ prodotto: d.prodotto })) continue;
      const { sito, td } = attribuisci(d);
      const ns = norm(sito);
      if (!ns) continue;
      const key = ns + '|' + td;
      const kg = Number(d.peso_associato_kg) || 0;
      const t = kg / 1000;

      if (inYear(d.fine_trasporto)) {
        dichiaratoMap.set(key, (dichiaratoMap.get(key) || 0) + t);
        if (!derivatiMap.has(key)) derivatiMap.set(key, { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 });
        const der = derivatiMap.get(key);
        der.granulo += (Number(d.granulo_kg) || 0) / 1000;
        der.fibre += (Number(d.fibre_kg) || 0) / 1000;
        der.metallo += (Number(d.metallo_kg) || 0) / 1000;
        der.cippato += (Number(d.cippato_kg) || 0) / 1000;
        der.ciabattato += (Number(d.ciabattato_kg) || 0) / 1000;
      }
    }

    // === 3. MOVIMENTAZIONE ANNO CORRENTE (per conferito, stato terminato + trasporto_finito_il nell'anno) ===
    // RETE, ACI ed EXTRA RACCOLTA sono canali indipendenti: il conferito di ciascuno
    // resta separato e il target Ecotyre del sito si misura solo sulla RETE.
    // UNA RIGA SENZA TIPO DI DESTINAZIONE NON SPARISCE DAI CONTI.
    //
    // Qui si scartava, e quei chili non comparivano in nessun conferito: non nel
    // riquadro, non nel residuo, e nemmeno nella giacenza, che dal conferito
    // dipende. Venti tonnellate arrivate a un impianto senza quel campo nel file
    // del portale facevano una giacenza di venti tonnellate piu' bassa del vero,
    // senza che niente lo dicesse (audit del 03/10/2026).
    //
    // Il resto di questo file, quando il tipo non si sa, lo tratta come impianto
    // e lo segnala (attribuisci, ingressoMovimento): qui si fa lo stesso. Meglio il
    // numero giusto con un avviso che un numero sbagliato in silenzio.
    //
    // IL CONFERITO E' DELLE SOLE PRIMARIE, su tutti e tre i canali (chiusura
    // dell'audit, 11/10/2026, R11). Chi riceve, con che ruolo e su che canale lo
    // dice ingressoMovimento, come per il resto del file. Per l'extra raccolta qui
    // entravano anche i trasferimenti da un piazzale (le secondarie di extra
    // raccolta): ogni PFU passato da un piazzale si contava due volte - una quando
    // e' stato raccolto, una quando si e' spostato - nella colonna «Extra», nel
    // totale e nel riquadro «Extra … t, fuori target». 3 t raccolte facevano 4,5
    // t, mentre la dashboard e la pagina Extra Raccolta dicevano 3. E' lo stesso
    // difetto del totale della rete chiuso il 10/10, rimasto sull'extra. Le
    // secondarie di extra hanno ora le loro colonne, come quelle ACI.
    const senzaTipo = new Map(); // ns -> { n, kg }
    const conferitoPer = (canale, ...fonti) => { // fonti: [records, archivio]
      const mappa = new Map(); // ns|ruolo -> t
      for (const [records, archivio] of fonti) {
        for (const r of records) {
          if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
          const d = dove(r, archivio);
          if (d.tipo !== 'primaria' || d.canale !== canale || !d.arrivo) continue;
          if (d.senza_tipo) {
            const s = senzaTipo.get(d.arrivo.chiave) || { n: 0, kg: 0 };
            s.n++;
            s.kg += Number(r.peso_effettivo) || 0;
            senzaTipo.set(d.arrivo.chiave, s);
          }
          const k = d.arrivo.chiave + '|' + d.arrivo.ruolo;
          mappa.set(k, (mappa.get(k) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
        }
      }
      return mappa;
    };
    // Il canale lo decide il MATERIALE, non l'archivio, anche qui: una primaria di
    // classe 9 che si trovasse nell'archivio della rete sta nel conferito ACI, non
    // in quello di rete. Altrimenti la stessa riga sarebbe ACI nella colonna della
    // giacenza e rete nella colonna Conferito, nel residuo e nella percentuale del
    // target - numeri su cui si decide quanto raccogliere - e la fatturazione, che
    // usa canaleMovimento, la fatturerebbe ACI. E' lo stesso difetto gia' corretto
    // qui sotto per le secondarie, che per le primarie era rimasto.
    const confPrimMap = conferitoPer('RETE', [reteAll, 'PrimariaRete']);
    const confAciMap = conferitoPer('ACI', [aciAll, 'PrimariaAci'], [reteAll, 'PrimariaRete']);
    const confExtraMap = conferitoPer('EXTRA_RACCOLTA', [extraAll, 'ExtraRaccolta']);
    for (const [ns, s] of senzaTipo) {
      anomalie.push({
        tipo: 'senza_tipo_destinazione',
        sito: nomiSito.get(ns) || ns,
        n: s.n,
        kg: Math.round(s.kg),
      });
    }

    // IL TARGET DI UN RACCOGLITORE SI RIPARTISCE SULLO STORICO (05/10/2026).
    //
    // Un raccoglitore non conferisce a un impianto solo, e in Target & Status non
    // si poteva scrivere piu' di un impianto per riga senza decidere a mano
    // quanto va a ciascuno: quei target restavano fuori da ogni sito. Qui si
    // guarda dove quel raccoglitore ha davvero portato le primarie di rete
    // dell'anno e si divide il suo target in proporzione ai chili - le righe con
    // l'impianto scritto a mano non si toccano (shared/targetImpianti.ts).
    //
    // Si ricalcola a ogni caricamento, come tutto il resto di questa funzione:
    // i conferimenti che arriveranno spostano le quote da soli.
    //
    // La regione si ricava dalla provincia del punto di raccolta, come fa il
    // raccolto che l'utente vede in Target & Status (PROV_TO_REGION in
    // raccoltoCalculator): le righe del target sono per raccoglitore e regione, e
    // due modi diversi di dire la regione non si incontrerebbero mai.
    //
    // LE RIGHE SU CUI SI RIPARTISCE SONO QUELLE DELLA PREDITTIVITA' (revisione
    // della chiusura dell'audit, 11/10/2026): conferitiPerRipartizione, in
    // shared/targetImpianti.ts. Qui c'era un ciclo con le stesse regole - rete,
    // terminate, fine trasporto nell'anno, regione dalla provincia, il mese della
    // fine trasporto - scritto una seconda volta; e lo stesso target deve dare lo
    // stesso sito nei due moduli (prove/stessoTargetStessoSito.mjs).
    const conferitiRaccoglitori = conferitiPerRipartizione(reteAll, annoNum);
    const ripartite = ripartisciTargetPrimarie({
      raccoglitori: targetRaccoglitori, mensili: targetMensili, conferiti: conferitiRaccoglitori,
      anno: annoNum, chiave: norm,
    });

    // Le secondarie di rete e quelle ACI viaggiano nello stesso archivio e si
    // distinguono dalla classe. Vanno tenute separate: la colonna "Conferito
    // RETE" sommava anche le secondarie ACI, e su un impianto che riceve
    // entrambe il numero era piu' alto del vero.
    // L'INGRESSO SI SEGNA SUL RUOLO CHE RICEVE, NON SOLO SUL SITO.
    //
    // Una secondaria puo' finire al piazzale di un sito invece che al suo
    // impianto: la destinazione e' la stessa ditta, ma il tipo di destinazione
    // dice 'stoc'. Indicizzando per solo nome, quei chili arrivavano anche alla
    // riga impianto - e li' entrano nella giacenza ACI e nel conferito - mentre
    // il materiale era gia' contato nella giacenza del piazzale, dove sta
    // davvero. Su Irigom, che e' insieme impianto e piazzale, lo stesso viaggio
    // si contava due volte (audit del 03/10/2026).
    //
    // Adesso la chiave degli ingressi porta il ruolo di chi riceve, come gia'
    // faceva il resto del file. Le uscite restano per nome: una secondaria parte
    // sempre da un piazzale. Ruolo, canale e partenza li dice ingressoMovimento,
    // la stessa risposta del modulo Dichiarazioni (11/10/2026, C2 e C9).
    //
    // Le secondarie di EXTRA RACCOLTA hanno le loro due colonne, come l'ACI
    // (11/10/2026, R11): fuori dal conferito, che e' raccolta, e dentro la
    // giacenza extra dell'impianto che le riceve, che quindi non cambia.
    const secInMap = new Map();       // ns|ruolo -> t di rete in ingresso
    const secOutMap = new Map();      // ns -> t di rete in uscita
    const secAciInMap = new Map();    // ns|ruolo -> t ACI in ingresso
    const secAciOutMap = new Map();   // ns -> t ACI in uscita
    const secExtraInMap = new Map();  // ns|ruolo -> t di extra raccolta in ingresso
    const secExtraOutMap = new Map(); // ns -> t di extra raccolta in uscita
    const mappeSecondarie = { RETE: [secInMap, secOutMap], ACI: [secAciInMap, secAciOutMap], EXTRA_RACCOLTA: [secExtraInMap, secExtraOutMap] };
    const contaSecondaria = (r, archivio) => {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) return;
      const d = dove(r, archivio);
      if (d.tipo !== 'secondaria') return;
      const t = (Number(r.peso_effettivo) || 0) / 1000;
      const [mIn, mOut] = mappeSecondarie[d.canale];
      if (d.arrivo) { const k = d.arrivo.chiave + '|' + d.arrivo.ruolo; mIn.set(k, (mIn.get(k) || 0) + t); }
      if (d.partenza) mOut.set(d.partenza.chiave, (mOut.get(d.partenza.chiave) || 0) + t);
    };
    for (const r of secAll) contaSecondaria(r, 'Secondaria');
    for (const r of extraAll) contaSecondaria(r, 'ExtraRaccolta');

    const terzMap = new Map(); // ns -> t
    for (const r of terzAll) {
      if (!isTerminato(r) || !inYear(r.trasporto_finito_il)) continue;
      const d = dove(r, 'Terziaria');
      if (!d.partenza) continue;
      terzMap.set(d.partenza.chiave, (terzMap.get(d.partenza.chiave) || 0) + (Number(r.peso_effettivo) || 0) / 1000);
    }

    // === 3b. GIACENZASITO (serve per risolvere il td delle terziarie) ===
    const giacMap = new Map(); // ns|td -> record
    for (const g of giacenzeSito) {
      giacMap.set(norm(g.sito) + '|' + tdNorm(g.tipo_destinazione), g);
    }
    const giacMapKeys = new Set(giacMap.keys());

    // === 5. UNIONE DEI SITI (tutte le chiavi sono ns|td) ===
    const rowKeys = new Set();

    for (const k of giacMapKeys) rowKeys.add(k);
    for (const r of impiantiConTarget) rowKeys.add(norm(r.nome_impianto) + '|imp');
    for (const k of giacPortaleMap.keys()) rowKeys.add(k);
    for (const k of aggiuntiMap.keys()) rowKeys.add(k);
    // Un soggetto con un terminato da sistemare compare, anche se e' l'unica cosa che ha.
    for (const k of datePerRiga.keys()) rowKeys.add(k);
    for (const ns of stocRilevMap.keys()) rowKeys.add(ns + '|stoc');
    for (const k of dichiaratoMap.keys()) rowKeys.add(k);
    for (const k of confPrimMap.keys()) rowKeys.add(k);
    // Anche chi ha ricevuto solo ACI o solo extra raccolta: senza la sua riga
    // quei chili non entravano nel totale, che deve fare la raccolta dell'anno
    // come la dashboard e la pagina Extra Raccolta (11/10/2026, R11).
    for (const k of confAciMap.keys()) rowKeys.add(k);
    for (const k of confExtraMap.keys()) rowKeys.add(k);
    // Per le mappe per-ns dell'anno corrente (secOutMap, terzMap): risolvi il td
    function resolveTds(ns) {
      const tds = [...giacMapKeys].filter(k => k.startsWith(ns + '|')).map(k => k.split('|')[1]);
      return tds.length > 0 ? tds : ['imp'];
    }
    // Gli ingressi delle secondarie hanno gia' la chiave completa: il ruolo lo
    // dice il tipo di destinazione del viaggio, non c'e' niente da risolvere.
    for (const k of secInMap.keys()) rowKeys.add(k);
    for (const k of secAciInMap.keys()) rowKeys.add(k);
    for (const k of secExtraInMap.keys()) rowKeys.add(k);
    for (const ns of secOutMap.keys()) {
      // secondarie_out riguarda lo stoccaggio
      const tds = resolveTds(ns);
      if (tds.includes('stoc')) rowKeys.add(ns + '|stoc');
      else rowKeys.add(ns + '|stoc');
    }
    // Lo stesso per chi spedisce solo ACI o solo extra raccolta (11/10/2026): nelle
    // Dichiarazioni quel piazzale c'e', con le sue partenze.
    for (const ns of [...secAciOutMap.keys(), ...secExtraOutMap.keys()]) rowKeys.add(ns + '|stoc');
    for (const ns of terzMap.keys()) {
      for (const td of resolveTds(ns)) rowKeys.add(ns + '|' + td);
    }

    // === 6. COSTRUZIONE RIGHE ===
    const righe = [];
    const sitiSenzaTarget = new Set();

    // Anomalie: ordini senza riscontro nella mappa
    for (const ord of ordiniSenzaRiscontro) {
      anomalie.push({ tipo: 'ordine_senza_riscontro', ordine: ord });
    }

    for (const key of rowKeys) {
      const [ns, td] = key.split('|');
      const g = giacMap.get(key);

      // Il nome scelto nel target ha la precedenza: e' una decisione esplicita.
      // Solo in sua assenza si usa la forma del portale, e la chiave normalizzata
      // resta l'ultima spiaggia.
      let sitoNome = g?.sito || nomiSito.get(ns) || ns;

      // Gli ordini del file del portale, piu' i carichi che il file non contiene ancora.
      const ordini_da_dichiarare = (ordiniMap.get(key) || 0) + (td === 'imp' && aggiuntiMap.has(key) ? aggiuntiMap.get(key).n : 0);
      const arretrato_per_anno = arretratoAnniMap.get(key) || {};

      // Giacenza a portale, un canale per volta. Per gli impianti e' la rete: la
      // fotografia degli ordini non dichiarati aggiornata ai caricamenti. Per gli
      // stoccaggi la rilevazione per classe aggiornata con i movimenti: la rete e
      // l'ACI si tengono separate, e l'extra raccolta (che a portale non c'e') a parte.
      let giacenza_portale_t;
      let giacenza_rete_t = null;
      let giacenza_aci_t = null;
      let giacenza_extra_t = null;
      let data_rilevazione = null;
      let rilevazione_obsoleta = null;
      let in_attesa_dichiarazione_t = 0;
      let senzaRilevazione = false;
      let giacenza_classi_kg = null;
      let rilevazione_classi_kg = null;
      let dopo_rilevazione = null;
      let aggiornata_al = null;
      let fotografia = null;
      // I due conti che sorvegliano la rilevazione (23/09/2026): valgono solo per
      // i piazzali, perche' solo loro partono da una lettura del portale.
      let verifica_rilevazione = null;
      let saldo_movimenti_archivio = null;
      // La riconciliazione del piazzale: l'estratto conto, lo storico delle
      // letture, com'e' adesso e se conviene rileggere (23/09/2026).
      let riconciliazione = null;
      // Gli ordini che compongono la giacenza ACI del piazzale, uno per uno
      // (richiesta dell'utente, 28/09/2026): si apre il numero della colonna e
      // si vede da dove viene, ticket compreso.
      let aci_dettaglio = null;
      // Perche' la giacenza di rete non c'e', quando non c'e': la pagina lo dice al
      // posto del numero (chiusura dell'audit, 11/10/2026, C5b e C15).
      let perche_senza_giacenza = null;
      // E il perche' degli altri canali, dove non e' quello di sempre della
      // colonna: un anno prima del gestionale, un piazzale di un anno chiuso
      // senza una lettura che lo apra (decisioni dell'utente del 13/10/2026).
      let perche_canali = null;

      if (td === 'stoc') {
        // in_attesa_dichiarazione_t: primarie arrivate allo stoccaggio che il file del
        // portale considera ancora in piazzale, non ancora abbinate a una secondaria.
        // Su un anno che non e' quello in corso, solo quelle arrivate in quell'anno.
        in_attesa_dichiarazione_t = inAttesaMap.get(ns) || 0;
        giacenza_extra_t = extraStoc.has(ns) ? extraStoc.get(ns) : null;

        // La somma dei soli movimenti in archivio: non e' una giacenza, vale dal
        // primo movimento caricato e si mostra accanto a quella vera per vedere
        // quanto manca all'appello e da quando. Non dipende dalla rilevazione.
        const suoiMovimenti = movArchivio.get(ns) || [];
        saldo_movimenti_archivio = saldoMovimentiInArchivio(suoiMovimenti);

        // La riconciliazione, il lavoro che il 22 e il 23 settembre si e' fatto
        // a mano su Nappi Sud: da dove viene la giacenza di adesso, che verdetto
        // ha avuto ogni lettura del portale - non solo l'ultima - come sta il
        // piazzale e quando conviene rileggere. Si fa anche senza rilevazione:
        // dire che manca il punto di partenza e' una risposta, non un vuoto.
        riconciliazione = riconciliazionePiazzale(rilevPerStoc.get(ns) || [], suoiMovimenti, { oggi });

        const rilev = stocRilevMap.get(ns);
        const partenza = partenzaMap.get(ns);
        // UN PIAZZALE DI UN ANNO CHIUSO SENZA UNA LETTURA CHE LO APRA (decisioni
        // dell'utente del 13/10/2026: gli anni passati con lo stesso numero nei due
        // moduli). Le Dichiarazioni, dalla revisione finale dell'11/10/2026, non
        // gli danno una giacenza («In piazzale» —, PERCHE_PIAZZALE_SENZA_INIZIO);
        // qui si scriveva il piazzale di oggi. Sul 2025 dei dati veri Nappi Sud
        // diceva 25,88 t qui e «—» nelle Dichiarazioni. Ora la stessa regola.
        const senzaInizio = !!(rilev && partenza) && annoTargetChiuso && !ancoraPropria(ns);
        if (senzaInizio) {
          giacenza_portale_t = null;
          data_rilevazione = rilev.dataStr;
          perche_senza_giacenza = PERCHE_PIAZZALE_SENZA_INIZIO(annoNum);
          perche_canali = { ACI: PERCHE_PIAZZALE_SENZA_INIZIO(annoNum) };
        } else if (rilev && partenza) {
          // Le classi da cui parte il numero sono quelle dell'ancora dell'anno.
          rilevazione_classi_kg = {
            P: Number(partenza.record.class1_kg) || 0, M: Number(partenza.record.class2_kg) || 0, G1: Number(partenza.record.class3_kg) || 0,
            G2: Number(partenza.record.class4_kg) || 0, ACI: Number(partenza.record.class9_kg) || 0, ND: 0,
          };
          const mov = movStoc.get(ns);
          // Le classi di rete si muovono solo con la rete, la classe 9 solo con l'ACI.
          giacenza_classi_kg = Object.fromEntries(Object.keys(rilevazione_classi_kg).map(c => {
            const saldo = c === 'ACI' ? mov.ACI : mov.RETE;
            return [c, rilevazione_classi_kg[c] + saldo.ingressi[c] - saldo.uscite[c]];
          }));
          const kgDi = (classi, soloAci) => Object.entries(classi).reduce((s, [c, v]) => s + ((c === 'ACI') === soloAci ? v : 0), 0);
          dopo_rilevazione = {
            // dal: l'ancora da cui parte il numero; ultima_lettura: il riscontro.
            dal: partenza.dataStr,
            ultima_lettura: rilev.dataStr,
            rete: { ingressi: mov.RETE.nIngressi, ingressi_kg: kgDi(mov.RETE.ingressi, false), uscite: mov.RETE.nUscite, uscite_kg: kgDi(mov.RETE.uscite, false) },
            aci: { ingressi: mov.ACI.nIngressi, ingressi_kg: kgDi(mov.ACI.ingressi, true), uscite: mov.ACI.nUscite, uscite_kg: kgDi(mov.ACI.uscite, true) },
          };
          aggiornata_al = datiAggiornatiAl || null;
          giacenza_rete_t = kgDi(giacenza_classi_kg, false) / 1000;
          giacenza_aci_t = giacenza_classi_kg.ACI / 1000;
          // Gli ordini dietro la colonna ACI: l'ancora per la classe 9 piu' i
          // movimenti ACI finiti dopo, uno per uno. Il totale si confronta con
          // la colonna e, se non torna, lo scarto si dice: non si aggiusta.
          aci_dettaglio = ordiniDellaGiacenza(suoiMovimenti, {
            canale: 'ACI',
            ancora_del: partenza.dataStr,
            ancora_kg: rilevazione_classi_kg.ACI,
            colonna_kg: giacenza_classi_kg.ACI,
          });
          // La colonna della giacenza a portale e' della rete: l'ACI sta nella sua colonna.
          giacenza_portale_t = giacenza_rete_t;
          data_rilevazione = rilev.dataStr;
          for (const c of CLASSI) {
            if (giacenza_classi_kg[c] < 0) anomalie.push({ tipo: 'giacenza_negativa', sito: nomiSito.get(ns) || ns, classe: c, kg: giacenza_classi_kg[c] });
          }
          const trentaGiorniFa = giornoRoma(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
          rilevazione_obsoleta = rilev.dataStr < trentaGiorniFa;
          // Il controllo della rilevazione: che cosa ci si aspettava di leggere,
          // partendo dalla precedente e contando i movimenti fra le due date, e
          // anche partendo dall'ancora dell'anno - altrimenti una lettura giusta
          // presa dopo una sbagliata risulta storta lei (23/09/2026).
          const storico = rilevPerStoc.get(ns) || [];
          const precedente = storico.length > 1 ? storico[storico.length - 2] : null;
          const ancora = ancoraDellAnno(storico, annoDellaLettura(rilev.dataStr));
          const iAncora = ancora ? storico.indexOf(ancora) : -1;
          const intermedie = iAncora >= 0 ? storico.slice(iAncora + 1, storico.length - 1) : [];
          verifica_rilevazione = verificaRilevazione(rilev.record, precedente, suoiMovimenti, { ancora, intermedie });
        } else {
          // UN PIAZZALE SENZA NESSUNA LETTURA NON HA UNA GIACENZA (chiusura
          // dell'audit, 11/10/2026, C15). Qui c'era 0, cioe' «piazzale vuoto»,
          // accanto a un testo che diceva «non vuol dire zero» e che non si vedeva
          // mai, perche' lo si mostra solo al posto di un numero che manca. Il
          // modulo Dichiarazioni diceva l'apertura scritta piu' il saldo dell'anno:
          // tre risposte alla stessa domanda. La giacenza di un piazzale parte da
          // una lettura (regola della direzione, 24/09/2026): senza, null in tutti e
          // due i moduli, col perche' (shared/giacenzaStoccaggi.ts).
          giacenza_portale_t = null;
          perche_senza_giacenza = PERCHE_PIAZZALE_SENZA_LETTURA;
          // L'anomalia si segnala solo se la riga sopravvive al filtro di
          // attivita' piu' sotto: non ha senso lamentare una rilevazione mancante
          // per un sito che nell'anno non e' nemmeno operativo.
          senzaRilevazione = true;
        }
      } else if (primaDelGestionale) {
        // UN ANNO PRIMA DEL GESTIONALE (decisioni dell'utente del 13/10/2026). Qui si
        // scriveva il portale di oggi (Irigom 652,84 t sul 2025 e sul 2024), nelle
        // Dichiarazioni tutto quello che era arrivato (4.439,08 t): due numeri per una
        // giacenza che non si puo' ricostruire. «—» in tutti e due, col perche'.
        giacenza_portale_t = null;
        perche_senza_giacenza = PERCHE_ANNO_PRIMA_DEL_GESTIONALE(annoNum);
        perche_canali = { ACI: perche_senza_giacenza, EXTRA_RACCOLTA: perche_senza_giacenza };
      } else if (annoTargetChiuso) {
        // UN ANNO CHIUSO: LA LETTURA DEL 31/12, NON IL PORTALE DI OGGI (decisioni
        // dell'utente del 13/10/2026). E' il numero a portale che le Dichiarazioni
        // usano per quell'anno (letturaDelTrentuno, la stessa funzione): la
        // lettura salvata dalla chiusura, al netto delle dichiarazioni dell'anno
        // caricate dopo. Qui si scriveva la fotografia di oggi su qualunque anno.
        // Senza la lettura «—» col perche'; chi la rete non la dichiara resta «—»
        // col suo. Le classi della fotografia di oggi non sono di quel giorno.
        const lettura = nonDichiaraRete.has(ns) ? null : letturaDelTrentuno(giacenzeAnnoDopo, { chiave: ns, canale: 'RETE', anno: annoNum, dichiarazioni: dichiarazioniSito, chiaveDi: norm });
        giacenza_portale_t = lettura ? lettura.netta_t : null;
        giacenza_rete_t = giacenza_portale_t;
        fotografia = { del: lettura ? fineAnnoChiuso : null, lettura_del_trentuno: true, foto_t: lettura ? lettura.letta_t : 0, aggiunti: 0, aggiunti_t: 0, dichiarato_dopo_t: lettura ? lettura.dichiarato_dopo_t : 0, rete_non_dichiarata: nonDichiaraRete.has(ns) };
        if (!lettura && !nonDichiaraRete.has(ns)) perche_senza_giacenza = PERCHE_SENZA_LETTURA_DEL_TRENTUNO(annoNum);
        aggiornata_al = lettura ? fineAnnoChiuso : null;
      } else {
        const fotoKg = (giacPortaleMap.get(key) || 0) * 1000;
        const agg = aggiuntiMap.get(key) || { kg: 0, classi: classiVuote(), n: 0 };
        const dopoKg = dichiaratoDopoMap.get(ns) || 0;
        // UNA GIACENZA NEGATIVA NON SI NASCONDE: E' UN ERRORE DA CORREGGERE.
        //
        // Qui c'era un Math.max(0, ...). Regola dell'utente, 03/10/2026: «come puo'
        // essere negativa una giacenza? succede solo in caso di errore e deve essere
        // corretto». Appunto: azzerandola, l'errore spariva dalla vista e restava nei
        // dati. E il modulo Dichiarazioni il taglio non lo faceva, quindi gli stessi
        // chili uscivano 0 in un modulo e negativi nell'altro - due moduli che devono
        // dire gli stessi numeri.
        //
        // Succede quando il portale ha accettato piu' di quanto il gestionale gli
        // attribuisce: una dichiarazione caricata su ordini che noi non abbiamo, o una
        // fotografia vecchia. Si mostra com'e' e si segnala.
        const totaleKg = fotoKg + agg.kg - dopoKg;
        giacenza_portale_t = totaleKg / 1000;
        giacenza_rete_t = giacenza_portale_t;
        // Per classe: fotografia e carichi aggiunti; le dichiarazioni caricate dopo,
        // che il portale scala dai carichi piu' vecchi senza dire di che classe,
        // si tolgono in proporzione.
        const lordo = classiVuote();
        const fotoClassi = classiImpiantoMap.get(key) || classiVuote();
        for (const c of Object.keys(lordo)) lordo[c] = fotoClassi[c] + agg.classi[c];
        const somma = Object.values(lordo).reduce((s, v) => s + v, 0);
        const fattore = somma > 0 ? totaleKg / somma : 0;
        giacenza_classi_kg = Object.fromEntries(Object.entries(lordo).map(([c, v]) => [c, v * fattore]));
        fotografia = { del: giornoFoto || null, foto_t: fotoKg / 1000, aggiunti: agg.n, aggiunti_t: agg.kg / 1000, dichiarato_dopo_t: dopoKg / 1000, rete_non_dichiarata: nonDichiaraRete.has(ns) };
        // LA RETE DI CHI NON LA DICHIARA NON HA UNA GIACENZA (utente, 10/10/2026:
        // «“—” con la spiegazione, in tutti e due i moduli»). Qui diceva 0, che si
        // legge «impianto vuoto»; le Dichiarazioni dicevano 1.833,43 t, cioe' tutto
        // quello che e' arrivato. Nessuno dei due e' vero: per accordo il
        // trattamento non e' a nostro carico e il portale non tiene per noi una
        // giacenza di rete. Si scrive null, e la cella dice perche'.
        if (nonDichiaraRete.has(ns)) { giacenza_portale_t = null; giacenza_rete_t = null; giacenza_classi_kg = null; }
        // SENZA IL FILE DEL PORTALE LA GIACENZA DI RETE NON C'E' (chiusura
        // dell'audit, 11/10/2026, C5b). Senza nessuna fotografia qui si faceva
        // 0 + 0 - 0 e si scriveva 0, cioe' «impianto vuoto»; il modulo
        // Dichiarazioni dice «—». Succede solo con l'archivio degli ordini non
        // dichiarati vuoto, e allora non e' vuoto l'impianto: manca il dato.
        // Per chi la rete non la dichiara il perche' e' quello, qui sopra.
        if (!giornoFoto && !nonDichiaraRete.has(ns)) { giacenza_portale_t = null; giacenza_rete_t = null; giacenza_classi_kg = null; perche_senza_giacenza = PERCHE_SENZA_FOTOGRAFIA; }
        aggiornata_al = datiAggiornatiAl || giornoFoto || null;
      }

      const dichiarato_t = dichiaratoMap.get(key) || 0;
      const der = derivatiMap.get(key) || { granulo: 0, fibre: 0, metallo: 0, cippato: 0, ciabattato: 0 };

      // Il conferito di ogni canale e' delle sole primarie: e' quello che e' stato
      // raccolto e portato qui. Le secondarie hanno le loro colonne.
      const conferito_primarie_t = confPrimMap.get(key) || 0;
      const conferito_aci_t = confAciMap.get(key) || 0;
      const conferito_extra_t = confExtraMap.get(key) || 0;

      // Una secondaria va da uno stoccaggio a un impianto: l'ingresso riguarda
      // l'impianto che riceve, l'uscita lo stoccaggio che spedisce. I flussi sono
      // indicizzati per sito e non per ruolo, quindi attribuirli senza distinguere
      // faceva contare lo stesso viaggio due volte su chi, come Irigom, e' insieme
      // impianto e stoccaggio. Le terziarie, uscite verso le cementerie, partono
      // sempre da un impianto.
      // Gli ingressi sono gia' divisi per ruolo di chi riceve: una secondaria
      // finita al piazzale sta sulla riga del piazzale e non su quella
      // dell'impianto, dove il materiale non e' mai arrivato.
      const secondarie_in_t = secInMap.get(key) || 0;
      const secondarie_out_t = td === 'stoc' ? (secOutMap.get(ns) || 0) : 0;
      // Le secondarie ACI restano a parte: non entrano nel conferito di rete.
      const secondarie_aci_in_t = secAciInMap.get(key) || 0;
      const secondarie_aci_out_t = td === 'stoc' ? (secAciOutMap.get(ns) || 0) : 0;
      // E quelle di extra raccolta, allo stesso modo (11/10/2026, R11).
      const secondarie_extra_in_t = secExtraInMap.get(key) || 0;
      const secondarie_extra_out_t = td === 'stoc' ? (secExtraOutMap.get(ns) || 0) : 0;
      const secondarie_nette_t = secondarie_in_t - secondarie_out_t;
      const terziarie_t = td === 'imp' ? (terzMap.get(ns) || 0) : 0;

      // LA GIACENZA DI ACI ED EXTRA RACCOLTA, anche per gli impianti.
      //
      // Prima restavano vuote: la colonna ACI di un impianto diceva 0, che non
      // voleva dire zero, voleva dire "non calcolata", e l'extra raccolta non
      // compariva affatto. «Anche ACI ed extra raccolta devono essere indicati nei
      // due moduli affinche' tutto sia a vista e si possa procedere con le
      // dichiarazioni e il decurtamento dalle giacenze» (utente, 03/10/2026).
      //
      // Stessa formula del modulo Dichiarazioni, perche' i due devono coincidere:
      // apertura + entrato - dichiarato. Per l'ACI entra la primaria e la
      // secondaria che arriva; l'apertura e' giacenza_riferimento_aci_t. Per l'extra
      // raccolta l'apertura non esiste - GiacenzaSito ha due campi, non tre - e si
      // parte da zero.
      //
      // Un negativo non si azzera: e' un errore da correggere e si deve vedere.
      // Un anno prima del gestionale non ha ne' l'apertura ne' le dichiarazioni:
      // anche ACI ed extra raccolta sono «—» col perche', come nelle Dichiarazioni
      // (decisioni dell'utente del 13/10/2026; sul 2025 erano tutto l'arrivato).
      if (td === 'imp' && primaDelGestionale) {
        giacenza_aci_t = null;
        giacenza_extra_t = null;
      } else if (td === 'imp') {
        // Al netto delle dichiarazioni dell'anno chiuso caricate dopo la lettura del
        // 31/12 (aperturaNetta, 10/10/2026): lo stesso conto del modulo Dichiarazioni.
        const aperturaAci = g ? aperturaNetta(g, 'ACI', dichiarazioniSito, norm).netta_t : 0;
        giacenza_aci_t = aperturaAci + conferito_aci_t + secondarie_aci_in_t - dichiaratoCanale(ns, 'ACI');
        // Le secondarie di extra arrivate qui entrano nella giacenza come quelle
        // ACI: fuori dal conferito, la giacenza resta quella di prima.
        giacenza_extra_t = conferito_extra_t + secondarie_extra_in_t - dichiaratoCanale(ns, 'EXTRA_RACCOLTA');
      }

      // Conferito e' cio' che il sito ha ricevuto. Le uscite non sono
      // conferimenti: sommarle agli ingressi contava ogni secondaria due volte.
      const conferito_t = conferito_primarie_t + secondarie_in_t;

      // I target vengono da Target & Status (shared/targetImpianti.ts). Il target
      // delle primarie dei raccoglitori che non dicono il ruolo e' del sito, non
      // del ruolo: per chi e' impianto e stoccaggio va sulla riga dell'impianto,
      // perche' il totale non lo conti due volte. Le quote ripartite sullo
      // storico il ruolo ce l'hanno, perche' lo dice il viaggio.
      const tgt = targetRigaGiacenze({
        sito: sitoNome, td, anno: annoNum, giacenzaSito: g,
        impiantiTarget, raccoglitori: targetRaccoglitori,
        primarieQui: td === 'imp' || !rowKeys.has(ns + '|imp'),
        // Se di questo sito c'e' una riga sola, quella prende anche i target
        // scritti per l'altro ruolo: nessun target deve restare senza casa.
        soloRuolo: !rowKeys.has(ns + '|' + (td === 'imp' ? 'stoc' : 'imp')),
        ripartite,
        chiave: norm,
      });
      const target_primarie_t = tgt.target_primarie_t;
      const target_totale_t = tgt.target_totale_t;
      // L'apertura di rete mostrata e' anche lei al netto (aperturaNetta): la colonna
      // deve dire lo stesso numero che il modulo Dichiarazioni usa come apertura.
      // Per un piazzale con almeno una lettura e' l'ancora portata al 31/12
      // (aperturaPiazzale): il campo scritto conta solo per chi letture non ne ha.
      const aperturaRete = g ? aperturaNetta(g, 'RETE', dichiarazioniSito, norm) : null;
      const aperturaLetta = td === 'stoc' ? aperturaPiazzale(ns, 'RETE') : null;
      const giacenza_riferimento_t = aperturaLetta !== null ? aperturaLetta : aperturaRete ? aperturaRete.netta_t : 0;
      const tipologia_trattamento = g?.tipologia_trattamento || '';

      // RESIDUO E COPERTURA RISPONDONO A DUE DOMANDE DIVERSE, e per questo si
      // calcolano su due basi diverse. Sono affiancate nella stessa tabella: la
      // nota sotto la tabella lo dice, altrimenti sembrano due versioni dello
      // stesso numero che non tornano.
      //
      // RESIDUO: quanto manca perche' a quel sito arrivi il suo target. Il target
      // totale di un impianto comprende gia' cio' che gli arriva in secondaria dai
      // piazzali (Irigom 4.445 t contro 3.400 t di sole primarie), quindi si
      // sottrae tutto quello che e' ARRIVATO - primarie piu' secondarie in
      // ingresso, cioe' conferito_t. Sottraendo le sole primarie il residuo usciva
      // piu' alto del vero: per Irigom 1.798,70 t invece di 1.067,04 t (decisione
      // dell'utente, 29/09/2026).
      const residuo_t = target_totale_t > 0 ? target_totale_t - conferito_t : null;
      // COPERTURA: quanto del target di RACCOLTA Ecotyre e' stato raccolto, e la
      // raccolta sono le primarie. Le secondarie sono materiale gia' raccolto che
      // si sposta da uno stoccaggio a un impianto: contarle qui farebbe contare due
      // volte lo stesso pneumatico, una quando si raccoglie e una quando si
      // trasferisce. Percio' questa resta sulle primarie.
      const percentuale_target = target_totale_t > 0 ? (conferito_primarie_t / target_totale_t) * 100 : null;

      // Un impianto senza target compare solo se nell'anno ha davvero qualcosa:
      // giacenza, arretrato di dichiarazione o movimentazione. Un impianto non
      // piu' contrattualizzato esce cosi' da solo dall'anno in corso, senza
      // bisogno di elenchi di esclusione da tenere aggiornati, e rientra da solo
      // se torna operativo.
      //
      // Gli stoccaggi seguono un'altra regola e non vengono mai nascosti: per loro
      // una rilevazione a zero non e' assenza di dati ma un'informazione, vuol dire
      // piazzale verificato e vuoto. Uno stoccaggio che non deve comparire va tolto
      // dall'elenco delle unita' locali, non dedotto dai numeri.
      // Le terziarie non contano: sono uscite di materiale gia' trasformato verso
      // le cementerie e non dicono nulla sulla giacenza di PFU. Un impianto uscito
      // dal contratto continua per qualche mese a spedire cio' che aveva in
      // piazzale, e quelle spedizioni lo tenevano in tabella con tutte le colonne
      // a zero.
      // I terminati con le date da sistemare di questo soggetto, un canale per volta.
      const dateRiga = datePerRiga.get(key) || [];
      // Le secondarie di extra raccolta sono uscite dal conferito: chi riceve solo
      // quelle resta in tabella come prima. E chi riceve solo secondarie ACI c'e'
      // anche lui, come nelle Dichiarazioni (11/10/2026).
      const haAttivita = giacenza_portale_t > 0 || in_attesa_dichiarazione_t > 0
        || ordini_da_dichiarare > 0 || dichiarato_t > 0 || conferito_t > 0 || conferito_aci_t > 0 || conferito_extra_t > 0
        || secondarie_aci_in_t > 0 || secondarie_extra_in_t > 0 || dateRiga.length > 0;
      if (!g && td === 'imp' && !haAttivita && !(target_totale_t > 0) && !(target_primarie_t > 0)) continue;

      if (senzaRilevazione) anomalie.push({ tipo: 'stoccaggio_senza_rilevazione', sito: sitoNome });
      // Una lettura che non torna con l'ancora dell'anno piu' i movimenti si
      // segnala subito. Una che si scosta solo dalla precedente, ma con l'ancora
      // torna, e' giusta: non e' un'anomalia (NAPPI SUD, 23/09/2026).
      const daControllare = anomaliaRilevazione(verifica_rilevazione);
      if (daControllare) anomalie.push({ tipo: 'rilevazione_da_controllare', sito: sitoNome, ...daControllare });

      // L'ATTESA CHE PER NOI E' UN GIRO CHIUSO (decisioni dell'utente del
      // 13/10/2026). Le 181,299 t che il portale attribuisce ancora allo
      // stoccaggio di T-Cycle sono partite tutte verso Tecnogum, che sulla rete
      // non dichiara a SMOCO: il numero resta quello del portale, e la riga lo
      // dice per quello che e', non come un'attesa da risolvere. La regola e'
      // attesaChiusaPerNoi, la stessa del riepilogo.
      const attesaChiusa = td === 'stoc' ? attesaChiusaPerNoi({
        attesaT: r2(in_attesa_dichiarazione_t), primoArrivo: primoInAttesa.get(ns) || '', senzaGiorno: inAttesaSenzaGiorno.has(ns),
        partenze: partenzeStoc.di(ns), nonDichiarano: nonDichiaranoNomi, inPiazzaleT: giacenza_rete_t === null ? null : r2(giacenza_rete_t),
      }) : null;

      righe.push({
        sito: sitoNome,
        tipo_destinazione: td,
        // null resta null: la rete di chi non la dichiara non ha una giacenza, e r2(null)
        // la faceva diventare 0, cioe' «impianto vuoto» (10/10/2026).
        giacenza_portale_t: giacenza_portale_t === null ? null : r2(giacenza_portale_t),
        // Una giacenza sotto zero non esiste: e' un errore, e va corretta. Si dice
        // qui, cosi' la pagina la puo' mostrare come tale invece di stamparla e
        // basta (regola dell'utente, 03/10/2026).
        giacenza_negativa: giacenza_portale_t !== null && giacenza_portale_t < 0,
        giacenza_rete_t: giacenza_rete_t !== null ? r2(giacenza_rete_t) : null,
        rete_non_dovuta: td === 'imp' && nonDichiaraRete.has(ns),
        giacenza_aci_t: giacenza_aci_t !== null ? r2(giacenza_aci_t) : null,
        giacenza_extra_t: giacenza_extra_t !== null ? r2(giacenza_extra_t) : null,
        // Perche' la giacenza di rete e' null: il file del portale mai caricato
        // (impianto) o nessuna rilevazione (piazzale). Per chi la rete non la
        // dichiara il perche' lo dice rete_non_dovuta.
        perche_senza_giacenza,
        // Il perche' di ACI ed extra raccolta quando non e' quello della colonna
        // (un anno prima del gestionale, un piazzale senza lettura che apra l'anno).
        ...(perche_canali ? { perche_canali } : {}),
        fotografia: fotografia && { ...fotografia, foto_t: r2(fotografia.foto_t), aggiunti_t: r2(fotografia.aggiunti_t), dichiarato_dopo_t: r2(fotografia.dichiarato_dopo_t) },
        giacenza_classi_kg: giacenza_classi_kg ? Object.fromEntries(Object.entries(giacenza_classi_kg).map(([c, v]) => [c, Math.round(v)])) : null,
        rilevazione_classi_kg,
        dopo_rilevazione,
        // Il controllo della rilevazione e la somma dei soli movimenti in
        // archivio: due termini di confronto, non due giacenze.
        verifica_rilevazione,
        saldo_movimenti_archivio,
        // La riconciliazione del piazzale, canale per canale.
        riconciliazione,
        // Gli ordini che fanno la colonna ACI di un piazzale, uno per uno.
        aci_dettaglio,
        aggiornata_al,
        data_rilevazione,
        rilevazione_obsoleta,
        in_attesa_dichiarazione_t: r2(in_attesa_dichiarazione_t),
        // Di quell'attesa, quanto per noi e' chiuso e perche' (null: niente).
        ...(attesaChiusa ? { in_attesa_chiusa_t: attesaChiusa.chiusa_t, in_attesa_chiusa_perche: attesaChiusa.perche } : {}),
        ordini_da_dichiarare,
        arretrato_per_anno,
        dichiarato_t: r2(dichiarato_t),
        // IL DICHIARATO DEGLI ALTRI DUE CANALI, cosi' la riga si spiega da se':
        // la giacenza ACI e' apertura piu' entrato meno questo numero, ed e'
        // esattamente quello che il modulo Dichiarazioni mostra come caricato.
        // Senza questi due campi, nelle righe per canale delle giacenze le celle
        // del dichiarato restavano vuote e il conto non si poteva rifare a occhio.
        //
        // MA IL DICHIARATO E' DI CHI TRATTA, NON DI CHI STOCCA (10/10/2026).
        //
        // La mappa qui sopra e' per soggetto e canale e non conosce il ruolo.
        // Letta anche sulla riga del piazzale faceva comparire «ACI dichiarato
        // 115,54 t» sullo stoccaggio GATIM, che non dichiara niente, e nel totale
        // quelle tonnellate si contavano due volte: 275,08 invece di 154,22, e
        // l'extra raccolta 1,72 invece di 0,86. La giacenza era giusta, perche'
        // quel calcolo era gia' protetto dal ruolo (if td === 'imp'): sbagliava
        // solo il numero scritto accanto, e per questo l'errore stava in vista
        // senza farsi vedere.
        //
        // Un piazzale non ha un dichiarato: null, cosi' la cella dice perche'
        // invece di uno zero, che si leggerebbe «non ha ancora dichiarato».
        dichiarato_aci_t: td === 'imp' ? r2(dichiaratoCanale(ns, 'ACI')) : null,
        dichiarato_extra_t: td === 'imp' ? r2(dichiaratoCanale(ns, 'EXTRA_RACCOLTA')) : null,
        granulo_t: r2(der.granulo),
        fibre_t: r2(der.fibre),
        metallo_t: r2(der.metallo),
        cippato_t: r2(der.cippato),
        ciabattato_t: r2(der.ciabattato),
        conferito_primarie_t: r2(conferito_primarie_t),
        conferito_aci_t: r2(conferito_aci_t),
        conferito_extra_t: r2(conferito_extra_t),
        secondarie_in_t: r2(secondarie_in_t),
        secondarie_out_t: r2(secondarie_out_t),
        secondarie_nette_t: r2(secondarie_nette_t),
        secondarie_aci_in_t: r2(secondarie_aci_in_t),
        secondarie_aci_out_t: r2(secondarie_aci_out_t),
        secondarie_extra_in_t: r2(secondarie_extra_in_t),
        secondarie_extra_out_t: r2(secondarie_extra_out_t),
        terziarie_t: r2(terziarie_t),
        conferito_t: r2(conferito_t),
        target_primarie_t: r2(target_primarie_t),
        // Quanto del target delle primarie non l'ha scritto nessuno a mano ma
        // viene dalla ripartizione sullo storico, e da chi: il numero da solo non
        // si capirebbe da dove arriva.
        target_primarie_ripartite_t: r2(tgt.target_primarie_ripartite_t),
        target_primarie_ripartizione: tgt.ripartizione.map(x => ({ raccoglitore: x.raccoglitore, regione: x.regione, t: r2(x.t), previsto: !!x.stimato })),
        target_totale_t: r2(target_totale_t),
        giacenza_riferimento_t: r2(giacenza_riferimento_t),
        tipologia_trattamento,
        residuo_t: residuo_t !== null ? r2(residuo_t) : null,
        percentuale_target: percentuale_target !== null ? r2(percentuale_target) : null,
        // Il riassunto per canale; l'elenco degli ordini sta nelle anomalie.
        date_da_sistemare: dateRiga.map(x => ({ canale: x.canale, ruolo: x.ruolo, n: x.n, arrivi: x.arrivi, arrivi_kg: x.arrivi_kg, partenze: x.partenze, partenze_kg: x.partenze_kg, senza_fine: x.senza_fine, avviso: avvisoSenzaFine(x, 'giacenze') })),
      });

      // Una segnalazione per soggetto e canale: quanti, quali, che cosa manca.
      for (const x of dateRiga) {
        anomalie.push({
          tipo: 'date_da_sistemare', sito: sitoNome, ruolo: td, canale: x.canale,
          n: x.n, arrivi: x.arrivi, arrivi_kg: x.arrivi_kg, partenze: x.partenze, partenze_kg: x.partenze_kg, senza_fine: x.senza_fine,
          avviso: avvisoSenzaFine(x, 'giacenze'), ordini: x.ordini,
        });
      }

      // --- Anomalie ---
      // Il target riguarda i soli impianti. Uno stoccaggio puo' legittimamente
      // esserne privo: quello di Irigom, per esempio, serve unicamente per gli
      // ACI, che un target non ce l'hanno.
      // Un anno chiuso si legge soltanto (28/09/2026): li' vale il target scritto
      // allora, e non si chiede di sistemare niente che non si puo' piu' sistemare.
      if (td === 'imp' && !(target_totale_t > 0) && !annoTargetChiuso) {
        sitiSenzaTarget.add(sitoNome + ' (Impianto)');
      }
      if (tgt.da_portare.totale && !annoTargetChiuso) {
        const cosa = tgt.da_portare.spento ? 'spento' : 'totale';
        anomalie.push({ tipo: 'target_da_portare', sito: sitoNome, anno: annoNum, cosa: 'totale', spento: tgt.da_portare.spento, target_t: r2(target_totale_t), avviso: testoTargetDaPortare(cosa) });
      }
      if (tgt.da_portare.primarie && !annoTargetChiuso) {
        // Due situazioni diverse, due avvisi diversi: i target dei raccoglitori
        // non ci sono affatto, oppure ci sono e nessuno e' legato a questo sito.
        const cosaPrimarie = tgt.da_portare.primarie_senza_impianto ? 'primarie_senza_impianto' : 'primarie';
        anomalie.push({ tipo: 'target_da_portare', sito: sitoNome, anno: annoNum, cosa: cosaPrimarie, target_t: r2(target_primarie_t), avviso: testoTargetDaPortare(cosaPrimarie) });
      }
      const sommaDerivati = der.granulo + der.fibre + der.metallo + der.cippato + der.ciabattato;
      if (dichiarato_t > 0 && Math.abs(sommaDerivati - dichiarato_t) > 0.001) {
        anomalie.push({
          tipo: 'coerenza_derivati',
          sito: sitoNome,
          dichiarato_t: r2(dichiarato_t),
          somma_derivati_t: r2(sommaDerivati),
          differenza_t: r2(dichiarato_t - sommaDerivati)
        });
      }
      if (target_totale_t > 0 && giacenza_portale_t > target_totale_t) {
        anomalie.push({
          tipo: 'giacenza_sopra_target',
          sito: sitoNome,
          giacenza_portale_t: r2(giacenza_portale_t),
          target_totale_t: r2(target_totale_t)
        });
      }
    }

    for (const s of sitiSenzaTarget) {
      anomalie.push({ tipo: 'sito_senza_target', sito: s, anno: annoNum });
    }

    // UN TARGET CHE NON STA SU NESSUN SITO VA DETTO.
    //
    // La ripartizione mette il target dove il raccoglitore ha portato: se non ha
    // ancora portato niente e nessuno gli ha scritto l'impianto, quelle
    // tonnellate non sono nel target di nessun sito, e il totale della colonna e'
    // piu' basso del contratto senza che niente lo dica.
    if (ripartite.senzaStorico.length > 0 && !annoTargetChiuso) {
      anomalie.push({
        tipo: 'target_raccoglitore_senza_sito',
        anno: annoNum,
        n: ripartite.senzaStorico.length,
        target_t: r2(ripartite.senzaStorico.reduce((s, x) => s + x.target_t, 0)),
        raccoglitori: ripartite.senzaStorico.map(x => ({ raccoglitore: x.raccoglitore, regione: x.regione, target_t: r2(x.target_t) })),
      });
    }

    righe.sort((a, b) => b.giacenza_portale_t - a.giacenza_portale_t);

    // === 7. TOTALI ===
    const numCols = [
      // Un totale per canale: la giacenza a portale e' della rete, ACI ed extra a parte.
      'giacenza_portale_t', 'giacenza_aci_t', 'giacenza_extra_t', 'in_attesa_dichiarazione_t',
      'dichiarato_t', 'dichiarato_aci_t', 'dichiarato_extra_t', 'granulo_t', 'fibre_t', 'metallo_t', 'cippato_t', 'ciabattato_t',
      'conferito_primarie_t', 'conferito_aci_t', 'conferito_extra_t', 'secondarie_in_t', 'secondarie_out_t', 'secondarie_nette_t', 'terziarie_t',
      'secondarie_aci_in_t', 'secondarie_aci_out_t', 'secondarie_extra_in_t', 'secondarie_extra_out_t',
      'conferito_t', 'target_primarie_t', 'target_totale_t', 'giacenza_riferimento_t'
    ];
    const totali = {};
    for (const c of numCols) totali[c] = r2(righe.reduce((s, r) => s + (r[c] || 0), 0));
    // IL CONFERITO DEL TOTALE CONTA OGNI CARICO UNA VOLTA (audit del 10/10/2026).
    //
    // Sulla riga di un sito il conferito e' giusto con le secondarie dentro: un
    // impianto riceve anche quello che gli arriva dai piazzali, e il suo target lo
    // comprende. Ma SOMMATO sulle righe contava due volte ogni PFU passato da un
    // piazzale - una come primaria al piazzale, una come secondaria all'impianto:
    // 10.744,79 t contro le 8.818,55 raccolte davvero. La riga TOTALE delle
    // Giacenze diceva cosi' «76% raggiunto» e, nella cella accanto, «residuo
    // 800,21 t» invece di circa 2.730; e l'intestazione del PDF scriveva
    // «Conferito RETE 10.744,79 t». Il modulo Dichiarazioni, col nome uguale,
    // diceva 8.818,55: ora lo dicono tutti e due.
    totali.conferito_t = totali.conferito_primarie_t;
    totali.giacenza_classi_kg = classiVuote();
    for (const r of righe) for (const [c, v] of Object.entries(r.giacenza_classi_kg || {})) totali.giacenza_classi_kg[c] += v;
    totali.ordini_da_dichiarare = righe.reduce((s, r) => s + (r.ordini_da_dichiarare || 0), 0);
    // DI QUALI CARICHI E' L'ATTESA (revisione finale del 13/10/2026): su un anno
    // che non e' quello in corso l'«In attesa di dichiarazione» e gli ordini
    // degli stoccaggi contano solo i carichi arrivati al piazzale in quell'anno
    // (nellAttesaDellAnno), e la colonna lo dice nella pagina, nel PDF e nel
    // foglio Excel, come la Quadratura delle Dichiarazioni. Sull'anno in corso
    // e' tutto il file: null, e l'etichetta resta quella di sempre.
    totali.in_attesa_dei_carichi_del = annoNum !== annoDiOggi ? annoNum : null;
    // Di quell'attesa, quanto per noi e' un giro chiuso (decisioni dell'utente del
    // 13/10/2026): il totale della colonna resta il numero del portale, e accanto
    // si dice quanto non e' un'attesa da risolvere. Solo se c'e'.
    const chiusaTot = righe.reduce((s, r) => s + (Number(r.in_attesa_chiusa_t) || 0), 0);
    if (chiusaTot > 0) totali.in_attesa_chiusa_t = r2(chiusaTot);
    // GLI ANNI PASSATI (decisioni dell'utente del 13/10/2026). Un totale di un
    // anno chiuso senza nessun numero nelle righe non e' zero: e' «—» (un anno
    // prima del gestionale, o senza le letture del 31/12). E la pagina dice
    // perche' una volta, sopra la tabella, con le stesse parole delle
    // Dichiarazioni.
    //
    // E UNA RIGA SENZA NUMERO NON VALE ZERO NEL TOTALE (revisione del 14/10/2026).
    // Bastava che una riga avesse il numero perche' il totale lo avesse: il 2026
    // guardato il 05/01/2027, prima che la chiusura salvi la lettura del 31/12,
    // aveva i cinque impianti che dichiarano la rete a «—» e il totale della
    // colonna, che e' anche la KPI «Giacenza rete a portale», a 25,88 t, il solo
    // piazzale di Nappi Sud, senza dire niente. Ora una riga senza il numero per
    // mancanza del dato (ha il suo perche') fa del totale del canale un «—», e il
    // totale dice quali righe e perche' (totaleDellaColonna, la regola anche delle
    // Dichiarazioni). La rete di chi non la dichiara e l'extra raccolta di un
    // piazzale che non ne ha non mancano: non hanno niente da sommare. Un piazzale
    // senza nessuna lettura manca alla rete e all'ACI, come dice EcoTyna. Sui dati
    // veri dell'anno in corso nessuna riga e' senza il dato: niente cambia.
    // Di un anno prima del gestionale il perche' e' gia' detto una volta per
    // tutto l'anno, e basta quello.
    const percheDelCanale = {
      giacenza_portale_t: (r) => r.perche_senza_giacenza,
      giacenza_aci_t: (r) => (r.perche_canali && r.perche_canali.ACI) || (r.tipo_destinazione === 'stoc' ? r.perche_senza_giacenza : null),
      giacenza_extra_t: (r) => r.perche_canali && r.perche_canali.EXTRA_RACCOLTA,
    };
    const perche_totali = {};
    for (const [campo, canale] of [['giacenza_portale_t', 'RETE'], ['giacenza_aci_t', 'ACI'], ['giacenza_extra_t', 'EXTRA_RACCOLTA']]) {
      const col = totaleDellaColonna(righe.map(r => ({
        sito: r.tipo_destinazione === 'stoc' ? `${r.sito} (piazzale)` : r.sito, t: r[campo], perche: percheDelCanale[campo](r),
      })));
      if (col.t === null) {
        totali[campo] = null;
        if (!primaDelGestionale) perche_totali[canale] = col.perche;
      } else if (annoTargetChiuso && !righe.some(r => r[campo] !== null && r[campo] !== undefined)) {
        totali[campo] = null;
      }
    }
    if (Object.keys(perche_totali).length) totali.perche_totali = perche_totali;
    totali.anno_chiuso = annoTargetChiuso;
    totali.prima_del_gestionale = primaDelGestionale;
    if (primaDelGestionale) totali.perche_prima_del_gestionale = PERCHE_ANNO_PRIMA_DEL_GESTIONALE(annoNum);
    // I formulari con le date da sistemare, un conteggio per canale: mai un totale.
    // Stesso portale dei gruppi: un senza fine di un altro anno che il portale
    // conosce e' contato anche qui (22/09/2026).
    totali.date_da_sistemare = daSistemare.perCanale(portaleConosce);

    return Response.json({ anno: annoNum, righe, totali, anomalie });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
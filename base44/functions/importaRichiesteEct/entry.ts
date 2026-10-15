import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { cancellaFile } from "../../shared/fileArchivio.ts";
import { annotaFileDaRimuovere, voceDaRimuovere } from "../../shared/fileDaRimuovere.ts";
import { urlScaricabile, riferimentoDalCorpo } from "../../shared/fileScaricabile.ts";
import * as XLSX from 'npm:xlsx@0.18.5';
import { fetchAll } from "../../shared/fetchAll.ts";
import { leggiFoglio, riconosciOrdine, scadenzaDaNota, listaOrdini, evasioneOrdini, abbinaRichieste, ritiriTerminati, idOrdineDaSalvare, ordiniConDateDaSistemare, ordiniEdEsitoRichiesta, annoRichiesta } from "../../shared/richiesteEct.ts";
import { statoOrdini } from "../../shared/todoOrdini.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { statoCaricamenti } from "../../shared/reportSettimanali.ts";

// Carica il foglio "Richieste ECT" del file di gestione e ne tiene aggiornato
// l'elenco: per ogni richiesta cerca l'ID ordine fra gli assegnati (nome del
// produttore piu' data di immissione) e, se quell'ordine risulta terminato,
// propone l'evasione con la data del ritiro.
//
// Non sovrascrive mai quello che ha messo l'utente: la spunta di evasione, la
// data di conferma, l'ID scelto a mano e le note interne restano.
//
// Una richiesta si riconosce da produttore, classe e data di immissione
// (abbinaRichieste), non dal numero di riga del foglio: ordinare il foglio o
// inserirci una riga non deve spostare le spunte su altre richieste.
//
// OGNI RICHIESTA HA IL SUO ANNO (prova del cambio d'anno, 15/10/2026, difetto
// 3). Prima il foglio intero prendeva un anno solo, il piu' alto fra le mail, e
// le richieste salvate si cercavano solo in quello: ricaricato a gennaio, con le
// mail di dicembre e una di gennaio, il foglio rifaceva le richieste di dicembre
// come richieste dell'anno nuovo - doppioni senza le spunte, «entro il 20/12»
// diventato il 20/12 dell'anno dopo - e caricato a dicembre dava a «entro il
// 10/01» un 10/01 gia' passato. Adesso l'anno di una richiesta e' quello della sua
// mail (o dell'immissione, se la mail manca: annoRichiesta), il termine senza
// anno e' il primo che non viene prima della mail (scadenzaDaNota), e le
// richieste salvate si leggono tutte, con una lettura sola (l'archivio e'
// piccolo), e si abbinano quelle degli anni che il foglio porta.
//
// L'ID ORDINE DEL FOGLIO (colonna «numero d'ordine», dal 09/10/2026: prova del
// cambio d'anno, difetto 10) vale come scritto a mano: va in id_ordine_manuale,
// che vince sempre sul riconoscimento automatico. Un ID gia' scritto a mano nel
// gestionale resta il suo, come le spunte: se il foglio ne dice un altro, la
// risposta lo elenca (id_diversi_dal_foglio) e la pagina lo dice.
//
// SOLO UN ID CHE C'E' FRA GLI ORDINI CARICATI (revisione del 15/10/2026). Un ID
// scritto male nel foglio - una cifra in meno - una volta preso restava per
// sempre: dal caricamento dopo valeva come scritto a mano nel gestionale, la
// correzione fatta nel foglio non passava piu' e la richiesta aspettava un ordine
// che non esiste. Il gestionale non sa da dove viene un id_ordine_manuale (non
// c'e' un campo che lo dica), quindi l'ID del foglio si prende solo se tutti i
// suoi ordini sono fra gli assegnati o le primarie: se no non si prende, intanto
// vale il riconoscimento automatico e la risposta lo dice
// (id_del_foglio_non_trovati). Un ordine nuovo non ancora caricato si prende al
// caricamento del foglio dopo quello delle primarie.
//
// Payload: { file_uri, anno? } (anno vale solo per una riga senza mail ne'
// immissione)
const FOGLIO = 'Richieste ECT';

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo l amministratore puo caricare le richieste' }, { status: 403 });

    const corpo = await req.json().catch(() => ({}));
    const { anno } = corpo;
    // Il file si prende solo come file_uri: un indirizzo non si accetta da chi
    // chiama (02/10/2026, come in importEcotyreFile). Qui il fetch era nudo:
    // un indirizzo rifiutato dava un 500 senza spiegazione, adesso un 400 che
    // dice perche.
    const dalCorpo = riferimentoDalCorpo(corpo);
    if (dalCorpo.errore) return Response.json({ error: dalCorpo.errore }, { status: 400 });
    const file_uri = dalCorpo.rif ? dalCorpo.rif.file_uri : null;
    const file_url = null;
    if (!file_uri) return Response.json({ error: 'file_uri obbligatorio' }, { status: 400 });

    // Il foglio delle richieste porta nomi di produttori, indirizzi e date: e' un
    // documento aziendale e adesso sale privato. Si apre con un link firmato che
    // basta per questa lettura e poi scade da solo, e l'indirizzo non lo conserva
    // nessun record: finita la lettura, quel file non e' piu' raggiungibile
    // dall'app in nessun modo.
    const risposta = await fetch(await urlScaricabile(base44, { file_uri, file_url }, 600));
    if (!risposta.ok) return Response.json({ error: 'Il file non si riesce a leggere: ' + risposta.status }, { status: 400 });
    const dati = new Uint8Array(await risposta.arrayBuffer());
    const wb = XLSX.read(dati, { type: 'array', cellDates: true, sheets: [FOGLIO] });
    const ws = wb.Sheets[FOGLIO];
    if (!ws) return Response.json({ error: 'Nel file non c e il foglio ' + FOGLIO }, { status: 400 });

    const griglia = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, cellDates: true });
    // Il foglio non comincia dalla riga 1: la prima riga dell'elenco e' quella
    // da cui parte l'area usata.
    const primaRiga = (XLSX.utils.decode_range(ws['!ref'] || 'A1').s.r || 0) + 1;
    const righe = leggiFoglio(griglia, primaRiga);
    if (!righe.length) return Response.json({ error: 'Il foglio ' + FOGLIO + ' non contiene richieste' }, { status: 400 });

    // L'anno di ogni richiesta e' quello della sua mail, o dell'immissione se la
    // mail manca (annoRichiesta; le date del foglio sono gia' giorni di
    // calendario). Solo per una riga senza nessuna delle due vale l'anno chiesto,
    // o quello di oggi.
    const annoDiRiserva = Number(anno) || Number(oggiRoma().slice(0, 4));
    const annoDi = (r) => annoRichiesta(r) || annoDiRiserva;
    const anniFoglio = new Set(righe.map(annoDi));
    const annoNum = Math.max(...anniFoglio);
    const anniInOrdine = [...anniFoglio].sort((a, b) => a - b);

    // Gli ordini si cercano fra primarie e assegnati: se il file delle primarie si
    // sta riscrivendo, o un caricamento l'ha lasciato a meta', ID e ritiri letti
    // adesso sarebbero sbagliati e resterebbero salvati. Si rinvia dicendo perche'.
    const { in_corso } = await statoCaricamenti(base44, ['primarie']);
    if (in_corso.length) {
      const c = in_corso[0];
      const chi = [c.utente, c.nome_file].filter(Boolean).join(', ');
      return Response.json({
        error: c.interrotto
          ? `Richieste non caricate: il caricamento delle primarie del ${c.data}${chi ? ` (${chi})` : ''} e' rimasto interrotto e l'archivio puo' essere incompleto. Ricarica prima il file delle primarie, poi questo.`
          : `Richieste non caricate: e' in corso il caricamento delle primarie${chi ? ` (${chi})` : ''}. Ricarica questo file quando e' finito.`,
        rinviato: true,
      }, { status: 409 });
    }

    const svc = base44.asServiceRole.entities;
    const [assRete, assAci, rete, aci, archivioRichieste] = await Promise.all([
      fetchAll(svc.Assegnato),
      fetchAll(svc.AssegnatoAci),
      fetchAll(svc.PrimariaRete),
      fetchAll(svc.PrimariaAci),
      // Tutte, con una lettura sola: sono poche decine l'anno.
      fetchAll(svc.RichiestaEct),
    ]);
    // Si abbinano le richieste degli anni che il foglio porta: per l'anno salvato
    // o per quello della loro mail (una salvata prima del 15/10/2026 poteva avere
    // l'anno piu' alto del foglio di allora). Le altre restano come sono, e non
    // si contano fra quelle tolte dal foglio.
    const esistenti = archivioRichieste.filter(e => anniFoglio.has(Number(e.anno)) || anniFoglio.has(annoRichiesta(e)));
    const ordini = [...assRete, ...assAci, ...rete, ...aci];
    const presenti = new Set(ordini.map(o => String(o.id_ordine || '').trim()).filter(Boolean));

    // Per sapere se il ritiro e' stato fatto: l'ordine fra i terminati, col giorno
    // italiano della fine trasporto (giornoMovimento). Tagliando la stringa UTC un
    // trasporto finito a mezzanotte italiana cadeva il giorno prima, e la data
    // rilevata cambiava a ogni alternanza fra questo caricamento e quello delle
    // primarie (importaBlocco, ritiri_ect), che legge il giorno italiano. Un
    // terminato senza fine trasporto non conta come ritirato - non si ripiega
    // sulla chiusura a portale - ma la richiesta che lo aspetta si segnala.
    // Un ritiro con un'altra data obbligatoria che manca o non torna conta, ma si
    // dice (daSistemare, regola dell'utente del 22/09/2026).
    const { terminati, senzaFine, daSistemare } = ritiriTerminati([...rete, ...aci]);
    // Lo stato di ogni ordine - terminato, eseguito, cancellato, assegnato - con la
    // stessa funzione del ricalcolo dopo le primarie e della to-do list
    // (statoOrdini): si salva con la richiesta (ordini_stato_json) e decide la
    // richiesta che il portale ha gia' chiuso cancellandone gli ordini
    // (statoRichiesta, 14/10/2026). Prima questo caricamento non lo scriveva, e
    // l'esito si calcolava senza: una richiesta col suo ordine cancellato tornava
    // «in attesa» a ogni caricamento del foglio.
    const statoTuttiGliOrdini = statoOrdini([...rete, ...aci], [...assRete, ...assAci]);
    const oggi = oggiRoma();

    const abbinate = abbinaRichieste(righe, esistenti);

    let creati = 0, aggiornati = 0, invariati = 0, spostate = 0, idDalFoglio = 0;
    const daConfermare = [];
    const terminatiSenzaFine = [];
    const conDate = [];
    const idDiversi = [];
    const idNonTrovati = [];
    const nonCaricati = (testo) => listaOrdini({ id_ordine_manuale: testo }).filter(id => !presenti.has(id));
    for (let i = 0; i < righe.length; i++) {
      const r = righe[i];
      const gia = abbinate[i];
      // Un ID gia' riconosciuto non si perde per un riconoscimento diventato
      // ambiguo: la stessa regola del ricalcolo dopo le primarie.
      const ric = idOrdineDaSalvare(gia, riconosciOrdine(r, ordini));
      if (gia && gia.riga_excel !== r.riga_excel) spostate++;
      // Gli ID scritti a mano restano e vincono: una richiesta puo' coprire piu'
      // ordini, e l'evasione si propone solo quando sono tutti ritirati. Quello
      // del foglio vale come scritto a mano quando nel gestionale non ce n'e' uno
      // (15/10/2026); se ce n'e' uno diverso resta quello, e si dice.
      // L'ID del foglio si prende solo se i suoi ordini ci sono TUTTI fra quelli
      // caricati (revisione del 15/10/2026): preso a meta', la richiesta si
      // chiuderebbe col ritiro di un ordine solo.
      const aMano = String((gia && gia.id_ordine_manuale) || '').trim();
      const idFoglio = r.id_ordine_foglio || '';
      const fuoriArchivio = nonCaricati(idFoglio);
      const dalFoglio = idFoglio && !fuoriArchivio.length ? idFoglio : '';
      const manuale = aMano || dalFoglio;
      if (!aMano && dalFoglio) idDalFoglio++;
      if (!aMano && idFoglio && fuoriArchivio.length) idNonTrovati.push({ pdr: r.pdr_nome, foglio: idFoglio, non_trovati: fuoriArchivio.join(', ') });
      if (aMano && idFoglio && listaOrdini({ id_ordine_manuale: aMano }).join(', ') !== listaOrdini({ id_ordine_manuale: idFoglio }).join(', ')) {
        // Si dice anche se quello del gestionale si trova fra gli ordini: uno che
        // non c'e' e' probabilmente quello sbagliato.
        idDiversi.push({ pdr: r.pdr_nome, foglio: idFoglio, gestionale: aMano, gestionale_trovato: nonCaricati(aMano).length === 0, foglio_trovato: fuoriArchivio.length === 0 });
      }
      const ids = listaOrdini({ id_ordine_manuale: manuale, id_ordine: ric.id_ordine });
      const ev = evasioneOrdini(ids, terminati);
      // Come nel ricalcolo dopo le primarie (importaBlocco, dataRitiro): un
      // ritiro gia' rilevato si toglie solo se l'archivio dice che un ordine
      // della richiesta non e' ritirato, non se l'ordine nell'archivio manca.
      const salvata = gia && gia.evasione_rilevata_il;
      const archivioNonBasta = !!salvata && !ids.filter(id => !terminati.has(id)).every(id => presenti.has(id));
      const rilevata = ev.ultima || (archivioNonBasta ? salvata : null);

      // Le date che vengono dal foglio o dai ritiri si riscrivono anche vuote
      // (null, non undefined, che l'aggiornamento ignora): una data tolta dal
      // foglio, o un secondo ID non ancora ritirato, altrimenti lasciava la
      // richiesta "da confermare" sulla data vecchia, con meno ordini evasi che
      // ordini.
      // Il termine senza anno e' il primo che non viene prima della mail; senza
      // la mail, il primo che non viene prima dell'immissione; senza nessuna
      // delle due, l'anno della riga.
      const campi = {
        anno: annoDi(r),
        riga_excel: r.riga_excel,
        pdr_nome: r.pdr_nome,
        classe: r.classe,
        provincia: r.provincia,
        ordine_immesso_il: r.ordine_immesso_il || undefined,
        trasportatore: r.trasportatore,
        mail_inviata_il: r.mail_inviata_il || null,
        nota: r.nota,
        scadenza: scadenzaDaNota(r.nota, r.mail_inviata_il || r.ordine_immesso_il || annoDi(r)) || null,
        evaso_il: r.evaso_il || null,
        motivo_annullamento: r.motivo_annullamento,
        id_ordine: ric.id_ordine,
        id_ordine_stato: ric.id_ordine_stato,
        id_ordine_candidati: ric.id_ordine_candidati,
        evasione_rilevata_il: rilevata || null,
        ordini_totali: ev.totali,
        ordini_evasi: ev.evasi,
        // L'ID del foglio si scrive solo dove nel gestionale non c'e' un ID a
        // mano: quello che c'e' non si tocca.
        ...(!aMano && manuale ? { id_ordine_manuale: manuale } : {}),
      };
      // Lo stato dei suoi ordini e poi l'esito, con la stessa funzione del
      // ricalcolo dopo le primarie (ordiniEdEsitoRichiesta): il giorno in cui un
      // ordine si e' visto cancellato si porta avanti dal salvato.
      const salvato = { ordini_stato_json: gia ? gia.ordini_stato_json : null, id_ordine_manuale: manuale, evasione_confermata: gia ? !!gia.evasione_confermata : false };
      Object.assign(campi, ordiniEdEsitoRichiesta(salvato, campi, ids, statoTuttiGliOrdini, oggi));

      if (!gia) { await svc.RichiestaEct.create(campi); creati++; }
      else {
        const cambia = Object.keys(campi).some(k => String(gia[k] ?? '') !== String(campi[k] ?? ''));
        if (cambia) { await svc.RichiestaEct.update(gia.id, campi); aggiornati++; } else invariati++;
      }
      // Chi risulta ritirato e non ha ancora la spunta va detto subito, sia che la
      // riga sia nuova sia che fosse gia' in elenco: e' quello su cui l utente
      // deve mettere le mani per rispondere al consorzio. Dal 29/09/2026 una
      // richiesta ritirata e' «evasa» da sola e statoRichiesta non dice piu'
      // «da_confermare»: il confronto con quell'esito era rimasto, e l'elenco
      // usciva sempre vuoto (14/10/2026). Si dice chi diventa evasa adesso.
      if (campi.esito === 'evasa' && !(gia && gia.evasione_confermata) && !(gia && gia.esito === 'evasa') && rilevata) {
        daConfermare.push({ pdr: r.pdr_nome, id_ordine: ids.join(', '), evasa_il: rilevata });
      }
      // Ancora aperta ma con un ordine terminato senza fine trasporto: si dice,
      // perche' il ritiro c'e' e sollecitarlo sarebbe sbagliato (regola 1).
      const senzaData = ids.filter(id => senzaFine.has(id));
      if (campi.esito === 'aperta' && senzaData.length) terminatiSenzaFine.push({ pdr: r.pdr_nome, id_ordine: senzaData.join(', ') });
      if (campi.esito !== 'annullata') conDate.push(...ordiniConDateDaSistemare(r.pdr_nome, ids, terminati, daSistemare));
    }

    // Le righe cancellate dal foglio non si toccano: restano nello storico.
    const ritrovate = new Set(abbinate.filter(Boolean).map(e => e.id));
    const orfane = esistenti.filter(e => !ritrovate.has(e.id)).length;

    // Il file era li' solo per essere letto e nessun record ne conserva
    // l'indirizzo. La piattaforma non sa cancellare (confermato dalla sua
    // assistenza il 30/09/2026), quindi il tentativo si fa solo sui file vecchi,
    // quelli pubblici: per un file privato il link firmato e' gia' scaduto e
    // l'indirizzo non lo conosce piu' nessuno, che e' la stessa cosa.
    const fileTolto = file_uri ? { riuscita: false, come: 'file privato: il link firmato è scaduto e l\'indirizzo non è stato conservato' } : await cancellaFile(base44, file_url);

    // IL FILE LETTO SI ANNOTA NEL REGISTRO. La piattaforma non sa cancellare:
    // questo foglio e' salito in area privata, e' stato letto, e nessun record ne
    // conserva l'indirizzo - quindi senza questa riga resterebbe caricato per
    // sempre e nessuno saprebbe quale chiedere di rimuovere. Dodici caricamenti
    // l'anno, uno al mese (audit del 03/10/2026).
    const registro = await annotaFileDaRimuovere(base44.asServiceRole.entities.FileDaRimuovere, [voceDaRimuovere({
      entita: 'RichiestaEct',
      record: { file_uri, file_url },
      motivo: 'foglio letto per il caricamento: nessun record ne conserva l\'indirizzo',
      cosa: 'Foglio delle Richieste ECT',
      descrizione: `Caricamento delle richieste ECT ${anniInOrdine.length > 1 ? `degli anni ${anniInOrdine.slice(0, -1).join(', ')} e ${annoNum}` : `dell'anno ${annoNum}`}`,
      oggi: oggiRoma(),
    })]);

    return Response.json({
      // anno: il piu' recente del foglio, come prima; anni: tutti quelli che porta.
      ok: true, anno: annoNum, anni: anniInOrdine, righe_lette: righe.length,
      file_tolto: fileTolto.riuscita ? true : fileTolto.come,
      annotato_nel_registro: registro.annotati,
      creati, aggiornati, invariati, orfane, spostate,
      riconosciuti: righe.filter(r => riconosciOrdine(r, ordini).id_ordine_stato === 'trovato').length,
      // Gli ID ordine presi dal foglio, quelli che il foglio dice diversi da uno
      // gia' nel gestionale (che resta), e quelli non presi perche' i loro ordini
      // non sono fra quelli caricati.
      id_dal_foglio: idDalFoglio,
      id_diversi_dal_foglio: idDiversi,
      id_del_foglio_non_trovati: idNonTrovati,
      da_confermare: daConfermare,
      terminati_senza_fine: terminatiSenzaFine,
      ordini_con_date_da_sistemare: conDate,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

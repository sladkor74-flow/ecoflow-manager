import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { soloAmministratore } from "../../shared/permessi.ts";
import { valoreCampo } from "../../shared/testoLungo.ts";
import { calcolaPassivaMese, MESI_PASSIVA } from "../../shared/passivaCalcolo.ts";
import { controlloCaricamenti, TIPI_RINVIO } from "../../shared/statoArchivi.ts";
import { tipiDeiCanali } from "../../shared/registroCaricamenti.ts";
import { tariffeMancantiDelConto, testoTariffaMancante } from "../../shared/consuntivoFornitore.ts";

// CONGELA IL CONTO DELLA PASSIVA DI UN MESE (decisione dell'utente, 29/09/2026).
//
// La fatturazione passiva e' un calcolo a richiesta e non si salva da nessuna
// parte: riaprendola domani puo' dare un numero diverso, perche' nel frattempo sono
// stati caricati ordini chiusi dopo o correzioni. Un consuntivo che arriva a
// novembre per settembre va confrontato col settembre di allora, non con settembre
// ricalcolato oggi.
//
// Congelare non vuol dire nascondere: il confronto di un consuntivo mostra sempre
// anche il ricalcolo di oggi e dice se e di quanto si e' mosso. Congelare e tacere
// sarebbe il modo migliore per non accorgersi dei movimenti arrivati dopo.
//
// Si congela una volta per mese e canale; rifarlo sovrascrive, e resta scritto
// quando e da chi. Solo l'amministratore.

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { user, errore } = await soloAmministratore(base44);
    if (errore) return errore;
    const svc = base44.asServiceRole.entities;
    const { anno, mese, canale, nota, conferma } = await req.json();
    const annoNum = Number(anno);
    const meseNum = Number(mese);
    const can = String(canale || '').toUpperCase();
    if (!annoNum || !(meseNum >= 1 && meseNum <= 12) || !['RETE', 'ACI', 'EXTRA_RACCOLTA'].includes(can)) {
      return Response.json({ error: 'Anno, mese (1-12) e canale (RETE, ACI, EXTRA_RACCOLTA) obbligatori' }, { status: 400 });
    }

    // NON SU UN ARCHIVIO A META' (chiusura dell'audit, 11/10/2026).
    //
    // Il conto congelato e' quello con cui si confrontano per mesi i consuntivi
    // dei fornitori: congelato su un archivio a meta', direbbe che i fornitori
    // hanno fatturato ritiri che non risultano. Mentre le primarie o le
    // secondarie si riscrivono, o dopo un caricamento interrotto o finito
    // parziale, si risponde 409 «rinviato» col motivo e non si scrive niente,
    // come gia' fanno verifiche, quadrature e alert. Le terziarie no: la passiva
    // non le legge, e un loro caricamento interrotto non deve fermare il mese
    // (TIPI_RINVIO, 11/10/2026). Lo stato si legge prima e dopo aver letto gli
    // archivi: un caricamento che parte mentre si legge, con una lettura sola,
    // non si vedrebbe (controlloCaricamenti, shared/statoArchivi.ts).
    const controllo = await controlloCaricamenti(base44, 'il congelamento della passiva', tipiDeiCanali(TIPI_RINVIO.passiva, [can]));
    if (controllo.rinvio) return controllo.rinvio;

    // Anche SurplusTariffa (il surplus sulle tariffe, 13/10/2026): il conto
    // congelato e' quello che i fornitori fatturano, Fuel Surcharge compreso, e
    // totale_euro e' il totale complessivo con il surplus dentro. passiva_json
    // porta le righe del surplus di ogni fornitore e surplus_del_mese, cosi' il
    // confronto di un consuntivo sa dire quale parte di una differenza e' un
    // surplus scritto dopo il congelamento.
    const [primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll, surplusAll] = await Promise.all([
      fetchAll(svc.PrimariaRete),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.Secondaria),
      fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Tariffa, { direzione: 'PASSIVA' }),
      fetchAll(svc.Fornitore, { stato: 'attivo' }),
      fetchAll(svc.SurplusTariffa),
    ]);
    const nomeMese = Object.keys(MESI_PASSIVA).find(k => MESI_PASSIVA[k] === meseNum - 1 && k.length > 3) || String(meseNum);
    const passiva = calcolaPassivaMese(
      { primarieRete, primarieAci, secondarieAll, extraRaccoltaAll, tariffeAll, fornitoriAll, surplusAll },
      annoNum, meseNum - 1, nomeMese, can,
    );

    const rinvio = await controllo.dopo();
    if (rinvio) return rinvio;

    // UN CONTO CON TARIFFE MANCANTI NON SI CONGELA SENZA DIRLO (prova del cambio
    // d'anno, 15/10/2026). Il 05/02/2027 gennaio si congelava senza le tariffe
    // 2027: 0,00 €, nessuna domanda, e la pagina buttava via il riepilogo. Il
    // 10/02 il consuntivo di GATIM (432,00 €) si confrontava con quello zero e
    // «si scostava di +432,00 euro». Ora, se nel conto ci sono tonnellate senza
    // la tariffa del mese (o con una tariffa copiata dall'anno prima e non
    // confermata: D4, decisione dell'utente del 15/10/2026, una riga cosi'
    // ferma un documento come una riga senza prezzo), si risponde 409 con l'elenco - chi, per che cosa, quante
    // tonnellate - e si congela solo con `conferma: true`: la pagina mostra
    // l'elenco e chiede. Congelato con la conferma, la nota lo dice.
    const { mancanti, da_confermare: daConfermare, tonnellate: tSenzaTariffa } = tariffeMancantiDelConto(passiva);
    const nomeCanale = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta' }[can];
    const periodo = `${nomeMese.toLowerCase()} ${annoNum}`;
    if ((mancanti.length || daConfermare.length) && conferma !== true) {
      const parti = [];
      if (mancanti.length) parti.push(`mancano le tariffe del mese di ${mancanti.map(testoTariffaMancante).join('; ')}`);
      if (daConfermare.length) parti.push(`hanno una tariffa copiata dall'anno prima e non ancora confermata ${daConfermare.map(testoTariffaMancante).join('; ')}`);
      return Response.json({
        error: `Nel conto della passiva di ${periodo} (${nomeCanale}) ${parti.join(', e ')}. Congelato così, quelle righe valgono zero (o il prezzo dell'anno prima) e i consuntivi di quei fornitori non si potranno controllare: scrivi prima le tariffe, oppure conferma per congelarlo lo stesso.`,
        da_confermare: true,
        tariffe_mancanti: mancanti,
        tariffe_da_confermare: daConfermare,
        tonnellate_senza_tariffa: tSenzaTariffa,
      }, { status: 409 });
    }

    const esistenti = await svc.ChiusuraPassivaMese.filter({ anno: annoNum, mese: meseNum, canale: can }, 'id', 5);
    const notaTariffe = mancanti.length || daConfermare.length
      ? `Congelato con la conferma${mancanti.length ? `, senza le tariffe di ${mancanti.map(testoTariffaMancante).join('; ')}` : ''}${daConfermare.length ? `${mancanti.length ? ',' : ''} con tariffe copiate e non confermate di ${daConfermare.map(testoTariffaMancante).join('; ')}` : ''}.`
      : '';
    const campi = {
      anno: annoNum, mese: meseNum, canale: can,
      congelato_il: new Date().toISOString(),
      congelato_da: (user && (user.full_name || user.email)) || '',
      totale_euro: (passiva.totali && passiva.totali.totale_complessivo) || 0,
      nota: [String(nota || ''), notaTariffe].filter(Boolean).join(' — '),
    };
    let record = esistenti && esistenti.length ? esistenti[0] : await svc.ChiusuraPassivaMese.create(campi);
    campi.passiva_json = await valoreCampo(base44, 'ChiusuraPassivaMese', record.id, 'passiva_json', JSON.stringify(passiva));
    await svc.ChiusuraPassivaMese.update(record.id, campi);

    return Response.json({
      ok: true,
      congelato: { ...record, ...campi, passiva_json: undefined },
      // Quanti fornitori e quanto: serve a chi preme il pulsante per sapere che
      // cosa ha appena fissato.
      riepilogo: {
        raccoglitori: (passiva.raccoglitori || []).length,
        impianti_stoccaggi: (passiva.impianti_stoccaggi || []).length,
        trasporti_secondaria: (passiva.trasporti_secondaria || []).length,
        totale_euro: campi.totale_euro,
        // di cui lo standard e il surplus: chi congela vede che il Fuel
        // Surcharge e' dentro il numero che ha appena fissato
        totale_standard: (passiva.totali && passiva.totali.standard && passiva.totali.standard.totale) || 0,
        totale_surplus: (passiva.totali && passiva.totali.surplus && passiva.totali.surplus.totale) || 0,
        surplus: (passiva.surplus_del_mese || []).map(s => ({ nome: s.nome, euro_t: s.euro_t, tonnellate: s.tonnellate_pagate, importo: s.importo, nota: s.nota })),
        anomalie: (passiva.anomalie || []).length,
        // le tariffe che mancavano e si e' congelato lo stesso (15/10/2026)
        tariffe_mancanti: mancanti,
        tariffe_da_confermare: daConfermare,
        tonnellate_senza_tariffa: tSenzaTariffa,
      },
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

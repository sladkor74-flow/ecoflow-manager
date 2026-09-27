import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { predittivitaDellAnno, fissaProgramma, annoInCorso } from "../../shared/predittivitaRisposta.ts";

// Il programma del mercoledi' (26/09/2026): alle 8 di ogni mercoledi' il
// workflow "Programma del mercoledi' Predittivita'" fissa i viaggi della
// settimana dopo, stoccaggio per impianto, in PianificazioneSettimanale
// (origine 'programma'). Il lunedi' si registrano i formulari della settimana
// prima e l'utente guarda il martedi' o il mercoledi': il programma nasce sui
// dati della settimana scorsa completa. Da li' non cambia piu': accanto la
// pagina mostra il fatto, e si vede se si e' in anticipo o in ritardo.
// L'amministratore lo corregge a mano dalla pagina (origine 'manuale'), e
// queste righe il mercoledi' non le tocca.
//
// I numeri sono quelli del motore unico (base44/shared/predittivita.ts), gli
// stessi della pagina e degli assistenti: il programma sono le righe di
// risposta.programma, scenario prudente.
//
// Prima questa funzione scriveva il lunedi' un "suggerimento" fra gli Alert del
// modulo secondarie, con un conto suo. Il programma adesso sta nella pagina:
// gli alert di quella regola non si scrivono piu', e quelli ancora aperti si
// chiudono qui.
//
// Non scrive se un caricamento di primarie o secondarie e' aperto, interrotto o
// concluso mentre si leggeva (409, come prima: i numeri sarebbero di mezzo
// archivio), ne' se l'anno non ha una configurazione. Risponde con un riassunto.

const REGOLA = 'suggerimento_predittivita_settimanale';
const eSuggerimento = (a) => a.regola_id === REGOLA || String(a.titolo || '').startsWith('Suggerimento Predittività Settimanale');
const it = (g) => (g ? `${g.slice(8, 10)}/${g.slice(5, 7)}/${g.slice(0, 4)}` : '');
const viaggi = (n) => `${n} ${n === 1 ? 'viaggio' : 'viaggi'}`;

/** Chiude i suggerimenti del lunedi' rimasti aperti: il programma adesso sta nella pagina. */
async function chiudiSuggerimenti(Alert, oggi) {
  const aperti = (await fetchAll(Alert, { modulo: 'secondarie', stato: 'aperto' })).filter(eSuggerimento);
  for (const a of aperti) {
    await Alert.update(a.id, { stato: 'risolto', risolto_note: `Chiuso il ${it(oggi)}: il suggerimento della settimana non si scrive piu' fra gli alert. Il programma della settimana dopo si fissa il mercoledi' e si legge nel modulo Predittivita' Secondarie.` });
  }
  return aperti.length;
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    // Il workflow del mercoledi' gira senza utente; se invece la chiama una
    // persona, solo l'amministratore puo' fissare il programma.
    const chiamante = await base44.auth.me().catch(() => null);
    if (chiamante && !eAmministratore(chiamante)) return rispostaSolaLettura();
    const e = base44.asServiceRole.entities;
    const oggi = oggiRoma();
    const anno = annoInCorso();

    const { dati, calcolo, risposta } = await predittivitaDellAnno(base44, { anno, puoFissare: true });
    // I suggerimenti vecchi si chiudono comunque: non dipendono dai numeri.
    let suggerimentiChiusi = 0;
    try { suggerimentiChiusi = await chiudiSuggerimenti(e.Alert, oggi); } catch (_) { /* si riprova il mercoledi' dopo */ }

    const settimana = risposta.prossima_settimana;
    const periodo = `la settimana dal ${it(settimana.dal)} al ${it(settimana.al)}`;
    const base = {
      anno, settimana, dati_al: risposta.dati_al, settimana_scorsa_completa: risposta.settimana_scorsa_completa,
      avvisi: risposta.avvisi.map(a => a.testo), suggerimenti_chiusi: suggerimentiChiusi,
    };

    if (dati.caricamento_in_corso) {
      return Response.json({
        ...base, rinviato: true, fissato: false,
        error: `Rinviato: ${String(dati.caricamento_in_corso).replace(/\.\s*$/, '')}. Il programma per ${periodo} non si fissa su un archivio forse a meta': a caricamento concluso si puo' rilanciare il workflow del mercoledi', o l'amministratore lo fissa a mano dal modulo Predittivita' Secondarie.`,
      }, { status: 409 });
    }
    if (risposta.configurazione_vuota) {
      const riassunto = `Nessun programma per ${periodo}: la predittivita' del ${anno} non ha impianti seguiti con un target di rete. Vanno configurati prima impianti, stoccaggi e target dell'anno.`;
      return Response.json({ ...base, ok: true, fissato: false, riassunto, righe: [] });
    }

    // Il workflow passa due volte, alle 8 e alle 14: il secondo passaggio serve
    // solo se alle 8 c'era un caricamento in corso. Un programma gia' fissato per
    // la settimana dopo non si rifa': deve restare quello deciso.
    if (risposta.programma.some(r => r.fissato && !r.fissato.manuale)) {
      const riassunto = `Il programma per ${periodo} era gia' fissato: resta com'e'. Per cambiarlo, l'amministratore lo corregge dal modulo Predittivita' Secondarie.`;
      return Response.json({ ...base, ok: true, fissato: false, gia_fissato: true, riassunto, righe: [] });
    }

    const righe = risposta.programma.map(r => ({ stoccaggio: r.stoccaggio, impianto: r.impianto, viaggi: r.viaggi, motivo: r.motivo }));
    const esito = righe.length
      ? await fissaProgramma(e, { anno, settimana: settimana.dal, righe, kgPerViaggio: calcolo.kg_per_viaggio, manuale: false, esistenti: dati.programmati, impianti: dati.ingresso.impianti })
      : { scritte: 0, lasciate: 0 };

    // Il riassunto: quello che vale adesso per la settimana, corretto a mano compreso.
    const parti = [];
    if (!righe.length) parti.push(`Nessun viaggio da programmare per ${periodo}: la programmazione degli impianti seguiti e' chiusa, o nessuno stoccaggio li alimenta.`);
    else {
      const totale = risposta.programma.reduce((t, r) => t + (r.fissato && r.fissato.manuale ? r.fissato.viaggi : r.viaggi), 0);
      const elenco = risposta.programma.map(r => (r.fissato && r.fissato.manuale
        ? `${r.stoccaggio} → ${r.impianto}: ${viaggi(r.fissato.viaggi)} (corretti a mano, restano cosi'; il calcolo ne direbbe ${r.viaggi})`
        : `${r.stoccaggio} → ${r.impianto}: ${viaggi(r.viaggi)}`));
      parti.push(`Programma fissato per ${periodo}, ${viaggi(totale)} in tutto: ${elenco.join('; ')}.`);
    }
    parti.push(`Dati caricati fino al ${it(risposta.dati_al)}${risposta.settimana_scorsa_completa ? '' : ": la settimana scorsa potrebbe non essere completa"}.`);
    return Response.json({ ...base, ok: true, fissato: righe.length > 0, scritte: esito.scritte, lasciate_manuali: esito.lasciate, righe, riassunto: parti.join(' ') });
  } catch (error) {
    return Response.json({ error: `Il programma del mercoledi' non e' riuscito: ${error && error.message ? error.message : String(error)}` }, { status: 500 });
  }
}

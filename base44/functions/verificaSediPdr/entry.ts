import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from '../../shared/fetchAll.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { daVerificare, esitoVerifica, riportaDecisione, ultimaVerificaPerPdr, normalizzaIndirizzo, verificaApplicabile, decisioneDiAltroPunto } from "../../shared/sediOperative.ts";

// CONTROLLA IN RETE LA SEDE OPERATIVA DEI PUNTI DI RACCOLTA.
//
// Sul formulario va la sede operativa (l'unita' locale), non la sede legale: il
// 06/10/2026 un formulario e' stato preparato sull'indirizzo sbagliato perche' a
// portale EUROGOMME SRL di Lavello riportava ancora una vecchia sede legale.
// Qui si cerca in rete, si confronta, e si SCRIVE SOLO UNA PROPOSTA: l'indirizzo
// che vale lo decide l'amministratore, e non si tocca mai l'entita' Pdr, che il
// caricamento successivo riscriverebbe da zero.
//
// Payload: { ids?: number[], limite?: number, giorni_validita?: number,
//            anno?: number, motivo?: string }
// Senza ids si prendono i punti di raccolta che hanno ordini assegnati
// nell'anno: sono quelli per cui un formulario si prepara davvero.
// Il limite e' basso di proposito: ogni ricerca in rete e' lenta, e la pagina
// richiama la funzione finche' «restanti» non e' zero.

const LIMITE_PREDEFINITO = 4;
const LIMITE_MASSIMO = 10;

const SCHEMA = {
  type: 'object',
  properties: {
    indirizzo: { type: 'string', description: 'Via e numero civico della sede operativa, vuoto se non si trova' },
    cap: { type: 'string' },
    comune: { type: 'string' },
    provincia: { type: 'string' },
    altre_sedi: { type: 'string', description: 'Le altre unita\' locali trovate, una per riga' },
    fonti: { type: 'array', items: { type: 'string' }, description: 'Gli indirizzi internet consultati' },
    confidenza: { type: 'string', enum: ['alta', 'media', 'bassa'] },
    spiegazione: { type: 'string' },
  },
  required: ['indirizzo', 'fonti', 'confidenza'],
};

const comeOggetto = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch (_e) { return {}; }
};

// conLimiteRichieste avvolge le entita' e le funzioni, NON le integrazioni: una
// ricerca respinta per troppe richieste al minuto non verrebbe ripetuta e si
// perderebbe il controllo di quel punto di raccolta. Come in
// elaboraReportSettimanale, si riprova dopo una pausa crescente.
const ATTESE_RITENTATIVO = [5000, 12000, 25000];
async function conRitentativi(fn) {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const messaggio = String(e && e.message ? e.message : e);
      if (!/rate limit|too many requests|429/i.test(messaggio) || i >= ATTESE_RITENTATIVO.length) throw e;
      await new Promise(r => setTimeout(r, ATTESE_RITENTATIVO[i]));
    }
  }
}

function promptPer(p) {
  const portale = [p.indirizzo_pdr, p.cap_pdr, p.comune_pdr, p.provincia_pdr ? '(' + p.provincia_pdr + ')' : ''].filter(Boolean).join(' ');
  // Quando l'indirizzo del punto di raccolta e' la copia della sede legale,
  // spesso nessuno ha mai scritto la sede operativa: e' il caso di Eurogomme, ed
  // e' un indizio che vale la pena dare a chi cerca. Da solo non e' un allarme:
  // per la maggior parte dei gommisti l'officina E' la sede legale.
  const comeLaSedeLegale = normalizzaIndirizzo(p.indirizzo_pdr) && normalizzaIndirizzo(p.indirizzo_pdr) === normalizzaIndirizzo(p.sede_legale);
  return [
    'Sei l\'addetto che prepara i formulari di identificazione del rifiuto (FIR) per un\'azienda italiana che ritira pneumatici fuori uso presso gommisti e autodemolitori.',
    'Sul formulario deve comparire la SEDE OPERATIVA del produttore - l\'unita\' locale dove si va davvero a ritirare: officina, piazzale, magazzino - e non la sede legale.',
    '',
    'Trova la sede operativa di questo soggetto:',
    `- Ragione sociale: ${p.ragione_sociale || p.descrizione_pdr || ''}`,
    p.descrizione_pdr && p.descrizione_pdr !== p.ragione_sociale ? `- Insegna del punto di raccolta: ${p.descrizione_pdr}` : '',
    p.partita_iva ? `- Partita IVA: ${p.partita_iva}` : '',
    p.codice_fiscale && p.codice_fiscale !== p.partita_iva ? `- Codice fiscale: ${p.codice_fiscale}` : '',
    `- Comune: ${p.comune_pdr || p.comune || ''} (${p.provincia_pdr || p.provincia || ''})`,
    `- Indirizzo che risulta a noi, che potrebbe essere vecchio o essere la sede legale: ${portale}`,
    comeLaSedeLegale ? '- Attenzione: nei nostri dati questo indirizzo e\' scritto anche come sede legale, quindi potrebbe non essere mai stata registrata la sede operativa vera. Controlla con attenzione se l\'officina sta altrove.' : '',
    '',
    'Regole, tutte importanti:',
    '- Cerca schede dell\'attivita\' su mappe ed elenchi (mappe, pagine gialle, elenchi di aziende, registro imprese), il sito dell\'azienda, le sue pagine pubbliche.',
    '- Riporta SOLO quello che hai letto su una fonte che citi: elenca gli indirizzi internet consultati. Senza una fonte consultabile lascia l\'indirizzo vuoto e le fonti vuote: dire «non si trova» e\' una risposta giusta, inventare no.',
    '- NON dedurre l\'indirizzo da quello che ti ho dato io e non correggerlo a mente: se la rete conferma lo stesso indirizzo, ripetilo citando dove l\'hai letto.',
    '- Se il soggetto ha piu\' unita\' locali, metti in «indirizzo» quella che fa officina o deposito nel comune indicato e le altre in «altre_sedi».',
    '- Attenzione agli omonimi: lo stesso nome in un altro comune non e\' lo stesso soggetto. Se non sei sicuro che sia lui, confidenza «bassa» e scrivilo nella spiegazione.',
    '- Serve solo l\'indirizzo: niente numeri di telefono, niente nomi di persone.',
    '- Scrivi la spiegazione in italiano, in una o due righe.',
  ].filter(Boolean).join('\n');
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

    const body = await req.json().catch(() => ({}));
    const limite = Math.min(LIMITE_MASSIMO, Math.max(1, Number(body.limite) || LIMITE_PREDEFINITO));
    const giorniValidita = Math.max(1, Number(body.giorni_validita) || 180);
    const oggi = oggiRoma();
    const anno = Number(body.anno) || Number(oggi.slice(0, 4));
    const svc = base44.asServiceRole.entities;

    const [pdrTutti, verifiche] = await Promise.all([
      fetchAll(svc.Pdr, null, 'id'),
      fetchAll(svc.VerificaSedePdr, null, 'id'),
    ]);

    // I punti di raccolta per cui un formulario si prepara davvero: quelli con
    // ordini assegnati nell'anno, rete e ACI. Gli altri non si controllano:
    // sono piu' di tremila e nessuno ci va a ritirare.
    let idRichiesti = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(n => !isNaN(n));
    let elenco;
    if (idRichiesti.length) {
      const dentro = new Set(idRichiesti);
      elenco = pdrTutti.filter(p => dentro.has(Number(p.id_pdr))).map(p => ({ pdr: p, motivo: String(body.motivo || 'chiesto a mano') }));
    } else {
      const [assRete, assAci] = await Promise.all([
        fetchAll(svc.Assegnato, { anno }, 'id'),
        fetchAll(svc.AssegnatoAci, { anno }, 'id'),
      ]);
      const conOrdini = [...new Set([...assRete, ...assAci].map(a => Number(a.id_pdr)).filter(n => !isNaN(n)))];
      elenco = daVerificare({ pdr: pdrTutti, idPdrConOrdini: conOrdini, verifiche, oggi, giorniValidita, limite: 10000 });
    }

    const restantiPrima = elenco.length;
    const daFare = elenco.slice(0, limite);
    const ultime = ultimaVerificaPerPdr(verifiche);
    const core = base44.asServiceRole.integrations.Core;
    const fatte = [];

    for (const { pdr: p, motivo } of daFare) {
      const portale = {
        indirizzo: String(p.indirizzo_pdr || ''),
        cap: String(p.cap_pdr || ''),
        comune: String(p.comune_pdr || ''),
        provincia: String(p.provincia_pdr || ''),
      };
      let esito;
      try {
        const risposta = comeOggetto(await conRitentativi(() => core.InvokeLLM({
          prompt: promptPer(p),
          add_context_from_internet: true,
          response_json_schema: SCHEMA,
        })));
        esito = esitoVerifica({ portale, risposta });
      } catch (e) {
        esito = {
          esito: 'errore', confidenza: 'bassa', fonti: [],
          indirizzo_trovato: '', cap_trovato: '', comune_trovato: '', provincia_trovato: '', altre_sedi: '',
          spiegazione: 'La ricerca non e\' riuscita: ' + (e && e.message ? e.message : String(e)),
        };
      }

      const nuova = {
        id_pdr: Number(p.id_pdr),
        id_cliente: Number(p.id_cliente) || undefined,
        ragione_sociale: String(p.ragione_sociale || ''),
        descrizione_pdr: String(p.descrizione_pdr || ''),
        partita_iva: String(p.partita_iva || ''),
        indirizzo_portale: portale.indirizzo,
        cap_portale: portale.cap,
        comune_portale: portale.comune,
        provincia_portale: portale.provincia,
        verificato_il: oggi,
        verificato_da: user.email || '',
        motivo_controllo: motivo,
        superata: false,
        ...esito,
      };
      // Una decisione gia' presa su dati che non sono cambiati non si butta via.
      // Ma vale solo se il punto e' ancora dello stesso soggetto: un gommista che
      // chiude e si re-iscrive prende un numero nuovo, e un numero vecchio puo'
      // ritrovarsi addosso un'altra azienda.
      const precedenteApplicabile = verificaApplicabile(ultime.get(Number(p.id_pdr)), p).vale
        ? ultime.get(Number(p.id_pdr))
        : null;
      Object.assign(nuova, riportaDecisione(nuova, precedenteApplicabile));
      // Se lo stesso soggetto aveva gia' una sede decisa su un ALTRO punto di
      // raccolta - il caso della re-iscrizione - non si applica da sola, perche'
      // e' un altro luogo: si scrive accanto, cosi' chi decide lo sa.
      if (nuova.stato === 'da_decidere') {
        const altrove = decisioneDiAltroPunto(p, verifiche);
        if (altrove) {
          const vecchio = [altrove.indirizzo_per_formulario || altrove.indirizzo_portale, altrove.cap_per_formulario || altrove.cap_portale, altrove.comune_per_formulario || altrove.comune_portale].filter(Boolean).join(', ');
          nuova.nota = `Lo stesso soggetto aveva gia' una sede decisa sul punto di raccolta ${altrove.id_pdr}: ${vecchio} (deciso il ${String(altrove.deciso_il || altrove.verificato_il || '').slice(0, 10)}). E' un altro punto, quindi va deciso di nuovo.`;
        }
      }

      // La precedente resta come storico, ma marcata superata: vale la piu' recente.
      const precedente = ultime.get(Number(p.id_pdr));
      if (precedente && precedente.id && !precedente.superata) {
        await svc.VerificaSedePdr.update(precedente.id, { superata: true });
      }
      const creata = await svc.VerificaSedePdr.create(nuova);
      fatte.push({
        id_pdr: nuova.id_pdr, id: creata && creata.id, ragione_sociale: nuova.ragione_sociale,
        esito: nuova.esito, confidenza: nuova.confidenza, motivo,
        indirizzo_portale: nuova.indirizzo_portale, indirizzo_trovato: nuova.indirizzo_trovato,
        fonti: nuova.fonti,
      });
    }

    const conta = (e) => fatte.filter(f => f.esito === e).length;
    return Response.json({
      anno,
      controllati: fatte.length,
      restanti: Math.max(0, restantiPrima - fatte.length),
      riepilogo: {
        coincide: conta('coincide'), incerto: conta('incerto'), diverso: conta('diverso'),
        non_trovato: conta('non_trovato'), errore: conta('errore'),
      },
      verifiche: fatte,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

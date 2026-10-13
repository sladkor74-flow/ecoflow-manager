import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from '../../shared/fetchAll.ts';
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { controlliTariffaAttiva, controlliUnitaTariffa } from "../../shared/ecotyreTariffe.ts";
import { conflittiTariffa, periodoTariffa } from "../../shared/conflittiTariffa.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { traccia, eliminaConTraccia, utenteDellaRichiesta, unisciTracce } from "../../shared/traccia.ts";
import { riferimentiFornitore, riferimentiTariffa, testoRiferimenti, ARCHIVI_MOVIMENTI } from "../../shared/riferimentiAnagrafica.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";

// Gestisce le operazioni di scrittura su entità anagrafiche (Tariffa, Fornitore, Servizio).
// FornitoreSecondaria non passa piu' di qui (27/09/2026): i collegamenti degli
// stoccaggi sono dati dell'anno e si scrivono in Target & Status, con l'anno.
// Solo l'amministratore può eseguire creazione/modifica/cancellazione.
// Per Tariffa (create/update) applica validazione server-side:
//   - campi obbligatori, chiave di unicità, sovrapposizione periodi, auto-chiusura rinegoziazione.
// Le regole dei conflitti stanno in shared/conflittiTariffa.ts dall'11/10/2026,
// perche' le usa anche la copia d'anno (preparaAnno).
// Payload: { entita, operazione, id?, dati?, motivo?, conferma_eliminazione? }
//
// LE TARIFFE SI SCRIVONO CON LA TRACCIA (11/10/2026). Prezzo, unita', date di
// validita' e stato di una tariffa, scritti a mano o chiusi da un prezzo nuovo,
// finiscono nello storico delle modifiche (ModificaDato, shared/traccia.ts) con
// chi, quando, il valore di prima e il motivo che arriva nel payload. La
// risposta porta traccia: { scritta, righe, motivo? }; se lo storico non si
// scrive la tariffa resta salvata, e la pagina lo dice.
function norm(v) {
  return String(v || '').trim().toUpperCase();
}

// UN FORNITORE (O UN SERVIZIO) NON SI SCRIVE DUE VOLTE (chiusura dell'audit,
// 11/10/2026). Le tariffe avevano il controllo dei doppioni, l'anagrafica no: in
// archivio ci sono «GATIM» e «GATIM S.R.L.», che per la passiva, la qualifica e
// i report sono lo stesso soggetto (normalizzaRagioneSociale li fa uguali) e
// che ognuno legge come vuole - resta il record letto per ultimo. Il menu delle
// tariffe propone due GATIM, ed e' da li' che e' nato il doppione delle tariffe
// del 2027. Qui si rifiuta il nome nuovo, o il nome cambiato, che coincide con
// uno che c'e' gia'; il doppione esistente lo toglie l'amministratore dalla
// pagina, tenendo il record a cui puntano le tariffe. Una modifica che lascia il
// nome com'e' (i ruoli, lo stato, il «fattura tramite») passa sempre: finche' il
// doppione c'e', rifiutarla vorrebbe dire non poter piu' toccare nessuno dei due.
const CAMPO_NOME = { Fornitore: 'ragione_sociale', Servizio: 'nome' };
const chiaveNome = (nome) => normalizzaRagioneSociale(String(nome || ''));
async function nomeGiaPresente(base44, entita, nome, idEscluso = null) {
  const chiave = chiaveNome(nome);
  if (!chiave) return null;
  const tutti = await fetchAll(base44.asServiceRole.entities[entita]);
  return tutti.find(x => x && x.id !== idEscluso && chiaveNome(x[CAMPO_NOME[entita]]) === chiave) || null;
}

// PRIMA DI ELIMINARE SI GUARDA CHI LO USA (audit del 20/09, alta A88; corretta
// il 12/10/2026). Un fornitore o una tariffa si eliminavano subito: le tariffe,
// le voci della passiva, i contratti e i movimenti restavano senza il loro
// soggetto o senza prezzo, e lo storico registrava l'eliminazione senza
// fermarla. Ora, se qualcosa li usa, si risponde 409 con l'elenco
// (shared/riferimentiAnagrafica.ts) e la proposta che non rompe niente -
// disattivare il fornitore, chiudere il periodo della tariffa -; si elimina lo
// stesso solo con conferma_eliminazione, e il motivo nello storico lo dice.
// Se un archivio non si legge, l'errore sale: un controllo a meta' direbbe
// «nessuno lo usa» quando non lo sa.
//
// Lo stesso vale per il record da eliminare (revisione del 13/10/2026): la sua
// lettura finiva in un catch che dava null, e con null il controllo si saltava,
// cosi' un errore passeggero bastava a eliminare senza domande un fornitore
// usato. Se non si legge, si risponde errore e non si elimina niente.
async function riferimentiPrimaDiEliminare(base44, entita, id) {
  const svc = base44.asServiceRole.entities;
  const [cosa, eliminato] = entita === 'Tariffa' ? ['la tariffa', 'eliminata'] : ['il fornitore', 'eliminato'];
  let record;
  try {
    record = await svc[entita].get(id);
  } catch (e) {
    throw new Error(`Non riesco a leggere ${cosa} da eliminare (${e && e.message ? e.message : e}): non l'ho ${eliminato}, riprova.`);
  }
  if (!record) throw new Error(`Non trovo ${cosa} da eliminare: non l'ho ${eliminato}, ricarica la pagina.`);
  const movimenti = {};
  for (const archivio of ARCHIVI_MOVIMENTI) movimenti[archivio] = await fetchAll(svc[archivio]);
  const fornitori = await fetchAll(svc.Fornitore);
  // «Chiudi periodo» solo a una tariffa ancora aperta (revisione del
  // 13/10/2026): a una gia' chiusa - dal 01/01/2027 tutte quelle del 2026 - la
  // proposta portava a chiuderla a oggi, cioe' ad allungarla, contro i contratti
  // annuali senza tacito rinnovo. La regola, e il testo per una tariffa chiusa,
  // stanno in riferimentiTariffa e testoRiferimenti; qui si passa il giorno
  // italiano di oggi.
  if (entita === 'Tariffa') return riferimentiTariffa(record, { movimenti, fornitori, oggi: oggiRoma() });
  const [tariffe, voci, contratti] = [await fetchAll(svc.Tariffa), await fetchAll(svc.VocePassivaAmministrazione), await fetchAll(svc.ContrattoFornitore)];
  return riferimentiFornitore(record, { tariffe, fornitori, voci, contratti, movimenti });
}

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();
    const { entita, operazione, id, dati, motivo, conferma_eliminazione } = await req.json();
    const svc = base44.asServiceRole.entities;
    const comeScrive = { utente: utenteDellaRichiesta(user), origine: 'Tariffe & Anagrafiche', motivo: String(motivo || '').trim() };
    const tracce = [];

    const ENTITA_AMMESSE = ['Tariffa', 'Fornitore', 'Servizio'];
    const OPERAZIONI_AMMESSE = ['create', 'update', 'delete'];

    if (!ENTITA_AMMESSE.includes(entita)) {
      return Response.json({ error: 'Entità non ammessa. Valori validi: ' + ENTITA_AMMESSE.join(', ') }, { status: 400 });
    }
    if (!OPERAZIONI_AMMESSE.includes(operazione)) {
      return Response.json({ error: 'Operazione non ammessa. Valori validi: ' + OPERAZIONI_AMMESSE.join(', ') }, { status: 400 });
    }
    if ((operazione === 'update' || operazione === 'delete') && !id) {
      return Response.json({ error: 'ID obbligatorio per update e delete' }, { status: 400 });
    }

    // === VALIDAZIONE TARIFFA (create e update) ===
    let tariffeChiuse = [];
    // Gli avvisi che non fermano il salvataggio ma devono arrivare a chi salva.
    const avvisiTariffa = [];
    if (entita === 'Tariffa' && (operazione === 'create' || operazione === 'update')) {
      let effettivi = dati || {};

      // Per update, fondi il record esistente con i nuovi dati
      if (operazione === 'update') {
        const esistente = await base44.asServiceRole.entities.Tariffa.get(id);
        effettivi = { ...esistente, ...dati };
      }

      // a) Campi obbligatori (valore zero ammesso) - distinti per direzione
      const isAttiva = norm(effettivi.direzione) === 'ATTIVA';
      const campiObbligatori = isAttiva
        ? ['cliente', 'direzione', 'tipologia', 'unita_misura', 'valore']
        : ['fornitore_id', 'direzione', 'tipologia', 'prestazione', 'unita_misura', 'valore'];
      const mancanti = campiObbligatori.filter(c => {
        const v = effettivi[c];
        if (c === 'valore') return v === undefined || v === null;
        return v === undefined || v === null || String(v).trim() === '';
      });
      if (mancanti.length > 0) {
        return Response.json({ error: 'Campi obbligatori mancanti', mancanti }, { status: 400 });
      }

      // ATTIVA non ammette prestazione
      if (isAttiva && effettivi.prestazione && String(effettivi.prestazione).trim() !== '') {
        return Response.json({ error: 'Il campo prestazione non si applica alla fatturazione attiva.' }, { status: 400 });
      }

      // servizio_ecotyre si applica solo alla fatturazione attiva
      if (!isAttiva && effettivi.servizio_ecotyre && String(effettivi.servizio_ecotyre).trim() !== '') {
        return Response.json({ error: 'Il campo servizio_ecotyre si applica solo alla fatturazione attiva.' }, { status: 400 });
      }

      // Il prezzo unico che comprende il trattamento riguarda solo la raccolta
      // passiva: altrove non avrebbe significato.
      if (effettivi.comprensiva_trattamento === true && (isAttiva || norm(effettivi.prestazione) !== 'RACCOLTA')) {
        return Response.json({ error: 'Il prezzo unico comprensivo del trattamento si applica solo alle tariffe passive di raccolta.' }, { status: 400 });
      }

      // f) Data fine precedente a data inizio
      const inizio = effettivi.data_inizio_validita;
      const fine = effettivi.data_fine_validita;
      if (inizio && fine && new Date(fine) < new Date(inizio)) {
        return Response.json({ error: 'La data di fine validità precede la data di inizio' }, { status: 400 });
      }

      // TUTTE ammessa solo per TRASPORTO_SECONDARIA
      if (norm(effettivi.tipologia) === 'TUTTE' && norm(effettivi.prestazione) !== 'TRASPORTO_SECONDARIA') {
        return Response.json({ error: 'La tipologia TUTTE è ammessa solo per il trasporto delle secondarie.' }, { status: 400 });
      }

      // b-e) Verifica conflitti (chiave distinta per direzione). Le passive si
      // leggono tutte, non solo quelle dello stesso fornitore_id: lo stesso
      // fornitore scritto in due modi (due righe in anagrafica) e' lo stesso
      // fornitore anche qui, come per la passiva (conflittiTariffa.ts, 11/10/2026).
      // Le passive si leggono senza filtro sulla direzione: una tariffa salvata
      // prima che il campo esistesse non ce l'ha scritto, ed e' passiva.
      const esistenti = isAttiva
        ? await fetchAll(base44.asServiceRole.entities.Tariffa, { direzione: 'ATTIVA' })
        : (await fetchAll(base44.asServiceRole.entities.Tariffa)).filter(t => norm(t.direzione || 'PASSIVA') === 'PASSIVA');
      // Caso d: chiudibile se senza data fine e la nuova comincia dopo.
      const { conflitti, chiudibili } = conflittiTariffa(effettivi, esistenti, operazione === 'update' ? id : null);

      if (conflitti.length > 0) {
        const c = conflitti[0];
        const periodo = periodoTariffa(c);
        const desc = isAttiva
          ? `cliente: ${c.cliente}, tipologia: ${c.tipologia}, regione: ${c.regione || 'tutte'}`
          : `${c.fornitore_nome} (prestazione: ${c.prestazione})`;
        return Response.json({
          error: `Conflitto con tariffa esistente per ${desc}, periodo: ${periodo}. Modifica la chiave o le date di validità.`,
          conflitto: { id: c.id, fornitore_nome: c.fornitore_nome, prestazione: c.prestazione, cliente: c.cliente, tipologia: c.tipologia, regione: c.regione, periodo }
        }, { status: 409 });
      }

      // f) I DUE MODI SILENZIOSI DI ROMPERE LA TARIFFA UNICA (06/10/2026):
      // un'unita' di misura sbagliata, che moltiplica o divide per mille, e una
      // seconda tariffa dello stesso canale legata a una dicitura, che
      // scavalcherebbe quella che vale per tutte. Il primo e' un errore e ferma
      // il salvataggio; il secondo e' un avviso che torna a chi salva.
      // L'unita' di misura si controlla anche sulle passive (11/10/2026): 90 €/kg
      // si salvava, e nel foglio dell'amministrazione diventava 90.000 €/t.
      const controlli = isAttiva ? controlliTariffaAttiva(effettivi, esistenti) : controlliUnitaTariffa(effettivi);
      const errore = controlli.find(c => c.gravita === 'errore');
      if (errore) return Response.json({ error: errore.messaggio }, { status: 400 });
      avvisiTariffa.push(...controlli.map(c => c.messaggio));

      // d) Chiudi le tariffe chiudibili (rinegoziazione prezzo)
      // La tariffa chiusa resta 'attivo': lo stato non_attivo vuol dire "non
      // deve valere mai", e usarlo qui cancellerebbe il prezzo da tutti i mesi
      // gia' fatturati con quel prezzo. A dire fino a quando vale e' la data di
      // fine. Nell'elenco delle tariffe sparisce lo stesso, perche' isArchiviata
      // guarda anche la data di fine passata.
      for (const t of chiudibili) {
        const fineChiusura = new Date(inizio);
        fineChiusura.setDate(fineChiusura.getDate() - 1);
        const dataFine = fineChiusura.toISOString().slice(0, 10);
        const chiusa = await traccia(svc, 'Tariffa', t.id, { data_fine_validita: dataFine }, {
          ...comeScrive,
          motivo: `chiusa dal prezzo nuovo che vale dal ${String(inizio).slice(0, 10).split('-').reverse().join('/')}${comeScrive.motivo ? `: ${comeScrive.motivo}` : ''}`,
        });
        tracce.push(chiusa.traccia);
        tariffeChiuse.push({
          id: t.id, fornitore_nome: t.fornitore_nome,
          data_fine_validita: dataFine, valore: t.valore, unita_misura: t.unita_misura,
        });
      }
    }

    // Il nome di un fornitore o di un servizio: nuovo, o cambiato, non deve
    // coincidere con uno che c'e' gia'.
    if ((entita === 'Fornitore' || entita === 'Servizio') && (operazione === 'create' || operazione === 'update')) {
      const campo = CAMPO_NOME[entita];
      const nome = dati && dati[campo];
      if (operazione === 'create' && !String(nome || '').trim()) {
        return Response.json({ error: `Il ${entita === 'Fornitore' ? 'fornitore' : 'servizio'} ha bisogno di un nome.` }, { status: 400 });
      }
      // Su una modifica si controlla solo se il nome cambia davvero.
      let cambiaNome = nome !== undefined;
      if (cambiaNome && operazione === 'update') {
        const prima = await base44.asServiceRole.entities[entita].get(id).catch(() => null);
        cambiaNome = !prima || chiaveNome(prima[campo]) !== chiaveNome(nome);
      }
      if (cambiaNome) {
        const gia = await nomeGiaPresente(base44, entita, nome, operazione === 'update' ? id : null);
        if (gia) {
          const chi = String(gia[campo] || '').trim();
          return Response.json({
            error: `«${String(nome).trim()}» e «${chi}» sono lo stesso ${entita === 'Fornitore' ? 'fornitore' : 'servizio'} per il gestionale (stesso nome normalizzato): usa quello che c'e' gia', o correggi il suo nome.`,
            doppione: { id: gia.id, nome: chi, stato: gia.stato || '' },
          }, { status: 409 });
        }
      }
    }

    // Fornitori e servizi non hanno campi tracciati: passano di qui lo stesso,
    // e si scrivono senza una lettura in piu'.
    let result;
    if (operazione === 'create' || operazione === 'update') {
      const scritta = await traccia(svc, entita, operazione === 'update' ? id : null, dati || {}, comeScrive);
      tracce.push(scritta.traccia);
      result = scritta.record;
    } else if (operazione === 'delete') {
      // Chi usa il fornitore o la tariffa (A88, 12/10/2026): vedi
      // riferimentiPrimaDiEliminare qui sopra.
      if (entita === 'Fornitore' || entita === 'Tariffa') {
        const riferimenti = await riferimentiPrimaDiEliminare(base44, entita, id);
        if (riferimenti && riferimenti.totale > 0) {
          if (conferma_eliminazione !== true) {
            return Response.json({ error: testoRiferimenti(riferimenti), riferimenti, richiede_conferma: true, conferma: 'eliminazione' }, { status: 409 });
          }
          comeScrive.motivo = [comeScrive.motivo, `eliminazione confermata nonostante: ${riferimenti.elenco.join("; ")}`].filter(Boolean).join(' — ');
        }
      }
      const tolta = await eliminaConTraccia(svc, entita, id, comeScrive);
      tracce.push(tolta.traccia);
      result = { id, deleted: true };
    }

    const response = { result, traccia: unisciTracce(tracce) };
    if (tariffeChiuse.length > 0) {
      response.tariffe_chiuse = tariffeChiuse;
    }
    // Gli avvisi non fermano il salvataggio, ma non si perdono per strada.
    if (avvisiTariffa.length > 0) {
      response.avvisi = avvisiTariffa;
    }
    return Response.json(response);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
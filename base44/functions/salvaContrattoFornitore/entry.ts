import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { riferimentoDalCorpo } from "../../shared/fileScaricabile.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";
import { richiestoA } from "../../shared/qualificaFornitori.ts";
import { CANALI_CONTRATTO, TIPI_CONTRATTO } from "../../shared/contrattiDellAnno.ts";

// IL SALVATAGGIO DI UN CONTRATTO A UN FORNITORE: generato, rigenerato,
// controfirmato (giro K3 delle segnalazioni del 20/09, corretto il 12/10/2026).
//
// Due difetti veri sul codice dell'11/10/2026, tutti e due nella pagina:
// - rigenerare un contratto gia' inviato o controfirmato lo rimetteva
//   «generato» e sostituiva il file senza dire niente: la copia mandata al
//   fornitore e la sua data sparivano dal gestionale. Ora serve una conferma
//   esplicita (conferma_rigenera) e la versione di prima resta, col suo file, il
//   suo stato e le sue date, in versioni_json;
// - il contratto controfirmato non si poteva caricare: c'era solo «segna
//   controfirmato», e il documento firmato restava fuori dal gestionale. Ora il
//   firmato diventa il documento del contratto (il generato passa fra le
//   versioni), e se nel catalogo della qualifica c'e' una voce «contratto» per
//   quel ruolo il firmato diventa anche il documento di qualifica del fornitore
//   (documento_qualifica_id), da leggere come gli altri.
//
// Si fa qui, con asServiceRole, e non nella pagina: per tenere la versione di
// prima serve il suo file_uri, e il file_uri al browser non si manda (05/10/2026).
// Solo l'amministratore. Prova: prove/contrattoFirmato.mjs.
//
// Payload:
//   { azione: 'genera', contratto_id?, dati: { anno, soggetto_chiave, soggetto_nome,
//     tipo_contratto, canale, ... }, file_uri, file_nome, conferma_rigenera? }
//   { azione: 'controfirmato', contratto_id, file_uri, file_nome, giorno: 'aaaa-mm-gg' }

const STATI_GIA_FUORI = ['inviato', 'controfirmato'];

// I campi che la pagina puo' scrivere generando un contratto: gli altri (stato,
// file, date dei passaggi, versioni) li decide questa funzione.
const CAMPI_DATI = ['anno', 'soggetto_chiave', 'soggetto_nome', 'tipo_contratto', 'canale', 'modello_id', 'modello_nome',
  'contratto_precedente_id', 'data_inizio', 'data_fine', 'quantitativo_previsto_t', 'condizioni_pagamento', 'valori_json', 'note'];

const testo = (v) => String(v ?? '').trim();
const giornoValido = (g) => /^\d{4}-\d{2}-\d{2}$/.test(testo(g));

const leggiVersioni = (c) => {
  try { const v = JSON.parse((c && c.versioni_json) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};

/** La fotografia della versione che sta per essere sostituita: file, stato e date. */
function versioneDi(c, motivo, il) {
  return {
    file_uri: c.file_uri || '', file_nome: c.file_nome || '', stato: c.stato || '',
    documento_firmato: !!c.documento_firmato, generato_il: c.generato_il || null,
    inviato_il: c.inviato_il || null, controfirmato_il: c.controfirmato_il || null,
    valori_json: c.valori_json || null, modello_nome: c.modello_nome || null,
    sostituito_il: il, motivo,
  };
}

const quando = (c) => (c.stato === 'controfirmato' && c.controfirmato_il ? ` il ${testo(c.controfirmato_il).split('-').reverse().join('/')}`
  : c.stato === 'inviato' && c.inviato_il ? ` il ${testo(c.inviato_il).split('-').reverse().join('/')}` : '');

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'I contratti li genera e li carica solo l\'amministratore.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    const ora = new Date().toISOString();

    const { rif, errore } = riferimentoDalCorpo(body);
    if (errore) return Response.json({ error: errore }, { status: 400 });
    if (!rif) return Response.json({ error: 'Manca il documento: caricalo prima di salvare.' }, { status: 400 });
    const fileNome = testo(body.file_nome) || 'contratto.docx';

    if (body.azione === 'genera') {
      // Un campo che la pagina non manda si scrive vuoto (null), non si lascia
      // com'era: rigenerando senza quantita' il contratto non deve tenere quella
      // della versione di prima, e un valore mancante non e' zero.
      const dati = {};
      for (const k of CAMPI_DATI) dati[k] = body.dati && body.dati[k] !== undefined && body.dati[k] !== '' ? body.dati[k] : null;
      dati.anno = Number(dati.anno);
      dati.canale = testo(dati.canale) || 'RETE';
      if (!dati.anno || !testo(dati.soggetto_chiave) || !TIPI_CONTRATTO.some(t => t.chiave === dati.tipo_contratto)) {
        return Response.json({ error: 'Mancano anno, fornitore o tipo del contratto.' }, { status: 400 });
      }
      if (!CANALI_CONTRATTO.includes(dati.canale)) return Response.json({ error: `Il canale ${dati.canale} non ha contratti annuali.` }, { status: 400 });

      // Il contratto che c'e' gia': quello indicato, o lo stesso fornitore, tipo,
      // canale e anno (un doppio clic non deve fare due contratti).
      let esistente = null;
      if (testo(body.contratto_id)) esistente = await svc.ContrattoFornitore.get(testo(body.contratto_id)).catch(() => null);
      if (!esistente) {
        const stessi = await svc.ContrattoFornitore.filter({ anno: dati.anno, soggetto_chiave: dati.soggetto_chiave, tipo_contratto: dati.tipo_contratto });
        esistente = stessi.find(c => (c.canale || 'RETE') === dati.canale && c.stato !== 'annullato') || null;
      }

      if (esistente && STATI_GIA_FUORI.includes(esistente.stato) && body.conferma_rigenera !== true) {
        return Response.json({
          error: `Questo contratto è già ${esistente.stato}${quando(esistente)}: rigenerandolo torna «generato» e il documento nuovo prende il posto di quello ${esistente.stato === 'controfirmato' ? 'firmato' : 'mandato al fornitore'}. Conferma per andare avanti: la versione di prima resta nello storico del contratto.`,
          serve_conferma: true, stato: esistente.stato, inviato_il: esistente.inviato_il || null, controfirmato_il: esistente.controfirmato_il || null,
        }, { status: 409 });
      }

      const nuovo = {
        ...dati, stato: 'generato', file_uri: rif.file_uri, file_nome: fileNome, generato_il: ora,
        inviato_il: null, controfirmato_il: null, documento_firmato: false,
      };
      if (esistente) {
        const versioni = leggiVersioni(esistente);
        if (esistente.file_uri) {
          const motivo = STATI_GIA_FUORI.includes(esistente.stato)
            ? `Rigenerato il ${oggiRoma().split('-').reverse().join('/')}: questa versione era ${esistente.stato}${quando(esistente)}.`
            : `Rigenerato il ${oggiRoma().split('-').reverse().join('/')}.`;
          versioni.push(versioneDi(esistente, motivo, ora));
        }
        await svc.ContrattoFornitore.update(esistente.id, { ...nuovo, versioni_json: JSON.stringify(versioni) });
        return Response.json({ ok: true, contratto_id: esistente.id, versioni: versioni.length, era: esistente.stato });
      }
      // Un contratto nuovo non ha niente da svuotare: i campi vuoti non si scrivono.
      const creato = await svc.ContrattoFornitore.create(Object.fromEntries(Object.entries(nuovo).filter(([, v]) => v !== null)));
      return Response.json({ ok: true, contratto_id: creato.id, versioni: 0, era: null });
    }

    if (body.azione === 'controfirmato') {
      const giorno = testo(body.giorno);
      if (!giornoValido(giorno) || giorno > oggiRoma()) return Response.json({ error: 'La data della firma va scritta come aaaa-mm-gg e non può essere futura.' }, { status: 400 });
      const contratto = testo(body.contratto_id) ? await svc.ContrattoFornitore.get(testo(body.contratto_id)).catch(() => null) : null;
      if (!contratto) return Response.json({ error: 'Il contratto non esiste: generalo prima di caricare il firmato.' }, { status: 404 });

      const versioni = leggiVersioni(contratto);
      if (contratto.file_uri) versioni.push(versioneDi(contratto, `Sostituito dal controfirmato caricato il ${oggiRoma().split('-').reverse().join('/')}.`, ora));
      const aggiornamento = {
        file_uri: rif.file_uri, file_nome: fileNome, documento_firmato: true,
        stato: 'controfirmato', controfirmato_il: giorno, versioni_json: JSON.stringify(versioni),
      };

      // Il legame con la qualifica: la voce del catalogo della famiglia
      // «contratto» che vale per il ruolo di questo contratto. Se non ce n'e'
      // una sola non si sceglie a caso: il firmato resta sul contratto e si dice.
      const ruolo = (TIPI_CONTRATTO.find(t => t.chiave === contratto.tipo_contratto) || {}).ruolo;
      const catalogo = await svc.TipoDocumentoQualifica.list('ordine', 500).catch(() => []);
      const voci = catalogo.filter(t => t && t.categoria === 'contratto' && richiestoA(t, { chiave: contratto.soggetto_chiave, ruoli: ruolo ? [ruolo] : [] }));
      let documento = null;
      let motivo = '';
      if (voci.length === 1) {
        const voce = voci[0];
        // Nasce «in_attesa»: la lettura (analizzaDocumentoQualifica) la chiama la
        // scheda Contratti appena riceve documento_qualifica_id, come fa la scheda
        // del fornitore dopo un caricamento a mano. Senza, dopo dieci minuti la
        // qualifica lo dava «da verificare» per un'analisi interrotta che non era
        // mai partita (revisione del 13/10/2026, prove/contrattoFirmato.mjs).
        documento = await svc.DocumentoQualifica.create({
          soggetto_chiave: contratto.soggetto_chiave, soggetto_nome: contratto.soggetto_nome || contratto.soggetto_chiave,
          tipo_documento_id: voce.id, tipo_documento_nome: voce.nome,
          file_uri: rif.file_uri, file_nome: fileNome, stato: 'attivo', analisi_stato: 'in_attesa',
          data_emissione: giorno,
          note: `Contratto ${contratto.tipo_contratto} ${contratto.canale || 'RETE'} ${contratto.anno} controfirmato, caricato dalla scheda Contratti.`,
        });
        aggiornamento.documento_qualifica_id = documento.id;
        // Il documento di prima di quella voce passa fra i sostituiti, come in un
        // caricamento a mano; non quelli degli altri contratti dello stesso anno
        // (la raccolta di rete e quella ACI sono due contratti veri, tutti e due validi).
        //
        // NE' IL CONTRATTO IN CORSO, SE IL NUOVO DECORRE PIU' AVANTI (revisione del
        // 13/10/2026). Il 2027 si controfirma a dicembre: mandare subito fra i
        // sostituiti il 2026, valido fino al 31/12, lasciava il requisito al solo
        // contratto nuovo, ancora da leggere, e il fornitore scendeva «da
        // completare» (o «critico», se la lettura trovava un problema) mentre il
        // contratto in vigore c'era. Ora, quando la decorrenza del nuovo (la data di
        // inizio del contratto, o il 1 gennaio del suo anno) viene dopo oggi, resta
        // attivo il documento che oggi vale ancora (scadenza non passata): il
        // requisito si regge sul migliore dei due (documentoDelRequisito in
        // qualificaFornitori.ts) e, quando il vecchio scade accanto al nuovo
        // valido, la qualifica lo chiude da sola (chiudiContrattiSuperati). Il
        // documento che questo stesso contratto aveva gia' (un firmato ricaricato)
        // e quelli scaduti o senza scadenza si sostituiscono come sempre.
        const oggi = oggiRoma();
        const decorrenza = giornoValido(String(contratto.data_inizio || '').slice(0, 10)) ? String(contratto.data_inizio).slice(0, 10)
          : Number(contratto.anno) ? `${Number(contratto.anno)}-01-01` : null;
        const decorrePiuAvanti = !!decorrenza && decorrenza > oggi;
        const scadenzaDi = (p) => [p.data_scadenza_manuale, p.data_scadenza].map(v => String(v || '').slice(0, 10)).find(giornoValido) || null;
        const altriDellAnno = new Set((await svc.ContrattoFornitore.filter({ anno: contratto.anno, soggetto_chiave: contratto.soggetto_chiave }))
          .filter(c => c.id !== contratto.id && c.documento_qualifica_id).map(c => c.documento_qualifica_id));
        const precedenti = await svc.DocumentoQualifica.filter({ soggetto_chiave: contratto.soggetto_chiave, tipo_documento_id: voce.id, stato: 'attivo' });
        for (const p of precedenti) {
          if (p.id === documento.id || altriDellAnno.has(p.id)) continue;
          const ancoraInVigore = decorrePiuAvanti && p.id !== contratto.documento_qualifica_id && (scadenzaDi(p) || '') >= oggi;
          if (ancoraInVigore) continue;
          await svc.DocumentoQualifica.update(p.id, { stato: 'sostituito' });
        }
      } else {
        motivo = voci.length === 0
          ? 'Nel catalogo della qualifica non c\'è una voce «contratto» per questo ruolo: il firmato resta sul contratto.'
          : `Nel catalogo della qualifica ci sono ${voci.length} voci «contratto» per questo ruolo (${voci.map(v => v.nome).join(', ')}): non ne scelgo una a caso, caricalo tu dalla scheda del fornitore.`;
      }
      await svc.ContrattoFornitore.update(contratto.id, aggiornamento);
      return Response.json({
        ok: true, contratto_id: contratto.id, versioni: versioni.length,
        documento_qualifica_id: documento ? documento.id : null,
        tipo_documento_nome: documento ? documento.tipo_documento_nome : null,
        motivo_senza_qualifica: motivo || null,
      });
    }

    return Response.json({ error: 'Azione sconosciuta: genera oppure controfirmato.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import { individuaSoggetti } from "../../shared/qualificaFornitori.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";

// La situazione contrattuale di un anno: chi va contrattualizzato, per cosa, e
// a che punto e' ciascun contratto.
//
// I soggetti sono gli stessi della qualifica documentale, ricavati dai
// movimenti dell'anno con il loro ruolo: chi raccoglie vuole un contratto di
// raccolta, chi stocca uno di stoccaggio, e cosi' via. Per ognuno si cerca il
// contratto dell'anno chiesto e quello dell'anno prima, che e' la base da cui
// si parte per il rinnovo.
//
// Rete, ACI ed extra raccolta restano canali separati anche qui.
//
// Payload: { anno }

const TIPI = [
  { chiave: 'raccolta', ruolo: 'raccolta' },
  { chiave: 'stoccaggio', ruolo: 'stoccaggio' },
  { chiave: 'trattamento', ruolo: 'trattamento' },
  { chiave: 'trasporto_secondaria', ruolo: 'trasporto_secondaria' },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { anno } = await req.json();
    const annoNum = Number(anno) || new Date().getUTCFullYear();
    const svc = base44.asServiceRole.entities;

    // I contratti si fanno per l'anno che viene, ma i soggetti si conoscono dai
    // movimenti di quello in corso: se l'anno chiesto non ha ancora movimenti si
    // guarda l'anno prima, altrimenti non ci sarebbe nessuno da contrattualizzare.
    let soggetti = await individuaSoggetti(base44, annoNum);
    let annoSoggetti = annoNum;
    if (!soggetti.length) {
      soggetti = await individuaSoggetti(base44, annoNum - 1);
      annoSoggetti = annoNum - 1;
    }

    const [contratti, modelli, fornitori, targetRacc, impiantiTarget] = await Promise.all([
      fetchAll(svc.ContrattoFornitore),
      svc.ModelloContratto.filter({ stato: 'attivo' }, 'tipo_contratto', 100),
      fetchAll(svc.Fornitore),
      svc.TargetRaccoglitore.filter({ anno: annoNum }, 'raccoglitore', 500),
      svc.ImpiantoTargetSecondaria.filter({ stato: 'attivo' }, 'nome_impianto', 100),
    ]);

    const perChiave = (elenco, campo) => {
      const m = new Map();
      for (const x of elenco) {
        const k = normalizzaRagioneSociale(x[campo]);
        if (k && !m.has(k)) m.set(k, x);
      }
      return m;
    };
    const fornitorePer = perChiave(fornitori, 'ragione_sociale');
    const impiantoPer = perChiave(impiantiTarget, 'nome_impianto');

    // I target per raccoglitore si sommano fra le regioni: il contratto e' uno solo.
    const targetPer = new Map();
    for (const t of targetRacc) {
      const k = normalizzaRagioneSociale(t.raccoglitore);
      if (!k) continue;
      targetPer.set(k, (targetPer.get(k) || 0) + (Number(t.target_tonnellate) || 0));
    }

    const righe = [];
    let attesi = 0, fatti = 0;
    for (const s of soggetti) {
      const f = fornitorePer.get(s.chiave) || null;
      const suoi = [];
      for (const tipo of TIPI) {
        if (!s.ruoli.includes(tipo.ruolo)) continue;
        // Il canale si ricava dai ruoli: per ora i contratti si fanno sulla rete,
        // e l'ACI si aggiunge a mano quando serve, perche' le condizioni sono altre.
        const canale = 'RETE';
        const contratto = contratti.find(c => c.soggetto_chiave === s.chiave && c.tipo_contratto === tipo.chiave
          && (c.canale || 'RETE') === canale && Number(c.anno) === annoNum && c.stato !== 'annullato') || null;
        const precedente = contratti.find(c => c.soggetto_chiave === s.chiave && c.tipo_contratto === tipo.chiave
          && (c.canale || 'RETE') === canale && Number(c.anno) === annoNum - 1 && c.stato !== 'annullato') || null;
        const modello = modelli.find(m => m.tipo_contratto === tipo.chiave && (m.canale || 'RETE') === canale) || null;

        const impianto = impiantoPer.get(s.chiave);
        const target = tipo.chiave === 'raccolta' ? (targetPer.get(s.chiave) || null)
          : (impianto && impianto.target ? Math.round(Number(impianto.target) / 1000) : null);

        attesi++;
        if (contratto && contratto.stato === 'controfirmato') fatti++;
        suoi.push({
          tipo: tipo.chiave,
          canale,
          stato: contratto ? contratto.stato : 'mancante',
          contratto_id: contratto ? contratto.id : null,
          contratto: contratto ? {
            id: contratto.id, data_inizio: contratto.data_inizio, data_fine: contratto.data_fine,
            quantitativo_previsto_t: contratto.quantitativo_previsto_t, condizioni_pagamento: contratto.condizioni_pagamento,
            file_nome: contratto.file_nome, file_uri: contratto.file_uri, generato_il: contratto.generato_il,
            modello_nome: contratto.modello_nome, note: contratto.note,
          } : null,
          precedente_id: precedente ? precedente.id : null,
          precedente: precedente ? {
            id: precedente.id, anno: precedente.anno, data_inizio: precedente.data_inizio, data_fine: precedente.data_fine,
            quantitativo_previsto_t: precedente.quantitativo_previsto_t, condizioni_pagamento: precedente.condizioni_pagamento,
            file_nome: precedente.file_nome, valori_json: precedente.valori_json,
          } : null,
          modello_id: modello ? modello.id : null,
          modello_nome: modello ? modello.nome : null,
          target_t: target,
        });
      }
      if (!suoi.length) continue;
      righe.push({
        chiave: s.chiave,
        nome: s.nome,
        ruoli: s.ruoli,
        fornitore_id: f ? f.id : null,
        piva: (f && f.piva) || s.piva || '',
        fornitore: f ? {
          ragione_sociale: f.ragione_sociale, piva: f.piva, codice_fiscale: f.codice_fiscale,
          indirizzo: f.indirizzo, cap: f.cap, comune: f.comune, provincia: f.provincia,
          email: f.email, telefono: f.telefono,
        } : null,
        contratti: suoi,
      });
    }
    righe.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

    return Response.json({
      anno: annoNum,
      anno_soggetti: annoSoggetti,
      soggetti: righe,
      modelli: modelli.map(m => ({
        id: m.id, nome: m.nome, tipo_contratto: m.tipo_contratto, canale: m.canale || 'RETE',
        anno_riferimento: m.anno_riferimento, file_nome: m.file_nome, file_uri: m.file_uri,
        segnaposti_json: m.segnaposti_json,
      })),
      totali: { attesi, controfirmati: fatti, da_fare: attesi - fatti },
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

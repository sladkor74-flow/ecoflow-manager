import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { leggiListaDaFogli, arricchisciLista, indiceMese } from "../../shared/evasioneAssegnati.ts";
import { caricaDati, cancellaVecchi, eseguiControlli } from "../../shared/evasioneAssegnatiDati.ts";
import { valoreCampo, eliminaCampo } from "../../shared/testoLungo.ts";

// Carica la lista degli assegnati inviata a un raccoglitore per un mese.
//
// Payload: { anno, mese, raccoglitore_chiave, raccoglitore_nome, file_nomi, fogli, inviata_il }
// inviata_il e' il giorno in cui la lista e' stata mandata al raccoglitore: da
// li' partono cronologia, priorita' e trascurate. Senza, vale la data di oggi.
// I file vengono aperti nel browser e qui arrivano solo le celle, con
// l'indicazione delle righe evidenziate: nessun file viene salvato.
//
// Caricare la lista di un mese cancella quella del mese precedente dello stesso
// raccoglitore, con tutti i suoi controlli: finita la verifica di un mese quello
// storico non serve piu'. Ricaricare la lista dello stesso mese la sostituisce.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: richiesto ruolo admin' }, { status: 403 });

    const body = await req.json();
    const anno = Number(body.anno), mese = Number(body.mese);
    const { raccoglitore_chiave, raccoglitore_nome } = body;
    if (!anno || !mese || !raccoglitore_chiave) return Response.json({ error: 'anno, mese e raccoglitore sono obbligatori' }, { status: 400 });
    if (!Array.isArray(body.fogli) || body.fogli.length === 0) return Response.json({ error: 'Nessun foglio da leggere' }, { status: 400 });
    const inviataIl = /^\d{4}-\d{2}-\d{2}$/.test(String(body.inviata_il || '')) ? String(body.inviata_il) : new Date().toISOString().slice(0, 10);

    const lettura = leggiListaDaFogli(body.fogli);
    if (lettura.righe.length === 0) {
      return Response.json({ error: 'Nei file non ho trovato ID ordine del portale. La lista deve contenere la colonna ID degli assegnati, per esempio ET26001380.' }, { status: 400 });
    }

    const dati = await caricaDati(base44);
    const righe = arricchisciLista(lettura.righe, dati.assegnati, dati.terminati, dati.cancellati);

    const cancellati = await cancellaVecchi(base44, { finoAIndice: indiceMese(anno, mese), raccoglitoreChiave: raccoglitore_chiave });

    const listaCreata = await base44.asServiceRole.entities.ListaAssegnati.create({
      raccoglitore_chiave,
      raccoglitore_nome,
      anno, mese,
      file_nomi: String(body.file_nomi || ''),
      caricata_il: new Date().toISOString(),
      inviata_il: inviataIl,
      righe_json: '',
      avvisi_json: '',
      richieste: righe.length,
      prioritarie: righe.filter(r => r.prioritaria).length,
    });
    // Le liste lunghe superano la dimensione di un campo: si salvano divise in parti.
    let lista;
    try {
      const campi = {
        righe_json: await valoreCampo(base44, 'ListaAssegnati', listaCreata.id, 'righe_json', JSON.stringify(righe)),
        avvisi_json: await valoreCampo(base44, 'ListaAssegnati', listaCreata.id, 'avvisi_json', JSON.stringify(lettura.avvisi)),
      };
      await base44.asServiceRole.entities.ListaAssegnati.update(listaCreata.id, campi);
      lista = { ...listaCreata, ...campi };
    } catch (e) {
      await eliminaCampo(base44, 'ListaAssegnati', listaCreata.id).catch(() => {});
      await base44.asServiceRole.entities.ListaAssegnati.delete(listaCreata.id).catch(() => {});
      throw e;
    }

    await eseguiControlli(base44, { liste: [lista], dati, forza: true });

    return Response.json({
      lista_id: lista.id,
      inviata_il: inviataIl,
      richieste: righe.length,
      prioritarie: lista.prioritarie,
      non_riconosciute: righe.filter(r => r.stato_al_caricamento === 'non_riconosciuta').length,
      gia_evase: righe.filter(r => r.stato_al_caricamento === 'gia_evasa').length,
      gia_annullate: righe.filter(r => r.stato_al_caricamento === 'annullata').length,
      avvisi: lettura.avvisi,
      fogli: lettura.fogli,
      cancellati,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

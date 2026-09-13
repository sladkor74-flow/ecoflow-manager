// Accesso ai dati per il controllo dell'evasione degli assegnati: caricamento
// degli archivi, esecuzione dei controlli e pulizia di cio' che non serve piu'.
// Il calcolo vero e proprio sta in evasioneAssegnati.ts.

import { fetchAll } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { oggiRoma } from "./reportSettimanali.ts";
import { normalizzaPrimaria, normalizzaAssegnato, trovaTarget, controllaLista, indiceMese, MESI } from "./evasioneAssegnati.ts";

const terminato = (r) => String(r.stato || '').toLowerCase().trim() === 'terminato';

export async function caricaDati(base44) {
  const svc = base44.asServiceRole.entities;
  const [rete, aci, assRete, assAci, fornitori] = await Promise.all([
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
    fetchAll(svc.Assegnato),
    fetchAll(svc.AssegnatoAci),
    fetchAll(svc.Fornitore),
  ]);
  const terminati = [
    ...rete.filter(terminato).map(r => normalizzaPrimaria(r, 'rete')),
    ...aci.filter(terminato).map(r => normalizzaPrimaria(r, 'aci')),
  ].filter(t => t.id_ordine && t.fine);
  const assegnati = [
    ...assRete.map(r => normalizzaAssegnato(r, 'rete')),
    ...assAci.map(r => normalizzaAssegnato(r, 'aci')),
  ].filter(a => a.id_ordine);
  const anagrafica = new Map();
  for (const f of fornitori) {
    const k = normalizzaRagioneSociale(f.ragione_sociale);
    if (k) anagrafica.set(k, f);
  }
  return { terminati, assegnati, anagrafica };
}

export async function ultimoCaricamentoPrimarie(base44) {
  const log = await base44.asServiceRole.entities.UploadLog.filter({ tipo_file: 'primarie', esito: 'successo' }, '-created_date', 1);
  return log.length ? log[0].created_date : null;
}

/**
 * Cancella liste e controlli di mesi che non servono piu'.
 * Con raccoglitoreChiave cancella solo quelli di quel raccoglitore: e' il caso
 * del caricamento della lista di un nuovo mese. Senza, e' la rete di sicurezza
 * che elimina tutto cio' che e' piu' vecchio del mese precedente.
 */
export async function cancellaVecchi(base44, { finoAIndice, raccoglitoreChiave = null }) {
  const svc = base44.asServiceRole.entities;
  const [liste, controlli] = await Promise.all([fetchAll(svc.ListaAssegnati), fetchAll(svc.ControlloEvasione)]);
  const daCancellare = (x) => indiceMese(Number(x.anno), Number(x.mese)) <= finoAIndice
    && (!raccoglitoreChiave || x.raccoglitore_chiave === raccoglitoreChiave);
  let n = 0;
  for (const c of controlli) if (daCancellare(c)) { await svc.ControlloEvasione.delete(c.id); n++; }
  for (const l of liste) if (daCancellare(l)) { await svc.ListaAssegnati.delete(l.id); n++; }
  return n;
}

export function indiceSicurezza() {
  const oggi = oggiRoma();
  return indiceMese(+oggi.slice(0, 4), +oggi.slice(5, 7)) - 2;
}

/**
 * Esegue il controllo sulle liste indicate.
 * Senza "forza" una lista gia' controllata sull'ultimo caricamento delle
 * primarie viene saltata: il controllo resta uno per caricamento.
 */
export async function eseguiControlli(base44, { liste, dati, forza = false }) {
  const svc = base44.asServiceRole.entities;
  const oggi = oggiRoma();
  const primarieIl = await ultimoCaricamentoPrimarie(base44);
  const tutteLeListe = await fetchAll(svc.ListaAssegnati);
  const targetPerAnno = new Map();
  const eseguiti = [];

  for (const lista of liste) {
    const anno = Number(lista.anno), mese = Number(lista.mese);
    if (!forza) {
      const ultimo = await svc.ControlloEvasione.filter({ lista_id: lista.id }, '-eseguito_il', 1);
      if (ultimo.length && ultimo[0].primarie_caricate_il === primarieIl && String(ultimo[0].eseguito_il) >= String(lista.caricata_il)) continue;
    }
    if (!targetPerAnno.has(anno)) targetPerAnno.set(anno, await fetchAll(svc.TargetRaccoglitorePrimaria, { anno }));
    const targets = targetPerAnno.get(anno).filter(t => t.mese === MESI[mese - 1]);
    const target = trovaTarget(targets, lista.raccoglitore_nome);

    const altreListe = tutteLeListe
      .filter(l => Number(l.anno) === anno && Number(l.mese) === mese)
      .map(l => ({ chiave: l.raccoglitore_chiave, nome: l.raccoglitore_nome, ids: new Set(JSON.parse(l.righe_json || '[]').map(r => r.id_ordine)) }));

    const { riepilogo, alert, esito } = controllaLista({
      lista: { righe: JSON.parse(lista.righe_json || '[]'), caricata_il: lista.caricata_il },
      raccoglitore: { chiave: lista.raccoglitore_chiave, nome: lista.raccoglitore_nome },
      anno, mese, oggi,
      terminati: dati.terminati,
      assegnati: dati.assegnati,
      altreListe,
      targetKg: target && Number(target.target_kg) > 0 ? Number(target.target_kg) : null,
    });

    const record = await svc.ControlloEvasione.create({
      lista_id: lista.id,
      raccoglitore_chiave: lista.raccoglitore_chiave,
      raccoglitore_nome: lista.raccoglitore_nome,
      anno, mese,
      eseguito_il: new Date().toISOString(),
      primarie_caricate_il: primarieIl,
      ...riepilogo,
      alert_json: JSON.stringify(alert),
      esito_json: JSON.stringify(esito),
    });
    eseguiti.push(record);
  }
  return eseguiti;
}

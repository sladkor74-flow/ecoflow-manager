import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { ARCHIVI_CON_FILE, voceFile, csvInventario, contaInventario, testoRichiesta } from "../../shared/inventarioFile.ts";

// L'ELENCO DEI FILE CHE LA PIATTAFORMA TIENE PER NOI.
//
// La piattaforma non sa cancellare un file (confermato dalla sua assistenza il
// 30/09/2026) e non mostra da nessuna parte quali file abbia. L'unico modo per
// farne rimuovere uno e' chiederlo al loro team indicandogli quale: questa
// funzione produce quella lista.
//
// Solo l'amministratore: e' l'inventario di tutti i documenti aziendali caricati,
// e i riferimenti dei file PUBBLICI sono indirizzi che funzionano per chiunque li
// abbia. Non e' una pagina da lasciare in giro.
//
// Risposta: { conta, csv, voci }. Il CSV e' quello da allegare alla richiesta.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!eAmministratore(user)) return rispostaSolaLettura();

    const svc = base44.asServiceRole.entities;
    const voci = [];
    const guasti = [];
    for (const def of ARCHIVI_CON_FILE) {
      // Un archivio che non si riesce a leggere si DICE: un inventario corto e
      // silenzioso farebbe credere che i file siano pochi, e si chiederebbe di
      // rimuoverne una parte credendo di averli chiesti tutti.
      try {
        const righe = await fetchAll(svc[def.entita], null, 'id');
        for (const r of righe) {
          const v = voceFile(def, r);
          if (v) voci.push(v);
        }
      } catch (e) {
        guasti.push(`${def.entita}: ${e && e.message ? e.message : e}`);
      }
    }

    const conta = contaInventario(voci);
    return Response.json({
      ok: true,
      conta,
      ...(guasti.length ? { archivi_non_letti: guasti } : {}),
      // La frase da scrivere nella richiesta, coi conti giusti: ogni file di
      // questo elenco e' in uso da un record, e solo i pubblici vanno rimossi.
      // Senza, l'elenco si legge come una lista di cancellazioni (02/10/2026).
      richiesta: testoRichiesta(conta),
      csv: csvInventario(voci),
      voci,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

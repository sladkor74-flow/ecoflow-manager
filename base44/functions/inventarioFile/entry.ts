import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { ARCHIVI_CON_FILE, voceFile, voceOrfana, csvInventario, contaInventario, testoRichiesta } from "../../shared/inventarioFile.ts";
import { avvisoFileDallInventario } from "../../shared/fileArchivio.ts";
import { oggiRoma } from "../../shared/giornoItaliano.ts";

// L'ELENCO DEI FILE CHE LA PIATTAFORMA TIENE PER NOI.
//
// La piattaforma non sa cancellare un file (confermato dalla sua assistenza il
// 30/09/2026) e non mostra da nessuna parte quali file abbia. L'unico modo per
// farne rimuovere uno e' chiederlo al loro team indicandogli quale: questa
// funzione produce quella lista.
//
// Il 02/10/2026 la stessa assistenza ha detto anche le due cose che mancavano:
// che un file non scade mai e resta anche dopo che il suo record e' stato
// cancellato o sostituito, e che li rimuove su richiesta se le si manda il
// file_uri dei privati o l'indirizzo completo dei pubblici. Da allora l'elenco
// comprende anche i file che nessun record usa piu' (FileDaRimuovere): prima non
// si potevano nemmeno nominare.
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

    // IL REGISTRO DEI FILE CHE NESSUN RECORD USA PIU'.
    //
    // Non e' un archivio come gli altri. Negli altri il file lo nomina il record
    // che lo usa; qui il record e' stato cancellato e il nome del file ce l'ha
    // solo questo registro, che le cancellazioni scrivono prima di procedere
    // (shared/fileDaRimuovere.ts). Senza questo pezzo l'inventario resta quello
    // che era fino al 02/10/2026: l'elenco dei file in uso, cioe' proprio quelli
    // che NON si fanno rimuovere.
    //
    // Quelli gia' rimossi restano nel registro ma non nell'elenco: la lista
    // serve a chiedere, non a rileggere la storia delle richieste.
    try {
      const registro = await fetchAll(svc.FileDaRimuovere, null, 'id');
      for (const r of registro) {
        if (String(r.stato || '') === 'rimosso') continue;
        const v = voceOrfana(r);
        if (v) voci.push(v);
      }
    } catch (e) {
      guasti.push('FileDaRimuovere: ' + (e && e.message ? e.message : e));
    }

    const conta = contaInventario(voci);

    // L'AVVISO SI RIFA' DA QUI (10/10/2026).
    //
    // Questo e' il posto che sa quanti file ci sono davvero: l'avviso lo deve
    // leggere da qui e non dall'esito di una pulizia, che vede solo i file di
    // quel giro. Se non si riesce, la risposta esce lo stesso: un inventario
    // che non parte perche' non ha potuto riscrivere un avviso sarebbe un
    // servizio in meno, non uno in piu'.
    let avviso = null;
    try {
      avviso = await avvisoFileDallInventario(base44, { conta, voci, oggi: oggiRoma() });
    } catch (e) {
      avviso = { errore: e && e.message ? e.message : String(e) };
    }

    return Response.json({
      ok: true,
      conta,
      avviso,
      ...(guasti.length ? { archivi_non_letti: guasti } : {}),
      // La frase da scrivere nella richiesta, coi conti giusti: si fanno
      // rimuovere i file con indirizzo pubblico e quelli che nessun record usa
      // piu', e NON si tocca il resto, che sono i documenti che i record stanno
      // usando. Senza questa frase l'elenco si legge come una lista di
      // cancellazioni, ed e' cosi' che il 02/10/2026 sono stati chiesti per
      // sbaglio anche i 144 documenti di qualifica.
      richiesta: testoRichiesta(conta),
      csv: csvInventario(voci),
      voci,
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

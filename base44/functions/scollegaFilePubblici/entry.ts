import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { eAmministratore, rispostaSolaLettura } from "../../shared/permessi.ts";
import { ARCHIVI_CON_FILE, voceFile } from "../../shared/inventarioFile.ts";
import { annotaFileDaRimuovere, voceDaRimuovere } from "../../shared/fileDaRimuovere.ts";

// TOGLIE DAI RECORD I LINK DEI FILE PUBBLICI.
//
// I file caricati fino al 30/09/2026 sono saliti in area pubblica: il loro
// indirizzo funziona per chiunque ce l'abbia, per sempre, e la piattaforma non
// sa cancellarli. Quegli indirizzi stanno scritti nei nostri record - soprattutto
// in UploadLog, che TUTTI gli utenti collegati possono leggere (rls read: true,
// serve alle pagine per accorgersi di un caricamento nuovo). Finche' restano li',
// il gestionale distribuisce da solo il link a un documento aziendale.
//
// Questa funzione li svuota. E' il rimedio che descrive l'assistenza della
// piattaforma: "removing it from your records hides it in your app". Il file
// resta sul loro storage - quello lo rimuove solo il loro team - ma il
// gestionale smette di dire a chiunque dove si trova.
//
// NON E' REVERSIBILE, e l'ordine conta: quei campi sono l'unico elenco dei file
// da far rimuovere. Si esegue DOPO aver scaricato l'inventario e averlo mandato
// al team (pulsante "Elenco dei file caricati" in Caricamento Dati). Per questo
// vuole una conferma esplicita e, senza, si limita a dire che cosa farebbe.
//
// Payload: { conferma: true } per eseguire; senza, e' solo un conteggio.
export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!eAmministratore(user)) return rispostaSolaLettura();

    const { conferma } = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;

    // Solo gli archivi che tengono un indirizzo PUBBLICO: sui privati non c'e'
    // niente da chiudere, il link firmato scade da solo.
    const conPubblici = ARCHIVI_CON_FILE.filter(d => d.campoUrl);
    const daFare = [];
    const guasti = [];
    for (const def of conPubblici) {
      try {
        for (const r of await fetchAll(svc[def.entita], null, 'id')) {
          const v = voceFile(def, r);
          if (v && v.genere === 'pubblico') daFare.push({ def, id: r.id, riferimento: v.riferimento, descrizione: v.descrizione });
        }
      } catch (e) {
        guasti.push(`${def.entita}: ${e && e.message ? e.message : e}`);
      }
    }

    // Un archivio non letto vuol dire che non si sa quanti ne restano li' dentro:
    // svuotare gli altri e dire "fatto" sarebbe una mezza verita'.
    if (guasti.length) {
      return Response.json({
        error: `Non si riescono a leggere tutti gli archivi (${guasti.join('; ')}). Non si tocca niente: svuotarne una parte lascerebbe gli altri link in giro senza dirlo.`,
        archivi_non_letti: guasti,
      }, { status: 502 });
    }

    const riepilogo = [...new Set(daFare.map(x => x.def.entita))].map(e => ({
      entita: e,
      record: daFare.filter(x => x.def.entita === e).length,
      file: new Set(daFare.filter(x => x.def.entita === e).map(x => x.riferimento)).size,
    }));

    if (!conferma) {
      return Response.json({
        ok: true, eseguito: false,
        record: daFare.length,
        file: new Set(daFare.map(x => x.riferimento)).size,
        per_archivio: riepilogo,
        nota: 'Nessun record è stato toccato. Scarica prima l\'elenco dei file caricati e mandalo al team della piattaforma: questi campi sono l\'unico posto dove quegli indirizzi sono scritti.',
      });
    }

    // PRIMA DI CANCELLARE L'INDIRIZZO, ANNOTARLO NEL REGISTRO.
    //
    // Lo dice la nota qui sopra: questi campi sono l'unico posto dove quegli
    // indirizzi sono scritti. Svuotarli senza annotarli vuol dire che quei file
    // restano in area pubblica per sempre e nessuno sa piu' quali chiedere di
    // rimuovere: la piattaforma non sa cancellare, e il registro FileDaRimuovere
    // esiste apposta per tenere l'elenco di quelli che nessun record usa piu'
    // (audit del 03/10/2026).
    const oggi = new Date().toISOString().slice(0, 10);
    const annotati = await annotaFileDaRimuovere(svc.FileDaRimuovere, daFare.map(x => voceDaRimuovere({
      entita: x.def.entita,
      record: { id: x.id, file_url: x.riferimento },
      motivo: 'riferimento pubblico scollegato dal record',
      cosa: x.def.cosa || '',
      descrizione: x.descrizione || '',
      oggi,
    })));

    let svuotati = 0;
    const falliti = [];
    for (const x of daFare) {
      try {
        await svc[x.def.entita].update(x.id, { [x.def.campoUrl]: '' });
        svuotati++;
      } catch (e) {
        falliti.push(`${x.def.entita}/${x.id}: ${e && e.message ? e.message : e}`);
      }
    }

    return Response.json({
      ok: true, eseguito: true,
      svuotati,
      per_archivio: riepilogo,
      annotati_nel_registro: annotati.annotati,
      ...(annotati.errore ? { registro_errore: annotati.errore } : {}),
      ...(falliti.length ? { non_svuotati: falliti } : {}),
      nota: 'I link pubblici non sono più scritti in nessun record: il gestionale non li distribuisce più. Gli indirizzi restano nel registro dei file da rimuovere, che è l\'elenco da mandare al team della piattaforma. I file restano sullo storage finché non li rimuove lui.',
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

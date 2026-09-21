// Accesso ai dati per il controllo dell'evasione degli assegnati: caricamento
// degli archivi, esecuzione dei controlli e pulizia di cio' che non serve piu'.
// Il calcolo vero e proprio sta in evasioneAssegnati.ts.

import { fetchAll } from "./fetchAll.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { oggiRoma } from "./giornoItaliano.ts";
import { eTerminato } from "./movimenti.ts";
import { eAci } from "./canaleSecondaria.ts";
import { normalizzaPrimaria, normalizzaAssegnato, normalizzaCancellato, controllaLista, indiceMese, MESI } from "./evasioneAssegnati.ts";
import { targetMensiliAnno, targetRaccoglitoreMese } from "./targetRaccoglitori.ts";
import { valoreCampo, leggiJson, leggiCampo, eliminaCampo } from "./testoLungo.ts";

const stato = (r) => String(r.stato || '').toLowerCase().trim();
// Extra raccolta: solo le primarie, cioe' le raccolte presso un produttore. Le
// richieste si inseriscono a mano come assegnate e diventano terminate con FIR,
// fine trasporto e peso effettivo.
const primariaExtra = (r) => String(r.tipo_movimento || 'primaria').toLowerCase() !== 'secondaria';
// Il canale lo decide eAci, la regola di tutto il gestionale (come canaleMovimento
// di movimenti.ts): l'archivio ACI resta ACI, e un record ACI rimasto nell'archivio
// della rete da un'importazione vecchia non entra nei conti della rete.
const canalePrimaria = (r, archivioAci) => (archivioAci || eAci(r) ? 'aci' : 'rete');

// === caricamenti delle primarie ===

// Oltre questo tempo un caricamento ancora aperto si e' interrotto: la soglia del
// registro dei caricamenti, la stessa di importaBlocco e di statoCaricamenti.
const FINESTRA_IN_CORSO_MS = 10 * 60 * 1000;
// created_date arriva in UTC senza la Z finale: si rimette prima di leggerla.
const istante = (v) => {
  const t = v ? new Date(String(v).replace(/(Z|[+-]\d{2}:?\d{2})?$/, 'Z')).getTime() : NaN;
  return isNaN(t) ? 0 : t;
};
const DATA_ORA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * I caricamenti delle primarie: l'ultimo che ha riscritto l'archivio e quello
 * rimasto aperto dopo di lui. Anche un "parziale", con poche righe fallite su
 * migliaia scritte, e' un archivio nuovo e le liste vanno ricontrollate; contando
 * solo i "successo" restavano ferme ai dati di prima. Si escludono, come ovunque,
 * "errore" e "in_corso". Un "in_corso" piu' recente dell'ultimo buono e' un
 * archivio che si sta riscrivendo, o rimasto a meta' se il caricamento si e'
 * interrotto.
 */
async function statoPrimarie(base44) {
  const log = (await base44.asServiceRole.entities.UploadLog.filter({ tipo_file: 'primarie' }, '-created_date', 20)) || [];
  const i = log.findIndex(l => l.esito !== 'errore' && l.esito !== 'in_corso');
  return {
    valido: i >= 0 ? log[i] : null,
    aperto: (i >= 0 ? log.slice(0, i) : log).find(l => l.esito === 'in_corso') || null,
  };
}

export async function ultimoCaricamentoPrimarie(base44) {
  const { valido } = await statoPrimarie(base44);
  return valido ? valido.created_date : null;
}

// Perche' gli archivi letti fra le due letture del registro non sono una base
// su cui ricontrollare, oppure null. Il registro letto solo prima non basta: un
// caricamento che parte o finisce mentre si leggono gli archivi non si vedrebbe.
function letturaInstabile(prima, dopo) {
  const aperto = dopo.aperto || prima.aperto;
  if (aperto) {
    const chi = [aperto.utente, aperto.nome_file].filter(Boolean).join(', ');
    const cosa = `Il caricamento delle primarie del ${DATA_ORA.format(new Date(istante(aperto.created_date)))}${chi ? ` (${chi})` : ''}`;
    const interrotto = Date.now() - istante(aperto.created_date) > FINESTRA_IN_CORSO_MS;
    return {
      interrotto,
      messaggio: interrotto
        ? `${cosa} risulta interrotto: l'archivio puo' essere incompleto e il caricamento va ripetuto. Fino ad allora le liste non si ricontrollano.`
        : `${cosa} non e' ancora concluso: le liste si ricontrollano quando si conclude.`,
    };
  }
  if ((prima.valido && prima.valido.id) !== (dopo.valido && dopo.valido.id)) {
    return { interrotto: false, messaggio: "Un caricamento delle primarie si e' concluso mentre si leggevano gli archivi: le liste si ricontrollano con i dati nuovi." };
  }
  return null;
}

// === archivi ===

export async function caricaDati(base44) {
  const svc = base44.asServiceRole.entities;
  const prima = await statoPrimarie(base44);
  const [rete, aci, assRete, assAci, extra, fornitori] = await Promise.all([
    fetchAll(svc.PrimariaRete),
    fetchAll(svc.PrimariaAci),
    fetchAll(svc.Assegnato),
    fetchAll(svc.AssegnatoAci),
    fetchAll(svc.ExtraRaccolta),
    fetchAll(svc.Fornitore),
  ]);
  const dopo = await statoPrimarie(base44);
  const extraPrimarie = extra.filter(primariaExtra);
  // Regola 1 (21/09/2026): il periodo di un terminato e' la sua fine trasporto,
  // mai la chiusura. Chi non ce l'ha resta nell'elenco con fine null: ogni conto
  // lo esclude (tutti filtrano su t.fine) e controllaLista e situazioneCanali lo
  // segnalano. Scartato qui, spariva in silenzio: una richiesta della lista
  // terminata cosi' risultava "non piu' presente".
  const terminati = [
    ...rete.filter(eTerminato).map(r => normalizzaPrimaria(r, canalePrimaria(r, false))),
    ...aci.filter(eTerminato).map(r => normalizzaPrimaria(r, 'aci')),
    ...extraPrimarie.filter(eTerminato).map(r => normalizzaPrimaria(r, 'extra')),
  ].filter(t => t.id_ordine);
  const assegnati = [
    ...assRete.map(r => normalizzaAssegnato(r, canalePrimaria(r, false))),
    ...assAci.map(r => normalizzaAssegnato(r, 'aci')),
    ...extraPrimarie.filter(r => stato(r) === 'assegnato').map(r => normalizzaAssegnato(r, 'extra')),
  ].filter(a => a.id_ordine);
  // Gli ordini cancellati restano nell'archivio delle primarie con il motivo.
  const cancellati = [
    ...rete.filter(r => stato(r) === 'cancellato').map(r => normalizzaCancellato(r, canalePrimaria(r, false))),
    ...aci.filter(r => stato(r) === 'cancellato').map(r => normalizzaCancellato(r, 'aci')),
  ].filter(c => c.id_ordine);
  const anagrafica = new Map();
  for (const f of fornitori) {
    const k = normalizzaRagioneSociale(f.ragione_sociale);
    if (k) anagrafica.set(k, f);
  }
  return {
    terminati, assegnati, cancellati, anagrafica,
    primarie_caricate_il: dopo.valido ? dopo.valido.created_date : null,
    // Regola 2: con un caricamento aperto l'archivio puo' essere a meta', e un
    // controllo salvato su quello resterebbe sbagliato fino al caricamento dopo.
    caricamento_aperto: letturaInstabile(prima, dopo),
  };
}

/**
 * Cancella liste e controlli di mesi che non servono piu'.
 * Con raccoglitoreChiave cancella solo quelli di quel raccoglitore: e' il caso
 * del caricamento della lista di un nuovo mese. Senza, e' la rete di sicurezza
 * che elimina tutto cio' che e' piu' vecchio del mese precedente.
 * Restituisce quante righe ha cancellato e gli indici dei mesi che hanno perso
 * una lista: le richieste passate a quella, nelle liste degli altri raccoglitori
 * dello stesso mese, cambiano stato e quelle liste vanno ricontrollate.
 */
export async function cancellaVecchi(base44, { finoAIndice, raccoglitoreChiave = null }) {
  const svc = base44.asServiceRole.entities;
  const [liste, controlli] = await Promise.all([fetchAll(svc.ListaAssegnati), fetchAll(svc.ControlloEvasione)]);
  const daCancellare = (x) => indiceMese(Number(x.anno), Number(x.mese)) <= finoAIndice
    && (!raccoglitoreChiave || x.raccoglitore_chiave === raccoglitoreChiave);
  let n = 0;
  const mesi = new Set();
  for (const c of controlli) if (daCancellare(c)) { await eliminaCampo(base44, 'ControlloEvasione', c.id); await svc.ControlloEvasione.delete(c.id); n++; }
  for (const l of liste) {
    if (!daCancellare(l)) continue;
    await eliminaCampo(base44, 'ListaAssegnati', l.id);
    await svc.ListaAssegnati.delete(l.id);
    mesi.add(indiceMese(Number(l.anno), Number(l.mese)));
    n++;
  }
  return { cancellati: n, mesi: [...mesi] };
}

export function indiceSicurezza() {
  const oggi = oggiRoma();
  return indiceMese(+oggi.slice(0, 4), +oggi.slice(5, 7)) - 2;
}

// I controlli fatti prima della regola del 21/09/2026 valutavano il mese fino a
// un margine ricavato dalla chiusura a portale (previsione.consolidato_al): vanno
// rifatti anche senza primarie nuove. ControlloEvasione non ha un campo di
// versione, quindi si legge l'esito, ma solo dei controlli eseguiti prima di
// questa data: dopo, quelli vecchi sono stati rifatti da un caricamento delle
// primarie o cancellati con la loro lista, e la lettura in piu' non serve.
const CONTROLLI_DA_VERIFICARE_FINO_AL = Date.parse('2026-10-15T00:00:00Z');

async function controlloConChiusura(base44, c) {
  if (istante(c.eseguito_il) >= CONTROLLI_DA_VERIFICARE_FINO_AL) return false;
  try {
    return (await leggiCampo(base44, 'ControlloEvasione', c, 'esito_json')).includes('"consolidato_al"');
  } catch {
    // Un esito che non si ricompone non si puo' nemmeno mostrare: si rifa'.
    return true;
  }
}

// Perche' l'ultimo controllo di una lista non vale piu', o null se vale ancora.
async function motivoRicontrollo(base44, ultimo, { targetKg, primarieIl, listeMese }) {
  if (!ultimo) return 'mai controllata';
  if ((Number(ultimo.target_kg) || null) !== targetKg) return 'target cambiato';
  if (istante(ultimo.primarie_caricate_il) !== istante(primarieIl)) return 'primarie nuove';
  // Una lista del mese, questa compresa, caricata dopo il controllo: le richieste
  // finite in quella diventano "in lista di altri", e i fuori lista che vi
  // compaiono "dalla lista di" lui.
  const eseguito = istante(ultimo.eseguito_il);
  if (listeMese.some(l => istante(l.caricata_il) > eseguito)) return 'lista caricata dopo';
  if (await controlloConChiusura(base44, ultimo)) return 'controllo sulla chiusura a portale';
  return null;
}

/**
 * Esegue il controllo sulle liste indicate.
 * Senza "forza" una lista gia' controllata sull'ultimo caricamento delle
 * primarie viene saltata: il controllo resta uno per caricamento. Si ripete
 * invece se nel frattempo e' cambiato il target del mese in Target & Status, se
 * dopo e' stata caricata la lista di un altro raccoglitore dello stesso mese, o
 * se il controllo e' di prima della regola della fine trasporto.
 *
 * L'eliminazione di una lista non lascia traccia: chi la cancella ricontrolla
 * con "forza" le liste rimaste in quel mese (caricaListaAssegnati, e la pagina
 * con controllaEvasioneAssegnati).
 *
 * Con un caricamento delle primarie aperto non si ricontrolla niente, nemmeno
 * con "forza" (regola 2): chi chiama lo trova in dati.caricamento_aperto e lo
 * dice. Una lista che non riesce non ferma le altre; gli errori si riportano
 * insieme alla fine.
 */
export async function eseguiControlli(base44, { liste, dati, forza = false }) {
  if (dati.caricamento_aperto) return [];
  const svc = base44.asServiceRole.entities;
  const oggi = oggiRoma();
  const primarieIl = dati.primarie_caricate_il !== undefined ? dati.primarie_caricate_il : await ultimoCaricamentoPrimarie(base44);
  const tutteLeListe = await fetchAll(svc.ListaAssegnati);
  // Righe delle liste, ricomposte una volta sola anche se divise in parti.
  const righeListe = new Map();
  const righeDi = async (l) => {
    if (!righeListe.has(l.id)) righeListe.set(l.id, await leggiJson(base44, 'ListaAssegnati', l, 'righe_json'));
    return righeListe.get(l.id);
  };
  const targetPerAnno = new Map();
  const eseguiti = [];
  const errori = [];

  for (const lista of liste) {
    try {
      const anno = Number(lista.anno), mese = Number(lista.mese);
      if (!targetPerAnno.has(anno)) targetPerAnno.set(anno, await targetMensiliAnno(base44, anno));
      const target = targetRaccoglitoreMese(targetPerAnno.get(anno), lista.raccoglitore_nome, MESI[mese - 1]);
      const targetKg = target && target.target_kg > 0 ? target.target_kg : null;
      const listeMese = tutteLeListe.filter(x => Number(x.anno) === anno && Number(x.mese) === mese);
      if (!forza) {
        const [ultimo] = await svc.ControlloEvasione.filter({ lista_id: lista.id }, '-eseguito_il', 1);
        if (!(await motivoRicontrollo(base44, ultimo, { targetKg, primarieIl, listeMese: [lista, ...listeMese] }))) continue;
      }

      const altreListe = [];
      for (const l of listeMese) {
        altreListe.push({ chiave: l.raccoglitore_chiave, nome: l.raccoglitore_nome, caricata_il: l.caricata_il, ids: new Set((await righeDi(l)).map(r => r.id_ordine)) });
      }

      const { riepilogo, alert, esito } = controllaLista({
        lista: { righe: await righeDi(lista), caricata_il: lista.caricata_il, inviata_il: lista.inviata_il },
        raccoglitore: { chiave: lista.raccoglitore_chiave, nome: lista.raccoglitore_nome },
        anno, mese, oggi,
        terminati: dati.terminati,
        assegnati: dati.assegnati,
        cancellati: dati.cancellati || [],
        altreListe,
        targetKg,
      });

      const creato = await svc.ControlloEvasione.create({
        lista_id: lista.id,
        raccoglitore_chiave: lista.raccoglitore_chiave,
        raccoglitore_nome: lista.raccoglitore_nome,
        anno, mese,
        eseguito_il: new Date().toISOString(),
        primarie_caricate_il: primarieIl,
        ...riepilogo,
        alert_json: '',
        esito_json: '',
      });
      // L'esito di una lista lunga supera la dimensione di un campo: diviso in parti.
      try {
        const campi = {
          alert_json: await valoreCampo(base44, 'ControlloEvasione', creato.id, 'alert_json', JSON.stringify(alert)),
          esito_json: await valoreCampo(base44, 'ControlloEvasione', creato.id, 'esito_json', JSON.stringify(esito)),
        };
        await svc.ControlloEvasione.update(creato.id, campi);
        eseguiti.push({ ...creato, ...campi });
      } catch (e) {
        await eliminaCampo(base44, 'ControlloEvasione', creato.id).catch(() => {});
        await svc.ControlloEvasione.delete(creato.id).catch(() => {});
        throw e;
      }
    } catch (e) {
      errori.push(`${lista.raccoglitore_nome || lista.raccoglitore_chiave} ${lista.mese}/${lista.anno}: ${e && e.message ? e.message : String(e)}`);
    }
  }
  if (errori.length) {
    const primi = errori.slice(0, 3).join('; ') + (errori.length > 3 ? ` (e altre ${errori.length - 3})` : '');
    throw new Error(`Controllo non riuscito su ${errori.length} ${errori.length === 1 ? 'lista' : 'liste'}: ${primi}`);
  }
  return eseguiti;
}

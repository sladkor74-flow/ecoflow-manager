import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { chiaveProduttore, abbina, divergenza, scadenzaEffettiva, unAnnoDopo } from "../../shared/omologhe.ts";

// Allinea l'elenco delle omologhe con i due fogli.
//
// Le righe arrivano gia' estratte dal browser, che legge i file Excel: qui si
// mettono in fila, si cerca dove i due fogli non vanno d'accordo e si scrive
// l'esito. Le decisioni prese dall'operatore in ufficio -- recepita, in sospeso,
// annullata, con la sua nota -- non si toccano mai: il gestionale aggiorna i
// dati, non il giudizio di chi ha verificato.
//
// Il documento si recepisce una volta, al primo ritiro, e da li' parte l'anno di
// validita': i ritiri successivi dallo stesso produttore non riportano piu'
// l'annotazione e va bene cosi'. Percio' dal registro contano la prima riga
// annotata e l'elenco di tutti i carichi, che distingue chi ha conferito senza
// che l'omologa risulti mai annotata da chi all'impianto non ha portato ancora nulla.
//
// Payload: { elenco: [...], registro: [annotati], conferitori: [...] }
// Risposta: { totale, nuovi, aggiornati, divergenze: { ... }, scomparsi }

const giorno = (v) => {
  const s = String(v ?? '').slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
};

const DATI = [
  'produttore', 'produttore_chiave', 'canale', 'tipologia_materiale', 'omologa_da', 'omologa_a', 'esito',
  'n_autorizzazione', 'autorizzazione_da', 'autorizzazione_a', 'rdp_da', 'rdp_a', 'quantitativo_max_annuo',
  'nell_elenco', 'nel_registro', 'registro_nome', 'registro_data', 'registro_riga', 'registro_volte',
  'registro_carichi', 'registro_primo_carico', 'scadenza_effettiva', 'validita_da_registro',
  'tipo_divergenza',
];

const uguali = (a, b) => DATI.every(k => {
  const x = a[k] === undefined || a[k] === null ? '' : a[k];
  const y = b[k] === undefined || b[k] === null ? '' : b[k];
  return String(x) === String(y);
});

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

    const body = await req.json();
    const elencoGrezzo = Array.isArray(body.elenco) ? body.elenco : [];
    const registroGrezzo = Array.isArray(body.registro) ? body.registro : [];
    if (!elencoGrezzo.length && !registroGrezzo.length) {
      return Response.json({ error: 'Non e\' arrivata nessuna riga dai due fogli.' }, { status: 400 });
    }

    // Un produttore scritto due volte nel nostro elenco resta uno: vale la prima riga.
    const chiaviElenco = new Set();
    let doppiElenco = 0;
    const elenco = elencoGrezzo
      .map(r => ({ ...r, nome: String(r.nome || '').trim(), chiave: chiaveProduttore(r.nome) }))
      .filter(r => r.nome && r.chiave)
      .filter(r => { if (chiaviElenco.has(r.chiave)) { doppiElenco++; return false; } chiaviElenco.add(r.chiave); return true; });
    // Nel registro lo stesso produttore puo' comparire scritto in due modi
    // ("ELGOMEC" e "ELGOMEC SNC"): si tratta come uno solo, con la prima data e
    // tutti i carichi. Altrimenti due righe finirebbero sullo stesso produttore.
    const unisci = (righe, fondi) => {
      const per = new Map();
      for (const r of righe) {
        const nome = String(r.nome || '').trim();
        const chiave = chiaveProduttore(nome);
        if (!nome || !chiave) continue;
        const gia = per.get(chiave);
        per.set(chiave, gia ? fondi(gia, r) : { ...r, nome, chiave });
      }
      return [...per.values()];
    };
    const prima = (a, b) => (a && b ? (a < b ? a : b) : a || b || null);
    const dopo = (a, b) => (a && b ? (a > b ? a : b) : a || b || null);
    const registro = unisci(registroGrezzo, (a, b) => {
      const primaB = b.data && (!a.data || b.data < a.data);
      return { ...a, data: prima(a.data, b.data), riga: primaB ? b.riga : a.riga, volte: (Number(a.volte) || 0) + (Number(b.volte) || 0) };
    });
    const conferitori = unisci(Array.isArray(body.conferitori) ? body.conferitori : [], (a, b) => ({
      ...a, carichi: (Number(a.carichi) || 0) + (Number(b.carichi) || 0), primo: prima(a.primo, b.primo), ultimo: dopo(a.ultimo, b.ultimo),
    }));

    const { abbinati, soloElenco, soloRegistro } = abbina(elenco, registro);
    const adesso = new Date().toISOString();

    // Carichi di ciascun produttore. Chi ha l'annotazione si ritrova con il nome
    // esatto, perche' viene dalla stessa colonna; per gli altri si cerca il nome
    // piu' somigliante con la stessa prudenza dell'abbinamento.
    const caricoPerChiave = new Map(conferitori.map(c => [c.chiave, c]));
    const caricoPerElenco = new Map(abbina(soloElenco, conferitori).abbinati.map(a => [a.elenco, a.registro]));
    const carichiDi = (c) => ({
      registro_carichi: c ? Number(c.carichi) || 0 : 0,
      registro_primo_carico: c ? giorno(c.primo) : null,
    });

    const desiderati = [];
    const daElenco = (e, x, punteggio) => {
      const carico = x ? caricoPerChiave.get(x.chiave) : caricoPerElenco.get(e);
      const carichi = carichiDi(carico);
      return {
      produttore: e.nome,
      produttore_chiave: e.chiave,
      canale: e.canale === 'ACI' ? 'ACI' : 'RETE',
      tipologia_materiale: String(e.tipologia || ''),
      omologa_da: giorno(e.om_da),
      omologa_a: giorno(e.om_a),
      esito: e.esito !== false,
      n_autorizzazione: String(e.n_autorizzazione || ''),
      autorizzazione_da: giorno(e.aut_da),
      autorizzazione_a: giorno(e.aut_a),
      rdp_da: giorno(e.rdp_da),
      rdp_a: giorno(e.rdp_a),
      quantitativo_max_annuo: String(e.quantitativo || ''),
      nell_elenco: true,
      nel_registro: !!x,
      registro_nome: x ? x.nome : '',
      registro_data: x ? giorno(x.data) : null,
      registro_riga: x ? Number(x.riga) || null : null,
      registro_volte: x ? Number(x.volte) || null : null,
      ...carichi,
      scadenza_effettiva: scadenzaEffettiva(giorno(e.om_a), x ? giorno(x.data) : null),
      validita_da_registro: false,
      tipo_divergenza: divergenza({
        canale: e.canale === 'ACI' ? 'ACI' : 'RETE',
        nellElenco: true, annotato: !!x, carichi: carichi.registro_carichi, ultimoCarico: carico ? giorno(carico.ultimo) : null,
        punteggio: x ? punteggio : undefined,
        dataElenco: giorno(e.om_da), dataRegistro: x ? giorno(x.data) : null,
      }),
      aggiornata_il: adesso,
      };
    };

    for (const a of abbinati) desiderati.push(daElenco(a.elenco, a.registro, a.punteggio));
    for (const e of soloElenco) desiderati.push(daElenco(e, null));
    // Chi e' annotato nel registro ma manca nell'elenco: la validita' parte dalla
    // prima annotazione, che e' il giorno in cui il documento risulta recepito.
    for (const x of soloRegistro) {
      const inizio = giorno(x.data);
      desiderati.push({
        produttore: x.nome,
        produttore_chiave: x.chiave,
        canale: 'RETE',
        tipologia_materiale: '',
        omologa_da: inizio,
        omologa_a: inizio ? unAnnoDopo(inizio) : null,
        esito: true,
        n_autorizzazione: '', autorizzazione_da: null, autorizzazione_a: null, rdp_da: null, rdp_a: null,
        quantitativo_max_annuo: '',
        nell_elenco: false,
        nel_registro: true,
        registro_nome: x.nome,
        registro_data: giorno(x.data),
        registro_riga: Number(x.riga) || null,
        registro_volte: Number(x.volte) || null,
        ...carichiDi(caricoPerChiave.get(x.chiave)),
        scadenza_effettiva: inizio ? unAnnoDopo(inizio) : null,
        validita_da_registro: !!inizio,
        tipo_divergenza: 'solo_registro',
        aggiornata_il: adesso,
      });
    }

    const svc = base44.asServiceRole.entities;
    const esistenti = await fetchAll(svc.Omologa);
    const perChiave = new Map();
    for (const r of esistenti) {
      const k = String(r.produttore_chiave || chiaveProduttore(r.produttore));
      if (!perChiave.has(k)) perChiave.set(k, r);
    }

    const nuovi = [];
    let aggiornati = 0;
    const visti = new Set();
    for (const d of desiderati) {
      visti.add(d.produttore_chiave);
      const gia = perChiave.get(d.produttore_chiave);
      if (!gia) { nuovi.push(d); continue; }
      if (uguali(gia, d)) continue;
      await svc.Omologa.update(gia.id, d);
      aggiornati++;
    }

    for (let i = 0; i < nuovi.length; i += 100) {
      await svc.Omologa.bulkCreate(nuovi.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }

    // Chi non compare piu' in nessuno dei due fogli non si cancella: si segna,
    // e resta all'operatore decidere se e' uscito davvero.
    let scomparsi = 0;
    for (const r of esistenti) {
      const k = String(r.produttore_chiave || chiaveProduttore(r.produttore));
      if (visti.has(k)) continue;
      if (r.nell_elenco === false && r.nel_registro === false) continue;
      await svc.Omologa.update(r.id, { nell_elenco: false, nel_registro: false, aggiornata_il: adesso });
      scomparsi++;
    }

    const conta = (t) => desiderati.filter(d => d.tipo_divergenza === t).length;
    return Response.json({
      totale: desiderati.length,
      nuovi: nuovi.length,
      aggiornati,
      scomparsi,
      righe_elenco: elenco.length,
      righe_registro: registro.length,
      conferitori: conferitori.length,
      doppi_elenco: doppiElenco,
      divergenze: {
        solo_registro: conta('solo_registro'),
        solo_elenco: conta('solo_elenco'),
        nome_diverso: conta('nome_diverso'),
        data_diversa: conta('data_diversa'),
        nessuna: conta('nessuna'),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

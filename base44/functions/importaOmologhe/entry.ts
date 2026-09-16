import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { chiaveProduttore, abbina, divergenza } from "../../shared/omologhe.ts";

// Allinea l'elenco delle omologhe con i due fogli.
//
// Le righe arrivano gia' estratte dal browser, che legge i file Excel: qui si
// mettono in fila, si cerca dove i due fogli non vanno d'accordo e si scrive
// l'esito. Le decisioni prese dall'operatore in ufficio -- recepita, in sospeso,
// annullata, con la sua nota -- non si toccano mai: il gestionale aggiorna i
// dati, non il giudizio di chi ha verificato.
//
// Payload: { elenco: [...], registro: [...] }
// Risposta: { totale, nuovi, aggiornati, divergenze: { ... }, scomparsi }

const giorno = (v) => {
  const s = String(v ?? '').slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
};

const DATI = [
  'produttore', 'produttore_chiave', 'canale', 'tipologia_materiale', 'omologa_da', 'omologa_a', 'esito',
  'n_autorizzazione', 'autorizzazione_da', 'autorizzazione_a', 'rdp_da', 'rdp_a', 'quantitativo_max_annuo',
  'nell_elenco', 'nel_registro', 'registro_nome', 'registro_data', 'registro_riga', 'registro_volte',
  'tipo_divergenza', 'aggiornata_il',
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

    const elenco = elencoGrezzo
      .map(r => ({ ...r, nome: String(r.nome || '').trim(), chiave: chiaveProduttore(r.nome) }))
      .filter(r => r.nome && r.chiave);
    const registro = registroGrezzo
      .map(r => ({ ...r, nome: String(r.nome || '').trim(), chiave: chiaveProduttore(r.nome) }))
      .filter(r => r.nome && r.chiave);

    const { abbinati, soloElenco, soloRegistro } = abbina(elenco, registro);
    const adesso = new Date().toISOString();

    const desiderati = [];
    const daElenco = (e, x, punteggio) => ({
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
      tipo_divergenza: divergenza({
        nellElenco: true, nelRegistro: !!x, punteggio: x ? punteggio : undefined,
        dataElenco: giorno(e.om_da), dataRegistro: x ? giorno(x.data) : null,
      }),
      aggiornata_il: adesso,
    });

    for (const a of abbinati) desiderati.push(daElenco(a.elenco, a.registro, a.punteggio));
    for (const e of soloElenco) desiderati.push(daElenco(e, null));
    for (const x of soloRegistro) {
      desiderati.push({
        produttore: x.nome,
        produttore_chiave: x.chiave,
        canale: 'RETE',
        tipologia_materiale: '',
        omologa_da: null,
        omologa_a: null,
        esito: true,
        n_autorizzazione: '', autorizzazione_da: null, autorizzazione_a: null, rdp_da: null, rdp_a: null,
        quantitativo_max_annuo: '',
        nell_elenco: false,
        nel_registro: true,
        registro_nome: x.nome,
        registro_data: giorno(x.data),
        registro_riga: Number(x.riga) || null,
        registro_volte: Number(x.volte) || null,
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

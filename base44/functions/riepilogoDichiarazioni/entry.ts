import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { MESI, meseDa, operazioneDa, quadratura } from "../../shared/dichiarazioniImpianti.ts";

// Dichiarazioni degli impianti, mese per mese, con la quadratura delle giacenze.
//
// Per ogni impianto e stoccaggio mette insieme:
//   - il conferito del mese, canale per canale (rete, ACI, extra raccolta), dai
//     formulari terminati per data di fine trasporto e peso effettivo;
//   - la dichiarazione del mese (DichiarazioneSito), con lo stato: in mano o caricata;
//   - la giacenza al 31 dicembre dell'anno prima (GiacenzaSito);
//   - la giacenza del portale (OrdineNonDichiarato: il conferito non ancora
//     dichiarato) e, per gli stoccaggi, l'ultima rilevazione.
//
// Canali indipendenti: rete, ACI ed extra raccolta non si sommano mai fra loro.
//
// Payload: { anno }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { anno } = await req.json().catch(() => ({}));
    if (!anno) return Response.json({ error: 'Anno obbligatorio' }, { status: 400 });
    const annoNum = Number(anno);

    const norm = normalizzaRagioneSociale;
    const td = (v) => String(v || '').toLowerCase().trim();
    const t3 = (v) => Math.round(v * 1000) / 1000;
    const terminato = (r) => String(r.stato || '').trim().toLowerCase() === 'terminato';
    const nellAnno = (d) => !!d && new Date(d).getUTCFullYear() === annoNum;
    const peso = (r) => (Number(r.peso_effettivo) || 0);
    const eAci = (r) => /aci|autodemoliz/i.test(`${r.prodotto || ''} ${r.classe || ''} ${r.codice_prodotto || ''}`);

    const svc = base44.asServiceRole.entities;
    const [giacenzeSito, dichiarazioni, rete, aci, extra, secondarie, terziarie, nonDichiarati, rilevazioni] = await Promise.all([
      fetchAll(svc.GiacenzaSito, { anno: annoNum }),
      fetchAll(svc.DichiarazioneSito, { anno: annoNum }),
      fetchAll(svc.PrimariaRete),
      fetchAll(svc.PrimariaAci),
      fetchAll(svc.ExtraRaccolta),
      fetchAll(svc.Secondaria),
      fetchAll(svc.Terziaria),
      fetchAll(svc.OrdineNonDichiarato),
      fetchAll(svc.GiacenzaStoccaggio),
    ]);

    // --- Conferito per sito, canale e mese (kg) ---
    const conferito = new Map(); // ns|canale|provenienza|mese -> kg
    const aggiungi = (ns, canale, provenienza, mese, kg) => {
      if (!ns || !mese) return;
      const k = `${ns}|${canale}|${provenienza}|${mese}`;
      conferito.set(k, (conferito.get(k) || 0) + kg);
    };
    const perAnno = { rete: new Map(), aci: new Map(), extra: new Map(), secIn: new Map(), secOut: new Map(), terz: new Map() };
    const somma = (mappa, chiave, valore) => mappa.set(chiave, (mappa.get(chiave) || 0) + valore);

    for (const r of rete) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      const ns = norm(r.destinazione);
      aggiungi(ns, 'RETE', '', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.rete, `${ns}|${td(r.tipo_destinazione) || 'imp'}`, peso(r));
    }
    for (const r of aci) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      const ns = norm(r.destinazione);
      aggiungi(ns, 'ACI', 'primaria', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.aci, `${ns}|${td(r.tipo_destinazione) || 'imp'}`, peso(r));
    }
    for (const r of extra) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      const ns = norm(r.destinazione);
      aggiungi(ns, 'EXTRA_RACCOLTA', '', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.extra, `${ns}|${td(r.tipo_destinazione) || 'imp'}`, peso(r));
    }
    for (const r of secondarie) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      const dest = norm(r.destinazione);
      const stoc = norm(r.stoccaggio);
      if (eAci(r)) aggiungi(dest, 'ACI', 'secondaria', meseDa(r.trasporto_finito_il), peso(r));
      else aggiungi(dest, 'RETE_SECONDARIE', '', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.secIn, dest, peso(r));
      somma(perAnno.secOut, stoc, peso(r));
    }
    for (const r of terziarie) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      somma(perAnno.terz, norm(r.unita_locale_origine || r.ragione_sociale), peso(r));
    }

    // --- Giacenza del portale: conferito non ancora dichiarato ---
    // Per gli impianti e' la giacenza; per gli stoccaggi e' materiale gia' partito,
    // in attesa che l'impianto ricevente dichiari.
    const ordineTipo = new Map();
    for (const r of [...rete, ...aci]) {
      const id = String(r.id_ordine || '').trim();
      if (id && td(r.tipo_destinazione)) ordineTipo.set(id, td(r.tipo_destinazione));
    }
    const portale = new Map();   // ns|imp -> t
    const inAttesa = new Map();  // ns -> t
    for (const r of nonDichiarati) {
      const sec = String(r.destinazione_secondaria || '').trim();
      const sito = sec || String(r.destinazione || '').trim();
      const ruolo = sec ? 'imp' : (ordineTipo.get(String(r.ordine_primaria || '').trim()) || 'imp');
      const ns = norm(sito);
      if (!ns) continue;
      const t = (Number(r.peso_non_dichiarato_kg) || 0) / 1000;
      if (ruolo === 'stoc') somma(inAttesa, ns, t);
      else somma(portale, `${ns}|imp`, t);
    }
    // Per gli stoccaggi la giacenza del portale e' l'ultima rilevazione piu' i
    // movimenti chiusi dopo: il portale, da quel giorno, continua ad aggiornarla.
    const rilevazione = new Map(); // ns -> { totale_t, data }
    for (const r of rilevazioni) {
      const ns = norm(r.sito);
      if (!ns) continue;
      const data = r.data_rilevazione ? String(r.data_rilevazione).slice(0, 10) : '';
      const totale = ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg', 'class9_kg'].reduce((s, c) => s + (Number(r[c]) || 0), 0) / 1000;
      const prima = rilevazione.get(ns);
      if (!prima || data > prima.data) rilevazione.set(ns, { totale_t: totale, data });
    }

    const dopoRilevazione = new Map(); // ns -> t (ingressi meno uscite dopo la rilevazione)
    const movimentoDopo = (ns, data, valore) => {
      const r = rilevazione.get(ns);
      if (!r || !r.data || !data || String(data).slice(0, 10) <= r.data) return;
      somma(dopoRilevazione, ns, valore);
    };
    for (const r of [...rete, ...aci, ...extra]) {
      if (!terminato(r) || td(r.tipo_destinazione) !== 'stoc') continue;
      movimentoDopo(norm(r.destinazione), r.trasporto_finito_il, peso(r) / 1000);
    }
    for (const r of secondarie) {
      if (!terminato(r)) continue;
      movimentoDopo(norm(r.stoccaggio), r.trasporto_finito_il, -peso(r) / 1000);
    }

    // --- Dichiarazioni per sito, canale, provenienza e mese ---
    const perDich = new Map();
    for (const d of dichiarazioni) {
      perDich.set(`${norm(d.sito)}|${d.canale || 'RETE'}|${d.provenienza || ''}|${d.mese}`, d);
    }
    const flussiDi = (ns, operazione) => {
      const chiavi = new Set();
      for (const k of conferito.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns && canale !== 'RETE_SECONDARIE') chiavi.add(`${canale}|${provenienza}`);
      }
      for (const k of perDich.keys()) {
        const [sito, canale, provenienza] = k.split('|');
        if (sito === ns) chiavi.add(`${canale}|${provenienza}`);
      }
      if (!chiavi.size) chiavi.add('RETE|');
      return [...chiavi].sort().map(c => {
        const [canale, provenienza] = c.split('|');
        const mesi = MESI.map(mese => {
          const d = perDich.get(`${ns}|${canale}|${provenienza}|${mese}`) || null;
          return {
            mese,
            conferito_kg: Math.round(conferito.get(`${ns}|${canale}|${provenienza}|${mese}`) || 0),
            dichiarazione: d && {
              id: d.id, quantita_kg: Number(d.quantita_kg) || 0, caricata_inviata: !!d.caricata_inviata, ricevuta_email: !!d.ricevuta_email,
              ricevuta_il: d.ricevuta_il || '', caricata_il: d.caricata_il || '', note: d.note || '',
              granulo_kg: Number(d.granulo_kg) || 0, fibre_kg: Number(d.fibre_kg) || 0, metalli_kg: Number(d.metalli_kg) || 0,
              ciabattato_kg: Number(d.ciabattato_kg) || 0, cippato_kg: Number(d.cippato_kg) || 0, cssc_kg: Number(d.cssc_kg) || 0, altro_kg: Number(d.altro_kg) || 0,
            },
          };
        });
        return {
          canale, provenienza, operazione,
          mesi,
          conferito_t: t3(mesi.reduce((s, m) => s + m.conferito_kg, 0) / 1000),
          dichiarato_caricato_t: t3(mesi.reduce((s, m) => s + (m.dichiarazione && m.dichiarazione.caricata_inviata ? m.dichiarazione.quantita_kg : 0), 0) / 1000),
          dichiarato_totale_t: t3(mesi.reduce((s, m) => s + (m.dichiarazione ? m.dichiarazione.quantita_kg : 0), 0) / 1000),
        };
      });
    };

    // --- Siti: quelli di Giacenze piu' quelli che hanno movimenti o dichiarazioni ---
    const nomi = new Map(); // ns|td -> nome leggibile
    for (const g of giacenzeSito) nomi.set(`${norm(g.sito)}|${td(g.tipo_destinazione)}`, g.sito);
    for (const r of [...rete, ...aci, ...extra]) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      const k = `${norm(r.destinazione)}|${td(r.tipo_destinazione) || 'imp'}`;
      if (!nomi.has(k) && r.destinazione) nomi.set(k, r.destinazione);
    }
    for (const d of dichiarazioni) {
      const ns = norm(d.sito);
      if (![...nomi.keys()].some(k => k.startsWith(ns + '|'))) nomi.set(`${ns}|imp`, d.sito);
    }

    const siti = [...nomi.entries()].map(([chiave, nome]) => {
      const [ns, ruolo] = chiave.split('|');
      const g = giacenzeSito.find(x => norm(x.sito) === ns && td(x.tipo_destinazione) === ruolo) || null;
      const operazione = operazioneDa(g && g.tipologia_trattamento);
      const flussi = flussiDi(ns, operazione);
      const sito = {
        sito: nome,
        chiave,
        tipo_destinazione: ruolo,
        tipologia_trattamento: (g && g.tipologia_trattamento) || '',
        operazione,
        giacenza_iniziale_t: t3(Number(g && g.giacenza_riferimento_t) || 0),
        target_primarie_t: t3(Number(g && g.target_primarie_t) || 0),
        conferito_t: t3((perAnno.rete.get(chiave) || 0) / 1000),
        conferito_aci_t: t3((perAnno.aci.get(chiave) || 0) / 1000),
        conferito_extra_t: t3((perAnno.extra.get(chiave) || 0) / 1000),
        secondarie_in_t: ruolo === 'imp' ? t3((perAnno.secIn.get(ns) || 0) / 1000) : 0,
        secondarie_out_t: ruolo === 'stoc' ? t3((perAnno.secOut.get(ns) || 0) / 1000) : 0,
        terziarie_out_t: ruolo === 'imp' ? t3((perAnno.terz.get(ns) || 0) / 1000) : 0,
        in_attesa_dichiarazione_t: t3(inAttesa.get(ns) || 0),
        giacenza_portale_t: ruolo === 'imp'
          ? t3(portale.get(`${ns}|imp`) || 0)
          : (rilevazione.has(ns) ? t3(rilevazione.get(ns).totale_t + (dopoRilevazione.get(ns) || 0)) : null),
        rilevazione_il: ruolo === 'stoc' && rilevazione.has(ns) ? rilevazione.get(ns).data : '',
        dichiarato_caricato_t: t3(flussi.reduce((s, f) => s + f.dichiarato_caricato_t, 0)),
        dichiarato_totale_t: t3(flussi.reduce((s, f) => s + f.dichiarato_totale_t, 0)),
        flussi,
      };
      return { ...sito, ...quadratura(sito) };
    }).filter(s => s.conferito_t || s.conferito_aci_t || s.conferito_extra_t || s.dichiarato_totale_t || s.giacenza_iniziale_t || s.giacenza_portale_t || s.secondarie_in_t || s.secondarie_out_t)
      .sort((a, b) => b.conferito_t - a.conferito_t || a.sito.localeCompare(b.sito));

    const totali = {
      conferito_t: t3(siti.reduce((s, x) => s + x.conferito_t, 0)),
      dichiarato_caricato_t: t3(siti.reduce((s, x) => s + x.dichiarato_caricato_t, 0)),
      dichiarato_totale_t: t3(siti.reduce((s, x) => s + x.dichiarato_totale_t, 0)),
      giacenza_calcolata_t: t3(siti.reduce((s, x) => s + x.giacenza_calcolata_t, 0)),
      giacenza_portale_t: t3(siti.reduce((s, x) => s + (x.giacenza_portale_t || 0), 0)),
      siti_che_quadrano: siti.filter(x => x.quadra === true).length,
      siti_da_quadrare: siti.filter(x => x.quadra === false).length,
    };

    return Response.json({ anno: annoNum, mesi: MESI, siti, totali });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

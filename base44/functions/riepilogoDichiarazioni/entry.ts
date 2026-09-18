import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchAll, perPagina } from "../../shared/fetchAll.ts";
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
    // Le primarie della rete e le dichiarazioni di trattamento del portale sono
    // decine di migliaia di righe e servono solo per farne dei totali: si leggono
    // una pagina alla volta, senza tenerle in memoria. Tenerle tutte insieme e'
    // quello che faceva restare la pagina sul "carico le dichiarazioni".
    const [giacenzeSito, dichiarazioni, aci, extra, secondarie, terziarie, nonDichiarati, rilevazioni] = await Promise.all([
      fetchAll(svc.GiacenzaSito, { anno: annoNum }),
      fetchAll(svc.DichiarazioneSito, { anno: annoNum }),
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

    // La giacenza del portale è la fotografia dell'ultimo file degli ordini non
    // dichiarati: per confrontarla si contano solo gli ordini chiusi entro quel giorno.
    const fotoPortale = nonDichiarati.reduce((max, r) => {
      const d = String(r.created_date || '').slice(0, 10);
      return d > max ? d : max;
    }, '');
    // Un ordine entra nella giacenza del portale quando viene chiuso: quelli chiusi
    // dopo la fotografia il portale non li ha ancora contati, anche se il trasporto
    // era finito prima.
    const chiusoIl = (r) => String(r.ordine_chiuso_il || r.trasporto_finito_il || '').slice(0, 10);
    const dopoLaFoto = (r) => !!fotoPortale && chiusoIl(r) > fotoPortale;
    const allaFoto = { rete: new Map(), secIn: new Map(), secOut: new Map(), dopo: new Map() };

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

    // Chi sono i siti e con che ruolo si scopre leggendo i formulari, una volta sola.
    const nomi = new Map();    // ns -> nome leggibile
    const ruoliDi = new Map(); // ns -> Set di ruoli
    const segnaRuolo = (ns, ruolo) => {
      if (!ruoliDi.has(ns)) ruoliDi.set(ns, new Set());
      ruoliDi.get(ns).add(ruolo);
    };
    for (const g of giacenzeSito) { nomi.set(norm(g.sito), g.sito); segnaRuolo(norm(g.sito), td(g.tipo_destinazione) || 'imp'); }
    const ordineTipo = new Map();
    const conta = (r) => {
      const ruolo = td(r.tipo_destinazione) || 'imp';
      const id = String(r.id_ordine || '').trim();
      if (id && td(r.tipo_destinazione)) ordineTipo.set(id, ruolo);
      if (!terminato(r)) return null;
      if (ruolo === 'stoc') movimentoDopo(norm(r.destinazione), r.trasporto_finito_il, peso(r) / 1000);
      if (!nellAnno(r.trasporto_finito_il) || !r.destinazione) return null;
      const ns = norm(r.destinazione);
      if (!nomi.has(ns)) nomi.set(ns, r.destinazione);
      segnaRuolo(ns, ruolo);
      return { ns, chiave: `${ns}|${ruolo}` };
    };

    await perPagina(svc.PrimariaRete, null, (r) => {
      const c = conta(r);
      if (!c) return;
      aggiungi(c.ns, 'RETE', '', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.rete, c.chiave, peso(r));
      somma(dopoLaFoto(r) ? allaFoto.dopo : allaFoto.rete, c.chiave, peso(r));
    });
    for (const r of aci) {
      const c = conta(r);
      if (!c) continue;
      aggiungi(c.ns, 'ACI', 'primaria', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.aci, c.chiave, peso(r));
    }
    for (const r of extra) {
      const c = conta(r);
      if (!c) continue;
      aggiungi(c.ns, 'EXTRA_RACCOLTA', '', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.extra, c.chiave, peso(r));
    }
    for (const r of secondarie) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      const dest = norm(r.destinazione);
      const stoc = norm(r.stoccaggio);
      if (eAci(r)) aggiungi(dest, 'ACI', 'secondaria', meseDa(r.trasporto_finito_il), peso(r));
      else aggiungi(dest, 'RETE_SECONDARIE', '', meseDa(r.trasporto_finito_il), peso(r));
      somma(perAnno.secIn, dest, peso(r));
      somma(perAnno.secOut, stoc, peso(r));
      // Le secondarie ACI non entrano nella giacenza del portale: canale a parte.
      if (!dopoLaFoto(r) && !eAci(r)) {
        somma(allaFoto.secIn, dest, peso(r));
        somma(allaFoto.secOut, stoc, peso(r));
      }
      movimentoDopo(stoc, r.trasporto_finito_il, -peso(r) / 1000);
    }
    for (const r of terziarie) {
      if (!terminato(r) || !nellAnno(r.trasporto_finito_il)) continue;
      somma(perAnno.terz, norm(r.unita_locale_origine || r.ragione_sociale), peso(r));
    }

    // --- Giacenza del portale: conferito non ancora dichiarato ---
    // Per gli impianti e' la giacenza; per gli stoccaggi e' materiale gia' partito,
    // in attesa che l'impianto ricevente dichiari.
    const portale = new Map();   // ns|imp -> t
    const inAttesa = new Map();  // ns -> t
    const aPortale = new Set();  // chi compare nella fotografia del portale
    const daDichiarare = new Map(); // ns|mese -> kg ancora in attesa di dichiarazione
    for (const r of nonDichiarati) {
      const sec = String(r.destinazione_secondaria || '').trim();
      const sito = sec || String(r.destinazione || '').trim();
      const ruolo = sec ? 'imp' : (ordineTipo.get(String(r.ordine_primaria || '').trim()) || 'imp');
      const ns = norm(sito);
      if (!ns) continue;
      aPortale.add(ns);
      const t = (Number(r.peso_non_dichiarato_kg) || 0) / 1000;
      if (ruolo === 'stoc') somma(inAttesa, ns, t);
      else {
        somma(portale, `${ns}|imp`, t);
        // In che mese sono finiti i trasporti che il portale aspetta ancora: e'
        // l'unico modo onesto di dire "questo mese e' da dichiarare". Un mese senza
        // una nostra dichiarazione ma che il portale non aspetta piu' e' gia' stato
        // dichiarato dentro un altro mese, e non manca niente.
        const mese = meseDa(r.fine_trasporto || r.data_chiusura);
        if (mese) somma(daDichiarare, `${ns}|${mese}`, t * 1000);
      }
    }
    // Quello che risulta dichiarato al portale, per confrontarlo con quello che
    // abbiamo segnato come caricato. Conta solo le dichiarazioni collegate a ordini
    // chiusi nell'anno: quelle che il portale ha agganciato a ordini dell'anno prima
    // non compaiono qui, quindi una differenza non e' per forza un mese sfuggito.
    const dichiaratoPortale = new Map();
    await perPagina(svc.DichiarazioneTrattamento, null, (r) => {
      if (!nellAnno(r.data_chiusura)) return;
      const ns = norm(String(r.destinazione_secondaria || '').trim() || r.destinazione);
      if (!ns) return;
      dichiaratoPortale.set(ns, (dichiaratoPortale.get(ns) || 0) + (Number(r.peso_associato_kg) || 0));
    });

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
            non_dichiarato_kg: canale === 'RETE' ? Math.round(daDichiarare.get(`${ns}|${mese}`) || 0) : 0,
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

    // --- Siti: uno per soggetto, non per ruolo. Chi è insieme impianto e stoccaggio
    // ha una sola giacenza da quadrare, che il portale tiene divisa fra i due ruoli. ---
    for (const d of dichiarazioni) {
      const ns = norm(d.sito);
      if (!nomi.has(ns)) { nomi.set(ns, d.sito); segnaRuolo(ns, 'imp'); }
    }

    const siti = [...nomi.entries()].map(([ns, nome]) => {
      const chiave = ns;
      const ruoli = [...(ruoliDi.get(ns) || new Set(['imp']))].sort();
      const perRuoli = (mappa) => ruoli.reduce((s, ruolo) => s + (mappa.get(`${ns}|${ruolo}`) || 0), 0);
      const g = giacenzeSito.find(x => norm(x.sito) === ns && td(x.tipo_destinazione) === 'imp')
        || giacenzeSito.find(x => norm(x.sito) === ns) || null;
      const operazione = operazioneDa(g && g.tipologia_trattamento);
      const flussi = flussiDi(ns, operazione);
      const soloStoccaggio = ruoli.length === 1 && ruoli[0] === 'stoc';
      // La giacenza del portale: per l'impianto è il conferito non ancora dichiarato,
      // per lo stoccaggio l'ultima rilevazione aggiornata con i movimenti chiusi dopo.
      const portaleImpianto = ruoli.includes('imp') ? (portale.get(`${ns}|imp`) || 0) : 0;
      // Chi non compare ne' fra gli ordini non dichiarati ne' fra le rilevazioni e non
      // ha mai dichiarato nulla non ha una giacenza a portale da confrontare: dire zero
      // sarebbe peggio che dire niente, perche' farebbe sembrare sbagliato un conto che
      // semplicemente non si puo' fare.
      const senzaPortale = !aPortale.has(ns) && !rilevazione.has(ns);
      const portaleStoccaggio = ruoli.includes('stoc') && rilevazione.has(ns)
        ? rilevazione.get(ns).totale_t + (dopoRilevazione.get(ns) || 0) : null;
      const sito = {
        sito: nome,
        chiave,
        ruoli,
        tipo_destinazione: soloStoccaggio ? 'stoc' : 'imp',
        tipologia_trattamento: (g && g.tipologia_trattamento) || '',
        // Chi non ci manda la dichiarazione di rete - perche' quel trattamento non
        // glielo paghiamo - non deve comparire come inadempiente: e' un accordo.
        dichiara_rete: !(g && g.dichiara_rete === false),
        operazione,
        giacenza_iniziale_t: t3(giacenzeSito.filter(x => norm(x.sito) === ns).reduce((s, x) => s + (Number(x.giacenza_riferimento_t) || 0), 0)),
        target_primarie_t: t3(giacenzeSito.filter(x => norm(x.sito) === ns).reduce((s, x) => s + (Number(x.target_primarie_t) || 0), 0)),
        conferito_t: t3(perRuoli(perAnno.rete) / 1000),
        conferito_aci_t: t3(perRuoli(perAnno.aci) / 1000),
        conferito_extra_t: t3(perRuoli(perAnno.extra) / 1000),
        secondarie_in_t: t3((perAnno.secIn.get(ns) || 0) / 1000),
        secondarie_out_t: t3((perAnno.secOut.get(ns) || 0) / 1000),
        terziarie_out_t: t3((perAnno.terz.get(ns) || 0) / 1000),
        in_attesa_dichiarazione_t: t3(inAttesa.get(ns) || 0),
        // Chi ha anche l'impianto: la giacenza a portale sono i suoi ordini non
        // dichiarati, che e' roba di rete. La rilevazione del suo stoccaggio sta a
        // parte - in Irigom sono PFU ACI - e sommarla qui mescolerebbe i canali.
        giacenza_portale_t: senzaPortale ? null
          : soloStoccaggio ? (portaleStoccaggio === null ? null : t3(portaleStoccaggio))
          : t3(portaleImpianto),
        rilevazione_stoccaggio_t: !soloStoccaggio && portaleStoccaggio ? t3(portaleStoccaggio) : 0,
        rilevazione_il: rilevazione.has(ns) ? rilevazione.get(ns).data : '',
        dichiarato_caricato_t: t3(flussi.reduce((s, f) => s + f.dichiarato_caricato_t, 0)),
        dichiarato_totale_t: t3(flussi.reduce((s, f) => s + f.dichiarato_totale_t, 0)),
        dichiarato_portale_t: t3((dichiaratoPortale.get(ns) || 0) / 1000),
        // Per la quadratura contano solo la rete e la situazione alla data della fotografia.
        dichiarato_caricato_rete_t: t3(flussi.filter(f => f.canale === 'RETE').reduce((s, f) => s + f.dichiarato_caricato_t, 0)),
        // Gli stoccaggi non stanno nella fotografia degli ordini non dichiarati: la
        // loro giacenza a portale è la rilevazione aggiornata a oggi, quindi per loro
        // il confronto si fa sui movimenti di oggi.
        // Uno stoccaggio non sta nella fotografia degli ordini: la sua giacenza a
        // portale e' la rilevazione fisica per classi, che tiene dentro i PFU di
        // qualunque canale. Percio' li' il conto si fa su quello che c'e' davvero in
        // piazzale - rete, ACI ed extra raccolta insieme - mentre i canali restano
        // distinti dappertutto: nei target, nelle dichiarazioni e nella fatturazione.
        conferito_alla_foto_t: t3((soloStoccaggio
          ? perRuoli(perAnno.rete) + perRuoli(perAnno.aci) + perRuoli(perAnno.extra)
          : perRuoli(allaFoto.rete)) / 1000),
        conferito_dopo_foto_t: t3((soloStoccaggio ? 0 : perRuoli(allaFoto.dopo)) / 1000),
        secondarie_in_alla_foto_t: t3(((soloStoccaggio ? perAnno.secIn.get(ns) : allaFoto.secIn.get(ns)) || 0) / 1000),
        secondarie_out_alla_foto_t: t3(((soloStoccaggio ? perAnno.secOut.get(ns) : allaFoto.secOut.get(ns)) || 0) / 1000),
        flussi,
      };
      return { ...sito, ...quadratura(sito) };
    }).filter(s => s.conferito_t || s.conferito_aci_t || s.conferito_extra_t || s.dichiarato_totale_t || s.giacenza_iniziale_t || s.giacenza_portale_t || s.secondarie_in_t || s.secondarie_out_t)
      .sort((a, b) => b.conferito_t - a.conferito_t || a.sito.localeCompare(b.sito));

    const totali = {
      conferito_t: t3(siti.reduce((s, x) => s + x.conferito_t, 0)),
      dichiarato_caricato_t: t3(siti.reduce((s, x) => s + x.dichiarato_caricato_t, 0)),
      dichiarato_totale_t: t3(siti.reduce((s, x) => s + x.dichiarato_totale_t, 0)),
      dichiarato_portale_t: t3(siti.reduce((s, x) => s + x.dichiarato_portale_t, 0)),
      giacenza_calcolata_t: t3(siti.reduce((s, x) => s + x.giacenza_calcolata_t, 0)),
      giacenza_portale_t: t3(siti.reduce((s, x) => s + (x.giacenza_portale_t || 0), 0)),
      siti_che_quadrano: siti.filter(x => x.quadra === true).length,
      siti_da_quadrare: siti.filter(x => x.quadra === false).length,
    };

    return Response.json({ anno: annoNum, mesi: MESI, siti, totali, foto_portale_il: fotoPortale });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { proiettaImpianto, viaggiPerMese, MESI, KG_PER_VIAGGIO } from "../../shared/proiezioneSecondarie.ts";

// Quante secondarie restano da portare a ogni impianto per arrivare al target.
//
// E' il ragionamento della tabella del foglio Excel, con i numeri presi dai dati
// invece che scritti a mano: il target dell'impianto, quello che gli e' già
// arrivato in primaria e in secondaria, quanto arriva in media ogni mese, e
// quanto materiale hanno gli stoccaggi che lo alimentano.
//
// Solo rete: le secondarie ACI non consumano il target di rete.
//
// Payload: { anno, mese_da }  mese_da e' l'indice del mese da cui proiettare
// (0 = gennaio); se manca si parte dal mese in corso.

const soloData = (v) => (v ? String(v).slice(0, 10) : '');
const terminato = (r) => String(r.stato || '').toLowerCase().trim() === 'terminato';
const peso = (r) => Number(r.peso_effettivo) || 0;

function meseDi(v, anno) {
  const d = soloData(v);
  if (!d || Number(d.slice(0, 4)) !== anno) return -1;
  return Number(d.slice(5, 7)) - 1;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const anno = Number(body.anno) || new Date().getUTCFullYear();
    const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    const meseDa = body.mese_da != null ? Number(body.mese_da) : Number(oggi.slice(5, 7)) - 1;

    const svc = base44.asServiceRole.entities;
    const [impianti, fornitori, primarie, secondarie, rilevazioni, ipotesiTutte] = await Promise.all([
      svc.ImpiantoTargetSecondaria.filter({ stato: 'attivo' }),
      svc.FornitoreSecondaria.filter({ stato: 'attivo' }),
      fetchAll(svc.PrimariaRete, { stato: 'terminato' }),
      fetchAll(svc.Secondaria, { stato: 'terminato' }),
      fetchAll(svc.GiacenzaStoccaggio),
      svc.IpotesiMensileSecondarie.filter({ anno }, 'mese', 500),
    ]);

    // --- dove arriva la roba, mese per mese ---
    const primariaPerSito = new Map();   // chiave sito -> { mese -> kg }  (impianti: tipo imp; stoccaggi: tipo stoc)
    const nomeSito = new Map();
    const aggiungi = (mappa, chiave, mese, kg) => {
      if (!mappa.has(chiave)) mappa.set(chiave, {});
      const m = mappa.get(chiave);
      m[mese] = (m[mese] || 0) + kg;
    };

    for (const r of primarie) {
      if (!terminato(r)) continue;
      const m = meseDi(r.trasporto_finito_il, anno);
      if (m < 0) continue;
      const chiave = normalizzaRagioneSociale(r.destinazione);
      if (!chiave) continue;
      nomeSito.set(chiave, String(r.destinazione).trim());
      aggiungi(primariaPerSito, chiave, m, peso(r));
    }

    const secondariaInSito = new Map();  // chiave impianto -> { mese -> kg }
    const secondariaDaStoccaggio = new Map(); // chiave stoccaggio -> { mese -> kg }
    for (const r of secondarie) {
      if (!terminato(r) || eAci(r)) continue;
      const m = meseDi(r.trasporto_finito_il, anno);
      if (m < 0) continue;
      const dest = normalizzaRagioneSociale(r.destinazione);
      const orig = normalizzaRagioneSociale(r.stoccaggio);
      if (dest) { nomeSito.set(dest, String(r.destinazione).trim()); aggiungi(secondariaInSito, dest, m, peso(r)); }
      if (orig) { nomeSito.set(orig, String(r.stoccaggio).trim()); aggiungi(secondariaDaStoccaggio, orig, m, peso(r)); }
    }

    // --- quanto c'e' adesso negli stoccaggi, rete ---
    // Ultima rilevazione del portale piu' quello che si e' mosso dopo: e' la
    // regola del modulo Giacenze, e la rete esclude la classe 9.
    const rilevazionePer = new Map();
    for (const g of rilevazioni) {
      const chiave = normalizzaRagioneSociale(g.sito);
      if (!chiave) continue;
      const data = soloData(g.data_rilevazione);
      const prima = rilevazionePer.get(chiave);
      if (!prima || data > prima.data) {
        rilevazionePer.set(chiave, {
          data,
          kg: ['class1_kg', 'class2_kg', 'class3_kg', 'class4_kg'].reduce((s, c) => s + (Number(g[c]) || 0), 0),
        });
      }
    }
    const giacenzaStoccaggio = (chiave) => {
      const r = rilevazionePer.get(chiave);
      if (!r) return null;
      let kg = r.kg;
      for (const p of primarie) {
        if (!terminato(p) || normalizzaRagioneSociale(p.destinazione) !== chiave) continue;
        if (soloData(p.trasporto_finito_il) > r.data) kg += peso(p);
      }
      for (const s of secondarie) {
        if (!terminato(s) || eAci(s) || normalizzaRagioneSociale(s.stoccaggio) !== chiave) continue;
        if (soloData(s.trasporto_finito_il) > r.data) kg -= peso(s);
      }
      return Math.max(0, Math.round(kg));
    };

    // --- le ipotesi scritte a mano, per impianto e mese ---
    const ipotesiPer = new Map();
    for (const i of ipotesiTutte) {
      const chiave = normalizzaRagioneSociale(i.impianto);
      if (!ipotesiPer.has(chiave)) ipotesiPer.set(chiave, {});
      ipotesiPer.get(chiave)[i.mese] = {
        primaria_kg: i.primaria_attesa_kg != null && i.primaria_attesa_kg !== '' ? Number(i.primaria_attesa_kg) : null,
        viaggi: i.viaggi_previsti != null && i.viaggi_previsti !== '' ? Number(i.viaggi_previsti) : null,
        note: i.note || '',
        id: i.id,
      };
    }
    const ipotesiPulite = (chiave) => {
      const per = ipotesiPer.get(chiave) || {};
      const out = {};
      for (const [mese, v] of Object.entries(per)) {
        const x = {};
        if (v.primaria_kg != null) x.primaria_kg = v.primaria_kg;
        if (v.viaggi != null) x.viaggi = v.viaggi;
        if (Object.keys(x).length) out[mese] = x;
      }
      return out;
    };

    // --- gli stoccaggi che alimentano ciascun impianto ---
    const stoccaggiDi = (chiaveImpianto) => {
      const nomi = new Set();
      // da chi e' registrato nella predittivita' come stoccaggio dell'impianto
      for (const f of fornitori) {
        if (normalizzaRagioneSociale(f.impianto_nome) !== chiaveImpianto) continue;
        if (f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo') nomi.add(normalizzaRagioneSociale(f.nome));
      }
      // e da chi gli ha davvero mandato secondarie quest'anno
      for (const s of secondarie) {
        if (!terminato(s) || eAci(s)) continue;
        if (normalizzaRagioneSociale(s.destinazione) !== chiaveImpianto) continue;
        const o = normalizzaRagioneSociale(s.stoccaggio);
        if (o) nomi.add(o);
      }
      return [...nomi].map(chiave => ({
        nome: nomeSito.get(chiave) || chiave,
        giacenza_kg: giacenzaStoccaggio(chiave) || 0,
        giacenza_nota: giacenzaStoccaggio(chiave) === null ? 'nessuna rilevazione del portale per questo stoccaggio' : '',
        ingressi_per_mese: primariaPerSito.get(chiave) || {},
      }));
    };

    const proiezioni = impianti.map(imp => {
      const chiave = normalizzaRagioneSociale(imp.nome_impianto);
      const p = proiettaImpianto(
        { nome: nomeSito.get(chiave) || imp.nome_impianto, target_kg: Number(imp.target) || 0, data_fine: imp.data_fine || `${anno}-12-18` },
        {
          conferito_primaria_per_mese: primariaPerSito.get(chiave) || {},
          conferito_secondaria_per_mese: secondariaInSito.get(chiave) || {},
          stoccaggi: stoccaggiDi(chiave),
        },
        { meseCorrente: meseDa, ipotesi: ipotesiPulite(chiave) },
      );
      return { ...p, impianto_id: imp.id, impianto_registrato: imp.nome_impianto, data_fine: imp.data_fine || `${anno}-12-18` };
    });

    return Response.json({
      anno,
      mese_da: meseDa,
      mese_da_nome: MESI[meseDa] || '',
      kg_per_viaggio: KG_PER_VIAGGIO,
      impianti: proiezioni,
      viaggi_per_mese: viaggiPerMese(proiezioni),
      ipotesi: ipotesiTutte.map(i => ({
        id: i.id, impianto: i.impianto, mese: i.mese,
        primaria_attesa_kg: i.primaria_attesa_kg, viaggi_previsti: i.viaggi_previsti, note: i.note,
      })),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

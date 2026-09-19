import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { eAci } from "../../shared/canaleSecondaria.ts";
import { proiettaInsieme, viaggiPerMese, MESI, KG_PER_VIAGGIO } from "../../shared/proiezioneSecondarie.ts";
import { dopoLaRilevazione, ultimeRilevazioni, kgReteDiRilevazione } from "../../shared/giacenzaStoccaggi.ts";

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
    const [impianti, fornitori, primarie, secondarie, extra, rilevazioni, ipotesiTutte, giacenzeSito] = await Promise.all([
      svc.ImpiantoTargetSecondaria.filter({ stato: 'attivo' }),
      svc.FornitoreSecondaria.filter({ stato: 'attivo' }),
      fetchAll(svc.PrimariaRete, { stato: 'terminato' }),
      fetchAll(svc.Secondaria, { stato: 'terminato' }),
      fetchAll(svc.ExtraRaccolta, { stato: 'terminato' }),
      fetchAll(svc.GiacenzaStoccaggio),
      svc.IpotesiMensileSecondarie.filter({ anno }, 'mese', 500),
      svc.GiacenzaSito.filter({ anno }, 'sito', 100).catch(() => []),
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
    const rilevazionePer = ultimeRilevazioni(rilevazioni, normalizzaRagioneSociale);
    // Stessa regola del modulo Giacenze, adesso in comune: si parte dalla
    // fotografia del portale e si contano i movimenti CHIUSI dopo di essa.
    // Prima qui si guardava la fine del trasporto contro il giorno della
    // rilevazione, e un carico chiuso il giorno dopo risultava dentro per le
    // Giacenze e fuori per la Predittivita', che scriveva "ne mancano N viaggi"
    // su un mese in cui il materiale c'era.
    const giacenzaStoccaggio = (chiave) => {
      const r = rilevazionePer.get(chiave);
      if (!r) return null;
      let kg = kgReteDiRilevazione(r.record);
      for (const p of primarie) {
        if (!terminato(p) || normalizzaRagioneSociale(p.destinazione) !== chiave) continue;
        if (dopoLaRilevazione(p, r.quando)) kg += peso(p);
      }
      for (const e of extra) {
        if (!terminato(e) || normalizzaRagioneSociale(e.destinazione) !== chiave) continue;
        if (String(e.tipo_movimento || 'primaria').toLowerCase().trim() === 'secondaria') continue;
        if (dopoLaRilevazione(e, r.quando)) kg += peso(e);
      }
      for (const s of secondarie) {
        if (!terminato(s) || eAci(s) || normalizzaRagioneSociale(s.stoccaggio) !== chiave) continue;
        if (dopoLaRilevazione(s, r.quando)) kg -= peso(s);
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
    // Quanto ogni impianto ha gia' ricevuto da ciascuno stoccaggio quest'anno:
    // serve a dividere la giacenza di uno stoccaggio condiviso.
    const ricevutoDa = new Map(); // "stoccaggio|impianto" -> kg
    for (const s2 of secondarie) {
      if (!terminato(s2) || eAci(s2)) continue;
      const o = normalizzaRagioneSociale(s2.stoccaggio);
      const d2 = normalizzaRagioneSociale(s2.destinazione);
      if (!o || !d2) continue;
      const k = o + '|' + d2;
      ricevutoDa.set(k, (ricevutoDa.get(k) || 0) + peso(s2));
    }

    const stoccaggiDi = (chiaveImpianto) => {
      const nomi = new Set();
      // da chi e' registrato nella predittivita' come stoccaggio dell'impianto
      for (const f of fornitori) {
        if (normalizzaRagioneSociale(f.impianto_nome) !== chiaveImpianto) continue;
        if (f.ruolo === 'stoccaggio' || f.ruolo === 'doppio_ruolo') nomi.add(normalizzaRagioneSociale(f.nome));
      }
      // e da chi gli ha davvero mandato secondarie QUEST'ANNO: un piazzale che
      // lavorava l'anno scorso e che per quest'anno non e' contrattualizzato non
      // entra nei conti del 2026. Senza il filtro d'anno rientrava dalla porta di
      // servizio - e' successo con RPN, che nel 2026 non ha ne' contratto ne'
      // giacenza, e compariva fra le fonti di Tecnogum con "0 t, non rilevato".
      for (const s of secondarie) {
        if (!terminato(s) || eAci(s)) continue;
        if (meseDi(s.trasporto_finito_il, anno) < 0) continue;
        if (normalizzaRagioneSociale(s.destinazione) !== chiaveImpianto) continue;
        const o = normalizzaRagioneSociale(s.stoccaggio);
        if (o) nomi.add(o);
      }
      return [...nomi].map(chiave => ({
        chiave,
        nome: nomeSito.get(chiave) || chiave,
        giacenza_kg: giacenzaStoccaggio(chiave),
        giacenza_nota: giacenzaStoccaggio(chiave) === null ? 'nessuna rilevazione del portale per questo stoccaggio' : '',
        ingressi_per_mese: primariaPerSito.get(chiave) || {},
        ricevuto_kg: ricevutoDa.get(chiave + '|' + chiaveImpianto) || 0,
      }));
    };

    // Un piazzale solo non puo' essere promesso a due impianti. Prima se ne
    // divideva la giacenza con una quota fissa, il che era meglio di niente ma
    // restava una finzione: la quota giusta cambia mese per mese, secondo quanto
    // manca a ciascuno. Adesso i due impianti si proiettano insieme e ogni mese
    // il piazzale distribuisce quello che ha davvero, a chi ne ha piu' bisogno.
    const stoccaggiPerImpianto = new Map();
    for (const imp of impianti) {
      const chiave = normalizzaRagioneSociale(imp.nome_impianto);
      stoccaggiPerImpianto.set(chiave, stoccaggiDi(chiave));
    }

    // Il target scritto nel foglio delle giacenze, per il confronto.
    const giacenzaSitoPer = new Map();
    for (const g2 of giacenzeSito) {
      const k = normalizzaRagioneSociale(g2.sito);
      if (k && !giacenzaSitoPer.has(k)) giacenzaSitoPer.set(k, g2);
    }

    const insieme = proiettaInsieme(impianti.map(imp => {
      const chiave = normalizzaRagioneSociale(imp.nome_impianto);
      return {
        impianto: { nome: nomeSito.get(chiave) || imp.nome_impianto, target_kg: Number(imp.target) || 0, data_fine: imp.data_fine || `${anno}-12-18` },
        dati: {
          conferito_primaria_per_mese: primariaPerSito.get(chiave) || {},
          conferito_secondaria_per_mese: secondariaInSito.get(chiave) || {},
          stoccaggi: stoccaggiPerImpianto.get(chiave) || [],
        },
        opzioni: { ipotesi: ipotesiPulite(chiave) },
      };
    }), { meseCorrente: meseDa });

    const proiezioni = impianti.map((imp, i) => {
      const chiave = normalizzaRagioneSociale(imp.nome_impianto);
      const p = insieme.impianti[i];
      // Il target dell'impianto sta scritto in due posti - qui e nel foglio delle
      // giacenze - e devono dire la stessa cosa: se non la dicono, la proiezione
      // lo segnala invece di scegliere da sola quale sia quello buono. Trovata
      // cosi' una differenza di 5 t su Tecnogum, il 19/09/2026.
      const sito = giacenzaSitoPer.get(chiave);
      const altroTarget = sito && Number(sito.target_totale_t) > 0 ? Math.round(Number(sito.target_totale_t) * 1000) : null;
      const avvisi = [...(p.avvisi || [])];
      if (altroTarget !== null && Math.abs(altroTarget - (Number(imp.target) || 0)) >= 1000) {
        avvisi.push(`Il target di questo impianto non coincide fra i moduli: qui vale ${Math.round((Number(imp.target) || 0) / 1000)} t, nelle Giacenze ${Math.round(altroTarget / 1000)} t. La proiezione usa il primo: correggi quello sbagliato, perche' i due numeri devono coincidere.`);
      }
      return { ...p, avvisi, impianto_id: imp.id, impianto_registrato: imp.nome_impianto, data_fine: imp.data_fine || `${anno}-12-18` };
    });

    return Response.json({
      anno,
      mese_da: meseDa,
      mese_da_nome: MESI[meseDa] || '',
      kg_per_viaggio: KG_PER_VIAGGIO,
      impianti: proiezioni,
      viaggi_per_mese: viaggiPerMese(proiezioni),
      piazzali_condivisi: insieme.piazzali_condivisi,
      registro_piazzali: insieme.registro_piazzali,
      ipotesi: ipotesiTutte.map(i => ({
        id: i.id, impianto: i.impianto, mese: i.mese,
        primaria_attesa_kg: i.primaria_attesa_kg, viaggi_previsti: i.viaggi_previsti, note: i.note,
      })),
    });
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

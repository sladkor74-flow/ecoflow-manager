import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { fetchAll } from "../../shared/fetchAll.ts";
import { rispostaSolaLettura } from "../../shared/permessi.ts";
import { chiaveProduttore } from "../../shared/omologhe.ts";
import { codiceRentriDa, indicePdr, collegaDichiarazione } from "../../shared/dichiarazioniRentri.ts";
import { oggiRoma } from "../../shared/reportSettimanali.ts";

// Allinea le dichiarazioni RENTRI con il foglio del file di gestione.
//
// Le righe arrivano gia' estratte dal browser. Qui si collega ogni dichiarazione
// ai PDR dell'anagrafica, per mettere accanto quello che dice il portale, e si
// scrive l'esito. Le dichiarazioni non scadono ma le condizioni cambiano (chi oggi
// non e' iscritto puo' esserlo domani): quando cambiano, i valori di prima restano
// nello storico. I collegamenti scelti o confermati a mano non si toccano mai.
//
// Payload: { righe: [{ riga, tipologia, nome, data, iscritto, digitale, cartaceo, nota }] }

const giorno = (v) => {
  const s = String(v ?? '').slice(0, 10);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : null;
};

const DATI = [
  'produttore', 'produttore_chiave', 'tipologia_materiale', 'data_dichiarazione', 'iscritto_rentri', 'fir_digitale',
  'fir_cartaceo', 'nota', 'codice_rentri', 'riga_foglio', 'doppia', 'nel_foglio', 'pdr_collegati', 'clienti_collegati',
  'collegamento', 'candidati_json',
];
const CONDIZIONI = ['data_dichiarazione', 'iscritto_rentri', 'fir_digitale', 'fir_cartaceo'];

const testo = (v) => (v === undefined || v === null ? '' : String(v));
const uguali = (a, b, campi) => campi.every(k => testo(a[k]) === testo(b[k]));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return rispostaSolaLettura();

    const body = await req.json();
    const grezze = Array.isArray(body.righe) ? body.righe : [];
    if (!grezze.length) return Response.json({ error: "Dal foglio non e' arrivata nessuna dichiarazione." }, { status: 400 });

    // Un produttore scritto due volte nel foglio resta uno: vale la prima riga, e
    // la dichiarazione porta il segno che nel foglio e' doppia.
    const perChiave = new Map();
    let doppie = 0;
    for (const r of grezze) {
      const nome = String(r.nome || '').trim();
      const chiave = chiaveProduttore(nome);
      if (!nome || !chiave) continue;
      if (perChiave.has(chiave)) { perChiave.get(chiave).doppia = true; doppie++; continue; }
      perChiave.set(chiave, { ...r, nome, chiave, doppia: false });
    }

    const svc = base44.asServiceRole.entities;
    const [pdr, esistenti] = await Promise.all([fetchAll(svc.Pdr), fetchAll(svc.DichiarazioneRentri)]);
    const indice = indicePdr(pdr);
    const vecchie = new Map();
    for (const e of [...esistenti].sort((a, b) => String(a.created_date || '').localeCompare(String(b.created_date || '')))) {
      const k = String(e.produttore_chiave || chiaveProduttore(e.produttore));
      if (!vecchie.has(k)) vecchie.set(k, e);
    }

    const adesso = new Date().toISOString();
    const nuove = [];
    const modifiche = [];
    const conta = { codice: 0, nome: 0, simile: 0, manuale: 0, nessuno: 0 };

    for (const r of perChiave.values()) {
      const gia = vecchie.get(r.chiave);
      const codice = codiceRentriDa(r.nota);
      const d = {
        produttore: r.nome,
        produttore_chiave: r.chiave,
        tipologia_materiale: String(r.tipologia || ''),
        data_dichiarazione: giorno(r.data),
        iscritto_rentri: r.iscritto === true,
        fir_digitale: r.digitale === true,
        fir_cartaceo: r.cartaceo === true,
        nota: String(r.nota || '').trim(),
        codice_rentri: codice,
        riga_foglio: Number(r.riga) || null,
        doppia: !!r.doppia,
        nel_foglio: true,
      };

      // Il collegamento scelto o confermato a mano vince sempre.
      const manuali = gia && Array.isArray(gia.pdr_manuali) ? gia.pdr_manuali : [];
      if (manuali.length) {
        const clienti = pdr.filter(p => manuali.includes(String(p.id_pdr))).map(p => String(p.id_cliente || ''));
        Object.assign(d, { collegamento: 'manuale', pdr_collegati: [...manuali].sort(), clienti_collegati: [...new Set(clienti.filter(Boolean))].sort(), candidati_json: '' });
      } else {
        const c = collegaDichiarazione({ chiave: r.chiave, codice }, indice);
        Object.assign(d, {
          collegamento: c.collegamento,
          pdr_collegati: [...new Set(c.pdr.map(p => String(p.id_pdr)))].sort(),
          clienti_collegati: [...new Set(c.pdr.map(p => String(p.id_cliente || '')).filter(Boolean))].sort(),
          candidati_json: c.candidati.length ? JSON.stringify(c.candidati) : '',
        });
      }
      conta[d.collegamento]++;

      if (!gia) { nuove.push({ ...d, aggiornata_il: adesso }); continue; }
      if (uguali(gia, d, DATI)) continue;
      const modifica = { id: gia.id, ...d, aggiornata_il: adesso };
      // Condizioni cambiate: quelle di prima passano nello storico.
      if (!uguali(gia, d, CONDIZIONI)) {
        let storico = [];
        try { storico = JSON.parse(gia.storico_json || '[]'); } catch (_e) { storico = []; }
        storico.push({
          fino_al: oggiRoma(),
          data_dichiarazione: gia.data_dichiarazione || null,
          iscritto_rentri: gia.iscritto_rentri === true,
          fir_digitale: gia.fir_digitale === true,
          fir_cartaceo: gia.fir_cartaceo === true,
        });
        modifica.storico_json = JSON.stringify(storico);
      }
      modifiche.push(modifica);
    }

    // Chi non compare piu' nel foglio non si cancella: si segna.
    let scomparse = 0;
    for (const [k, e] of vecchie) {
      if (perChiave.has(k) || e.nel_foglio === false) continue;
      modifiche.push({ id: e.id, nel_foglio: false, aggiornata_il: adesso });
      scomparse++;
    }

    for (let i = 0; i < nuove.length; i += 100) {
      await svc.DichiarazioneRentri.bulkCreate(nuove.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }
    for (let i = 0; i < modifiche.length; i += 100) {
      await svc.DichiarazioneRentri.bulkUpdate(modifiche.slice(i, i + 100));
      await new Promise(r => setTimeout(r, 200));
    }

    return Response.json({
      totale: perChiave.size,
      nuove: nuove.length,
      aggiornate: modifiche.length - scomparse,
      scomparse,
      doppie,
      pdr_in_anagrafica: pdr.length,
      collegamenti: conta,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

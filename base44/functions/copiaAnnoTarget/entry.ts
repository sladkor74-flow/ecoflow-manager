import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { conLimiteRichieste } from "../../shared/limiteRichieste.ts";
import { soloAmministratore } from "../../shared/permessi.ts";
import { fetchAll } from "../../shared/fetchAll.ts";
import { normalizzaRagioneSociale } from "../../shared/normalizzaRagioneSociale.ts";
import { regolePredittivita } from "../../shared/regolePredittivita.ts";
import { annoChiuso, annoCorrenteRoma, recordDellAnno, pianoCopiaAnno, conteggiPiano } from "../../shared/annoTarget.ts";

// Un anno nuovo di Target & Status nasce come copia del precedente (utente,
// 27/09/2026): impianti e loro target, collegamenti degli stoccaggi (con la
// priorita' scritta), target dei raccoglitori annui e mensili, contratto Ecotyre
// (solo se l'anno non ne ha uno) ed elenco dei siti delle giacenze. Tutto
// "copiato dal {anno-1}, da confermare": i numeri veri arrivano col contratto.
//
// Corpo: { anno, simula }. Con simula:true dice solo quanto creerebbe. Solo
// l'amministratore; mai su un anno chiuso, e non se l'anno prima e' vuoto. Si
// puo' ripetere: salta quello che l'anno ha gia' e completa quello che manca
// (anche dopo una copia interrotta a meta'). Non cancella e non modifica niente.
//
// Un anno gia' compilato a mano (di norma quello in corso) non si inquina: una
// categoria si copia solo se l'anno non ne ha, o ha solo record copiati e non
// ancora confermati (pianoCopiaAnno). Gli impianti che nell'anno prima avevano il
// target solo in Giacenze nascono con quel target e la predittivita' spenta.
//
// Gli impianti e i collegamenti si leggono interi e si tengono per anno con
// annoDelRecord: un record senza anno vale il 2026, e .filter({anno}) lo
// perderebbe.

const A_BLOCCHI = 100;

async function creaTutti(entita, righe) {
  for (let i = 0; i < righe.length; i += A_BLOCCHI) {
    const blocco = righe.slice(i, i + A_BLOCCHI);
    if (typeof entita.bulkCreate === 'function') await entita.bulkCreate(blocco);
    else for (const r of blocco) await entita.create(r);
  }
}

const piuRecente = (a, b) => (String(b.updated_date || b.created_date || '') > String(a.updated_date || a.created_date || '') ? b : a);
// fra due impianti con lo stesso nome: quello attivo, e fra pari il piu' recente
const meglio = (a, b) => ((a.stato !== 'non_attivo') !== (b.stato !== 'non_attivo') ? (b.stato !== 'non_attivo' ? b : a) : piuRecente(a, b));

export default async function(req) {
  try {
    const base44 = conLimiteRichieste(createClientFromRequest(req));
    const { user, errore } = await soloAmministratore(base44);
    if (errore) return errore;

    const corpo = await req.json().catch(() => ({}));
    const anno = Number(corpo && corpo.anno);
    const simula = !!(corpo && corpo.simula);
    if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
      return Response.json({ error: "Indica l'anno da preparare." }, { status: 400 });
    }
    if (annoChiuso(anno)) {
      return Response.json({ error: `Il ${anno} è chiuso: si può solo consultare, non si copia niente.`, anno_chiuso: true }, { status: 400 });
    }
    if (anno > annoCorrenteRoma() + 1) {
      return Response.json({ error: `Il ${anno} è troppo lontano: si prepara al massimo l'anno prossimo.` }, { status: 400 });
    }
    const da = anno - 1;
    const e = base44.asServiceRole.entities;

    const [impianti, fornitori, raccoglitori, mensili, commesse, sitiPrima, sitiAnno] = await Promise.all([
      fetchAll(e.ImpiantoTargetSecondaria),
      fetchAll(e.FornitoreSecondaria),
      fetchAll(e.TargetRaccoglitore),
      fetchAll(e.TargetMensile),
      fetchAll(e.CommessaEcotyre),
      fetchAll(e.GiacenzaSito, { anno: da }),
      fetchAll(e.GiacenzaSito, { anno }),
    ]);
    const archivi = { impianti, fornitori, raccoglitori, mensili, commessa: commesse };
    const sorgente = { ...archivi, siti: sitiPrima };
    const esistenti = { ...archivi, siti: sitiAnno };

    const vuoto = ['impianti', 'fornitori', 'raccoglitori', 'mensili', 'commessa', 'siti'].every(k => recordDellAnno(sorgente[k], da).length === 0);
    if (vuoto) {
      return Response.json({ error: `Il ${da} non ha niente da copiare: il ${anno} va compilato a mano.`, anno_precedente_vuoto: true }, { status: 400 });
    }

    const commessaPrima = recordDellAnno(commesse, da).reduce((x, r) => (x ? piuRecente(x, r) : r), null);
    const piano = pianoCopiaAnno({
      anno, sorgente, esistenti,
      regolePrecedenti: regolePredittivita(da, commessaPrima),
      chiave: normalizzaRagioneSociale,
      da: (user && (user.full_name || user.email)) || '',
    });
    const conteggi = conteggiPiano(piano);
    const risposta = { ok: true, anno, da, simulato: simula, conteggi, saltati: { ...piano.saltati }, impianti_da_giacenze: piano.daGiacenze || 0 };
    if (simula) return Response.json(risposta);

    // 1. gli impianti, uno per uno: serve il loro id per i collegamenti
    const nuovi = [];
    for (const r of piano.impianti) nuovi.push(await e.ImpiantoTargetSecondaria.create(r));

    // 2. i collegamenti, con l'id dell'impianto dell'anno (nuovo o gia' presente)
    const perChiave = new Map();
    for (const r of [...recordDellAnno(impianti, anno), ...nuovi]) {
      const k = normalizzaRagioneSociale(r && r.nome_impianto);
      if (!k || !r.id) continue;
      const prima = perChiave.get(k);
      perChiave.set(k, prima ? meglio(prima, r) : r);
    }
    const collegamenti = [];
    let senzaImpianto = 0;
    for (const { impianto_chiave, ...c } of piano.collegamenti) {
      const imp = perChiave.get(impianto_chiave);
      if (!imp) { senzaImpianto++; continue; }
      collegamenti.push({ ...c, impianto_id: imp.id, impianto_nome: imp.nome_impianto || c.impianto_nome });
    }
    await creaTutti(e.FornitoreSecondaria, collegamenti);

    // 3. il resto
    await creaTutti(e.TargetRaccoglitore, piano.raccoglitori);
    await creaTutti(e.TargetMensile, piano.mensili);
    if (piano.commessa) await e.CommessaEcotyre.create(piano.commessa);
    await creaTutti(e.GiacenzaSito, piano.siti);

    risposta.conteggi = { ...conteggi, collegamenti: collegamenti.length };
    if (senzaImpianto) risposta.saltati.collegamenti_senza_impianto = senzaImpianto;
    return Response.json(risposta);
  } catch (error) {
    return Response.json({ error: error && error.message ? error.message : String(error) }, { status: 500 });
  }
}

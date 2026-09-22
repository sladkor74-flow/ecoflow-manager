// Gli strumenti di EcoTyna: da dove prende i numeri quando le si fa una domanda.
//
// Prima l'assistente aveva un solo riassunto della commessa, sempre lo stesso e
// sempre di oggi: bastava per le domande larghe e non bastava per tutto il
// resto. Adesso ha un elenco di strumenti, ognuno con i suoi parametri, e per
// ogni domanda si decide quali interrogare.
//
// Ogni strumento restituisce sempre la stessa forma:
//   { fonte, periodo, dati_al, dati }
// dove "fonte" dice da quale modulo vengono i numeri, "periodo" a che cosa si
// riferiscono e "dati_al" quando sono stati letti. Cosi' la risposta puo' citare
// la provenienza di ogni cifra invece di limitarsi a dire un numero.
//
// Gli strumenti non calcolano quasi niente per conto loro: chiamano la stessa
// logica dei moduli - le pivot del Report Mensile, la quadratura dei formulari,
// la predittivita' - perche' due conti diversi sulla stessa cosa sono un conto
// sbagliato di sicuro.
//
// Rete, ACI ed extra raccolta restano canali separati anche qui: uno strumento
// che li somma non esiste.

import { fetchAll } from "./fetchAll.ts";
import { contaFormulari } from "./formulari.ts";
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { getRegioneFromProvincia } from "./dataEnrichment.ts";
import { giornoRoma, oggiRoma } from "./giornoItaliano.ts";
import { eAci } from "./canaleSecondaria.ts";
import { eTerminato, giornoMovimento } from "./movimenti.ts";
import { PIVOT_DEFS, calcolaPivot, MESI } from "./reportMensile.ts";
import { caricaGestionale, caricamentiAperti, contaDistinti } from "./quadraturaFirDati.ts";
import { intervalloSettimana, settimanaIso, statoCaricamenti, riepilogoVociDate, voceDate } from "./reportSettimanali.ts";
import { situazioneGestionale, terminatiSenzaFine } from "./assistente.ts";
import { listaOrdini, statoRichiesta, evasioneOrdini } from "./richiesteEct.ts";
import { targetDelPortale } from "./targetRaccoglitori.ts";
import { statoDichiarazione, sommaMateriali } from "./dichiarazioniImpianti.ts";
import { giorniAllaScadenza, fasciaScadenza } from "./omologhe.ts";
import { statoRequisito } from "./qualificaFornitori.ts";
import { calcolaRigheAttiva, riconciliaAttiva, documentoValido, eRigaACorpo, eSecondariaExtra, TIPOLOGIE_ATTIVA } from "./attivaCalcolo.ts";

export { oggiRoma };

// Di una data conta il giorno italiano: la regola sta in shared/giornoItaliano.ts.
const soloData = (v) => giornoRoma(v);
const terminato = (r) => String(r.stato || '').toLowerCase().trim() === 'terminato';
const peso = (r) => Number(r.peso_effettivo) || 0;
const t3 = (kg) => Math.round((Number(kg) || 0) / 1000 * 1000) / 1000;

const meseDi = (v, anno) => {
  const d = soloData(v);
  if (!d || (anno && Number(d.slice(0, 4)) !== Number(anno))) return -1;
  return Number(d.slice(5, 7)) - 1;
};

const annoDi = (v) => { const d = soloData(v); return d ? Number(d.slice(0, 4)) : null; };

// Il canale arriva scritto come lo scrive l'utente ("extra raccolta", "Extra",
// "aci"). Confrontato cosi' com'era, "EXTRA RACCOLTA" non era un canale: la
// fatturazione attiva rispondeva con tutti e tre, e il raccolto dell'extra
// raccolta usciva con i numeri della rete sotto il nome dell'extra.
// Stringa vuota se non e' un canale.
function canaleChiesto(v) {
  const k = String(v ?? '').toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (k === 'EXTRA' || k === 'EXTRARACCOLTA') return 'EXTRA_RACCOLTA';
  return TIPOLOGIE_ATTIVA.includes(k) ? k : '';
}

/**
 * Le date obbligatorie dei formulari: immissione, inizio e fine trasporto
 * (regola dell'utente del 22/09/2026, "vanno segnalate e questo vale sempre dove
 * ci sono ordini terminati"). Prima si dicevano solo i terminati senza fine
 * trasporto; ora tutti quelli a cui una data manca o non torna, di qualunque
 * anno, con ID ordine, formulario e date che mancano (riepilogoVociDate in
 * reportSettimanali.ts, sulle regole di movimenti.ts). Sono ordini distinti,
 * non righe: lo stesso ordine con piu' righe vale una volta.
 *
 * I senza fine trasporto restano a parte perche' sono i soli che il conto
 * scarta: non stanno in nessun mese, e scartati in silenzio fanno sembrare
 * completo un conto che non lo e'. Si contano tutti, di qualunque periodo, come
 * fanno la Dashboard e il Report Mensile, divisi per anno di immissione,
 * l'unica data che hanno, con una voce per chi non ha nemmeno quella; mai la
 * chiusura a portale (terminatiSenzaFine in assistente.ts, la stessa del
 * riepilogo). Gli altri sono nel conto, ma le date vanno inserite o corrette.
 *
 * Un modulo e un canale per volta: chi chiama passa le righe di uno solo, e dice
 * quale. null se sono tutte a posto.
 */
function dateObbligatorie(righe, modulo = '') {
  const riepilogo = riepilogoVociDate(righe, 10);
  if (!riepilogo) return null;
  const { esclusi, per_anno } = terminatiSenzaFine(righe);
  const kg = (xs) => xs.reduce((s, r) => s + peso(r), 0);
  return {
    ...(modulo ? { modulo } : {}),
    ordini: riepilogo.ordini,
    esempi: riepilogo.esempi.map(v => ({
      id_ordine: v.id_ordine, numero_fir: v.numero_fir, date: v.date,
      ...(v.giorno ? { fine_trasporto: v.giorno } : { escluso_dal_conto: true }),
    })),
    ...(riepilogo.ordini > riepilogo.esempi.length ? { avviso: `ELENCO TAGLIATO: qui ci sono ${riepilogo.esempi.length} ordini dei ${riepilogo.ordini}. Il numero giusto e' "ordini".` } : {}),
    ...(esclusi.length ? {
      senza_fine_trasporto: {
        formulari: contaFormulari(esclusi),
        tonnellate: t3(kg(esclusi)),
        per_anno_immissione: per_anno.map(g => ({
          anno_immissione: g.anno === null ? 'senza data di immissione' : g.anno,
          formulari: contaFormulari(g.righe), tonnellate: t3(kg(g.righe)),
        })),
      },
    } : {}),
    nota: 'Immissione, inizio e fine trasporto sono date obbligatorie nei formulari: questi ordini terminati, di qualunque anno, ne hanno una che manca o non torna, e vanno segnalati sempre. Quelli senza fine trasporto ("senza_fine_trasporto", "escluso_dal_conto") sono esclusi dal conto perche\' non si sa in che mese cadono, e qualcuno potrebbe appartenere al periodo chiesto: sono divisi per anno di immissione, l\'unica data che hanno, e chi non ha nemmeno quella sta nella voce "senza data di immissione". Gli altri sono nel conto, ma le date vanno inserite o corrette. Si correggono nel file del portale e si ricaricano; l\'extra raccolta nella sua scheda.',
  };
}

/**
 * Le primarie o le extra di un canale, filtrate per periodo e per luogo, e a
 * parte i terminati dello stesso luogo con le date obbligatorie da sistemare, di
 * qualunque periodo: chi non ha la fine trasporto il periodo non lo ha proprio.
 */
async function movimenti(base44, { canale, anno, mese, provincia, regione, raccoglitore, destinazione }) {
  const svc = base44.asServiceRole.entities;
  const entita = canale === 'ACI' ? 'PrimariaAci' : canale === 'EXTRA_RACCOLTA' ? 'ExtraRaccolta' : 'PrimariaRete';
  const tutte = await fetchAll(svc[entita], { stato: 'terminato' });
  const meseIdx = mese ? MESI.findIndex(m => m.toLowerCase() === String(mese).toLowerCase()) : -1;
  const chiave = (v) => normalizzaRagioneSociale(v);
  const delLuogo = tutte.filter(r => {
    if (!terminato(r)) return false;
    // Nell'extra raccolta lo stesso archivio tiene la raccolta dal produttore e
    // i trasferimenti successivi: il raccolto sono solo le primarie, altrimenti
    // il materiale si conta due volte, una quando arriva e una quando si sposta.
    if (canale === 'EXTRA_RACCOLTA' && String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== 'primaria') return false;
    if (provincia && String(r.provincia || '').toUpperCase() !== String(provincia).toUpperCase()) return false;
    if (regione && normalizzaRagioneSociale(r.regioni || r.regione || getRegioneFromProvincia(r.provincia)) !== normalizzaRagioneSociale(regione)) return false;
    if (raccoglitore && chiave(r.trasportatore) !== chiave(raccoglitore)) return false;
    if (destinazione && chiave(r.destinazione) !== chiave(destinazione)) return false;
    return true;
  });
  const righe = delLuogo.filter(r => {
    const m = meseDi(r.trasporto_finito_il, anno);
    if (m < 0) return false;
    if (meseIdx >= 0 && m !== meseIdx) return false;
    return true;
  });
  const modulo = canale === 'ACI' ? 'primarie ACI' : canale === 'EXTRA_RACCOLTA' ? 'extra raccolta, raccolte' : 'primarie di rete';
  return { righe, date: dateObbligatorie(delLuogo, modulo) };
}

/**
 * Un elenco lungo non si consegna intero: si taglia, altrimenti il prompt non
 * sta in piedi. Ma il taglio va detto a voce alta, perche' chi legge conta le
 * righe che vede e crede sia quello il totale: e' successo davvero il
 * 19/09/2026, con 268 punti di raccolta della provincia di Bari diventati 6
 * nella risposta. Da qui in poi ogni elenco porta con se' quanti sono in tutto,
 * quanti se ne vedono e, se e' tagliato, l'avviso di non contarli.
 */
function elenco(righe, quanti = 60) {
  const mostrate = righe.slice(0, quanti);
  const esito = { quanti: righe.length, mostrate: mostrate.length, righe: mostrate };
  if (righe.length > mostrate.length) {
    esito.avviso = `ELENCO TAGLIATO: qui ci sono ${mostrate.length} righe delle ${righe.length} totali. Il numero giusto e' "quanti": non contare le righe di questo elenco.`;
  }
  return esito;
}

// Il mese di un movimento e' quello della fine del trasporto, come in tutto il
// resto del gestionale. Il campo "mese" che arriva dal portale ogni tanto dice
// un'altra cosa - il FIR RGYTR025688FF, finito il 31 luglio 2026, li' e' segnato
// ad agosto - e raggruppare su quello spacca il mese in due.
const MESE_DA_DATA = (r) => {
  const d = soloData(r.trasporto_finito_il);
  return d ? MESI[Number(d.slice(5, 7)) - 1] || 'N/D' : 'N/D';
};

// La regione di un movimento: la colonna del portale, il campo vecchio, e in
// mancanza la provincia. Il filtro la cercava cosi' e il raggruppamento no, e
// filtrando per Campania usciva un dettaglio con la riga "N/D".
const REGIONE_DI = (r) => String(r.regioni || r.regione || getRegioneFromProvincia(r.provincia) || 'N/D').trim();

function perChiave(righe, campo) {
  const m = new Map();
  // I chili si sommano riga per riga, i formulari si contano per numero: un
  // formulario chiuso su piu' ordini - sull'ACI capita per regola - resta un
  // formulario solo.
  for (const r of righe) {
    const k = campo === 'mese' ? MESE_DA_DATA(r)
      : campo === 'regioni' ? REGIONE_DI(r)
      : String(r[campo] || 'N/D').trim();
    if (!m.has(k)) m.set(k, { nome: k, righe: [], kg: 0 });
    const x = m.get(k);
    x.righe.push(r);
    x.kg += peso(r);
  }
  return [...m.values()]
    .map(x => ({ nome: x.nome, formulari: contaFormulari(x.righe), kg: x.kg, tonnellate: t3(x.kg) }))
    .sort((a, b) => b.kg - a.kg);
}

const euro2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Quanto ci spetta da Ecotyre, calcolato sui dati di oggi con le righe del
 * modulo (attivaCalcolo.ts) e messo accanto al documento salvato di ogni mese.
 * Col mese si fa anche la riconciliazione riga per riga, come nella pagina;
 * sull'anno si confrontano i totali, che bastano a dire quale mese e' indietro.
 * Rete, ACI ed extra raccolta: tre conti, nessun totale che li somma.
 */
async function attivaSuiDatiDiOggi(base44, { anno, meseChiesto, meseIgnorato, tipologia, fornitore }) {
  const svc = base44.asServiceRole.entities;
  const [reteAll, aciAll, extraAll, fornitori, tariffe, documenti] = await Promise.all([
    fetchAll(svc.PrimariaRete), fetchAll(svc.PrimariaAci), fetchAll(svc.ExtraRaccolta),
    fetchAll(svc.Fornitore), fetchAll(svc.Tariffa, { direzione: 'ATTIVA' }),
    fetchAll(svc.DocumentoFatturazione, { tipo: 'ATTIVA', anno }),
  ]);
  const chiesta = canaleChiesto(tipologia);
  const canaleIgnorato = tipologia && !chiesta ? String(tipologia) : '';
  const canali = TIPOLOGIE_ATTIVA.filter(c => !chiesta || c === chiesta);

  // Il calcolo delle righe scarta i terminati senza fine trasporto: qui si
  // contano, canale per canale, cosi' la risposta dice che il conto di quanto ci
  // spetta e' incompleto invece di tacerlo; e con loro gli ordini a cui manca
  // un'altra data obbligatoria o che le hanno incoerenti (22/09/2026). Le
  // secondarie dell'extra raccolta non si fatturano, e non si contano nemmeno qui.
  const archivioDi = { RETE: reteAll, ACI: aciAll, EXTRA_RACCOLTA: (extraAll || []).filter(r => !eSecondariaExtra(r)) };
  const moduloDi = { RETE: 'primarie di rete', ACI: 'primarie ACI', EXTRA_RACCOLTA: 'extra raccolta, raccolte' };
  const conDate = canali.map(c => ({ canale: c, date: dateObbligatorie(archivioDi[c], moduloDi[c]) })).filter(x => x.date);

  // Senza mese: i mesi dell'anno fino a quello in corso, per fine trasporto.
  const oggi = oggiRoma();
  const annoOggi = Number(oggi.slice(0, 4));
  const ultimo = anno < annoOggi ? 11 : anno === annoOggi ? Number(oggi.slice(5, 7)) - 1 : -1;
  const mesi = meseChiesto ? [meseChiesto] : MESI.slice(0, ultimo + 1);

  const perCanale = new Map(canali.map(c => [c, { canale: c, kg: 0, ordini: 0, euro: 0, senza_prezzo: 0, kg_senza_prezzo: 0, mesi: [] }]));
  const anomalie = [];
  for (const mese of mesi) {
    const { righe, anomalie: an } = calcolaRigheAttiva({ reteAll, aciAll, extraAll, fornitori, tariffe, anno, mese });
    for (const a of an) if (canali.includes(a.tipologia)) anomalie.push({ mese, ...a });
    const docsMese = documenti.filter(d => String(d.mese || '').toLowerCase() === mese.toLowerCase());
    for (const c of canali) {
      const lista = righe[c] || [];
      const x = { kg: 0, ordini: 0, euro: 0, senza_prezzo: 0, kg_senza_prezzo: 0 };
      for (const r of lista) {
        x.euro += Number(r.totale) || 0;
        // Un sovracosto a corpo e' un importo, non un movimento: niente chili ne' ordini.
        if (eRigaACorpo(r)) continue;
        x.kg += Number(r.quantita) || 0;
        x.ordini++;
        if (r.stato_validazione === 'errore') { x.senza_prezzo++; x.kg_senza_prezzo += Number(r.quantita) || 0; }
      }
      const doc = documentoValido(docsMese, c);
      let documento;
      if (!doc) {
        documento = { stato: 'non elaborato', ...(lista.length ? { avviso: 'Il mese non ha ancora un documento: questi importi non sono ancora in fattura.' } : {}) };
      } else {
        documento = {
          stato: doc.stato, elaborato_il: soloData(doc.data_elaborazione),
          totale_documento_euro: euro2(doc.totale), differenza_euro: euro2(x.euro - (Number(doc.totale) || 0)),
        };
        if (meseChiesto) {
          const voci = await fetchAll(svc.VoceFatturazione, { documento_id: doc.id });
          const ric = riconciliaAttiva(lista, voci);
          // La fine trasporto si scrive come giorno italiano: l'ora UTC del
          // record, a mezzanotte, mostrerebbe il giorno prima.
          const conGiorno = (xs) => xs.map(x => ({ ...x, data_fine_trasporto: soloData(x.data_fine_trasporto) }));
          Object.assign(documento, {
            allineato: ric.allineato,
            arrivati_dopo: elenco(conGiorno(ric.nuovi), 20), cambiati: elenco(conGiorno(ric.cambiati), 20), non_piu_nel_mese: elenco(conGiorno(ric.spariti), 20),
            differenza_kg: ric.delta_kg, differenza_euro: ric.delta_euro,
          });
        } else {
          // Senza il mese si confrontano i totali, non le righe. Gli euro da
          // soli non bastano: una riga arrivata dopo a zero euro (senza tariffa,
          // o un'extra raccolta col prezzo a zero) non li sposta. Si guarda
          // anche quante sono le righe; il dettaglio riga per riga si ha
          // chiedendo il mese. I documenti di prima del conteggio non lo hanno.
          const righeDoc = doc.numero_voci === null || doc.numero_voci === undefined ? null : Number(doc.numero_voci);
          documento.righe_documento = righeDoc;
          documento.righe_oggi = lista.length;
          documento.allineato = Math.abs(documento.differenza_euro) < 0.005 && (righeDoc === null || righeDoc === lista.length);
        }
        if (!documento.allineato) {
          documento.avviso = doc.stato === 'chiusa'
            ? 'Il documento e\' indietro rispetto ai dati caricati e il periodo e\' chiuso: va riaperto, oppure la differenza si fattura con un\'integrazione.'
            : 'Il documento e\' indietro rispetto ai dati caricati: va rielaborato (Elabora Mese nel modulo Fatturazione).';
        }
      }
      const tot = perCanale.get(c);
      for (const campo of ['kg', 'ordini', 'euro', 'senza_prezzo', 'kg_senza_prezzo']) tot[campo] += x[campo];
      if (lista.length || doc) {
        tot.mesi.push({
          mese, tonnellate: t3(x.kg), ordini: x.ordini, euro: euro2(x.euro),
          ...(x.senza_prezzo ? { righe_senza_prezzo: x.senza_prezzo, tonnellate_senza_prezzo: t3(x.kg_senza_prezzo) } : {}),
          documento,
        });
      }
    }
  }

  return {
    fonte: `Fatturazione attiva verso Ecotyre, calcolata sui dati di oggi${chiesta ? `, canale ${chiesta}` : ', un canale per volta'}`,
    periodo: meseChiesto ? `${meseChiesto} ${anno}` : ultimo >= 0 ? `anno ${anno}, da ${MESI[0]} a ${MESI[ultimo]}` : `anno ${anno}`,
    dati_al: oggi,
    dati: {
      canali: [...perCanale.values()].map(x => ({
        canale: x.canale, tonnellate: t3(x.kg), ordini: x.ordini, euro: euro2(x.euro),
        ...(x.senza_prezzo ? { righe_senza_prezzo: x.senza_prezzo, tonnellate_senza_prezzo: t3(x.kg_senza_prezzo) } : {}),
        mesi: x.mesi,
      })),
      anomalie: elenco(anomalie, 30),
      ...(conDate.length ? { date_obbligatorie_da_sistemare: conDate.map(x => ({ canale: x.canale, ...x.date })) } : {}),
      ...(ultimo < 0 && !meseChiesto ? { avviso_periodo: `L'anno ${anno} non e' ancora cominciato.` } : {}),
      ...(meseIgnorato ? { avviso_periodo: `"${meseIgnorato}" non e' un mese: ho preso l'anno ${anno}.` } : {}),
      ...(canaleIgnorato ? { avviso_canale: `"${canaleIgnorato}" non e' un canale: ci sono tutti e tre, separati.` } : {}),
      ...(fornitore ? { avviso_fornitore: 'Nell\'attiva il cliente e\' uno solo, Ecotyre: il filtro sul fornitore non si applica.' } : {}),
      nota: `Conto fatto adesso sui movimenti terminati, per fine trasporto, con le stesse righe dell'anteprima e di "Elabora Mese". Accanto a ogni mese c'e' il documento salvato: una differenza vuol dire che dopo l'elaborazione sono arrivati o cambiati dei movimenti, e il documento va aggiornato.${meseChiesto ? '' : ' Senza il mese il documento si confronta sul totale in euro e sul numero di righe: una riga cambiata di peso con lo stesso importo si vede solo chiedendo il mese, che confronta riga per riga.'} Rete, ACI ed extra raccolta non si sommano.`,
    },
  };
}

// ─── il registro ───

export const STRUMENTI = [
  {
    nome: 'panoramica_commessa',
    descrizione: 'Il quadro generale della commessa: contratto, raccolto per canale, target, alert, giacenze e qualifica. Da usare per le domande larghe, non per un numero preciso.',
    parametri: { anno: 'numero, opzionale', mese: 'nome del mese, opzionale' },
    moduli: ['Target & Status', 'Dashboard'],
    async esegui(base44, p) {
      const oggi = p.data || oggiRoma();
      const testo = await situazioneGestionale(base44, oggi);
      return { fonte: 'Riepilogo della commessa', periodo: `anno ${oggi.slice(0, 4)}`, dati_al: oggi, dati: { riepilogo: testo } };
    },
  },
  {
    nome: 'raccolto',
    descrizione: 'Quanto si e\' raccolto in un canale e in un periodo, con il dettaglio per raccoglitore, provincia, regione, classe o destinazione. Il canale va sempre indicato: rete, ACI ed extra raccolta non si sommano.',
    parametri: {
      canale: 'RETE, ACI o EXTRA_RACCOLTA, obbligatorio', anno: 'numero', mese: 'nome del mese, opzionale',
      provincia: 'sigla, opzionale', regione: 'opzionale', raccoglitore: 'opzionale', destinazione: 'opzionale',
      raggruppa: 'raccoglitore, provincia, regione, classe, destinazione o mese',
    },
    moduli: ['Terminati Rete', 'Terminati ACI', 'Extra Raccolta', 'Report Mensile'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      // Un canale non riconosciuto non deve passare in silenzio per la rete: si
      // prende la rete e lo si dice, perche' i tre canali non si sommano.
      const canale = canaleChiesto(p.canale) || 'RETE';
      const avvisoCanale = canaleChiesto(p.canale) ? ''
        : `${p.canale ? `"${p.canale}" non e' un canale` : 'Canale non indicato'}: questi sono i numeri della RETE. ACI ed extra raccolta non si sommano: per loro rifai la domanda col canale.`;
      // Un mese che non esiste non deve passare in silenzio per "tutto l'anno".
      const meseValido = p.mese ? MESI.find(m => m.toLowerCase() === String(p.mese).toLowerCase()) : '';
      const meseIgnorato = p.mese && !meseValido ? String(p.mese) : '';
      const { righe, date } = await movimenti(base44, { ...p, mese: meseValido, anno, canale });
      const campo = { raccoglitore: 'trasportatore', provincia: 'provincia', regione: 'regioni', classe: 'classe', destinazione: 'destinazione', mese: 'mese' }[p.raggruppa] || 'trasportatore';
      const totale = righe.reduce((s, r) => s + peso(r), 0);
      return {
        fonte: `Formulari terminati, canale ${canale}`,
        periodo: meseValido ? `${meseValido} ${anno}` : `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          canale, formulari: contaFormulari(righe), tonnellate: t3(totale),
          ...(avvisoCanale ? { avviso_canale: avvisoCanale } : {}),
          ...(date ? { date_obbligatorie_da_sistemare: date } : {}),
          ...(meseIgnorato ? { avviso_periodo: `"${meseIgnorato}" non e' un mese: ho preso tutto l'anno ${anno}.` } : {}),
          per: p.raggruppa || 'raccoglitore',
          dettaglio: elenco(perChiave(righe, campo), 60),
        },
      };
    },
  },
  {
    nome: 'target_raccoglitori',
    descrizione: 'Il target annuo di ciascun raccoglitore della rete e quanto ha fatto finora, con lo scostamento. I target sono solo di rete: l\'ACI non ne ha.',
    parametri: { anno: 'numero' },
    moduli: ['Target & Status'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const svc = base44.asServiceRole.entities;
      const [target, { righe, date }] = await Promise.all([
        svc.TargetRaccoglitore.filter({ anno }, 'raccoglitore', 500),
        movimenti(base44, { canale: 'RETE', anno }),
      ]);
      // Il nome del target puo' essere l'abbreviazione di quello che scrive il
      // portale ("PNEUSERVICE SRL" per "PNEUSERVICE CONVERSANO SRL"): abbinando
      // solo per nome uguale, il raccolto di quel raccoglitore risultava zero e
      // finiva in cima alla lista di chi e' sotto target. Stesso criterio degli
      // altri moduli: uguale, oppure abbreviazione le cui parole stanno tutte
      // nel nome del portale.
      const nomiTarget = [...new Set(target.map(t => t.raccoglitore).filter(Boolean))];
      const fatto = new Map();
      const senzaTarget = new Map();
      for (const r of righe) {
        const nome = targetDelPortale(nomiTarget, r.trasportatore);
        if (nome) {
          const k = normalizzaRagioneSociale(nome);
          fatto.set(k, (fatto.get(k) || 0) + peso(r));
        } else {
          const k = String(r.trasportatore || 'N/D').trim();
          senzaTarget.set(k, (senzaTarget.get(k) || 0) + peso(r));
        }
      }
      const per = new Map();
      for (const t of target) {
        const k = normalizzaRagioneSociale(t.raccoglitore);
        if (!per.has(k)) per.set(k, { raccoglitore: t.raccoglitore, target_t: 0, fatto_t: t3(fatto.get(k) || 0) });
        per.get(k).target_t += Number(t.target_tonnellate) || 0;
      }
      const dettaglio = [...per.values()].map(x => ({
        ...x,
        target_t: Math.round(x.target_t * 100) / 100,
        residuo_t: Math.round((x.target_t - x.fatto_t) * 100) / 100,
        percentuale: x.target_t > 0 ? Math.round((x.fatto_t / x.target_t) * 1000) / 10 : null,
      })).sort((a, b) => (a.percentuale ?? 999) - (b.percentuale ?? 999));
      return {
        fonte: 'Target & Status, canale RETE',
        periodo: `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          raccoglitori: dettaglio,
          target_totale_t: Math.round(dettaglio.reduce((s, x) => s + x.target_t, 0) * 100) / 100,
          fatto_totale_t: Math.round(dettaglio.reduce((s, x) => s + x.fatto_t, 0) * 100) / 100,
          ...(senzaTarget.size ? { raccolto_senza_target: [...senzaTarget.entries()].map(([nome, kg]) => ({ raccoglitore: nome, tonnellate: t3(kg) })).sort((a, b) => b.tonnellate - a.tonnellate) } : {}),
          ...(date ? { date_obbligatorie_da_sistemare: date } : {}),
        },
      };
    },
  },
  {
    nome: 'report_mensile',
    descrizione: 'Le pivot del Report Mensile: raccolta, impianti, viaggi, ACI, secondarie di rete, secondarie ACI, terziarie ed extra raccolta.',
    parametri: { pivot: Object.keys(PIVOT_DEFS).join(', '), anno: 'numero', mese: 'nome del mese, per le pivot mensili' },
    moduli: ['Report Mensile'],
    async esegui(base44, p) {
      const chiave = PIVOT_DEFS[p.pivot] ? p.pivot : 'raccolta';
      const pivotIgnorata = p.pivot && !PIVOT_DEFS[p.pivot] ? String(p.pivot) : '';
      const def = PIVOT_DEFS[chiave];
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      // Una pivot mensile copre un mese solo. Se il mese non e' stato chiesto si
      // prende quello in corso, ma allora bisogna dirlo: prima il periodo diceva
      // "2026" e il numero era del solo mese corrente.
      const meseValido = p.mese ? MESI.find(m => m.toLowerCase() === String(p.mese).toLowerCase()) : '';
      const meseUsato = def.periodo === 'mese' ? (meseValido || MESI[Number(oggiRoma().slice(5, 7)) - 1]) : '';
      const righe = await fetchAll(base44.asServiceRole.entities[def.entita]);
      const pivot = calcolaPivot(chiave, righe, anno, meseUsato);
      // La pivot scarta i terminati senza fine trasporto: la pagina li segnala,
      // e qui si contano sulle stesse righe con gli stessi filtri della pivot
      // (il canale delle secondarie, la raccolta o il trasferimento dell'extra),
      // insieme agli ordini con le altre date obbligatorie da sistemare.
      const date = dateObbligatorie(righe.filter(r => {
        if (def.canale && (def.canale === 'ACI') !== eAci(r)) return false;
        if (def.movimento && String(r.tipo_movimento || 'primaria').toLowerCase().trim() !== def.movimento) return false;
        return true;
      }), `${def.entita}${def.canale ? ` ${def.canale}` : ''}${def.movimento ? ` (${def.movimento})` : ''}`);
      const avvisi = [];
      if (def.periodo === 'mese' && !meseValido) avvisi.push(`Questa pivot copre un mese solo e il mese non era indicato: sono i dati di ${meseUsato} ${anno}, non dell'anno.`);
      if (pivotIgnorata) avvisi.push(`La pivot "${pivotIgnorata}" non esiste: ho preso "${chiave}".`);
      return {
        fonte: `Report Mensile, pivot ${pivot.titolo}`,
        periodo: def.periodo === 'mese' ? `${meseUsato} ${anno}` : `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          titolo: pivot.titolo, misure: pivot.etichetteMisure, colonne: pivot.colonne,
          righe_lette: pivot.righeLette, albero: pivot.radice,
          ...(date ? { date_obbligatorie_da_sistemare: date } : {}),
          ...(avvisi.length ? { avvisi } : {}),
        },
      };
    },
  },
  {
    nome: 'settimana_formulari',
    descrizione: 'I formulari di una settimana, per flusso e per impianto: quanti e quanti chili, come li conta il gestionale nella quadratura FIR.',
    parametri: { anno: 'numero', settimana: 'numero della settimana ISO' },
    moduli: ['Verifiche', 'Quadratura FIR'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const settimana = Number(p.settimana) || settimanaIso(oggiRoma()).settimana;
      const intervallo = intervalloSettimana(anno, settimana);
      const g = await caricaGestionale(base44, intervallo);
      const flussi = Object.entries(g).map(([chiave, d]) => ({
        flusso: chiave, formulari: d.totale.n, tonnellate: t3(d.totale.kg),
        celle: d.celle.map(c => ({ impianto: c.impianto, trasportatore: c.trasportatore, formulari: c.n, tonnellate: t3(c.kg) })),
      })).filter(f => f.formulari > 0);
      // I flussi stanno sotto il loro canale, ciascuno con il proprio totale. Un
      // totale della settimana non esiste: sommare rete, ACI ed extra raccolta
      // darebbe un numero che non vuol dire niente, e continuava a succedere.
      const canaleDelFlusso = (nome) => (/aci/.test(nome) ? 'ACI' : /extra/.test(nome) ? 'EXTRA_RACCOLTA' : 'RETE');
      const perCanale = {};
      for (const f of flussi) {
        const c = canaleDelFlusso(f.flusso);
        // Dentro un canale, primarie e secondarie non si sommano: lo stesso
        // materiale e' arrivato una volta in primaria e poi si e' spostato in
        // secondaria, e sommarli lo conterebbe due volte.
        if (!perCanale[c]) perCanale[c] = { canale: c, totale_del_canale: null, flussi: [] };
        perCanale[c].flussi.push(f);
      }
      // Le date obbligatorie, flusso per flusso (22/09/2026): i terminati senza
      // fine trasporto non stanno in nessuna settimana e la quadratura li conta a
      // parte; quelli della settimana senza immissione o inizio del trasporto, o
      // con date incoerenti, sono contati ma vanno corretti. E un archivio che si
      // sta ricaricando e' a meta': i numeri vanno presi con quell'avviso, non
      // come definitivi.
      const conDate = Object.entries(g)
        .filter(([, d]) => d && ((d.senza_fine && d.senza_fine.n > 0) || (d.date_da_sistemare || []).length))
        .map(([chiave, d]) => ({
          flusso: chiave, canale: canaleDelFlusso(chiave),
          ...(d.senza_fine && d.senza_fine.n > 0 ? { senza_fine_trasporto: { formulari: d.senza_fine.n, esempi: d.senza_fine.esempi, escluso_da_ogni_settimana: true } } : {}),
          ...((d.date_da_sistemare || []).length ? { nella_settimana: { formulari: contaDistinti(d.date_da_sistemare), esempi: d.date_da_sistemare.slice(0, 10).map(x => ({ fir: x.fir, ordine: x.ordine, date: x.date })) } } : {}),
        }));
      const aperti = caricamentiAperti(g);
      return {
        fonte: 'Formulari terminati nella settimana',
        periodo: `settimana ${settimana} del ${anno}, dal ${intervallo.inizio} al ${intervallo.fine}`,
        dati_al: oggiRoma(),
        dati: {
          settimana, intervallo,
          canali: Object.values(perCanale),
          ...(conDate.length ? { date_obbligatorie_da_sistemare: { flussi: conDate, nota: 'Immissione, inizio e fine trasporto sono obbligatorie nei formulari. "senza_fine_trasporto": terminati di qualunque periodo senza la data di fine trasporto, esclusi da ogni settimana. "nella_settimana": formulari della settimana, contati, a cui manca l\'immissione o l\'inizio del trasporto o che hanno le date incoerenti. Vanno corretti nel file del portale e ricaricati; l\'extra raccolta nella sua scheda.' } } : {}),
          ...(aperti.length ? { avviso_caricamenti: `Caricamento ${aperti.some(a => a.interrotto) ? 'interrotto' : 'in corso'} di ${aperti.map(a => a.tipo_file).join(', ')}: l'archivio puo' essere a meta' e questi numeri non sono definitivi.` } : {}),
          totale_della_settimana: null,
          nota: "Ogni flusso ha il suo totale e i totali NON si sommano, per due motivi diversi: fra canali perche' rete, ACI ed extra raccolta sono commesse indipendenti; dentro lo stesso canale perche' primaria e secondaria sono lo stesso materiale che si sposta, e sommarle lo conterebbe due volte. Nella risposta i numeri vanno dati flusso per flusso.",
        },
      };
    },
  },
  {
    nome: 'cerca_movimento',
    descrizione: 'Cerca un formulario (FIR) o un ID ordine in tutti gli archivi e dice dove sta, con produttore, trasportatore, destinazione, peso e date.',
    parametri: { testo: 'numero di formulario o ID ordine, anche parziale' },
    moduli: ['Terminati Rete', 'Terminati ACI', 'Secondarie', 'Extra Raccolta', 'Terziarie'],
    async esegui(base44, p) {
      const cerca = String(p.testo || '').trim().toUpperCase();
      if (!cerca) return { fonte: 'Archivi dei movimenti', periodo: '', dati_al: oggiRoma(), dati: { trovati: [], nota: 'Nessun testo da cercare.' } };
      const svc = base44.asServiceRole.entities;
      const archivi = ['PrimariaRete', 'PrimariaAci', 'Secondaria', 'ExtraRaccolta', 'Terziaria'];
      const trovati = [];
      await Promise.all(archivi.map(async (nome) => {
        const righe = await fetchAll(svc[nome]);
        for (const r of righe) {
          const fir = String(r.numero_fir || '').toUpperCase();
          const ordine = String(r.id_ordine || '').toUpperCase();
          if (!fir.includes(cerca) && !ordine.includes(cerca)) continue;
          trovati.push({
            archivio: nome, canale: nome === 'PrimariaAci' ? 'ACI' : nome === 'Secondaria' ? (eAci(r) ? 'ACI' : 'RETE') : nome === 'ExtraRaccolta' ? 'EXTRA_RACCOLTA' : 'RETE',
            id_ordine: r.id_ordine, numero_fir: r.numero_fir, stato: r.stato,
            produttore: r.ragione_sociale || r.stoccaggio || r.unita_locale_origine || '',
            punto_di_raccolta: r.punto_di_raccolta || '', provincia: r.provincia || '',
            trasportatore: r.trasportatore || '', destinazione: r.destinazione || '',
            classe: r.classe || '', peso_effettivo_kg: peso(r),
            // tutte e tre le date obbligatorie, e cosa manca o non torna (22/09/2026)
            ordine_immesso_il: soloData(r.ordine_immesso_il), trasporto_iniziato_il: soloData(r.trasporto_iniziato_il),
            trasporto_finito_il: soloData(r.trasporto_finito_il), ordine_chiuso_il: soloData(r.ordine_chiuso_il),
            ...(voceDate(r) ? { date_obbligatorie_da_sistemare: voceDate(r).date } : {}),
          });
        }
      }));
      return { fonte: 'Archivi dei movimenti', periodo: 'tutti gli anni', dati_al: oggiRoma(), dati: { cercato: cerca, trovati: elenco(trovati, 40) } };
    },
  },
  {
    nome: 'proiezione_secondarie',
    descrizione: 'Quanti viaggi di secondaria restano da portare a ciascun impianto per arrivare al target, mese per mese, se gli stoccaggi hanno materiale per farli e quali ipotesi sono state fissate a mano. Solo rete: ACI ed extra raccolta non entrano nella predittivita\'.',
    parametri: { anno: 'numero', mese_da: 'indice del mese da cui proiettare, 0 = gennaio' },
    moduli: ['Predittivita Secondarie'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const meseDa = p.mese_da != null ? Number(p.mese_da) : Number(oggiRoma().slice(5, 7)) - 1;
      // Si chiama il modulo, non si rifa' il conto: qui mancavano le giacenze
      // degli stoccaggi e le ipotesi scritte a mano, e uscivano viaggi diversi
      // da quelli che l'utente vede a video, con avvisi di materiale mancante
      // che a video non c'erano.
      const res = await base44.functions.invoke('proiezioneSecondarie', { anno, mese_da: meseDa });
      const d = (res && res.data) || res || {};
      const impianti = (d.impianti || []).map(x => ({
        impianto: x.impianto,
        target_t: t3(x.target_kg), conferito_t: t3(x.conferito_kg), residuo_t: t3(x.residuo_kg),
        viaggi_totali: x.viaggi_totali,
        mesi: (x.mesi || []).map(m => ({
          mese: m.mese, primaria_attesa_t: t3(m.primaria_kg), viaggi: m.viaggi,
          residuo_t: t3(m.residuo_kg), viaggi_disponibili: m.viaggi_disponibili, viaggi_mancanti: m.viaggi_mancanti,
          da_ipotesi: !!(m.primaria_da_ipotesi || m.viaggi_da_ipotesi),
        })),
        stoccaggi: (x.stoccaggi || []).map(st => ({ nome: st.nome, giacenza_t: st.giacenza_kg == null ? null : t3(st.giacenza_kg), nota: st.giacenza_nota || '' })),
        avvisi: x.avvisi || [],
      }));
      // Gli avvisi che valgono per tutta la proiezione si passano cosi' come
      // arrivano: un archivio che si sta ricaricando e' a meta' e i viaggi non
      // sono definitivi, e i terminati senza fine trasporto restano fuori dal
      // gia' arrivato. Scartati qui, la risposta li dava per completi.
      const sf = d.senza_fine_trasporto;
      return {
        fonte: 'Predittivita delle secondarie, canale RETE',
        periodo: `da ${MESI[meseDa] || ''} ${anno} alla data obiettivo`.trim(),
        dati_al: oggiRoma(),
        dati: {
          ...(d.caricamento_in_corso ? { avviso_caricamenti: d.caricamento_in_corso } : {}),
          ...(d.avvisi_generali && d.avvisi_generali.length ? { avvisi_generali: d.avvisi_generali } : {}),
          ...(sf && (sf.primarie || sf.secondarie) ? { senza_fine_trasporto: sf } : {}),
          // le date obbligatorie mancanti o incoerenti dei terminati di rete, come
          // le dice il modulo (22/09/2026): passano cosi' come arrivano
          ...(d.date_da_sistemare ? { date_obbligatorie_da_sistemare: d.date_da_sistemare } : {}),
          kg_per_viaggio: d.kg_per_viaggio,
          impianti,
          viaggi_per_mese: d.viaggi_per_mese,
          piazzali_condivisi: d.piazzali_condivisi,
          registro_piazzali: d.registro_piazzali,
          ipotesi_fissate: (d.ipotesi || []).map(i => ({ impianto: i.impianto, mese: i.mese, primaria_attesa_kg: i.primaria_attesa_kg, viaggi_previsti: i.viaggi_previsti, note: i.note })),
          nota: "Sono gli stessi numeri del modulo Predittivita Secondarie, ipotesi scritte a mano comprese. Solo rete: ACI ed extra raccolta non entrano. Gli impianti che attingono allo stesso stoccaggio sono calcolati insieme: quel piazzale ha una giacenza sola e il registro qui sotto dice mese per mese quanto ne prende ciascuno.",
        },
      };
    },
  },
  {
    nome: 'rotte_conferimenti',
    descrizione: 'Chi conferisce dove: le rotte della commessa lette dai movimenti dell\'anno, e i formulari che sembrano chiusi sulla destinazione sbagliata. Un raccoglitore conferisce dove ha il proprio impianto o dove ha l\'accordo di stoccare; nelle secondarie l\'origine e\' lo stoccaggio, che per quel viaggio e\' il produttore.',
    parametri: { anno: 'numero', origine: 'raccoglitore o stoccaggio, opzionale', solo_sospetti: 'vero per avere solo i conferimenti fuori rotta' },
    moduli: ['Alert & Controllo', 'Verifiche'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const res = await base44.functions.invoke('controlloRotte', { anno });
      const d = (res && res.data) || res || {};
      const k = p.origine ? normalizzaRagioneSociale(p.origine) : '';
      const flussi = (d.flussi || []).map(f2 => ({
        flusso: f2.nome,
        movimenti: f2.movimenti,
        rotte: (f2.rotte || [])
          .filter(o => !k || normalizzaRagioneSociale(o.origine).includes(k))
          .map(o => ({
            origine: o.origine,
            ruolo: o.ruolo,
            viaggi: o.totale_viaggi,
            tonnellate: t3(o.totale_kg),
            conferisce_a: (o.destinazioni || []).map(dd => `${dd.destinazione}: ${dd.viaggi} viaggi, ${t3(dd.kg)} t${dd.sospetta ? ' (FUORI ROTTA)' : ''}`),
          })),
        sospetti: (f2.sospetti || []).filter(x => !k || normalizzaRagioneSociale(x.origine).includes(k)),
        // i terminati del flusso, di qualunque anno, con date obbligatorie mancanti o incoerenti
        ...(f2.date_da_sistemare ? { date_obbligatorie_da_sistemare: f2.date_da_sistemare } : {}),
      }));
      return {
        fonte: 'Rotte dei conferimenti',
        periodo: `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          sospetti_per_flusso: flussi.map(f2 => ({ flusso: f2.flusso, quanti: f2.sospetti.length })),
          flussi: p.solo_sospetti ? flussi.map(f2 => ({ flusso: f2.flusso, sospetti: f2.sospetti, ...(f2.date_obbligatorie_da_sistemare ? { date_obbligatorie_da_sistemare: f2.date_obbligatorie_da_sistemare } : {}) })) : flussi,
          stoccaggi_condivisi: d.stoccaggi_condivisi,
          tariffe_da_verificare: d.tariffe_da_verificare,
          nota: "Le rotte si leggono dalla storia dell'anno: quello che un'origine fa quasi sempre e' la sua rotta, quello che fa una volta sola contro centinaia di viaggi e' quasi sempre un formulario chiuso male. Chi ha due rotte vere, con numeri consistenti, non viene segnalato.",
        },
      };
    },
  },
  {
    nome: 'alert_aperti',
    descrizione: 'Gli alert aperti del gestionale, per modulo e gravita\'. Comprende, per modulo e canale e di qualunque anno, gli ordini terminati con date obbligatorie (immissione, inizio e fine trasporto) mancanti o incoerenti, con l\'elenco degli ordini.',
    parametri: { modulo: 'opzionale' },
    moduli: ['Alert & Controllo'],
    async esegui(base44, p) {
      // Il modulo arriva scritto come capita: basta una maiuscola o uno spazio
      // per non trovare niente e rispondere "nessun alert".
      const chiesto = String(p.modulo || '').toLowerCase().trim().replace(/\s+/g, '_');
      const alert = await fetchAll(base44.asServiceRole.entities.Alert, { stato: 'aperto' });
      const moduli = [...new Set(alert.map(a => String(a.modulo || 'altro')))];
      const filtrati = chiesto && moduli.includes(chiesto) ? alert.filter(a => String(a.modulo || 'altro') === chiesto) : alert;
      const moduloIgnorato = chiesto && !moduli.includes(chiesto) ? chiesto : '';
      const per = new Map();
      for (const a of filtrati) {
        const k = `${a.modulo || 'altro'}|${a.severita || 'info'}`;
        if (!per.has(k)) per.set(k, { modulo: a.modulo || 'altro', severita: a.severita || 'info', quanti: 0, esempi: [] });
        const x = per.get(k);
        x.quanti++;
        if (x.esempi.length < 3) x.esempi.push(a.titolo);
      }
      // Le date obbligatorie (22/09/2026) per esteso: un alert per modulo e
      // canale, col suo elenco di ordini. Il motore le rivaluta a ogni caricamento
      // su tutti i terminati, di qualunque anno; dal 22/09/2026 anche l'extra
      // raccolta, a ogni scheda salvata, e l'avviso che lo negava e' tolto.
      const date = filtrati.filter(a => String(a.regola_id || '').startsWith('date_obbligatorie')).map(a => ({
        modulo: a.modulo, canale: a.canale || '', ordini: a.quanti ?? null, senza_fine_trasporto: a.senza_fine ?? null,
        titolo: a.titolo, elenco: a.descrizione,
      }));
      return {
        fonte: 'Alert & Controllo',
        periodo: 'adesso',
        dati_al: oggiRoma(),
        dati: {
          totale: filtrati.length,
          gruppi: [...per.values()].sort((a, b) => b.quanti - a.quanti),
          ...(date.length ? { date_obbligatorie_da_sistemare: { per_modulo_e_canale: date, nota: 'Immissione, inizio e fine trasporto sono obbligatorie nei formulari: vanno inserite o corrette. Un modulo e un canale per voce, mai sommati.' } } : {}),
          ...(moduloIgnorato ? { avviso: `"${moduloIgnorato}" non e' un modulo degli alert (ci sono: ${moduli.join(', ')}): il totale qui sotto e' di tutti.` } : {}),
        },
      };
    },
  },
  {
    nome: 'richieste_ect',
    descrizione: 'Le richieste di ritiro arrivate dal consorzio per email: quali sono aperte, quali scadute, quali ritirate da confermare e quali evase. Il ritiro si ricontrolla sui terminati di adesso, per fine trasporto.',
    parametri: { anno: 'numero', stato: 'aperta, da_confermare, evasa o annullata' },
    moduli: ['To-Do List'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const svc = base44.asServiceRole.entities;
      const richieste = await fetchAll(svc.RichiestaEct, { anno });
      const oggi = oggiRoma();
      const giorni = (scadenza) => {
        const d = soloData(scadenza);
        if (!d) return null;
        return Math.round((new Date(d).getTime() - new Date(oggi).getTime()) / 86400000);
      };

      // Il ritiro si rifa' qui sui terminati di adesso. L'esito salvato lo
      // riscrivono il caricamento delle primarie e l'apertura della pagina: se
      // nessuno dei due era ancora partito, una richiesta gia' ritirata restava
      // aperta e "scaduta", e la risposta suggeriva di sollecitare un ritiro
      // fatto. Stessa regola di importaBlocco (ritiri_ect, dataRitiro): il giorno
      // e' quello italiano della fine trasporto, mai la chiusura a portale, e la
      // richiesta e' ritirata solo quando lo sono tutti i suoi ordini. Un ordine
      // terminato senza fine trasporto non conta come ritirato, e si dice.
      // Un ritiro gia' rilevato si toglie solo se l'archivio dice che un suo
      // ordine non e' ritirato; un ordine che negli archivi non c'e' affatto (un
      // caricamento parziale, un ID scritto male) non basta, e resta la data
      // salvata: altrimenti la richiesta tornava aperta e scaduta qui, mentre la
      // pagina - che quella data la conserva di proposito - non si riallineava mai.
      // Qui l'ID ordine non si riconosce di nuovo: vale quello salvato.
      // Mentre le primarie si ricaricano l'archivio e' a meta': allora vale
      // l'esito salvato, calcolato su un archivio intero, e lo si dice.
      const daControllare = richieste.filter(r => listaOrdini(r).length && !r.motivo_annullamento && !r.evasione_confermata);
      let terminati = null, senzaFine = null, presenti = null, inCorso = [], statoNonLetto = false;
      // Immissione, inizio e fine trasporto sono obbligatorie (22/09/2026): di un
      // ordine terminato a cui ne manca una, o con date incoerenti, si dice quale.
      const dateDegliOrdini = new Map();
      if (daControllare.length) {
        const caricamenti = await statoCaricamenti(base44, ['primarie', 'primarie_rete', 'primarie_aci']).catch(() => null);
        if (!caricamenti) statoNonLetto = true;
        inCorso = (caricamenti && caricamenti.in_corso) || [];
        if (!inCorso.length) {
          // Gli stessi archivi di importaBlocco: tutte le primarie, di ogni
          // stato, e gli assegnati, per sapere quali ordini l'archivio conosce.
          const [assRete, assAci, rete, aci] = await Promise.all([
            fetchAll(svc.Assegnato),
            fetchAll(svc.AssegnatoAci),
            fetchAll(svc.PrimariaRete),
            fetchAll(svc.PrimariaAci),
          ]);
          terminati = new Map(); // id ordine -> primo giorno di fine trasporto
          senzaFine = new Set(); // id degli ordini terminati senza fine trasporto
          for (const o of [...rete, ...aci]) {
            const id = String(o.id_ordine || '').trim();
            if (!id || !eTerminato(o)) continue;
            // le date obbligatorie che mancano o non tornano, per dirle accanto all'ordine
            const v = voceDate(o);
            if (v) dateDegliOrdini.set(id, v.date);
            const g = giornoMovimento(o);
            if (!g) { senzaFine.add(id); continue; }
            if (!terminati.has(id) || g < terminati.get(id)) terminati.set(id, g);
          }
          presenti = new Set([...assRete, ...assAci, ...rete, ...aci].map(o => String(o.id_ordine || '').trim()).filter(Boolean));
        }
      }
      // Copia di dataRitiro in base44/functions/importaBlocco/entry.ts: se la
      // regola cambia la', va cambiata anche qui.
      const dataRitiro = (salvata, ids, ev) => {
        if (ev.ultima) return ev.ultima;
        if (!salvata) return null;
        const mancanti = ids.filter(id => !terminati.has(id));
        return mancanti.every(id => presenti.has(id)) ? null : salvata;
      };

      const tutte = richieste.map(r => {
        const ordini = listaOrdini(r);
        // Senza ID ordine non c'e' niente da cercare fra i terminati: resta il salvato.
        const ev = terminati && ordini.length ? evasioneOrdini(ordini, terminati) : null;
        const rilevata = ev ? dataRitiro(r.evasione_rilevata_il, ordini, ev) : r.evasione_rilevata_il;
        const stato = statoRichiesta({ ...r, evasione_rilevata_il: rilevata || null });
        const salvato = r.esito || statoRichiesta(r);
        const g = giorni(r.scadenza);
        // Un ordine senza fine trasporto conta solo se non c'e' anche una sua
        // riga terminata con la data: allora e' ritirato lo stesso.
        const ordiniSenzaFine = senzaFine ? ordini.filter(id => senzaFine.has(id) && !terminati.has(id)) : [];
        const ordiniConDate = ordini.filter(id => dateDegliOrdini.has(id)).map(id => ({ id_ordine: id, date: dateDegliOrdini.get(id) }));
        return {
          pdr: r.pdr_nome, provincia: r.provincia, classe: r.classe,
          ordini, stato, scadenza: soloData(r.scadenza),
          giorni_alla_scadenza: g,
          scaduta: stato === 'aperta' && g !== null && g < 0,
          immesso_il: soloData(r.ordine_immesso_il), evaso_il: soloData(r.evaso_il || rilevata),
          ...(ev && ev.totali > 1 ? { ordini_ritirati: `${ev.evasi} su ${ev.totali}` } : {}),
          ...(ordiniSenzaFine.length ? { ordini_terminati_senza_fine_trasporto: ordiniSenzaFine } : {}),
          ...(ordiniConDate.length ? { ordini_con_date_obbligatorie_da_sistemare: ordiniConDate } : {}),
          ...(salvato !== stato ? { stato_nella_pagina: salvato } : {}),
        };
      });
      // "scaduta" non e' uno stato dell'archivio ma e' quello che si chiede piu'
      // spesso: e' una richiesta ancora aperta con la scadenza passata. E uno
      // stato che non esiste non deve svuotare l'elenco in silenzio.
      const chiesto = String(p.stato || '').toLowerCase().trim();
      const stati = [...new Set(tutte.map(r => r.stato))];
      const righe = !chiesto ? tutte
        : chiesto === 'scaduta' ? tutte.filter(r => r.scaduta)
        : stati.includes(chiesto) ? tutte.filter(r => r.stato === chiesto)
        : tutte;
      const statoIgnorato = chiesto && chiesto !== 'scaduta' && !stati.includes(chiesto) ? chiesto : '';
      const diverse = tutte.filter(r => r.stato_nella_pagina).length;
      const senzaFineTot = tutte.filter(r => r.ordini_terminati_senza_fine_trasporto).length;
      const conDateTot = tutte.filter(r => r.ordini_con_date_obbligatorie_da_sistemare).length;
      // Il ricontrollo automatico della pagina (caricamento delle primarie,
      // apertura da parte dell'amministratore) lavora solo sull'anno in corso:
      // per un anno passato la pagina non si riallinea da sola.
      const riallineo = anno === Number(oggi.slice(0, 4))
        ? 'la pagina si riallinea al prossimo caricamento delle primarie o alla sua apertura da parte dell\'amministratore.'
        : `per il ${anno} la pagina non si ricalcola da sola: il ricontrollo automatico riguarda solo le richieste dell'anno in corso.`;
      return {
        fonte: `Richieste ECT${terminati ? ', ritiri ricontrollati sui terminati di adesso' : inCorso.length ? ', esito salvato' : ''}`,
        periodo: `anno ${anno}`,
        dati_al: oggi,
        dati: {
          aperte: tutte.filter(r => r.stato === 'aperta').length,
          scadute: tutte.filter(r => r.scaduta).length,
          da_confermare: tutte.filter(r => r.stato === 'da_confermare').length,
          richieste: elenco(righe, 60),
          ...(statoIgnorato ? { avviso: `"${statoIgnorato}" non e' uno stato delle richieste (ci sono: ${stati.join(', ')}, piu' "scaduta" che vuol dire aperta e fuori termine): qui sotto ci sono tutte.` } : {}),
          ...(inCorso.length ? { avviso_caricamenti: `Caricamento delle primarie ${inCorso.some(a => a.interrotto) ? 'interrotto' : 'in corso'}: l'archivio puo' essere a meta', quindi i ritiri non si sono ricontrollati e qui c'e' l'esito salvato dall'ultimo caricamento completo.` } : {}),
          ...(statoNonLetto ? { avviso_caricamenti: 'Non sono riuscita a leggere lo stato dei caricamenti: i ritiri sono ricontrollati sui terminati di adesso, ma se le primarie si stavano ricaricando potrebbero non essere definitivi.' } : {}),
          ...(diverse ? { avviso_pagina: `${diverse} ${diverse === 1 ? 'richiesta ha' : 'richieste hanno'} qui uno stato diverso da quello salvato nella To-Do List ("stato_nella_pagina"): vale quello ricontrollato adesso; ${riallineo}` } : {}),
          ...(senzaFineTot ? { avviso_senza_fine_trasporto: `${senzaFineTot} ${senzaFineTot === 1 ? 'richiesta ha' : 'richieste hanno'} ordini terminati senza data di fine trasporto: non contano come ritirati finche' la data non si corregge nel file del portale e si ricarica.` } : {}),
          ...(conDateTot ? { avviso_date_obbligatorie: `${conDateTot} ${conDateTot === 1 ? 'richiesta ha' : 'richieste hanno'} ordini terminati con date obbligatorie (immissione, inizio o fine trasporto) mancanti o incoerenti, detti in "ordini_con_date_obbligatorie_da_sistemare": vanno corretti nel file del portale e ricaricati.` } : {}),
        },
      };
    },
  },
  {
    nome: 'caricamenti',
    descrizione: 'Quando sono stati caricati per l\'ultima volta i file del gestionale: serve per sapere se un dato e\' aggiornato.',
    parametri: {},
    moduli: ['Caricamento Dati'],
    async esegui(base44) {
      // Sessanta righe non bastano a coprire tutti i tipi di file, e l'ultima
      // riga di un tipo puo' essere un tentativo fallito: "caricato oggi" con
      // dentro zero righe non e' un caricamento. Si tiene l'ultimo riuscito, e
      // il tentativo fallito si dice a parte.
      const log = await fetchAll(base44.asServiceRole.entities.UploadLog);
      log.sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')));
      const per = new Map();
      const falliti = new Map();
      for (const l of log) {
        const tipo = l.tipo_file || 'altro';
        const fallito = String(l.esito || '').toLowerCase().includes('err');
        if (fallito) {
          if (!falliti.has(tipo) && !per.has(tipo)) falliti.set(tipo, { tipo, quando: soloData(l.created_date), file: l.nome_file, esito: l.esito });
          continue;
        }
        if (!per.has(tipo)) per.set(tipo, { tipo, quando: soloData(l.created_date), file: l.nome_file, righe: l.righe_importate, esito: l.esito });
      }
      return {
        fonte: 'Caricamento Dati',
        periodo: 'ultimi caricamenti riusciti',
        dati_al: oggiRoma(),
        dati: {
          caricamenti: [...per.values()].sort((a, b) => String(b.quando).localeCompare(String(a.quando))),
          ...(falliti.size ? { tentativi_falliti_dopo_l_ultimo_riuscito: [...falliti.values()] } : {}),
        },
      };
    },
  },
  {
    nome: 'giacenze',
    descrizione: 'La giacenza di impianti e stoccaggi, un canale per volta (rete, ACI, extra raccolta), aggiornata a ogni caricamento: il materiale arrivato che non e\' ancora stato dichiarato, con target di rete, ordini da dichiarare e arretrato per anno. Usa lo stesso calcolo del modulo Giacenze, cosi\' i numeri sono quelli che si vedono a video.',
    parametri: { anno: 'numero', sito: 'nome dell\'impianto o dello stoccaggio, opzionale', tipo: 'impianto o stoccaggio, opzionale' },
    moduli: ['Giacenze'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const res = await base44.functions.invoke('calcolaGiacenze', { anno });
      const d = (res && res.data) || res || {};
      let righe = d.righe || [];
      // Il tipo si applica solo quando non e' stato chiesto un sito preciso:
      // chiedendo "la giacenza di Nappi Sud" con tipo "impianto" si finiva per
      // non trovare niente, perche' Nappi Sud e' uno stoccaggio. E se non si
      // applica sparisce, perche' altrimenti resta scritto fra i parametri e la
      // risposta chiama impianto uno stoccaggio.
      if (p.tipo && p.sito) delete p.tipo;
      if (p.tipo && !p.sito) {
        const vuole = /stoc/i.test(String(p.tipo)) ? 'stoc' : 'imp';
        righe = righe.filter(r => (String(r.tipo_destinazione || '').toLowerCase() === 'stoc' ? 'stoc' : 'imp') === vuole);
      }
      if (p.sito) {
        // Il nome puo' arrivare accorciato ("Nappi Sud" per "NAPPI SUD SRL"):
        // si accetta anche chi lo contiene, purche' sia uno solo.
        const k = normalizzaRagioneSociale(p.sito);
        const esatti = righe.filter(r => normalizzaRagioneSociale(r.sito) === k);
        righe = esatti.length ? esatti : righe.filter(r => normalizzaRagioneSociale(r.sito).includes(k));
      }
      // Un campo per canale, mai una giacenza unica: prima passava solo
      // giacenza_portale_t, e alla domanda "quanta giacenza ha Nappi Sud?" la
      // risposta comprendeva la classe 9. Il null vuol dire "non calcolata"
      // (uno stoccaggio senza rilevazione, un impianto senza il file degli
      // ordini non dichiarati, l'ACI di un impianto), non zero.
      // calcolaGiacenze usa per gli impianti la regola di Dichiarazioni Impianti
      // (shared/giacenzaPortale.ts), quindi i due moduli dicono lo stesso numero.
      // Senza il file, pero', l'impianto ha una fotografia col giorno vuoto e una
      // giacenza a zero: quello zero non e' un dato, e passato cosi' EcoTyna
      // diceva "nessuna giacenza".
      const utili = righe.map(r => {
        const stoc = String(r.tipo_destinazione || '').toLowerCase() === 'stoc';
        const f = r.fotografia;
        const calcolata = stoc || !!(f && f.del);
        return {
          sito: r.sito, tipo: stoc ? 'stoccaggio' : 'impianto',
          giacenza_rete_t: calcolata ? (r.giacenza_rete_t ?? null) : null,
          giacenza_aci_t: r.giacenza_aci_t ?? null,
          extra_raccolta_in_piazzale_t: r.giacenza_extra_t ?? null,
          // Da dove viene il numero, cosi' uno scarto col portale si spiega coi dati.
          calcolo: stoc
            ? (r.data_rilevazione
              ? { rilevazione_del: r.data_rilevazione, rilevazione_classi_kg: r.rilevazione_classi_kg, dopo_la_rilevazione: r.dopo_rilevazione, rilevazione_obsoleta: !!r.rilevazione_obsoleta }
              : { avviso: 'Nessuna rilevazione del portale per questo stoccaggio: la giacenza non si puo\' calcolare.' })
            : (calcolata
              ? { file_del_portale_del: f.del, fotografia_t: f.foto_t, carichi_aggiunti: f.aggiunti, carichi_aggiunti_t: f.aggiunti_t, dichiarato_dopo_la_fotografia_t: f.dichiarato_dopo_t }
              : { avviso: 'Nessun file degli ordini non dichiarati caricato: senza la fotografia del portale la giacenza di rete dell\'impianto non si puo\' calcolare (non e\' zero). Va caricato il file.' }),
          movimenti_caricati_fino_al: r.aggiornata_al || null,
          in_attesa_dichiarazione_t: r.in_attesa_dichiarazione_t, ordini_da_dichiarare: r.ordini_da_dichiarare,
          dichiarato_rete_t: r.dichiarato_t, conferito_primarie_rete_t: r.conferito_primarie_t, conferito_aci_t: r.conferito_aci_t,
          conferito_extra_t: r.conferito_extra_t,
          secondarie_rete_in_t: r.secondarie_in_t, secondarie_rete_out_t: r.secondarie_out_t,
          secondarie_aci_in_t: r.secondarie_aci_in_t, secondarie_aci_out_t: r.secondarie_aci_out_t,
          target_rete_t: r.target_totale_t, giacenza_riferimento_t: r.giacenza_riferimento_t,
          giacenza_classi_kg: calcolata ? r.giacenza_classi_kg : null,
          // I formulari terminati del soggetto con le date obbligatorie da
          // sistemare, per canale (regola del 22/09/2026): prima si perdevano qui.
          date_da_sistemare: r.date_da_sistemare || [],
        };
      });
      // Chiedendo un sito, le sue anomalie vengono prima e le altre dei siti non
      // chiesti restano fuori: in fila con quelle di tutti i siti, le date da
      // sistemare del sito chiesto potevano finire oltre le prime 20 e sparire
      // dalla risposta (22/09/2026). Restano, dopo, quelle senza sito (del file
      // del portale e degli ordini senza riscontro).
      let anomalie = d.anomalie || [];
      if (p.sito) {
        const chiavi = utili.map(r => normalizzaRagioneSociale(r.sito)).filter(Boolean);
        const delSito = (a) => { const k = normalizzaRagioneSociale(a.sito || ''); return !!k && chiavi.some(c => k === c || k.includes(c)); };
        anomalie = [...anomalie.filter(delSito), ...anomalie.filter(a => !a.sito)];
      }
      // I totali si rifanno sulle righe rimaste, un canale per volta: quelli del
      // modulo sono di tutti i siti e, filtrando per sito o per tipo,
      // risponderebbero a un'altra domanda. Nessun totale somma i canali.
      const filtrato = !!(p.sito || p.tipo);
      const somma = (xs, campo) => Math.round(xs.reduce((s, r) => s + (Number(r[campo]) || 0), 0) * 1000) / 1000;
      const impianti = utili.filter(r => r.tipo === 'impianto');
      const stoccaggi = utili.filter(r => r.tipo === 'stoccaggio');
      // Chi non ha il dato resta fuori dai totali, e lo si dice in ogni canale in
      // cui manca: senza, il totale sembra completo. Uno stoccaggio senza
      // rilevazione manca sia alla rete sia all'ACI (le classi 1-4 e la 9 stanno
      // nella stessa rilevazione).
      const senzaRilevazione = stoccaggi.filter(r => r.giacenza_rete_t === null).map(r => r.sito);
      const senzaFile = impianti.filter(r => r.giacenza_rete_t === null).map(r => r.sito);
      const totali = {
        perimetro: filtrato ? `solo ${utili.length === 1 ? 'il sito richiesto' : 'i siti richiesti'}` : 'tutti i siti',
        siti: utili.length,
        rete: {
          giacenza_t: somma(utili, 'giacenza_rete_t'),
          di_cui_impianti_t: somma(impianti, 'giacenza_rete_t'),
          di_cui_stoccaggi_t: somma(stoccaggi, 'giacenza_rete_t'),
          in_attesa_dichiarazione_t: somma(utili, 'in_attesa_dichiarazione_t'),
          ordini_da_dichiarare: utili.reduce((s, r) => s + (Number(r.ordini_da_dichiarare) || 0), 0),
          ...(senzaFile.length ? { impianti_senza_file_del_portale_esclusi: senzaFile } : {}),
          ...(senzaRilevazione.length ? { stoccaggi_senza_rilevazione_esclusi: senzaRilevazione } : {}),
        },
        aci: {
          giacenza_stoccaggi_t: somma(stoccaggi, 'giacenza_aci_t'),
          ...(senzaRilevazione.length ? { stoccaggi_senza_rilevazione_esclusi: senzaRilevazione } : {}),
        },
        extra_raccolta: { in_piazzale_t: somma(stoccaggi, 'extra_raccolta_in_piazzale_t') },
        nota_totali: 'Tre canali, tre totali: rete, ACI ed extra raccolta non si sommano.',
      };
      return {
        fonte: 'Giacenze, giacenza a portale per canale',
        periodo: `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          siti: elenco(utili, 80), totali, anomalie: elenco(anomalie, 20),
          // Niente giustificazioni con la chiusura a portale: la giacenza segue i
          // caricamenti, e uno scarto e' un'anomalia da dire, non da spiegare via.
          nota: "La giacenza segue i caricamenti e si legge per fine trasporto, un canale per volta. Impianti (rete): la fotografia del file degli ordini non dichiarati, piu' i carichi che il gestionale conosce e il file no (riconosciuti dal numero d'ordine), meno le dichiarazioni caricate a portale dopo la fotografia. Stoccaggi: la rilevazione del portale per classe (1-4 rete, 9 ACI) piu' ingressi e uscite con il trasporto finito dopo. L'extra raccolta a portale non c'e': e' il saldo del piazzale nell'anno. Se un numero non torna con il portale, dillo come anomalia da verificare (un file non ancora caricato, una rilevazione vecchia, una dichiarazione non registrata) e non spiegarlo con la data di chiusura dell'ordine a portale, che non decide niente.",
        },
      };
    },
  },
  {
    nome: 'dichiarazioni_impianti',
    descrizione: 'Le dichiarazioni mensili di trattamento degli impianti: quanto e\' stato dichiarato mese per mese, quali sono state caricate a portale, i materiali ricavati e cosa manca. Il canale conta: rete, ACI ed extra raccolta si dichiarano separatamente.',
    parametri: { anno: 'numero', mese: 'nome del mese, opzionale', sito: 'opzionale', canale: 'RETE, ACI o EXTRA_RACCOLTA, opzionale' },
    moduli: ['Dichiarazioni Impianti'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const svc = base44.asServiceRole.entities;
      const dich = await fetchAll(svc.DichiarazioneSito, { anno });
      const k = p.sito ? normalizzaRagioneSociale(p.sito) : '';
      // Un canale scritto male non deve svuotare l'elenco in silenzio: si tolgono
      // il filtro e lo si dice (il riepilogo resta comunque per sito e canale).
      const canale = canaleChiesto(p.canale);
      const canaleIgnorato = p.canale && !canale ? String(p.canale) : '';
      const righe = dich.filter(d => {
        if (p.mese && String(d.mese || '').toLowerCase() !== String(p.mese).toLowerCase()) return false;
        if (k && normalizzaRagioneSociale(d.sito) !== k) return false;
        if (canale && String(d.canale || 'RETE').toUpperCase() !== canale) return false;
        return true;
      }).map(d => ({
        sito: d.sito, canale: d.canale || 'RETE', operazione: d.operazione, provenienza: d.provenienza,
        mese: d.mese, quantita_kg: Math.round(Number(d.quantita_kg) || 0),
        stato: statoDichiarazione(d), caricata_il: soloData(d.caricata_il),
        materiali_kg: Math.round(sommaMateriali(d)),
        granulo_kg: Math.round(Number(d.granulo_kg) || 0), fibre_kg: Math.round(Number(d.fibre_kg) || 0),
        metalli_kg: Math.round(Number(d.metalli_kg) || 0), cippato_kg: Math.round(Number(d.cippato_kg) || 0),
        ciabattato_kg: Math.round(Number(d.ciabattato_kg) || 0), cssc_kg: Math.round(Number(d.cssc_kg) || 0),
      }));
      const perSito = new Map();
      for (const r of righe) {
        const key = `${r.sito}|${r.canale}`;
        if (!perSito.has(key)) perSito.set(key, { sito: r.sito, canale: r.canale, dichiarato_kg: 0, caricate: 0, da_caricare: 0 });
        const x = perSito.get(key);
        x.dichiarato_kg += r.quantita_kg;
        if (r.stato === 'caricata') x.caricate++; else if (r.quantita_kg > 0) x.da_caricare++;
      }
      return {
        fonte: 'Dichiarazioni Impianti',
        periodo: p.mese ? `${p.mese} ${anno}` : `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          riepilogo: [...perSito.values()].map(x => ({ ...x, dichiarato_t: t3(x.dichiarato_kg) })).sort((a, b) => b.dichiarato_kg - a.dichiarato_kg),
          dichiarazioni: elenco(righe, 80),
          ...(canaleIgnorato ? { avviso_canale: `"${canaleIgnorato}" non e' un canale: qui ci sono tutti e tre, ciascuno sulla sua riga e mai sommati.` } : {}),
          nota: 'Una dichiarazione decurta la giacenza a portale solo quando risulta caricata.',
        },
      };
    },
  },
  {
    nome: 'omologhe',
    descrizione: 'Le omologhe dei produttori: chi e\' omologato, fino a quando, quali sono scadute o in scadenza e dove ci sono divergenze fra elenco e registro. Criterio: basta il primo recepimento, e vale sempre il documento piu\' recente.',
    parametri: { produttore: 'opzionale', canale: 'RETE o ACI, opzionale', stato: 'da_verificare, recepita, in_sospeso o annullata, opzionale', in_scadenza: 'vero per avere solo quelle che scadono entro 90 giorni' },
    moduli: ['Omologhe'],
    async esegui(base44, p) {
      const oggi = oggiRoma();
      const svc = base44.asServiceRole.entities;
      const tutte = await fetchAll(svc.Omologa);
      const k = p.produttore ? normalizzaRagioneSociale(p.produttore) : '';
      // Un canale non riconosciuto toglie il filtro e lo si dice; l'extra
      // raccolta qui non ha omologhe, e l'elenco vuoto va spiegato.
      const canale = canaleChiesto(p.canale);
      const avvisoCanale = p.canale && !canale
        ? `"${p.canale}" non e' un canale: le omologhe sono di RETE e di ACI, ciascuna col suo conteggio, e qui ci sono tutte e due.`
        : canale === 'EXTRA_RACCOLTA' ? 'L\'extra raccolta non ha omologhe in questo modulo: ci sono solo quelle di RETE e di ACI.' : '';
      const righe = tutte.filter(o => {
        if (k && normalizzaRagioneSociale(o.produttore) !== k && !normalizzaRagioneSociale(o.produttore).includes(k)) return false;
        if (canale && String(o.canale || '').toUpperCase() !== canale) return false;
        if (p.stato && o.stato !== p.stato) return false;
        return true;
      }).map(o => {
        const scadenza = o.scadenza_effettiva || o.omologa_a || '';
        const giorni = scadenza ? giorniAllaScadenza(scadenza, oggi) : null;
        return {
          produttore: o.produttore, canale: o.canale, esito_omologa: o.esito ? 'OMOLOGA OK' : 'non recepita',
          tipologia_materiale: o.tipologia_materiale, omologa_da: soloData(o.omologa_da), omologa_a: soloData(o.omologa_a),
          scadenza_effettiva: soloData(scadenza), giorni_alla_scadenza: giorni, fascia: giorni === null ? '' : fasciaScadenza(giorni),
          stato: o.stato, divergenza: o.tipo_divergenza, nell_elenco: o.nell_elenco, nel_registro: o.nel_registro,
          primo_carico: soloData(o.registro_primo_carico), carichi: o.registro_carichi,
        };
      });
      const filtrate = p.in_scadenza ? righe.filter(r => r.giorni_alla_scadenza !== null && r.giorni_alla_scadenza <= 90) : righe;
      filtrate.sort((a, b) => (a.giorni_alla_scadenza ?? 9999) - (b.giorni_alla_scadenza ?? 9999));
      // I conteggi un canale per volta: rete e ACI non si sommano, nemmeno
      // quando il canale non e' stato indicato.
      const canaliDelConto = canale === 'RETE' || canale === 'ACI' ? [canale] : canale ? [] : ['RETE', 'ACI'];
      const perCanale = Object.fromEntries(canaliDelConto.map(c => [c, { scadute: 0, da_verificare: 0 }]));
      for (const r of filtrate) {
        const c = String(r.canale || 'N/D').toUpperCase();
        if (!perCanale[c]) perCanale[c] = { scadute: 0, da_verificare: 0 };
        if (r.giorni_alla_scadenza !== null && r.giorni_alla_scadenza < 0) perCanale[c].scadute++;
        if (r.stato === 'da_verificare') perCanale[c].da_verificare++;
      }
      return {
        fonte: 'Omologhe',
        periodo: `situazione al ${oggi}`,
        dati_al: oggi,
        dati: {
          per_canale: perCanale,
          ...(avvisoCanale ? { avviso_canale: avvisoCanale } : {}),
          omologhe: elenco(filtrate, 80),
          nota: 'RETE e ACI sono canali indipendenti: i conteggi stanno canale per canale e non si sommano.',
        },
      };
    },
  },
  {
    nome: 'dichiarazioni_rentri',
    descrizione: 'Le dichiarazioni RENTRI dei produttori: chi e\' iscritto, chi usa il formulario digitale e chi quello cartaceo, il codice RENTRI e il collegamento con i punti di raccolta.',
    parametri: { produttore: 'opzionale', solo_non_iscritti: 'vero per avere solo chi non risulta iscritto' },
    moduli: ['Dichiarazioni RENTRI'],
    async esegui(base44, p) {
      const svc = base44.asServiceRole.entities;
      // Chi e' sparito dall'ultimo foglio del portale non conta piu': resta in
      // archivio per lo storico, ma non nei conteggi di oggi.
      const tutte = (await fetchAll(svc.DichiarazioneRentri)).filter(d => d.nel_foglio !== false);
      const k = p.produttore ? normalizzaRagioneSociale(p.produttore) : '';
      let righe = tutte.filter(d => !k || normalizzaRagioneSociale(d.produttore).includes(k));
      if (p.solo_non_iscritti) righe = righe.filter(d => !d.iscritto_rentri);
      return {
        fonte: 'Dichiarazioni RENTRI',
        periodo: 'ultimo file del portale caricato',
        dati_al: oggiRoma(),
        dati: {
          iscritti: righe.filter(d => d.iscritto_rentri).length,
          fir_digitale: righe.filter(d => d.fir_digitale).length,
          fir_cartaceo: righe.filter(d => d.fir_cartaceo).length,
          senza_collegamento: righe.filter(d => d.collegamento === 'nessuno').length,
          dichiarazioni: elenco(righe.map(d => ({
            produttore: d.produttore, tipologia_materiale: d.tipologia_materiale,
            data_dichiarazione: soloData(d.data_dichiarazione), iscritto_rentri: d.iscritto_rentri,
            fir_digitale: d.fir_digitale, fir_cartaceo: d.fir_cartaceo, codice_rentri: d.codice_rentri,
            collegamento: d.collegamento, pdr_collegati: (d.pdr_collegati || []).length,
          })), 80),
        },
      };
    },
  },
  {
    nome: 'punti_di_raccolta',
    descrizione: 'L\'anagrafica dei punti di raccolta e dei clienti: dove sono, chi li segue, l\'iscrizione RENTRI e il tipo di formulario.',
    parametri: { cerca: 'ragione sociale, comune o codice, anche parziale', provincia: 'sigla, opzionale' },
    moduli: ['PDR e Clienti'],
    async esegui(base44, p) {
      const svc = base44.asServiceRole.entities;
      const cerca = String(p.cerca || '').trim().toLowerCase();
      const tutti = await fetchAll(svc.Pdr);
      const righe = tutti.filter(r => {
        if (p.provincia && String(r.provincia_pdr || r.provincia || '').toUpperCase() !== String(p.provincia).toUpperCase()) return false;
        if (!cerca) return true;
        return `${r.ragione_sociale || ''} ${r.descrizione_pdr || ''} ${r.comune_pdr || ''} ${r.comune || ''} ${r.codice_esterno || ''} ${r.codice_esterno_pdr || ''}`.toLowerCase().includes(cerca);
      });
      return {
        fonte: 'Anagrafica PDR',
        periodo: 'ultimo file PDR caricato',
        dati_al: oggiRoma(),
        dati: {
          pdr: elenco(righe.map(r => ({
            ragione_sociale: r.ragione_sociale, descrizione_pdr: r.descrizione_pdr,
            comune: r.comune_pdr || r.comune, provincia: r.provincia_pdr || r.provincia,
            partita_iva: r.partita_iva, rentri_iscrizione: r.rentri_iscrizione, tipo_formulario: r.tipo_formulario,
            key_account: r.key_account, trasportatore_principale: r.trasportatore_principale, sospeso: r.sospeso,
          })), 60),
        },
      };
    },
  },
  {
    nome: 'qualifica_fornitori',
    descrizione: 'Lo stato della qualifica dei fornitori: documenti scaduti, mancanti, non conformi o in scadenza, soggetto per soggetto, e i contratti dell\'anno.',
    parametri: { anno: 'numero', soggetto: 'opzionale', solo_problemi: 'vero per avere solo chi ha qualcosa fuori posto' },
    moduli: ['Qualifica Fornitori'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const oggi = oggiRoma();
      const svc = base44.asServiceRole.entities;
      const [riepilogo, catalogo, documenti, contratti] = await Promise.all([
        svc.RiepilogoQualifica.filter({ anno }, '-aggiornato_il', 1).catch(() => []),
        fetchAll(svc.TipoDocumentoQualifica),
        fetchAll(svc.DocumentoQualifica, { stato: 'attivo' }),
        fetchAll(svc.ContrattoFornitore, { anno }).catch(() => []),
      ]);
      const tipi = new Map(catalogo.map(t => [t.id, t]));
      const k = p.soggetto ? normalizzaRagioneSociale(p.soggetto) : '';
      const perSoggetto = new Map();
      for (const d of documenti) {
        const nome = d.soggetto_nome || d.soggetto_chiave || 'N/D';
        if (k && !normalizzaRagioneSociale(nome).includes(k)) continue;
        const tipo = tipi.get(d.tipo_documento_id) || { obbligatorio: true, preavviso_giorni: 60, tipo_scadenza: 'da_documento' };
        const st = statoRequisito(tipo, d, oggi);
        if (!perSoggetto.has(nome)) perSoggetto.set(nome, { soggetto: nome, documenti: 0, validi: 0, scaduti: 0, in_scadenza: 0, non_conformi: 0, da_verificare: 0, dettaglio: [] });
        const x = perSoggetto.get(nome);
        x.documenti++;
        // statoRequisito dice "scaduto" e "non_conforme" al singolare: senza
        // questa corrispondenza i due contatori restavano a zero per tutti.
        const contatore = { valido: 'validi', scaduto: 'scaduti', non_conforme: 'non_conformi', in_scadenza: 'in_scadenza', da_verificare: 'da_verificare', in_analisi: 'da_verificare' }[st.stato];
        if (contatore && x[contatore] !== undefined) x[contatore]++;
        if (st.stato !== 'valido' && x.dettaglio.length < 10) {
          x.dettaglio.push({ documento: d.tipo_documento_nome, stato: st.stato, scadenza: st.scadenza, giorni: st.giorni });
        }
      }
      let soggetti = [...perSoggetto.values()];
      if (p.solo_problemi) soggetti = soggetti.filter(s2 => s2.documenti > s2.validi);
      soggetti.sort((a, b) => (b.scaduti + b.non_conformi) - (a.scaduti + a.non_conformi));
      return {
        fonte: 'Qualifica Fornitori',
        periodo: `anno ${anno}`,
        // Gli stati dei documenti si ricalcolano adesso: la data del riepilogo
        // salvato riguarda solo i conteggi, e resta scritta dentro.
        dati_al: oggi,
        dati: {
          riepilogo: riepilogo[0] ? { ...riepilogo[0], nota: `Conteggi salvati il ${soloData(riepilogo[0].aggiornato_il)}` } : null,
          soggetti: elenco(soggetti, 80),
          contratti: elenco(contratti.map(c => ({ soggetto: c.soggetto_nome, tipo: c.tipo_contratto, canale: c.canale, stato: c.stato, anno: c.anno, decorrenza: soloData(c.data_inizio), scadenza: soloData(c.data_fine), quantitativo_t: c.quantitativo_previsto_t })), 60),
          nota: 'Qui ci sono i documenti caricati. I documenti che mancano del tutto si vedono nel modulo Qualifica Fornitori, che confronta ogni soggetto con il catalogo dei requisiti del suo ruolo.',
        },
      };
    },
  },
  {
    nome: 'fatturazione',
    descrizione: 'Quanto dobbiamo pagare ai fornitori (passiva) e quanto ci spetta (attiva), per fornitore e per mese. Per la passiva con il mese indicato fa lo stesso conto del modulo, sui movimenti terminati; senza mese legge solo i documenti gia\' elaborati. L\'attiva si calcola sempre sui dati di oggi, mese per mese, e dice di quanto il documento salvato e\' indietro. I canali restano separati.',
    parametri: { anno: 'numero', mese: 'nome del mese: indicalo sempre per la passiva', tipo: 'PASSIVA o ATTIVA', tipologia: 'RETE, ACI o EXTRA_RACCOLTA', fornitore: 'opzionale' },
    moduli: ['Fatturazione'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const tipo = String(p.tipo || 'PASSIVA').toUpperCase();
      const svc = base44.asServiceRole.entities;

      // Il mese si normalizza subito, prima di qualunque ramo: nei documenti
      // salvati e' scritto con l'iniziale maiuscola, e un "marzo" minuscolo
      // passato al filtro non trovava niente e faceva dire "nessun importo".
      const meseChiesto = p.mese ? MESI.find(m => m.toLowerCase() === String(p.mese).toLowerCase()) : '';
      const meseIgnorato = p.mese && !meseChiesto ? String(p.mese) : '';

      // La passiva di un mese si calcola, non si legge: le voci salvate esistono
      // solo dopo che qualcuno ha elaborato e salvato il documento, e chiedendo
      // "quanto dobbiamo a Green Tyre per marzo" si rispondeva "niente" mentre
      // il modulo diceva 13.271,40 euro. Qui si chiama lo stesso conto del
      // modulo, cosi' i due numeri non possono divergere.
      // Il canale si riconosce anche scritto come capita ("extra raccolta").
      const tipologiaChiesta = canaleChiesto(p.tipologia);
      const tipologiaIgnorata = p.tipologia && !tipologiaChiesta ? String(p.tipologia) : '';

      if (tipo === 'PASSIVA' && meseChiesto) {
        const tipologia = tipologiaChiesta || 'RETE';
        // Il conto del modulo scarta i terminati senza fine trasporto senza
        // contarli: qui si contano sugli archivi del canale, con lo stesso filtro
        // sul campo vuoto della quadratura, cosi' la risposta dice che il conto
        // e' incompleto invece di tacerlo. Primarie e secondarie a parte: sono
        // lo stesso materiale che si sposta. null se l'archivio non si e' letto:
        // il conteggio non c'e', che non vuol dire zero.
        // Gli ordini a cui manca un'altra data obbligatoria, o che le hanno
        // incoerenti (22/09/2026), sono nel conto ma vanno corretti. Con un
        // filtro non si trovano, e rileggere per intero primarie e secondarie di
        // tutti gli anni a ogni domanda, accanto a calcolaPassiva, rischiava di
        // sforare il tempo della funzione: si prendono dagli alert del motore
        // (date_obbligatorie_<canale>), un modulo per volta, come fa il
        // riepilogo di EcoTyna. L'extra raccolta e' un archivio piccolo, e il suo
        // alert non si rivaluta ancora da solo quando si salva una scheda: li'
        // si leggono i terminati interi.
        const extra = tipologia === 'EXTRA_RACCOLTA';
        const senzaData = (entita) => fetchAll(svc[entita], { trasporto_finito_il: null }).catch(() => null);
        const canaleAlert = tipologia === 'ACI' ? 'ACI' : 'rete';
        const [res, primLette, secLette, alertDate] = await Promise.all([
          base44.functions.invoke('calcolaPassiva', { anno, mese: meseChiesto, tipologia }),
          extra ? fetchAll(svc.ExtraRaccolta, { stato: 'terminato' }).catch(() => null)
            : senzaData(tipologia === 'ACI' ? 'PrimariaAci' : 'PrimariaRete'),
          extra ? Promise.resolve([]) : senzaData('Secondaria'),
          extra ? Promise.resolve([]) : fetchAll(svc.Alert, { regola_id: `date_obbligatorie_${canaleAlert}`, stato: 'aperto' }).catch(() => null),
        ]);
        const d = (res && res.data) || res || {};
        const conteggioFatto = primLette !== null && secLette !== null;
        // Gli alert del canale, primarie e secondarie ciascuna col suo: rete e
        // ACI non si mescolano, e nemmeno primarie e secondarie.
        const moduliAlert = tipologia === 'ACI' ? { primarie_aci: 'primarie', secondarie: 'secondarie' } : { primarie_rete: 'primarie', secondarie: 'secondarie' };
        const dagliAlert = (alertDate || [])
          .filter(a => moduliAlert[a.modulo] && String(a.canale || canaleAlert) === canaleAlert)
          .map(a => ({
            modulo: moduliAlert[a.modulo], canale: tipologia, ordini: a.quanti ?? null, senza_fine_trasporto: a.senza_fine ?? null,
            elenco: a.descrizione,
          }));
        const primarieCanale = tipologia === 'EXTRA_RACCOLTA' ? (primLette || []).filter(r => !eSecondariaExtra(r)) : (primLette || []);
        const secondarieCanale = tipologia === 'EXTRA_RACCOLTA' ? (primLette || []).filter(eSecondariaExtra)
          : (secLette || []).filter(r => eAci(r) === (tipologia === 'ACI'));
        const nomePrimarie = tipologia === 'EXTRA_RACCOLTA' ? 'raccolta' : 'primarie';
        const nomeSecondarie = tipologia === 'EXTRA_RACCOLTA' ? 'trasferimenti' : 'secondarie';
        const sfPrimarie = dateObbligatorie(primarieCanale, `${nomePrimarie}, canale ${tipologia}`);
        const sfSecondarie = dateObbligatorie(secondarieCanale, `${nomeSecondarie}, canale ${tipologia}`);
        const k = p.fornitore ? normalizzaRagioneSociale(p.fornitore) : '';
        const sezione = (nome, gruppi) => (gruppi || [])
          .filter(f => !k || normalizzaRagioneSociale(f.fornitore).includes(k))
          .map(f => ({
            sezione: nome, fornitore: f.fornitore, interno: !!f.interno,
            tonnellate: f.totale_tonnellate, euro: f.totale_euro,
            ...(f.di_cui && f.di_cui.length ? { di_cui: f.di_cui.map(x => ({ fornitore: x.fornitore, tonnellate: x.tonnellate, viaggi: x.viaggi })) } : {}),
          }));
        const voci = [
          ...sezione('raccolta', d.raccoglitori),
          ...sezione('impianti e stoccaggi', d.impianti_stoccaggi),
          ...sezione('trasporto di secondaria', d.trasporti_secondaria),
        ].sort((a, b) => (Number(b.euro) || 0) - (Number(a.euro) || 0));
        // I totali e la quadratura che arrivano dal modulo sono di tutto il mese:
        // se qui si e' chiesto un fornitore solo, rispondono a un'altra domanda.
        const suo = Math.round(voci.reduce((s, v) => s + (Number(v.euro) || 0), 0) * 100) / 100;
        return {
          fonte: `Fatturazione passiva, canale ${tipologia}`,
          periodo: `${meseChiesto} ${anno}`,
          dati_al: oggiRoma(),
          dati: {
            fornitori: elenco(voci, 60),
            ...(k
              ? { totale_del_fornitore_euro: suo, totali_del_mese_tutti_i_fornitori: d.totali }
              : { totali: d.totali, quadratura: d.quadratura }),
            anomalie: elenco(d.anomalie || [], 20),
            ...(sfPrimarie || sfSecondarie || dagliAlert.length ? {
              date_obbligatorie_da_sistemare: {
                canale: tipologia,
                ...(sfPrimarie ? { [nomePrimarie]: sfPrimarie } : {}),
                ...(sfSecondarie ? { [nomeSecondarie]: sfSecondarie } : {}),
                ...(dagliAlert.length ? {
                  tutte_le_date_dagli_alert: dagliAlert,
                  nota_alert: 'Per primarie e secondarie qui sopra ci sono i terminati senza fine trasporto, letti adesso: sono esclusi dal conto. "tutte_le_date_dagli_alert" sono gli alert del motore, uno per modulo e canale, con tutte le date obbligatorie mancanti o incoerenti (anche l\'immissione e l\'inizio del trasporto, che non tolgono l\'ordine dal conto: vanno corretti lo stesso) e l\'elenco degli ordini, rivalutati a ogni caricamento del file del modulo. I senza fine trasporto compaiono in tutte e due le voci: sono gli stessi ordini, non vanno sommati. Primarie e secondarie non si sommano.',
                } : {}),
              },
            } : {}),
            ...(conteggioFatto ? {} : { avviso_date_obbligatorie: 'Non sono riuscita a leggere i terminati per contare quelli con date obbligatorie mancanti o incoerenti: se ce ne sono senza data di fine trasporto, il conto qui sopra li esclude.' }),
            ...(alertDate === null ? { avviso_alert_date: 'Non sono riuscita a leggere gli alert delle date obbligatorie: gli ordini a cui manca l\'immissione o l\'inizio del trasporto, o con date incoerenti, qui non ci sono. Si vedono in Alert & Controllo.' } : {}),
            ...(tipologiaChiesta ? {} : { avviso_canale: `${tipologiaIgnorata ? `"${tipologiaIgnorata}" non e' un canale` : 'Canale non indicato'}: questo e' il conto della RETE. ACI ed extra raccolta hanno il loro, e non si sommano.` }),
            nota: 'Conto fatto adesso sui movimenti terminati del mese, lo stesso del modulo Fatturazione. Un fornitore che ne fattura un altro porta il secondo in "di cui": si paga al primo.',
          },
        };
      }

      // L'attiva si calcola adesso, con le righe del modulo (attivaCalcolo.ts,
      // le stesse dell'anteprima e di "Elabora Mese"), e il documento salvato si
      // mette accanto. Leggendo solo le voci salvate, un ritiro del 30/06 arrivato
      // col caricamento del 04/07 non esisteva per "quanto ci spetta a giugno"
      // finche' qualcuno non rielaborava il mese: la pagina lo vedeva con la
      // riconciliazione, EcoTyna no.
      if (tipo === 'ATTIVA') return await attivaSuiDatiDiOggi(base44, { anno, meseChiesto, meseIgnorato, tipologia: p.tipologia, fornitore: p.fornitore });

      const filtro = { anno, tipo };
      if (meseChiesto) filtro.mese = meseChiesto;
      if (tipologiaChiesta) filtro.tipologia = tipologiaChiesta;
      const voci = await fetchAll(svc.VoceFatturazione, filtro);
      const nomeDi = (v) => v.fornitore_nome || 'N/D';
      const k = p.fornitore ? normalizzaRagioneSociale(p.fornitore) : '';
      const righe = k ? voci.filter(v => normalizzaRagioneSociale(nomeDi(v)).includes(k)) : voci;
      const per = new Map();
      for (const v of righe) {
        const nome = nomeDi(v);
        const key = `${nome}|${v.tipologia || ''}`;
        if (!per.has(key)) per.set(key, { fornitore: nome, tipologia: v.tipologia, voci: 0, quantita: 0, totale_euro: 0, sospese: 0, da_controllare: 0, servizi: new Set() });
        const x = per.get(key);
        x.voci++;
        x.quantita += Number(v.quantita) || 0;
        if (!v.sospesa) x.totale_euro += Number(v.totale) || 0;
        if (v.sospesa) x.sospese++;
        if (v.stato_validazione && v.stato_validazione !== 'verificato') x.da_controllare++;
        if (v.servizio_nome) x.servizi.add(v.servizio_nome);
      }
      const gruppi = [...per.values()].map(x => ({
        fornitore: x.fornitore, tipologia: x.tipologia, voci: x.voci,
        quantita: Math.round(x.quantita * 1000) / 1000,
        totale_euro: Math.round(x.totale_euro * 100) / 100,
        sospese: x.sospese, da_controllare: x.da_controllare, servizi: [...x.servizi].slice(0, 4),
      })).sort((a, b) => b.totale_euro - a.totale_euro);
      return {
        fonte: `Fatturazione ${tipo}` + (tipologiaChiesta ? `, canale ${tipologiaChiesta}` : ', un canale per volta'),
        periodo: meseChiesto ? `${meseChiesto} ${anno}` : `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          // Un totale unico ha senso solo dentro un canale: senza filtro di
          // tipologia sommerebbe rete, ACI ed extra raccolta in un numero solo,
          // e questo vale per gli euro come per il numero delle voci.
          ...(tipologiaChiesta
            ? { voci: righe.length, totale_euro: Math.round(gruppi.reduce((s, g) => s + g.totale_euro, 0) * 100) / 100 }
            : { totale_per_canale: Object.values(gruppi.reduce((acc, g) => { const c = g.tipologia || 'N/D'; if (!acc[c]) acc[c] = { canale: c, voci: 0, euro: 0 }; acc[c].voci += g.voci; acc[c].euro = Math.round((acc[c].euro + g.totale_euro) * 100) / 100; return acc; }, {})), nota_totale: 'Non c\'e\' un totale unico, ne\' di euro ne\' di voci: rete, ACI ed extra raccolta sono commesse indipendenti.' }),
          ...(meseIgnorato ? { avviso_periodo: `"${meseIgnorato}" non e' un mese: ho preso tutto l'anno ${anno}.` } : {}),
          ...(tipologiaIgnorata ? { avviso_canale: `"${tipologiaIgnorata}" non e' un canale: qui sotto ci sono tutti e tre, un totale per canale.` } : {}),
          canale: tipologiaChiesta || 'nessun filtro di canale: qui dentro ci sono rete, ACI ed extra raccolta, da tenere distinti',
          gruppi: elenco(gruppi, 60),
          nota: 'Qui ci sono solo le voci dei documenti gia\' elaborati e salvati: per sapere quanto si deve a un fornitore in un mese preciso rifai la domanda indicando il mese, cosi\' il conto si fa sui movimenti.',
        },
      };
    },
  },
  {
    nome: 'tariffe',
    descrizione: 'Le tariffe concordate con fornitori e clienti: quanto si paga o si incassa per raccolta, trasporto di secondaria, trattamento o conferimento, e per quale tratta.',
    parametri: { fornitore: 'opzionale', prestazione: 'RACCOLTA, TRASPORTO_SECONDARIA, TRATTAMENTO o CONFERIMENTO_STOCCAGGIO', direzione: 'PASSIVA o ATTIVA', tipologia: 'RETE, ACI, EXTRA_RACCOLTA o TUTTE' },
    moduli: ['Fatturazione', 'Tariffe'],
    async esegui(base44, p) {
      const svc = base44.asServiceRole.entities;
      const filtro = { stato: 'attivo' };
      if (p.prestazione) filtro.prestazione = String(p.prestazione).toUpperCase();
      if (p.direzione) filtro.direzione = String(p.direzione).toUpperCase();
      const tutte = await fetchAll(svc.Tariffa, filtro);
      const k = p.fornitore ? normalizzaRagioneSociale(p.fornitore) : '';
      // "TUTTE" e' una tipologia delle tariffe, non un canale: chiesta cosi', non filtra.
      const tipologia = canaleChiesto(p.tipologia);
      const righe = tutte.filter(t => {
        if (k && !normalizzaRagioneSociale(t.fornitore_nome).includes(k) && !normalizzaRagioneSociale(t.cliente).includes(k)) return false;
        if (tipologia && t.tipologia && String(t.tipologia).toUpperCase() !== tipologia && String(t.tipologia).toUpperCase() !== 'TUTTE') return false;
        return true;
      });
      return {
        fonte: 'Tariffe',
        periodo: 'tariffe attive',
        dati_al: oggiRoma(),
        dati: {
          tariffe: elenco(righe.map(t => ({
            fornitore: t.fornitore_nome || t.cliente, prestazione: t.prestazione, direzione: t.direzione,
            tipologia: t.tipologia, servizio: t.servizio_nome, produttore: t.produttore, destinatario: t.destinatario || t.destinazione,
            regione: t.regione, provincia: t.provincia, classe: t.classe_materiale,
            valore: t.valore, unita_misura: t.unita_misura,
            validita: `${soloData(t.data_inizio_validita)} - ${soloData(t.data_fine_validita) || 'senza scadenza'}`,
          })), 80),
          ...(p.tipologia && !tipologia && String(p.tipologia).toUpperCase().trim() !== 'TUTTE'
            ? { avviso_canale: `"${p.tipologia}" non e' un canale: qui ci sono le tariffe di tutti i canali, ciascuna col suo.` } : {}),
        },
      };
    },
  },
];

/** Il catalogo da mettere nel prompt: nome, cosa fa e che parametri vuole. */
export function catalogoStrumenti() {
  return STRUMENTI.map(s => ({
    nome: s.nome,
    descrizione: s.descrizione,
    parametri: s.parametri,
    moduli: s.moduli,
  }));
}

/**
 * Esegue uno strumento. Non lancia mai: se qualcosa va storto lo scrive nel
 * risultato, perche' una risposta che dice "questo non sono riuscita a leggerlo"
 * e' utile, una che si interrompe no.
 */
export async function eseguiStrumento(base44, nome, parametri = {}) {
  const s = STRUMENTI.find(x => x.nome === nome);
  if (!s) return { strumento: nome, errore: `Strumento sconosciuto: ${nome}` };
  let ultimo = null;
  // Due tentativi: quando la piattaforma e' sotto sforzo risponde "rate limit"
  // e la domanda resta senza dati per un motivo che non c'entra niente con la
  // domanda. Al secondo colpo di solito passa.
  for (let giro = 0; giro < 2; giro++) {
    try {
      const esito = await s.esegui(base44, parametri || {});
      return { strumento: nome, parametri, ...esito };
    } catch (e) {
      ultimo = e && e.message ? e.message : String(e);
      if (giro === 0) await new Promise(r => setTimeout(r, 1200));
    }
  }
  return { strumento: nome, parametri, errore: ultimo };
}

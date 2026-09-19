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
import { normalizzaRagioneSociale } from "./normalizzaRagioneSociale.ts";
import { eAci } from "./canaleSecondaria.ts";
import { PIVOT_DEFS, calcolaPivot, MESI } from "./reportMensile.ts";
import { caricaGestionale } from "./quadraturaFirDati.ts";
import { intervalloSettimana, settimanaIso } from "./reportSettimanali.ts";
import { proiettaImpianto, viaggiPerMese } from "./proiezioneSecondarie.ts";
import { situazioneGestionale } from "./assistente.ts";
import { listaOrdini, statoRichiesta } from "./richiesteEct.ts";
import { statoDichiarazione, sommaMateriali } from "./dichiarazioniImpianti.ts";
import { giorniAllaScadenza, fasciaScadenza } from "./omologhe.ts";
import { statoRequisito } from "./qualificaFornitori.ts";

export const oggiRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

const soloData = (v) => (v ? String(v).slice(0, 10) : '');
const terminato = (r) => String(r.stato || '').toLowerCase().trim() === 'terminato';
const peso = (r) => Number(r.peso_effettivo) || 0;
const t3 = (kg) => Math.round((Number(kg) || 0) / 1000 * 1000) / 1000;

const meseDi = (v, anno) => {
  const d = soloData(v);
  if (!d || (anno && Number(d.slice(0, 4)) !== Number(anno))) return -1;
  return Number(d.slice(5, 7)) - 1;
};

/** Le primarie o le extra di un canale, filtrate per periodo e per luogo. */
async function movimenti(base44, { canale, anno, mese, provincia, regione, raccoglitore, destinazione }) {
  const svc = base44.asServiceRole.entities;
  const entita = canale === 'ACI' ? 'PrimariaAci' : canale === 'EXTRA_RACCOLTA' ? 'ExtraRaccolta' : 'PrimariaRete';
  const righe = await fetchAll(svc[entita], { stato: 'terminato' });
  const meseIdx = mese ? MESI.findIndex(m => m.toLowerCase() === String(mese).toLowerCase()) : -1;
  const chiave = (v) => normalizzaRagioneSociale(v);
  return righe.filter(r => {
    if (!terminato(r)) return false;
    const m = meseDi(r.trasporto_finito_il, anno);
    if (m < 0) return false;
    if (meseIdx >= 0 && m !== meseIdx) return false;
    if (provincia && String(r.provincia || '').toUpperCase() !== String(provincia).toUpperCase()) return false;
    if (regione && normalizzaRagioneSociale(r.regioni || r.regione) !== normalizzaRagioneSociale(regione)) return false;
    if (raccoglitore && chiave(r.trasportatore) !== chiave(raccoglitore)) return false;
    if (destinazione && chiave(r.destinazione) !== chiave(destinazione)) return false;
    return true;
  });
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

function perChiave(righe, campo) {
  const m = new Map();
  for (const r of righe) {
    const k = campo === 'mese' ? MESE_DA_DATA(r) : String(r[campo] || 'N/D').trim();
    if (!m.has(k)) m.set(k, { nome: k, formulari: 0, kg: 0 });
    const x = m.get(k);
    x.formulari++;
    x.kg += peso(r);
  }
  return [...m.values()].map(x => ({ ...x, tonnellate: t3(x.kg) })).sort((a, b) => b.kg - a.kg);
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
      const canale = String(p.canale || 'RETE').toUpperCase();
      // Un mese che non esiste non deve passare in silenzio per "tutto l'anno".
      const meseValido = p.mese ? MESI.find(m => m.toLowerCase() === String(p.mese).toLowerCase()) : '';
      const meseIgnorato = p.mese && !meseValido ? String(p.mese) : '';
      const righe = await movimenti(base44, { ...p, mese: meseValido, anno, canale });
      const campo = { raccoglitore: 'trasportatore', provincia: 'provincia', regione: 'regioni', classe: 'classe', destinazione: 'destinazione', mese: 'mese' }[p.raggruppa] || 'trasportatore';
      const totale = righe.reduce((s, r) => s + peso(r), 0);
      return {
        fonte: `Formulari terminati, canale ${canale}`,
        periodo: meseValido ? `${meseValido} ${anno}` : `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          canale, formulari: righe.length, tonnellate: t3(totale),
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
      const [target, righe] = await Promise.all([
        svc.TargetRaccoglitore.filter({ anno }, 'raccoglitore', 500),
        movimenti(base44, { canale: 'RETE', anno }),
      ]);
      const fatto = new Map();
      for (const r of righe) {
        const k = normalizzaRagioneSociale(r.trasportatore);
        fatto.set(k, (fatto.get(k) || 0) + peso(r));
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
        dati: { raccoglitori: dettaglio, target_totale_t: dettaglio.reduce((s, x) => s + x.target_t, 0), fatto_totale_t: Math.round(dettaglio.reduce((s, x) => s + x.fatto_t, 0) * 100) / 100 },
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
      const def = PIVOT_DEFS[chiave];
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const righe = await fetchAll(base44.asServiceRole.entities[def.entita]);
      const pivot = calcolaPivot(chiave, righe, anno, p.mese || MESI[Number(oggiRoma().slice(5, 7)) - 1]);
      return {
        fonte: `Report Mensile, pivot ${pivot.titolo}`,
        periodo: def.periodo === 'mese' ? `${p.mese || ''} ${anno}`.trim() : `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: { titolo: pivot.titolo, misure: pivot.etichetteMisure, colonne: pivot.colonne, righe_lette: pivot.righeLette, albero: pivot.radice },
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
      return {
        fonte: 'Formulari terminati nella settimana',
        periodo: `settimana ${settimana} del ${anno}, dal ${intervallo.inizio} al ${intervallo.fine}`,
        dati_al: oggiRoma(),
        dati: { settimana, intervallo, flussi },
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
            trasporto_finito_il: soloData(r.trasporto_finito_il), ordine_chiuso_il: soloData(r.ordine_chiuso_il),
          });
        }
      }));
      return { fonte: 'Archivi dei movimenti', periodo: 'tutti gli anni', dati_al: oggiRoma(), dati: { cercato: cerca, trovati: elenco(trovati, 40) } };
    },
  },
  {
    nome: 'proiezione_secondarie',
    descrizione: 'Quanti viaggi di secondaria restano da portare a ciascun impianto per arrivare al target, mese per mese, e se gli stoccaggi hanno materiale per farli.',
    parametri: { anno: 'numero', mese_da: 'indice del mese da cui proiettare, 0 = gennaio' },
    moduli: ['Predittivita Secondarie'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const meseDa = p.mese_da != null ? Number(p.mese_da) : Number(oggiRoma().slice(5, 7)) - 1;
      const svc = base44.asServiceRole.entities;
      const [impianti, primarie, secondarie] = await Promise.all([
        svc.ImpiantoTargetSecondaria.filter({ stato: 'attivo' }),
        fetchAll(svc.PrimariaRete, { stato: 'terminato' }),
        fetchAll(svc.Secondaria, { stato: 'terminato' }),
      ]);
      const perSito = (righe, campo, filtro) => {
        const m = new Map();
        for (const r of righe) {
          if (filtro && !filtro(r)) continue;
          const mese = meseDi(r.trasporto_finito_il, anno);
          if (mese < 0) continue;
          const k = normalizzaRagioneSociale(r[campo]);
          if (!m.has(k)) m.set(k, {});
          m.get(k)[mese] = (m.get(k)[mese] || 0) + peso(r);
        }
        return m;
      };
      const prim = perSito(primarie, 'destinazione');
      const sec = perSito(secondarie, 'destinazione', r => !eAci(r));
      const proiezioni = impianti.map(imp => {
        const k = normalizzaRagioneSociale(imp.nome_impianto);
        return proiettaImpianto(
          { nome: imp.nome_impianto, target_kg: Number(imp.target) || 0, data_fine: imp.data_fine || `${anno}-12-18` },
          { conferito_primaria_per_mese: prim.get(k) || {}, conferito_secondaria_per_mese: sec.get(k) || {}, stoccaggi: [] },
          { meseCorrente: meseDa },
        );
      });
      return {
        fonte: 'Predittivita delle secondarie, canale RETE',
        periodo: `da ${MESI[meseDa]} ${anno} alla data obiettivo`,
        dati_al: oggiRoma(),
        dati: { impianti: proiezioni.map(x => ({ impianto: x.impianto, target_t: t3(x.target_kg), conferito_t: t3(x.conferito_kg), residuo_t: t3(x.residuo_kg), viaggi_totali: x.viaggi_totali, mesi: x.mesi.map(m => ({ mese: m.mese, primaria_t: t3(m.primaria_kg), viaggi: m.viaggi, residuo_t: t3(m.residuo_kg) })), avvisi: x.avvisi })), viaggi_per_mese: viaggiPerMese(proiezioni) },
      };
    },
  },
  {
    nome: 'alert_aperti',
    descrizione: 'Gli alert aperti del gestionale, per modulo e gravita\'.',
    parametri: { modulo: 'opzionale' },
    moduli: ['Alert & Controllo'],
    async esegui(base44, p) {
      const filtro = p.modulo ? { stato: 'aperto', modulo: p.modulo } : { stato: 'aperto' };
      const alert = await fetchAll(base44.asServiceRole.entities.Alert, filtro);
      const per = new Map();
      for (const a of alert) {
        const k = `${a.modulo || 'altro'}|${a.severita || 'info'}`;
        if (!per.has(k)) per.set(k, { modulo: a.modulo || 'altro', severita: a.severita || 'info', quanti: 0, esempi: [] });
        const x = per.get(k);
        x.quanti++;
        if (x.esempi.length < 3) x.esempi.push(a.titolo);
      }
      return { fonte: 'Alert & Controllo', periodo: 'adesso', dati_al: oggiRoma(), dati: { totale: alert.length, gruppi: [...per.values()].sort((a, b) => b.quanti - a.quanti) } };
    },
  },
  {
    nome: 'richieste_ect',
    descrizione: 'Le richieste di ritiro arrivate dal consorzio per email: quali sono aperte, quali scadute e quali evase.',
    parametri: { anno: 'numero', stato: 'aperta, da_confermare, evasa o annullata' },
    moduli: ['To-Do List'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const richieste = await fetchAll(base44.asServiceRole.entities.RichiestaEct, { anno });
      const righe = richieste.map(r => ({
        pdr: r.pdr_nome, provincia: r.provincia, classe: r.classe,
        ordini: listaOrdini(r), stato: statoRichiesta(r), scadenza: r.scadenza,
        immesso_il: soloData(r.ordine_immesso_il), evaso_il: soloData(r.evaso_il || r.evasione_rilevata_il),
      })).filter(r => !p.stato || r.stato === p.stato);
      return { fonte: 'Richieste ECT', periodo: `anno ${anno}`, dati_al: oggiRoma(), dati: { richieste: elenco(righe, 60) } };
    },
  },
  {
    nome: 'caricamenti',
    descrizione: 'Quando sono stati caricati per l\'ultima volta i file del gestionale: serve per sapere se un dato e\' aggiornato.',
    parametri: {},
    moduli: ['Caricamento Dati'],
    async esegui(base44) {
      const log = await base44.asServiceRole.entities.UploadLog.list('-created_date', 60);
      const per = new Map();
      for (const l of log) {
        if (per.has(l.tipo_file)) continue;
        per.set(l.tipo_file, { tipo: l.tipo_file, quando: soloData(l.created_date), file: l.nome_file, righe: l.righe_importate, esito: l.esito });
      }
      return { fonte: 'Caricamento Dati', periodo: 'ultimi caricamenti', dati_al: oggiRoma(), dati: { caricamenti: [...per.values()] } };
    },
  },
  {
    nome: 'giacenze',
    descrizione: 'La giacenza a portale di impianti e stoccaggi: il materiale conferito che non e\' ancora stato dichiarato, con target, ordini da dichiarare e arretrato per anno. Usa lo stesso calcolo del modulo Giacenze, cosi\' i numeri sono quelli che si vedono a video.',
    parametri: { anno: 'numero', sito: 'nome dell\'impianto o dello stoccaggio, opzionale', tipo: 'impianto o stoccaggio, opzionale' },
    moduli: ['Giacenze'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const res = await base44.functions.invoke('calcolaGiacenze', { anno });
      const d = (res && res.data) || res || {};
      let righe = d.righe || [];
      // Il tipo si applica solo quando non e' stato chiesto un sito preciso:
      // chiedendo "la giacenza di Nappi Sud" con tipo "impianto" si finiva per
      // non trovare niente, perche' Nappi Sud e' uno stoccaggio.
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
      const utili = righe.map(r => ({
        sito: r.sito, tipo: String(r.tipo_destinazione || '').toLowerCase() === 'stoc' ? 'stoccaggio' : 'impianto',
        giacenza_portale_t: r.giacenza_portale_t,
        in_attesa_dichiarazione_t: r.in_attesa_dichiarazione_t, ordini_da_dichiarare: r.ordini_da_dichiarare,
        dichiarato_t: r.dichiarato_t, conferito_primarie_t: r.conferito_primarie_t, conferito_aci_t: r.conferito_aci_t,
        conferito_extra_t: r.conferito_extra_t, secondarie_in_t: r.secondarie_in_t, secondarie_out_t: r.secondarie_out_t,
        target_totale_t: r.target_totale_t, giacenza_riferimento_t: r.giacenza_riferimento_t,
        data_rilevazione: r.data_rilevazione, giacenza_classi_kg: r.giacenza_classi_kg,
      }));
      return {
        fonte: 'Giacenze, giacenza a portale',
        periodo: `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: { siti: elenco(utili, 80), totali: d.totali, anomalie: elenco(d.anomalie || [], 20) },
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
      const righe = dich.filter(d => {
        if (p.mese && String(d.mese || '').toLowerCase() !== String(p.mese).toLowerCase()) return false;
        if (k && normalizzaRagioneSociale(d.sito) !== k) return false;
        if (p.canale && String(d.canale || 'RETE').toUpperCase() !== String(p.canale).toUpperCase()) return false;
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
      const righe = tutte.filter(o => {
        if (k && normalizzaRagioneSociale(o.produttore) !== k && !normalizzaRagioneSociale(o.produttore).includes(k)) return false;
        if (p.canale && String(o.canale || '').toUpperCase() !== String(p.canale).toUpperCase()) return false;
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
      return {
        fonte: 'Omologhe',
        periodo: `situazione al ${oggi}`,
        dati_al: oggi,
        dati: {
          scadute: filtrate.filter(r => r.giorni_alla_scadenza !== null && r.giorni_alla_scadenza < 0).length,
          da_verificare: filtrate.filter(r => r.stato === 'da_verificare').length,
          omologhe: elenco(filtrate, 80),
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
      const tutte = await fetchAll(svc.DichiarazioneRentri);
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
        if (st.stato === 'valido') x.validi++;
        else if (x[st.stato] !== undefined) x[st.stato]++;
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
    descrizione: 'Quanto dobbiamo pagare ai fornitori (passiva) e quanto ci spetta (attiva), per fornitore e per mese. Per la passiva con il mese indicato fa lo stesso conto del modulo, sui movimenti terminati; senza mese legge solo i documenti gia\' elaborati. I canali restano separati.',
    parametri: { anno: 'numero', mese: 'nome del mese: indicalo sempre per la passiva', tipo: 'PASSIVA o ATTIVA', tipologia: 'RETE, ACI o EXTRA_RACCOLTA', fornitore: 'opzionale' },
    moduli: ['Fatturazione'],
    async esegui(base44, p) {
      const anno = Number(p.anno) || Number(oggiRoma().slice(0, 4));
      const tipo = String(p.tipo || 'PASSIVA').toUpperCase();
      const svc = base44.asServiceRole.entities;

      // La passiva di un mese si calcola, non si legge: le voci salvate esistono
      // solo dopo che qualcuno ha elaborato e salvato il documento, e chiedendo
      // "quanto dobbiamo a Green Tyre per marzo" si rispondeva "niente" mentre
      // il modulo diceva 13.271,40 euro. Qui si chiama lo stesso conto del
      // modulo, cosi' i due numeri non possono divergere.
      const meseChiesto = p.mese ? MESI.find(m => m.toLowerCase() === String(p.mese).toLowerCase()) : '';
      if (tipo === 'PASSIVA' && meseChiesto) {
        const tipologia = String(p.tipologia || 'RETE').toUpperCase();
        const res = await base44.functions.invoke('calcolaPassiva', { anno, mese: meseChiesto, tipologia });
        const d = (res && res.data) || res || {};
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
        return {
          fonte: `Fatturazione passiva, canale ${tipologia}`,
          periodo: `${meseChiesto} ${anno}`,
          dati_al: oggiRoma(),
          dati: {
            fornitori: elenco(voci, 60),
            totali: d.totali,
            anomalie: elenco(d.anomalie || [], 20),
            quadratura: d.quadratura,
            nota: 'Conto fatto adesso sui movimenti terminati del mese, lo stesso del modulo Fatturazione. Un fornitore che ne fattura un altro porta il secondo in "di cui": si paga al primo.',
          },
        };
      }

      const filtro = { anno, tipo };
      if (p.mese) filtro.mese = p.mese;
      if (p.tipologia) filtro.tipologia = String(p.tipologia).toUpperCase();
      const voci = await fetchAll(svc.VoceFatturazione, filtro);
      const k = p.fornitore ? normalizzaRagioneSociale(p.fornitore) : '';
      const righe = k ? voci.filter(v => normalizzaRagioneSociale(v.fornitore_nome).includes(k)) : voci;
      const per = new Map();
      for (const v of righe) {
        const nome = v.fornitore_nome || 'N/D';
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
        fonte: `Fatturazione ${tipo}`,
        periodo: p.mese ? `${p.mese} ${anno}` : `anno ${anno}`,
        dati_al: oggiRoma(),
        dati: {
          voci: righe.length,
          totale_euro: Math.round(gruppi.reduce((s, g) => s + g.totale_euro, 0) * 100) / 100,
          gruppi: elenco(gruppi, 60),
          nota: tipo === 'PASSIVA'
            ? 'Qui ci sono solo le voci dei documenti gia\' elaborati e salvati: per sapere quanto si deve a un fornitore in un mese preciso rifai la domanda indicando il mese, cosi\' il conto si fa sui movimenti.'
            : 'La fatturazione attiva si vede dopo che il documento del mese e\' stato elaborato nel modulo Fatturazione: quello che non compare qui non e\' ancora stato elaborato.',
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
      const righe = tutte.filter(t => {
        if (k && !normalizzaRagioneSociale(t.fornitore_nome).includes(k) && !normalizzaRagioneSociale(t.cliente).includes(k)) return false;
        if (p.tipologia && t.tipologia && String(t.tipologia).toUpperCase() !== String(p.tipologia).toUpperCase() && String(t.tipologia).toUpperCase() !== 'TUTTE') return false;
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

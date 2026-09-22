import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertTriangle, Info, FileSpreadsheet, FolderDown, CheckCircle2, Ship, FileCheck2, Circle, ClipboardCheck } from 'lucide-react';
import { formatKg, formatTonnellate } from '@/lib/utils';
import { usePermessi } from '@/lib/permessi';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { giornoRoma } from '@/lib/giornoItaliano';
import { eTerminato, giornoMovimento, dateDaSistemare, testoDate } from '@/lib/movimenti';
import { fetchAllClient } from '@/lib/fetchAllClient';
import { leggiRegistroIrigom } from '@/lib/registroIrigom';
import { componiMese, dividiExtra, MESI, extraDaSalvare, extraGiaDichiarate, finestraExtra, extraDellePratiche, dichiarazioniExtra, testoExtraCompresa } from '@/lib/praticaIrigom';
import { wordDelMese, excelDelMese, cartellaZip, dataIt, datiFileGestione } from '@/lib/documentiIrigom';
import { scarica } from '@/lib/docxModello';
import { timbraPdf } from '@/lib/timbraPdf';
import { excelBlocco } from '@/lib/bloccoGestione';
import { scriviBloccoNelFile } from '@/lib/scriviBloccoGestione';
import { esportaFoglioDichiarazioni } from '@/lib/foglioDichiarazioni';
import { fileConversione } from '@/lib/convertiWordPdf';
import ModelliIrigom from '@/components/dichiarazioni/ModelliIrigom';

// La pratica mensile delle dichiarazioni di Irigom, dentro il gestionale.
//
// 1. Si carica il registro di carico e scarico dell'impianto e si sceglie il mese.
// 2. Il gestionale calcola quanto dichiarare, sceglie formulari del ferro e
//    allegati VII e dice quante terziarie aprire a portale.
// 3. Si danno i numeri delle terziarie, i dati della nave e i documenti che il
//    gestionale non puo' avere: formulari del ferro, DDT del CSS-C, allegati VII.
// 4. Esce la cartella del mese, come nel repository - Word delle dichiarazioni,
//    riepilogo Excel col blocco del mese, PDF rinominati - e la dichiarazione si
//    registra nel gestionale.
//
// I file del registro e i PDF si leggono nel browser e non si conservano: resta
// la pratica, con i numeri e le scelte, che basta a rifare tutto.

const t = (kg) => formatTonnellate((Number(kg) || 0) / 1000);
const oggiIt = () => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
const nomeCartella = (mese, anno) => `Irigom ${mese} ${anno}`;
const FIR = /[A-Z]{5}\d{6}[A-Z]{2}/;

// L'extra raccolta partita con la nave sta nell'ultima terziaria, che a portale
// si chiude col peso intero (regola dell'utente del 22/09/2026). Le stesse parole
// nei riquadri, nel pulsante e nelle note, perche' non si contraddicano.
const quale = (c) => (c.terziaria ? `nella terziaria ${c.terziaria}` : `nella terziaria dell'allegato VII n. ${c.allegato}`);
const conExtra = (p) => !!(p && p.extra_kg > 0 && p.chiusura_ultima_terziaria && p.chiusura_ultima_terziaria.extra_kg > 0);
/** "di cui 460 kg di extra raccolta nella terziaria TER26154141, che si chiude a portale a 20.340 kg"; '' senza extra. */
const diCuiExtra = (p) => (conExtra(p)
  ? `di cui ${formatKg(p.extra_kg)} kg di extra raccolta ${quale(p.chiusura_ultima_terziaria)}, che si chiude a portale a ${formatKg(p.chiusura_ultima_terziaria.portale_kg)} kg`
  : '');
/** La frase per le note: il totale a portale e, se c'e', l'extra che contiene. */
const testoPortale = (p) => (!p.portale_kg ? 'A portale non si carica nulla.' : conExtra(p)
  ? `A portale ${formatKg(p.portale_kg)} kg, di cui ${formatKg(p.extra_kg)} kg di extra raccolta ${quale(p.chiusura_ultima_terziaria)}, chiusa a ${formatKg(p.chiusura_ultima_terziaria.portale_kg)} kg, dichiarata a parte sul canale extra raccolta; la parte di rete e' ${formatKg(p.rete_kg)} kg.`
  : `A portale ${formatKg(p.portale_kg)} kg, tutti di rete.`);
/** Il totale a portale di una pratica salvata, da dati_json; null per quelle di prima del 22/09/2026, che non l'avevano. */
function portaleSalvato(p) {
  try {
    const d = JSON.parse((p && p.dati_json) || '{}');
    return typeof d.portale_kg === 'number' ? d.portale_kg : null;
  } catch (e) {
    return null;
  }
}

/** Che documento e' un file, dal nome. */
function riconosci(nome) {
  const n = nome.toUpperCase();
  const ter = /TER\d{8}/.exec(n);
  if (ter) return { tipo: 'terziaria', chiave: ter[0] };
  if (/(ALLEGAT[OI]|ANNEX)\s*(VII|7)\b.*\bDA\s*\d+\s*A\s*\d+/.test(n)) return { tipo: 'nave', chiave: '' };
  const all = /(ALLEGAT[OI]|ANNEX)\s*(VII|7)\D*?(\d{1,3})(?!\d)/.exec(n);
  if (all) return { tipo: 'allegato', chiave: String(Number(all[3])) };
  const ddt = /DDT\D*?(\d{1,6})/.exec(n);
  if (ddt) return { tipo: 'ddt', chiave: String(Number(ddt[1])) };
  const fir = FIR.exec(n);
  if (fir) return { tipo: 'formulario', chiave: fir[0] };
  return { tipo: 'altro', chiave: '' };
}

function Passo({ numero, titolo, fatto, children, spiega }) {
  return (
    <section className="border rounded-xl bg-card">
      <header className="px-4 py-3 border-b bg-muted/20 flex items-start gap-3">
        <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${fatto ? 'bg-emerald-600 text-white' : 'bg-primary/10 text-primary'}`}>
          {fatto ? <CheckCircle2 className="w-4 h-4" /> : numero}
        </span>
        <div>
          <h4 className="font-semibold text-sm">{titolo}</h4>
          {spiega && <p className="text-xs text-muted-foreground mt-0.5">{spiega}</p>}
        </div>
      </header>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </section>
  );
}

function Riquadro({ titolo, valore, nota, tono }) {
  const bordo = tono === 'scelto' ? 'border-primary/50 bg-primary/5' : tono === 'attenzione' ? 'border-amber-300 bg-amber-50' : 'bg-muted/30';
  return (
    <div className={`px-3 py-2 rounded-md border min-w-[160px] ${bordo}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{titolo}</div>
      <div className="tabular-nums font-semibold">{valore}</div>
      {nota && <div className="text-[11px] text-muted-foreground">{nota}</div>}
    </div>
  );
}

const Avviso = ({ testo, grave }) => (
  <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm border ${grave ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{testo}</span>
  </div>
);

export default function PraticaIrigom({ anno, irigom, fotoPortaleIl, onRegistrata }) {
  const { isAdmin } = usePermessi();
  const inputRegistro = useRef(null);
  const inputDocumenti = useRef(null);
  const [registro, setRegistro] = useState(null);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState('');
  const [mese, setMese] = useState('');
  const [pratiche, setPratiche] = useState([]);
  // Le pratiche e le dichiarazioni di extra raccolta dell'anno prima servono al
  // cambio d'anno: l'extra arrivata a dicembre parte con la nave di gennaio.
  const [praticheAnnoPrima, setPraticheAnnoPrima] = useState([]);
  const [extraDichiarate, setExtraDichiarate] = useState([]);
  const [modelli, setModelli] = useState([]);
  const [extraArchivio, setExtraArchivio] = useState([]);
  const [lettura, setLettura] = useState('giacenza');
  const [extraScelti, setExtraScelti] = useState(null);
  const [quotaFerroExtra, setQuotaFerroExtra] = useState('26');
  const [terziarieTesto, setTerziarieTesto] = useState('');
  const [nave, setNave] = useState({ nome: '', imo: '', porto: '', partenza: '', cementeria: '' });
  const [dataLettera, setDataLettera] = useState(oggiIt());
  const [documenti, setDocumenti] = useState([]);
  const [lavoro, setLavoro] = useState('');
  const [esito, setEsito] = useState(null);

  const caricaArchivi = useCallback(async () => {
    try {
      // L'extra raccolta si legge tutta, a pagine: con le prime 500 per fine
      // trasporto restavano fuori proprio i terminati senza fine trasporto, che
      // vanno segnalati (regola del 22/09/2026).
      const annoPrima = Number(anno) - 1;
      const [p, pPrima, m, e, dEx, dExPrima] = await Promise.all([
        base44.entities.PraticaIrigom.filter({ anno }),
        base44.entities.PraticaIrigom.filter({ anno: annoPrima }),
        base44.entities.ModelloDocumento.list(),
        fetchAllClient(base44.entities.ExtraRaccolta, null, '-trasporto_finito_il'),
        fetchAllClient(base44.entities.DichiarazioneSito, { anno, canale: 'EXTRA_RACCOLTA' }, 'id'),
        fetchAllClient(base44.entities.DichiarazioneSito, { anno: annoPrima, canale: 'EXTRA_RACCOLTA' }, 'id'),
      ]);
      setPratiche(p || []);
      setPraticheAnnoPrima(pPrima || []);
      setExtraDichiarate([...(dEx || []), ...(dExPrima || [])]);
      setModelli(m || []);
      setExtraArchivio(e || []);
    } catch (err) {
      setErrore(err?.response?.data?.error || err.message);
    }
  }, [anno]);
  useEffect(() => { caricaArchivi(); }, [caricaArchivi]);

  const praticaDelMese = useMemo(() => pratiche
    .filter(p => p.mese === mese && p.stato !== 'sostituita')
    .sort((a, b) => (b.versione || 1) - (a.versione || 1))[0] || null, [pratiche, mese]);
  // A gennaio l'ultima registrata e' quella di dicembre dell'anno prima.
  const ultimaRegistrata = useMemo(() => [...pratiche, ...praticheAnnoPrima]
    .filter(p => p.stato === 'registrata')
    .sort((a, b) => (Number(b.anno) - Number(a.anno)) || MESI.indexOf(b.mese) - MESI.indexOf(a.mese))[0] || null, [pratiche, praticheAnnoPrima]);

  // Scegliendo un mese si riparte da quello che la pratica aveva gia'; se non c'e',
  // la nave e la ripartizione dell'extra si propongono come l'ultima volta.
  const scegliMese = (m) => {
    setMese(m);
    setEsito(null);
    // I PDF caricati prima di scegliere il mese restano; passando da un mese a un
    // altro si ripulisce, perche' la numerazione degli allegati VII riparte a ogni nave.
    if (mese && mese !== m) setDocumenti([]);
    setExtraScelti(null);
    const p = pratiche.filter(x => x.mese === m && x.stato !== 'sostituita').sort((a, b) => (b.versione || 1) - (a.versione || 1))[0];
    const base = p || ultimaRegistrata;
    setTerziarieTesto(p && p.terziarie ? p.terziarie.join('\n') : '');
    setLettura(p && p.lettura ? p.lettura : 'giacenza');
    try { setNave({ nome: '', imo: '', porto: '', partenza: '', cementeria: '', ...(base && base.nave_json ? JSON.parse(base.nave_json) : {}), ...(p ? {} : { partenza: '' }) }); } catch (e) { /* nave vuota */ }
    try {
      const ex = base && base.extra_json ? JSON.parse(base.extra_json) : null;
      if (ex && ex.quota_ferro) setQuotaFerroExtra(String(Math.round(ex.quota_ferro * 1000) / 10));
      if (p && ex && ex.formulari) setExtraScelti(new Set(ex.formulari.map(f => f.id)));
    } catch (e) { /* ripartizione di default */ }
    setDataLettera(p && p.data_lettera ? p.data_lettera : oggiIt());
  };

  const caricaRegistro = async (file) => {
    setCaricando(true);
    setErrore('');
    try {
      const r = await leggiRegistroIrigom(file, anno);
      setRegistro(r);
      if (!mese) {
        // Il primo mese compilato che non ha ancora una pratica registrata.
        const registrate = new Set(pratiche.filter(p => p.stato === 'registrata').map(p => p.mese));
        const primo = r.mesi.find(m => !registrate.has(m.mese) && (m.uscite_cippato_kg || m.uscite_ferro_kg || m.uscite_cssc_kg));
        if (primo) scegliMese(primo.mese);
      }
    } catch (e) {
      setRegistro(null);
      setErrore(e.message || String(e));
    }
    setCaricando(false);
  };

  // --- La giacenza di rete a portale a fine mese, per fine trasporto ---
  // La fotografia degli ordini non dichiarati e i carichi che il file non ha
  // ancora, fino all'ultimo giorno del mese; meno le dichiarazioni dei mesi
  // prima caricate a portale dopo la fotografia.
  const idx = MESI.indexOf(mese);
  const portaleFineMese = useMemo(() => {
    if (!irigom || idx < 0 || !irigom.portale_fine_mese || !irigom.portale_fine_mese[idx]) return null;
    const pm = irigom.portale_fine_mese[idx];
    const rete = (irigom.flussi || []).find(f => f.canale === 'RETE');
    const dopo = rete ? rete.mesi.slice(0, idx).reduce((s, m) => s + (m.dichiarazione && m.dichiarazione.caricata_inviata && fotoPortaleIl
      && String(m.dichiarazione.caricata_il || '').slice(0, 10) > fotoPortaleIl ? m.dichiarazione.quantita_kg : 0), 0) : 0;
    return { kg: Math.max(0, pm.foto_kg + pm.aggiunti_kg - dopo), foto_kg: pm.foto_kg, aggiunti_kg: pm.aggiunti_kg, dopo_kg: dopo };
  }, [irigom, idx, fotoPortaleIl]);

  // --- L'extra raccolta arrivata a Irigom e non ancora dichiarata ---
  const nsIrigom = irigom ? normalizzaRagioneSociale(irigom.sito) : 'irigom';
  // Le pratiche registrate dell'anno e dell'anno prima, tranne quella del mese
  // che si rifa' (src/lib/praticaIrigom.js, extraGiaDichiarate).
  const praticheDueAnni = useMemo(() => [...pratiche, ...praticheAnnoPrima], [pratiche, praticheAnnoPrima]);
  const giaDichiarate = useMemo(() => extraGiaDichiarate(praticheDueAnni, { anno, mese }), [praticheDueAnni, anno, mese]);
  // Per fine trasporto, sul giorno italiano: fino all'ultimo giorno del mese che
  // si dichiara, e dall'anno prima se in quell'anno la pratica c'era gia'. Si
  // guardava solo l'anno della pratica: l'extra arrivata a dicembre e partita con
  // la nave di gennaio non si sarebbe proposta mai, e ora che sta nel totale a
  // portale l'errore pesa di piu'.
  const finestra = useMemo(() => finestraExtra({ anno, meseIdx: idx, annoPrimaConPratica: praticheAnnoPrima.some(p => p.stato === 'registrata') }), [anno, idx, praticheAnnoPrima]);
  const extraCandidati = useMemo(() => extraArchivio.filter(r => {
    const giorno = giornoMovimento(r);
    return eTerminato(r)
      && normalizzaRagioneSociale(r.destinazione) === nsIrigom
      && !!giorno && giorno >= finestra.da && giorno <= finestra.a
      && !giaDichiarate.has(r.id);
  }), [extraArchivio, nsIrigom, finestra, giaDichiarate]);
  // Regola dell'utente del 22/09/2026: immissione, inizio e fine trasporto sono
  // obbligatorie in ogni formulario. Un'extra raccolta terminata per Irigom senza
  // fine trasporto non si colloca in nessun mese, quindi non si propone e non
  // entra nella giacenza, ma si segnala dicendo quali date mancano: prima spariva
  // in silenzio. Si mostrano nel passo 1, appena gli archivi sono letti, anche
  // senza registro e su un mese vuoto: stavano nel passo 2 e si vedevano solo col
  // registro caricato e un mese compilato. Quelle che la fine ce l'hanno ma hanno
  // un'altra data mancante o nell'ordine sbagliato restano fra le proposte,
  // segnalate accanto, negli avvisi della pratica e nel passo dei documenti.
  const extraSenzaFine = useMemo(() => extraArchivio.filter(r => eTerminato(r)
    && normalizzaRagioneSociale(r.destinazione) === nsIrigom
    && !giornoMovimento(r)
    && !giaDichiarate.has(r.id)), [extraArchivio, nsIrigom, giaDichiarate]);
  // Un'extra raccolta il cui mese ha gia' una dichiarazione scritta a mano non si
  // propone di nuovo: si vede, e la si spunta solo se va rifatta. "A mano" vuol
  // dire che la dichiarazione di quel mese (e anno) vale piu' di quanto ci hanno
  // scritto le pratiche registrate. Prima si guardava se la nota citava la pratica
  // di questo mese: l'extra di un mese gia' toccato da un'altra pratica sembrava
  // dichiarata anche quando non lo era, e l'anno prima non si guardava affatto.
  const extraPratiche = useMemo(() => extraDellePratiche(praticheDueAnni), [praticheDueAnni]);
  const dichiarataAMano = useCallback((r) => {
    const g = giornoMovimento(r);
    if (!g) return false;
    const a = Number(g.slice(0, 4));
    const m = MESI[Number(g.slice(5, 7)) - 1];
    const d = extraDichiarate.find(x => Number(x.anno) === a && x.mese === m && normalizzaRagioneSociale(x.sito) === nsIrigom);
    const dallePratiche = (extraPratiche.get(`${a}|${m}`) || { pfu_kg: 0 }).pfu_kg;
    return !!(d && (Number(d.quantita_kg) || 0) > dallePratiche);
  }, [extraDichiarate, extraPratiche, nsIrigom]);
  const sceltiExtra = extraScelti || new Set(extraCandidati.filter(r => !dichiarataAMano(r)).map(r => r.id));
  const extra = useMemo(() => {
    const scelti = extraCandidati.filter(r => sceltiExtra.has(r.id));
    const pfu = scelti.reduce((s, r) => s + (Number(r.peso_effettivo) || 0), 0);
    if (!pfu) return null;
    const quota = Math.min(1, Math.max(0, Number(String(quotaFerroExtra).replace(',', '.')) / 100 || 0));
    const div = dividiExtra(pfu, quota);
    return {
      ...div, quota_ferro: quota,
      formulari: scelti.map(r => ({
        id: r.id, formulario: r.numero_fir || '', peso_kg: Math.round(Number(r.peso_effettivo) || 0),
        inizio_trasporto: giornoRoma(r.trasporto_iniziato_il), fine_trasporto: giornoRoma(r.trasporto_finito_il),
        campagna: r.tipologia_trasporto || r.id_ordine || '', produttore: r.produttore || r.ragione_sociale || '',
        trasportatore: r.trasportatore || '', destinatario: 'IRIGOM SRL',
        // Regola del 22/09/2026: le date mancanti o incoerenti vanno con la pratica,
        // che le segnala anche nel passo dei documenti e nel foglio Controlli.
        date_da_sistemare: dateDaSistemare(r) ? testoDate(r) : '',
      })),
    };
  }, [extraCandidati, sceltiExtra, quotaFerroExtra]);

  // --- La pratica ---
  const riga = registro && mese ? registro.mesi.find(m => m.mese === mese) : null;
  const terziarie = useMemo(() => [...new Set((terziarieTesto.toUpperCase().match(/TER\d{8}/g) || []))].sort(), [terziarieTesto]);
  const pratica = useMemo(() => {
    if (!riga) return null;
    return componiMese({
      riga,
      ferro: registro.ferro.filter(r => r.mese === mese),
      allegati: registro.allegati.filter(r => r.mese === mese),
      ddt: registro.cssc.righe.filter(r => r.mese === mese && r.nostra).map(r => ({ ddt: r.ddt, data: r.data, kg: r.kg })),
      portaleFineMeseKg: portaleFineMese ? portaleFineMese.kg : null,
      // L'extra raccolta arrivata e non dichiarata con questa pratica e' ancora in
      // impianto: il registro la conta in giacenza, il portale di rete no.
      extraInGiacenzaKg: extraCandidati.filter(r => !sceltiExtra.has(r.id) && !dichiarataAMano(r)).reduce((s, r) => s + (Number(r.peso_effettivo) || 0), 0),
      lettura, extra, terziarie,
    });
  }, [riga, registro, mese, portaleFineMese, lettura, extra, terziarie, extraCandidati, sceltiExtra, dichiarataAMano]);

  // --- I documenti forniti ---
  const aggiungiDocumenti = (lista) => {
    const nuovi = [...lista].map(file => ({ file, nome: file.name, ...riconosci(file.name) }));
    setDocumenti(prima => [...prima.filter(d => !nuovi.some(n => n.nome === d.nome)), ...nuovi]);
  };
  // Da qualunque pulsante o trascinandoli: l'Excel e' il registro, i PDF i documenti.
  const aggiungiFile = (lista) => {
    const tutti = [...(lista || [])];
    const excel = tutti.filter(x => /\.(xlsx|xlsm|xls)$/i.test(x.name));
    const pdf = tutti.filter(x => /\.pdf$/i.test(x.name));
    const altri = tutti.filter(x => !excel.includes(x) && !pdf.includes(x));
    if (pdf.length) aggiungiDocumenti(pdf);
    if (excel.length) caricaRegistro(excel[0]);
    if (altri.length || excel.length > 1) {
      setErrore([altri.length ? `Non so leggere ${altri.map(x => x.name).join(', ')}: servono il registro in Excel e i documenti in PDF.` : '',
        excel.length > 1 ? `Ho letto un solo registro, ${excel[0].name}.` : ''].filter(Boolean).join(' '));
    }
  };
  const [sopra, setSopra] = useState(false);
  const trascina = {
    onDragOver: (e) => { e.preventDefault(); setSopra(true); },
    onDragLeave: () => setSopra(false),
    onDrop: (e) => { e.preventDefault(); setSopra(false); aggiungiFile(e.dataTransfer && e.dataTransfer.files); },
  };
  // Un PDF dal nome non riconoscibile si assegna a mano al documento che manca.
  const assegna = (nome, valore) => {
    const [tipo, chiave] = valore.split('|');
    setDocumenti(prima => prima.map(d => (d.nome === nome ? { ...d, tipo, chiave: chiave || '' } : d)));
  };
  const richiesti = useMemo(() => {
    if (!pratica) return [];
    const r = [];
    for (const f of pratica.ferro.tabella) r.push({ tipo: 'formulario', chiave: f.formulario, nome: `Formulario del ferro ${f.formulario}` });
    for (const d of pratica.cssc.righe) if (!d.parte || d.parte.startsWith('1 ')) r.push({ tipo: 'ddt', chiave: String(Number(String(d.ddt).replace(/\D/g, ''))), nome: `DDT del CSS-C ${d.ddt}` });
    for (const x of pratica.terziarie.righe) r.push({ tipo: 'allegato', chiave: String(x.allegato), nome: `Allegato VII n. ${x.allegato}` });
    return r.map(x => ({ ...x, file: documenti.find(d => d.tipo === x.tipo && d.chiave === x.chiave) || null }));
  }, [pratica, documenti]);
  const navePresente = documenti.some(d => d.tipo === 'nave');

  // --- La cartella del mese ---
  const scaricaModelli = async () => {
    const attivi = {};
    for (const [uso, chiave] of [['irigom_ferro', 'ferro'], ['irigom_nave', 'nave'], ['irigom_extra', 'extra'], ['irigom_cssc', 'cssc']]) {
      const m = modelli.find(x => x.uso === uso && x.attivo !== false);
      if (!m) continue;
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: m.file_uri, expires_in: 600 });
      const risposta = await fetch(signed_url);
      if (!risposta.ok) throw new Error(`Non riesco a scaricare il modello "${m.nome}" (${risposta.status}).`);
      attivi[chiave] = new Uint8Array(await risposta.arrayBuffer());
    }
    return attivi;
  };
  const contesto = () => ({ anno, mese, data_lettera: dataLettera, nave: { ...nave, partenza: nave.partenza } });

  const salvaBozza = async (stato = 'in_preparazione', extraCampi = {}) => {
    const dati = {
      anno, mese, stato, lettura: pratica.letture.usata,
      registro_file: registro.file_nome,
      portale_fine_mese_kg: portaleFineMese ? portaleFineMese.kg : null,
      // rete_kg e' la sola parte di rete, extra_kg l'extra raccolta: il totale
      // caricato a portale (portale_kg, extra compresa, regola del 22/09/2026)
      // sta in dati_json e, a parole, nella nota. cippato, metalli e CSS-C sono
      // quelli della rete e fanno rete_kg.
      rete_kg: pratica.rete_kg, extra_kg: pratica.extra_kg,
      cippato_kg: pratica.materiali.cippato_kg, metalli_kg: pratica.materiali.metalli_kg, cssc_kg: pratica.materiali.cssc_kg,
      note: testoPortale(pratica),
      terziarie, data_lettera: dataLettera,
      nave_json: JSON.stringify(nave),
      // Solo l'extra che la pratica dichiara (pratica.extra), non quella spuntata:
      // in un mese senza nave resta in impianto e il mese dopo si ripropone.
      extra_json: JSON.stringify(extraDaSalvare(pratica, extra ? extra.quota_ferro : null)),
      dati_json: JSON.stringify({ ...pratica, allegati: { scelti: pratica.allegati.scelti, coperto_kg: pratica.allegati.coperto_kg } }),
      documenti_json: JSON.stringify(richiesti.map(r => ({ tipo: r.tipo, chiave: r.chiave, file: r.file ? r.file.nome : '' }))),
      ...extraCampi,
    };
    if (praticaDelMese && praticaDelMese.stato === 'in_preparazione') return base44.entities.PraticaIrigom.update(praticaDelMese.id, dati);
    return base44.entities.PraticaIrigom.create({ ...dati, versione: praticaDelMese ? (praticaDelMese.versione || 1) + 1 : 1 });
  };

  // Il blocco del mese da incollare nel foglio DICHIARAZIONI del file di
  // gestione: il file sta sul computer dell'utente, e l'utente non e' sempre li'.
  const scaricaBlocco = async () => {
    setLavoro('blocco');
    setErrore('');
    setEsito(null);
    try {
      const bytes = await excelBlocco(datiFileGestione({ pratica, contesto: contesto() }));
      scarica(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Blocco DICHIARAZIONI Irigom ${mese.toLowerCase()} ${anno}.xlsx`);
      setEsito({ tipo: 'blocco' });
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
    }
    setLavoro(null);
  };

  // Il file di gestione: si carica qui e si riscarica gia' scritto, coi colori dei
  // mesi di prima. Serve a chi lavora lontano dal computer dove sta quel file:
  // l'originale non si tocca, si scarica una copia nuova.
  const inputGestione = useRef(null);
  const scriviNelFileGestione = async (file) => {
    if (!file) return;
    setLavoro('gestione');
    setErrore('');
    setEsito(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const scritto = await scriviBloccoNelFile(bytes, datiFileGestione({ pratica, contesto: contesto() }));
      scarica(new Blob([scritto.bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), file.name);
      setEsito({ tipo: 'gestione', ...scritto, nome: file.name });
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
    }
    setLavoro(null);
  };

  // Il foglio DICHIARAZIONI rifatto da quello che il gestionale sa: i mesi che non
  // ha si dicono, non si inventano.
  const esportaFoglio = async () => {
    setLavoro('foglio');
    setErrore('');
    setEsito(null);
    try {
      const tutte = await fetchAllClient(base44.entities.DichiarazioneSito, { anno }, 'id');
      const sue = (tutte || []).filter(d => normalizzaRagioneSociale(d.sito) === nsIrigom && !d.provenienza);
      const bytes = await esportaFoglioDichiarazioni({ pratiche, dichiarazioni: sue, anno });
      scarica(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Foglio DICHIARAZIONI Irigom ${anno}.xlsx`);
      setEsito({ tipo: 'foglio', mesi: pratiche.length });
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
    }
    setLavoro(null);
  };

  const scaricaCartella = async (soloExcel = false) => {
    setLavoro(soloExcel ? 'excel' : 'cartella');
    setErrore('');
    setEsito(null);
    try {
      const xlsx = await excelDelMese({ pratica, contesto: contesto() });
      const MESE = mese.toUpperCase();
      if (soloExcel) {
        scarica(new Blob([xlsx], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Riepilogo dichiarazioni Irigom ${mese} ${anno}.xlsx`);
      } else {
        const m = await scaricaModelli();
        const word = wordDelMese({ pratica, contesto: contesto(), modelli: m });
        const file = [...word, { percorso: `${MESE}/Riepilogo dichiarazioni Irigom ${mese.toLowerCase()} ${anno}.xlsx`, bytes: xlsx }];
        // I dati per scrivere il blocco del mese nel file di gestione (strumenti/irigom/scrivi_blocco_mese.ps1).
        const datiGestione = datiFileGestione({ pratica, contesto: contesto() });
        file.push({ percorso: `${MESE}/Dati per il file di gestione.json`, bytes: new TextEncoder().encode(JSON.stringify(datiGestione, null, 1)) });
        // Il blocco del mese pronto da incollare nel foglio DICHIARAZIONI: si fa
        // da qualunque computer, senza il file di gestione (22/09/2026).
        file.push({ percorso: `${MESE}/Blocco per il file di gestione.xlsx`, bytes: await excelBlocco(datiGestione) });
        // I PDF forniti, dove li vuole il repository; gli allegati VII anche col
        // numero della terziaria, nel nome e scritto in alto sulla prima pagina.
        const nonTimbrati = [];
        for (const d of documenti) {
          const bytes = new Uint8Array(await d.file.arrayBuffer());
          if (d.tipo === 'formulario') file.push({ percorso: `${MESE}/FERRO/${d.chiave}.pdf`, bytes });
          else if (d.tipo === 'ddt') file.push({ percorso: `${MESE}/CSS-C/DOC/DDT ${d.chiave}.pdf`, bytes });
          else if (d.tipo === 'nave') file.push({ percorso: `${MESE}/EXPORT/ALLEGATI VII/ANNEX VII NAVE/${d.nome}`, bytes });
          else if (d.tipo === 'allegato') {
            // Gli allegati VII spacchettati stanno tutti in SPACCHETTATI, come nel
            // repository: in ALLEGATI VII non resta niente di sciolto.
            file.push({ percorso: `${MESE}/EXPORT/ALLEGATI VII/ANNEX VII NAVE/SPACCHETTATI/${d.nome}`, bytes });
            const r = pratica.terziarie.righe.find(x => String(x.allegato) === d.chiave);
            if (r && r.terziaria) {
              // La copia per il portale porta il numero della terziaria nel nome e
              // scritto in alto a destra sulla prima pagina. Se il PDF non si
              // lascia scrivere, la copia resta quella originale e lo si dice.
              const timbro = await timbraPdf(bytes, r.terziaria);
              if (!timbro.timbrato) nonTimbrati.push(`${r.terziaria} (allegato ${r.allegato})`);
              file.push({ percorso: `${MESE}/EXPORT/TERZIARIE/${r.terziaria}.pdf`, bytes: timbro.bytes });
            }
          } else file.push({ percorso: `${MESE}/ALTRI/${d.nome}`, bytes });
        }
        // Lo script che converte in PDF i Word della cartella, sottocartelle comprese:
        // il browser non puo' avviare Word, quel doppio clic si.
        file.push(...fileConversione(MESE));
        scarica(cartellaZip(file), `${nomeCartella(mese, anno)}.zip`);
        const vuoti = [...new Set(word.flatMap(w => w.vuoti))];
        const mancanoModelli = ['ferro', 'nave', 'extra', 'cssc'].filter(k => !m[k]);
        setEsito({ tipo: 'cartella', vuoti, word: word.length, mancanoModelli, nonTimbrati });
      }
      if (isAdmin) { await salvaBozza(); await caricaArchivi(); }
    } catch (e) {
      setErrore(e?.response?.data?.error || e.message || String(e));
    }
    setLavoro('');
  };

  // --- La registrazione ---
  const registra = async () => {
    setErrore('');
    let motivo = '';
    const precedente = pratiche.find(p => p.mese === mese && p.stato === 'registrata');
    if (precedente) {
      motivo = window.prompt(`${mese} e' gia' stato registrato (versione ${precedente.versione || 1}). Perche' lo rifai? La versione di prima resta nello storico con questo motivo.`, '') || '';
      if (!motivo.trim()) return;
    }
    setLavoro('registra');
    try {
      const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
      const utente = await base44.auth.me().catch(() => null);
      // In fondo alla nota, sempre, la frase fissa con l'extra raccolta compresa
      // nella quantita' (anche 0 kg): finche' DichiarazioneSito non ha un campo, e'
      // quella che i confronti per canale leggono per non contare l'extra come
      // rete (testoExtraCompresa, extraCompresaDaNota in src/lib/praticaIrigom.js).
      const nota = `${pratica.solo_metalli
        ? `Segnata nel gestionale il ${dataIt(oggi)} dal registro ${registro.file_nome}: nel mese sono usciti solo metalli ferrosi (${formatKg(riga.uscite_ferro_kg)} kg) e nessuna gomma. A portale non si carica nulla: il ferro si dichiara con la prossima uscita di gomma.`
        : `Preparata nel gestionale il ${dataIt(oggi)} dal registro ${registro.file_nome}: ${pratica.terziarie.righe.length} terziarie${terziarie.length ? ` (${terziarie[0]} - ${terziarie[terziarie.length - 1]})` : ''}, ${pratica.cssc.righe.length} dichiarazioni di CSS-C${nave.nome ? `, nave ${nave.nome}` : ''}; lettura dalla ${pratica.letture.usata === 'giacenza' ? 'giacenza a portale' : 'uscite del registro'}. ${testoPortale(pratica)}`} ${testoExtraCompresa(pratica.solo_metalli ? 0 : pratica.extra_kg)}`;
      // La dichiarazione di rete del mese: si aggiorna quella che c'e', con traccia di prima.
      const esistenti = await base44.entities.DichiarazioneSito.filter({ anno, mese });
      const suIrigom = (d) => normalizzaRagioneSociale(d.sito) === nsIrigom;
      const reteEsistente = esistenti.find(d => suIrigom(d) && (d.canale || 'RETE') === 'RETE' && !d.provenienza);
      // La quantita' e' il totale caricato a portale, extra raccolta dell'ultima
      // terziaria compresa, e cosi' i materiali (regola dell'utente del
      // 22/09/2026): e' quello che il portale decurta dalla giacenza di rete e che
      // il report delle dichiarazioni confronta, al chilo, per riconoscerla. La
      // parte di extra e' scritta nella nota e dichiarata anche sul suo canale:
      // gestita fuori portale, quella riga la chiude a mano l'utente.
      const campiRete = {
        quantita_kg: pratica.portale_kg, cippato_kg: pratica.materiali_portale.cippato_kg, metalli_kg: pratica.materiali_portale.metalli_kg, cssc_kg: pratica.materiali_portale.cssc_kg,
        motivo_assenza: pratica.solo_metalli ? 'solo_metalli' : '',
        ricevuta_email: !pratica.solo_metalli, ricevuta_il: pratica.solo_metalli ? '' : ((reteEsistente && reteEsistente.ricevuta_il) || oggi),
        note: [reteEsistente && reteEsistente.note, reteEsistente && reteEsistente.quantita_kg ? `Prima: ${formatKg(reteEsistente.quantita_kg)} kg; aggiornata il ${dataIt(oggi)}${motivo ? ` perche' ${motivo}` : ''}.` : '', nota].filter(Boolean).join('\n'),
      };
      const rete = reteEsistente
        ? await base44.entities.DichiarazioneSito.update(reteEsistente.id, campiRete)
        : await base44.entities.DichiarazioneSito.create({ sito: irigom ? irigom.sito : 'Irigom S.r.l.', operazione: 'R1', canale: 'RETE', provenienza: '', anno, mese, ...campiRete });
      // L'extra raccolta si scrive sul mese del formulario, canale a parte, con
      // l'anno del formulario: quella di dicembre partita con la nave di gennaio va
      // su dicembre dell'anno prima. Ogni mese vale quello che ci hanno scritto le
      // altre pratiche registrate piu' la parte di questa (dichiarazioniExtra): si
      // scriveva la sola parte dell'ultima pratica e quella di prima spariva dal
      // numero. Il ferro si divide in proporzione al peso. Il valore di prima resta
      // nella nota.
      if (pratica.extra) {
        for (const x of dichiarazioniExtra(pratica.extra, praticheDueAnni, { anno, mese })) {
          const giaExtra = (await base44.entities.DichiarazioneSito.filter({ anno: x.anno, mese: x.mese })).find(d => suIrigom(d) && d.canale === 'EXTRA_RACCOLTA');
          const prima = giaExtra && Number(giaExtra.quantita_kg) && Number(giaExtra.quantita_kg) !== x.quantita_kg
            ? `Prima: ${formatKg(giaExtra.quantita_kg)} kg; aggiornata il ${dataIt(oggi)}${motivo ? ` perche' ${motivo}` : ''}.` : '';
          const campiExtra = {
            quantita_kg: x.quantita_kg, cippato_kg: x.cippato_kg, metalli_kg: x.metalli_kg, ricevuta_email: true, ricevuta_il: (giaExtra && giaExtra.ricevuta_il) || oggi,
            note: [giaExtra && giaExtra.note, prima,
              `Dichiarata con la pratica di ${mese} ${anno}, terziaria ${pratica.extra.terziaria || '—'} (allegato VII ${pratica.extra.allegato}): ${formatKg(x.questa_kg)} kg${x.altre_kg ? `, piu' ${formatKg(x.altre_kg)} kg dichiarati con altre pratiche` : ''}.`].filter(Boolean).join('\n'),
          };
          if (giaExtra) await base44.entities.DichiarazioneSito.update(giaExtra.id, campiExtra);
          else await base44.entities.DichiarazioneSito.create({ sito: irigom ? irigom.sito : 'Irigom S.r.l.', operazione: 'R1', canale: 'EXTRA_RACCOLTA', provenienza: '', anno: x.anno, mese: x.mese, ...campiExtra });
        }
      }
      if (precedente) await base44.entities.PraticaIrigom.update(precedente.id, { stato: 'sostituita', motivo_sostituzione: motivo.trim() });
      await salvaBozza('registrata', {
        registrata_il: new Date().toISOString(), registrata_da: (utente && (utente.full_name || utente.email)) || '',
        dichiarazione_rete_id: rete && rete.id ? rete.id : (reteEsistente ? reteEsistente.id : ''),
      });
      await caricaArchivi();
      setEsito({ tipo: 'registrata' });
      if (onRegistrata) onRegistrata();
    } catch (e) {
      setErrore(e?.response?.data?.error || e.message || String(e));
    }
    setLavoro('');
  };

  const statoMese = (m) => {
    const p = pratiche.filter(x => x.mese === m && x.stato !== 'sostituita').sort((a, b) => (b.versione || 1) - (a.versione || 1))[0];
    const r = registro ? registro.mesi.find(x => x.mese === m) : null;
    const compilato = r && (r.uscite_cippato_kg || r.uscite_ferro_kg || r.uscite_cssc_kg || r.giacenza_cippato_kg);
    if (p && p.stato === 'registrata') return { classe: 'bg-emerald-600 text-white border-emerald-600', nota: 'registrata' };
    if (p) return { classe: 'bg-emerald-50 border-emerald-300 text-emerald-900', nota: 'in preparazione' };
    if (registro && !compilato) return { classe: 'text-muted-foreground', nota: 'non compilato' };
    return { classe: '', nota: '' };
  };

  const bloccata = !pratica || pratica.blocchi.length > 0;
  const mancaNave = pratica && pratica.terziarie.righe.length > 0 && (!nave.nome || !nave.partenza || !nave.porto);
  const mancanoTer = pratica && pratica.terziarie.righe.length > 0 && terziarie.length !== pratica.terziarie.righe.length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-muted-foreground max-w-4xl">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Le dichiarazioni di Irigom le prepariamo noi. Carica il registro di carico e scarico dell&apos;impianto e scegli il mese: il gestionale
          sceglie i formulari del ferro e gli allegati VII, calcola quanto dichiarare e ti dice quante terziarie aprire a portale. Poi gli dai
          i numeri delle terziarie, i dati della nave e i PDF che solo tu hai, e ti restituisce la cartella del mese pronta per il repository:
          i Word delle dichiarazioni, il riepilogo Excel col blocco del mese e gli allegati VII rinominati. Il registro e i PDF si leggono qui e
          non si conservano.
        </span>
      </div>

      <ModelliIrigom modelli={modelli} isAdmin={isAdmin} onCaricato={caricaArchivi} />

      {errore && <Avviso testo={errore} grave />}

      <Passo numero={1} titolo="Il registro e il mese" fatto={!!registro && !!mese}
        spiega="Il file dell'impianto, con i fogli Cons. e Dettaglio, e se vuoi già i PDF del mese: formulari del ferro, DDT del CSS-C, allegati VII. Si leggono nel browser.">
        <div {...trascina} className={`flex items-center gap-2 flex-wrap rounded-lg border border-dashed px-3 py-2.5 transition-colors ${sopra ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}`}>
          <input ref={inputRegistro} type="file" multiple className="hidden" accept=".xlsx,.xlsm,.xls,.pdf"
            onChange={e => { const f = [...(e.target.files || [])]; e.target.value = ''; aggiungiFile(f); }} />
          <Button variant={registro ? 'outline' : 'default'} disabled={caricando} onClick={() => inputRegistro.current && inputRegistro.current.click()}>
            {caricando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {registro ? 'Cambia registro o aggiungi PDF' : 'Carica il registro e i PDF'}
          </Button>
          <span className="text-xs text-muted-foreground">
            {registro ? registro.file_nome : 'oppure trascinali qui'}
            {documenti.length > 0 && ` · ${documenti.length} PDF${documenti.some(d => d.tipo === 'altro') ? `, ${documenti.filter(d => d.tipo === 'altro').length} da assegnare` : ''}`}
          </span>
        </div>
        {registro && registro.controlli.map((c, i) => <Avviso key={i} testo={c} />)}
        <div className="flex flex-wrap gap-1.5">
          {MESI.map(m => {
            const s = statoMese(m);
            return (
              <button key={m} type="button" onClick={() => scegliMese(m)} title={s.nota}
                className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${s.classe} ${mese === m ? 'ring-2 ring-primary ring-offset-1' : 'hover:bg-muted'}`}>
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {/* Senza registro e senza mese non c'e' nessuna pratica, quindi nemmeno i
            pulsanti: si vedono solo dopo, ed e' bene dirlo invece di lasciarli cercare. */}
        {!pratica && (
          <p className="text-xs text-muted-foreground">
            {registro
              ? 'Scegli il mese: sotto compaiono quanto dichiarare, quante terziarie aprire e i pulsanti per la cartella del mese, il blocco per il file di gestione e le esportazioni.'
              : 'Carica il registro e poi scegli il mese: solo allora compaiono la pratica e i pulsanti per la cartella del mese, il blocco per il file di gestione e le esportazioni.'}
          </p>
        )}
        {mese && !registro && praticaDelMese && (
          <p className="text-xs text-muted-foreground">
            {mese}: pratica {praticaDelMese.stato === 'registrata' ? 'registrata' : 'in preparazione'}
            {portaleSalvato(praticaDelMese) !== null
              ? `, a portale ${t(portaleSalvato(praticaDelMese))} t${praticaDelMese.extra_kg ? `, di cui rete ${t(praticaDelMese.rete_kg)} t ed extra raccolta ${t(praticaDelMese.extra_kg)} t` : ', tutte di rete'}`
              : `, dichiarati di rete ${t(praticaDelMese.rete_kg)} t${praticaDelMese.extra_kg ? ` ed extra raccolta ${t(praticaDelMese.extra_kg)} t a parte` : ''}`}
            . Carica il registro per rifarla o scaricare di nuovo i documenti.
          </p>
        )}
        {/* Sempre, appena gli archivi sono letti: un terminato senza fine trasporto
            si segnala comunque (regola del 22/09/2026), col registro o senza. */}
        {extraSenzaFine.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs space-y-0.5">
            <p className="font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {extraSenzaFine.length === 1
                ? 'Un\'extra raccolta terminata per Irigom non ha la fine del trasporto: senza non si colloca in nessun mese, quindi non si propone in nessuna pratica e non entra nei conti.'
                : `${extraSenzaFine.length} extra raccolte terminate per Irigom non hanno la fine del trasporto: senza non si collocano in nessun mese, quindi non si propongono in nessuna pratica e non entrano nei conti.`}
              {' '}Le date di immissione, inizio e fine trasporto sono obbligatorie: vanno sistemate nel formulario.
            </p>
            {extraSenzaFine.map(r => (
              <p key={r.id} className="flex flex-wrap gap-x-2 pl-5">
                <span className="font-mono">{r.numero_fir || r.id_ordine || '—'}</span>
                <span>{r.produttore || r.ragione_sociale || ''}</span>
                <span className="tabular-nums">{formatKg(r.peso_effettivo)} kg</span>
                <span>{testoDate(r)}</span>
              </p>
            ))}
          </div>
        )}
      </Passo>

      {pratica && (
        <>
          <Passo numero={2} titolo={`Quanto dichiarare per ${mese} ${anno}`} fatto={!bloccata}
            spiega="Ciabattato e CSS-C sono quelli usciti con i loro documenti; il ferro e' la parte che si aggiusta.">
            {pratica.blocchi.map((b, i) => <Avviso key={i} testo={b} grave />)}
            {!pratica.vuoto && (
              <>
                <div className="flex gap-2 flex-wrap">
                  {/* Le due letture danno il totale da caricare a portale, extra raccolta
                      partita con la nave compresa (regola del 22/09/2026). */}
                  <button type="button" className="text-left" onClick={() => setLettura('uscite')}>
                    <Riquadro titolo="Uscite del registro" valore={`${t(pratica.letture.uscite.totale_kg)} t`} tono={pratica.letture.usata === 'uscite' ? 'scelto' : ''}
                      nota={`ciabattato ${t(riga.uscite_cippato_kg)} + ferro ${t(riga.uscite_ferro_kg)} + CSS-C ${t(riga.uscite_cssc_kg)}${pratica.letture.uscite.extra_kg ? `, extra raccolta compresa` : ''}`} />
                  </button>
                  <button type="button" className="text-left" disabled={!pratica.letture.giacenza} onClick={() => setLettura('giacenza')}>
                    <Riquadro titolo="Giacenza a portale a fine mese" tono={pratica.letture.usata === 'giacenza' ? 'scelto' : ''}
                      valore={pratica.letture.giacenza ? `${t(pratica.letture.giacenza.totale_kg)} t` : 'non disponibile'}
                      nota={pratica.letture.giacenza ? `${t(pratica.letture.giacenza.portale_fine_mese_kg)} a portale meno ${t(pratica.letture.giacenza.resta_kg)} che devono restare (gomma AD + ferro AE del registro)${pratica.letture.giacenza.extra_in_giacenza_kg ? ` (tolti ${t(pratica.letture.giacenza.extra_in_giacenza_kg)} di extra raccolta ancora in impianto)` : ''}` : 'serve il file degli ordini non dichiarati'} />
                  </button>
                  {pratica.letture.scarto_kg !== null && (
                    <Riquadro titolo="Scarto fra le due letture" valore={`${pratica.letture.scarto_kg > 0 ? '+' : ''}${formatKg(pratica.letture.scarto_kg)} kg`}
                      tono={Math.abs(pratica.letture.scarto_kg) > 500 ? 'attenzione' : ''} nota="va capito prima di caricare" />
                  )}
                  <Riquadro titolo="Da dichiarare a portale" valore={`${t(pratica.portale_kg)} t`} tono="scelto"
                    nota={conExtra(pratica) ? `${formatKg(pratica.portale_kg)} kg, ${diCuiExtra(pratica)}` : `${formatKg(pratica.portale_kg)} kg, tutti di rete`} />
                </div>
                {portaleFineMese && (
                  <p className="text-xs text-muted-foreground">
                    Giacenza di rete a portale al {`31/${String(idx + 1).padStart(2, '0')}`}, per fine trasporto: {t(portaleFineMese.foto_kg)} t dal file del portale
                    {fotoPortaleIl ? ` del ${dataIt(fotoPortaleIl)}` : ''}{portaleFineMese.aggiunti_kg ? `, più ${t(portaleFineMese.aggiunti_kg)} t di carichi che il file non contiene ancora` : ''}
                    {portaleFineMese.dopo_kg ? `, meno ${t(portaleFineMese.dopo_kg)} t di dichiarazioni caricate dopo` : ''}.
                    {fotoPortaleIl && fotoPortaleIl < `${anno}-${String(idx + 1).padStart(2, '0')}-31` && idx >= 0 && fotoPortaleIl.slice(0, 7) <= `${anno}-${String(idx + 1).padStart(2, '0')}` ? ' La fotografia del portale non arriva alla fine del mese: carica il file degli ordini non dichiarati di oggi.' : ''}
                  </p>
                )}
                {pratica.avvisi.map((a, i) => <Avviso key={i} testo={a} />)}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="border rounded-lg overflow-hidden">
                    <p className="px-3 py-2 text-xs font-semibold bg-muted/30 border-b">Formulari del ferro · {formatKg(pratica.ferro.quota_kg)} kg nostri su {formatKg(pratica.ferro.esiti.reduce((s, f) => s + f.kg, 0))}</p>
                    <table className="w-full text-xs">
                      <tbody>
                        {pratica.ferro.esiti.map(f => (
                          <tr key={f.riga || f.formulario} className={`border-t ${f.quota_kg ? '' : 'text-muted-foreground'}`}>
                            <td className="px-3 py-1 font-mono">{f.formulario}</td>
                            <td className="px-2 py-1">{dataIt(f.data)}</td>
                            <td className="px-2 py-1">{f.destinatario}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{formatKg(f.kg)}</td>
                            <td className="px-2 py-1 text-right tabular-nums font-medium">{f.quota_kg ? formatKg(f.quota_kg) : '—'}</td>
                            <td className="px-2 py-1 text-[11px]">{f.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3">
                    {pratica.cssc.righe.length > 0 && (
                      <div className="border rounded-lg px-3 py-2 text-xs">
                        <p className="font-semibold mb-1">CSS-C · {pratica.cssc.righe.length} {pratica.cssc.righe.length === 1 ? 'dichiarazione' : 'dichiarazioni'}</p>
                        {pratica.cssc.righe.map((d, i) => <p key={i} className="tabular-nums">{d.ddt}{d.parte ? ` (parte ${d.parte})` : ''} del {dataIt(d.data)}: {formatKg(d.cssc_kg)} + {formatKg(d.ferro_kg)} di ferro = {formatKg(d.totale_kg)} kg</p>)}
                      </div>
                    )}
                    {pratica.terziarie.righe.length > 0 && (
                      <div className="border rounded-lg px-3 py-2 text-xs space-y-1">
                        <p className="font-semibold">Allegati VII scelti: {pratica.allegati.scelti.map(a => a.numero).join(', ')}</p>
                        <p className="text-muted-foreground">
                          La combinazione più vicina al ciabattato uscito, cercata fra {pratica.allegati.bacino === 'SMOCO' ? 'i soli allegati di SMOCO' : pratica.allegati.bacino === 'SMOCO e TRANSAR' ? 'gli allegati di SMOCO e TRANSAR, perché i soli SMOCO non bastavano' : pratica.allegati.bacino === 'tutti i trasportatori' ? 'tutti gli allegati, perché SMOCO e TRANSAR non bastavano' : 'gli allegati del mese'}:
                          {' '}{formatKg(pratica.allegati.coperto_kg)} kg per {formatKg(riga.uscite_cippato_kg)} da coprire{pratica.allegati.scarto_kg > 0 ? `, ${formatKg(pratica.allegati.scarto_kg)} kg in più che restano fuori dall'ultima terziaria` : ', esatti'}.
                          {' '}Su {pratica.allegati.ordinati.length} allegati del mese.
                        </p>
                        <p className="text-sm pt-1 flex items-center gap-2 text-primary font-medium">
                          <ClipboardCheck className="w-4 h-4" /> Apri a portale {pratica.terziarie_da_aprire} {pratica.terziarie_da_aprire === 1 ? 'terziaria' : 'terziarie'} da Irigom, con peso indicativo 1 kg.
                        </p>
                      </div>
                    )}
                    {/* Qui solo le proposte: i terminati senza fine trasporto stanno nel passo 1. */}
                    {extraCandidati.length > 0 && (
                      <div className="border rounded-lg px-3 py-2 text-xs space-y-1.5">
                        <p className="font-semibold">Extra raccolta arrivata a Irigom e non ancora dichiarata</p>
                        {extraCandidati.map(r => (
                          <div key={r.id}>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={sceltiExtra.has(r.id)} onChange={e => {
                                const s = new Set(sceltiExtra);
                                if (e.target.checked) s.add(r.id); else s.delete(r.id);
                                setExtraScelti(s);
                              }} />
                              <span className="font-mono">{r.numero_fir || '—'}</span>
                              <span>{dataIt(giornoMovimento(r))}</span>
                              <span>{r.produttore || r.ragione_sociale}</span>
                              {dichiarataAMano(r) && <span className="text-muted-foreground">già dichiarata nel suo mese</span>}
                              <span className="tabular-nums ml-auto">{formatKg(r.peso_effettivo)} kg</span>
                            </label>
                            {dateDaSistemare(r) && (
                              <p className="ml-6 text-amber-800 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />Date del formulario da sistemare: {testoDate(r)}.</p>
                            )}
                          </div>
                        ))}
                        {extra && (
                          <p className="flex items-center gap-2 flex-wrap pt-1">
                            Ferro sul totale:
                            <input value={quotaFerroExtra} onChange={e => setQuotaFerroExtra(e.target.value)} className="w-14 border rounded px-1.5 py-0.5 text-right tabular-nums" />%
                            <span className="text-muted-foreground">= {formatKg(extra.cippato_kg)} kg di ciabattato e {formatKg(extra.ferro_kg)} di ferro. Partono con la nave nell&apos;ultima terziaria, che a portale si chiude col peso intero; nei documenti e nel riepilogo restano in una riga a parte. La ripartizione la dà l&apos;impianto: correggila se ti ha dato numeri diversi.</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </Passo>

          {!pratica.vuoto && (
            <Passo numero={3} titolo="Terziarie, nave e documenti" fatto={!mancanoTer && !mancaNave && richiesti.every(r => r.file)}
              spiega="Quello che il gestionale non può sapere da solo. I PDF restano nel browser: servono a controllarli e a metterli, rinominati, nella cartella del mese.">
              <div className="grid gap-4 lg:grid-cols-3">
                {pratica.terziarie.righe.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">Numeri delle terziarie aperte a portale</p>
                    <textarea value={terziarieTesto} onChange={e => setTerziarieTesto(e.target.value)} rows={6} placeholder="TER26153987&#10;TER26153994&#10;…"
                      className="w-full border rounded-md px-2 py-1.5 text-xs font-mono" />
                    <p className={`text-xs ${mancanoTer ? 'text-amber-700' : 'text-emerald-700'}`}>{terziarie.length} di {pratica.terziarie.righe.length}: in ordine crescente vanno agli allegati nell&apos;ordine di scelta.</p>
                  </div>
                )}
                {pratica.terziarie.righe.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold flex items-center gap-1"><Ship className="w-3.5 h-3.5" /> La nave del mese</p>
                    {[['nome', 'Nome, senza MV'], ['imo', 'IMO'], ['porto', 'Porto di partenza'], ['partenza', 'Partenza, gg/mm/aaaa'], ['cementeria', 'Cementeria (campo 7 dell\'allegato VII)']].map(([k, etichetta]) => (
                      <input key={k} value={nave[k] || ''} onChange={e => setNave(x => ({ ...x, [k]: e.target.value }))} placeholder={etichetta}
                        className="w-full border rounded-md px-2 py-1 text-xs" />
                    ))}
                    <p className="text-[11px] text-muted-foreground">Proposti dall&apos;ultima pratica: controllali sull&apos;allegato VII.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold flex items-center gap-1"><FileCheck2 className="w-3.5 h-3.5" /> Documenti</p>
                  <input ref={inputDocumenti} type="file" multiple accept=".pdf,.xlsx,.xlsm,.xls" className="hidden"
                    onChange={e => { const f = [...(e.target.files || [])]; e.target.value = ''; aggiungiFile(f); }} />
                  <div {...trascina} className={`rounded-md border border-dashed px-2 py-1.5 flex items-center gap-2 transition-colors ${sopra ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}`}>
                    <Button size="sm" variant="outline" onClick={() => inputDocumenti.current && inputDocumenti.current.click()}>
                      <Upload className="w-3.5 h-3.5 mr-1" /> Aggiungi i PDF
                    </Button>
                    <span className="text-[11px] text-muted-foreground">o trascinali qui</span>
                  </div>
                  <ul className="text-xs space-y-0.5 max-h-48 overflow-y-auto">
                    {richiesti.map(r => (
                      <li key={`${r.tipo}-${r.chiave}`} className="flex items-center gap-1.5">
                        {r.file ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span className={r.file ? '' : 'text-muted-foreground'}>{r.nome}</span>
                      </li>
                    ))}
                    {navePresente && <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />File intero della nave</li>}
                    {documenti.filter(d => d.tipo === 'altro').map(d => (
                      <li key={d.nome} className="text-amber-800 pt-1">
                        <span className="block truncate" title={d.nome}>{d.nome}</span>
                        <select defaultValue="" onChange={e => e.target.value && assegna(d.nome, e.target.value)} className="mt-0.5 w-full border rounded px-1 py-0.5 text-xs bg-background text-foreground">
                          <option value="">Non riconosciuto dal nome: che documento è?</option>
                          {richiesti.filter(r => !r.file).map(r => <option key={`${r.tipo}-${r.chiave}`} value={`${r.tipo}|${r.chiave}`}>{r.nome}</option>)}
                          {pratica.terziarie.righe.length > 0 && !navePresente && <option value="nave|">File intero degli allegati VII della nave</option>}
                        </select>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 text-xs pt-1">
                    Data della lettera <input value={dataLettera} onChange={e => setDataLettera(e.target.value)} className="w-28 border rounded px-1.5 py-0.5" />
                  </label>
                </div>
              </div>
            </Passo>
          )}

          {!pratica.vuoto && (
            <Passo numero={4} titolo="La cartella del mese e la registrazione" fatto={praticaDelMese && praticaDelMese.stato === 'registrata'}
              spiega="La cartella ha la stessa forma della cartella del mese nel repository. I Word si convertono in PDF da Word, Salva con nome.">
              {pratica.terziarie.righe.length > 0 && (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        {['Terziaria', 'Allegato VII', 'Peso allegato', 'Ciabattato', 'Ferro', 'Chiudi a portale con', 'Resta a 38.000'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Ciabattato e ferro sono la parte di rete, come nei documenti; la
                          colonna di chiusura e' il peso con cui si chiude a portale, che per
                          l'ultima comprende l'extra raccolta (regola del 22/09/2026). */}
                      {pratica.terziarie.righe.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1 font-mono">{r.terziaria || <span className="text-muted-foreground">da indicare</span>}</td>
                          <td className="px-2 py-1 tabular-nums">{r.allegato}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(r.peso_allegato_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(r.cippato_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(r.ferro_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">
                            <span className="font-semibold">{formatKg(r.chiusura_portale_kg)} kg</span>
                            {r.extra_kg > 0 && <span className="block text-[11px] text-amber-800">{formatKg(r.totale_kg)} di rete + {formatKg(r.extra_kg)} di extra raccolta</span>}
                          </td>
                          <td className="px-2 py-1 tabular-nums text-muted-foreground">{formatKg(r.residuo_kg)}</td>
                        </tr>
                      ))}
                      {pratica.extra && (
                        <tr className="border-t bg-amber-50/60">
                          <td className="px-2 py-1 font-mono">{pratica.extra.terziaria || '—'}</td>
                          <td className="px-2 py-1 tabular-nums">{pratica.extra.allegato}</td>
                          <td className="px-2 py-1">extra raccolta</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(pratica.extra.cippato_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(pratica.extra.ferro_kg)}</td>
                          <td className="px-2 py-1" colSpan={2}>
                            <span className="tabular-nums">{formatKg(pratica.extra.totale_kg)} kg</span> di extra raccolta, compresi nella chiusura
                            {pratica.extra.terziaria ? ` della terziaria ${pratica.extra.terziaria}` : ' di questa terziaria'} ({formatKg(pratica.extra.chiusura_terziaria_kg)} kg); dichiarati a parte, sul canale extra raccolta
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="px-2 py-1" colSpan={5}>Terziarie a portale</td>
                        <td className="px-2 py-1 tabular-nums">{formatKg(pratica.terziarie.chiusura_portale_kg)} kg</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              {pratica.solo_metalli && (
                <p className="text-sm rounded-lg border border-sky-200 bg-sky-50 text-sky-900 px-3 py-2">
                  Nel mese sono usciti solo metalli ferrosi ({formatKg(riga.uscite_ferro_kg)} kg) e nessuna gomma: a portale non si carica nulla. Registrandolo, il mese
                  risulta <strong>solo metalli ferrosi</strong> nel riepilogo; il ferro si dichiara con la prossima uscita di gomma.
                </p>
              )}
              <div className="flex flex-wrap gap-2 text-sm">
                <Riquadro titolo="Totale a portale" valore={`${formatKg(pratica.portale_kg)} kg`} tono="scelto"
                  nota={conExtra(pratica) ? `CSS-C + terziarie, ${diCuiExtra(pratica)}` : 'CSS-C + terziarie, tutti di rete'} />
                {conExtra(pratica) && (
                  <>
                    <Riquadro titolo="di cui rete" valore={`${formatKg(pratica.rete_kg)} kg`} nota="CSS-C + terziarie senza l'extra: riga IRIGOM del riepilogo" />
                    <Riquadro titolo="di cui extra raccolta" valore={`${formatKg(pratica.extra_kg)} kg`} nota="a parte: riga EXTRA RACCOLTA, sul mese del formulario" />
                  </>
                )}
              </div>
              {!pratica.solo_metalli && pratica.portale_kg > 0 && (
                <p className="text-xs text-muted-foreground max-w-4xl">
                  Registrando, la dichiarazione di rete di Irigom di {mese} si scrive con {formatKg(pratica.portale_kg)} kg, quelli che carichi a portale: il report
                  delle dichiarazioni la riconosce da questo peso.
                  {conExtra(pratica) && ` Nella nota resta scritto che ${formatKg(pratica.extra_kg)} kg sono extra raccolta ${quale(pratica.chiusura_ultima_terziaria)}, e in fondo ${testoExtraCompresa(pratica.extra_kg)}, perche' i confronti per canale non li contino come rete; l'extra raccolta si scrive anche a parte, sul suo canale e sul mese del formulario, e quella riga la chiudi tu: a portale non si distingue.`}
                </p>
              )}
              {mancaNave && <Avviso testo="Mancano i dati della nave: la dichiarazione del ciabattato li usa." />}
              {/* Le date obbligatorie dei formulari dell'extra, anche qui accanto ai documenti (regola del 22/09/2026). */}
              {pratica.extra && (pratica.extra.avvisi_date || []).map((a, i) => <Avviso key={`date-${i}`} testo={a} />)}
              {mancanoTer && <Avviso testo={`Servono ${pratica.terziarie.righe.length} numeri di terziaria: senza, nei documenti la colonna resta vuota.`} />}
              <div className="flex flex-wrap gap-2">
                <Button disabled={bloccata || !!lavoro} onClick={() => scaricaCartella(false)}>
                  {lavoro === 'cartella' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderDown className="w-4 h-4 mr-2" />} Scarica la cartella del mese
                </Button>
                <Button variant="outline" disabled={bloccata || !!lavoro} onClick={() => scaricaCartella(true)}>
                  {lavoro === 'excel' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />} Solo il riepilogo Excel
                </Button>
                <input ref={inputGestione} type="file" accept=".xlsx,.xlsm" className="hidden"
                  onChange={e => { const file = (e.target.files || [])[0]; e.target.value = ''; scriviNelFileGestione(file); }} />
                <Button variant="outline" disabled={bloccata || !!lavoro} onClick={() => inputGestione.current && inputGestione.current.click()}
                  title="Carica qui il file di gestione: te lo riscarichi con il blocco del mese gia' scritto in fondo al foglio DICHIARAZIONI, coi colori dei mesi di prima. Il tuo file non viene toccato: quello che scarichi e' una copia nuova">
                  {lavoro === 'gestione' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Scrivi nel file di gestione
                </Button>
                <Button variant="outline" disabled={bloccata || !!lavoro} onClick={scaricaBlocco}
                  title="Le righe del mese come vanno nel foglio DICHIARAZIONI del file di gestione: si copiano e si incollano in coda al foglio, da qualunque computer">
                  {lavoro === 'blocco' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />} Blocco per il file di gestione
                </Button>
                <Button variant="outline" disabled={!!lavoro} onClick={esportaFoglio}
                  title="Il foglio DICHIARAZIONI rifatto con quello che il gestionale sa: i mesi preparati qui, col riepilogo in alto. Quelli che non ha li elenca a parte">
                  {lavoro === 'foglio' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />} Esporta il foglio DICHIARAZIONI
                </Button>
                {isAdmin && (
                  <Button variant="outline" disabled={bloccata || !!lavoro || mancanoTer} onClick={registra}
                    title={`Scrive la dichiarazione del mese nel gestionale col totale a portale, ${formatKg(pratica.portale_kg)} kg, come dichiarazione in mano: diventa caricata quando il report del portale la riconosce`}>
                    {lavoro === 'registra' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} {pratica.solo_metalli ? `Segna ${mese}: solo metalli ferrosi` : `Registra la dichiarazione di ${mese}`}
                  </Button>
                )}
              </div>
              {esito && esito.tipo === 'cartella' && (
                <div className="text-xs border rounded-lg px-3 py-2 bg-muted/30 space-y-0.5">
                  <p><CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />Cartella scaricata: {esito.word} Word, il riepilogo Excel e i PDF forniti.</p>
                  {esito.mancanoModelli.length > 0 && <p className="text-amber-700">Mancano i modelli per: {esito.mancanoModelli.join(', ')}. Caricali qui sopra.</p>}
                  {esito.vuoti.length > 0 && <p className="text-amber-700">Nei Word sono rimasti da riempire: {esito.vuoti.join(', ')}.</p>}
                  {(esito.nonTimbrati || []).length > 0 && <p className="text-amber-700">Su questi allegati non sono riuscito a scrivere il numero della terziaria (il file ha comunque il nome giusto): {esito.nonTimbrati.join(', ')}.</p>}
                </div>
              )}
              {esito && esito.tipo === 'blocco' && (
                <p className="text-xs text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />Blocco scaricato: nel foglio BLOCCO ci sono le righe da copiare, nel foglio "Come si incolla" i passi e le due celle del riepilogo da scrivere a mano.</p>
              )}
              {esito && esito.tipo === 'gestione' && (
                <div className="text-xs border rounded-lg px-3 py-2 bg-muted/30 space-y-0.5">
                  <p><CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />
                    Scaricato <strong>{esito.nome}</strong> con il blocco di {mese} dalla riga {esito.riga_inizio} alla {esito.riga_fine}
                    {esito.riepilogo && esito.riepilogo.colonna ? `; riepilogo in colonna ${esito.riepilogo.colonna}, riga ${esito.riepilogo.riga_irigom}` : ''}.
                  </p>
                  <p className="text-muted-foreground">Il file che avevi non è stato toccato: controlla quello scaricato e poi sostituiscilo tu.</p>
                  {(esito.avvisi || []).map((a, i) => <p key={i} className="text-amber-700">{a}</p>)}
                </div>
              )}
              {esito && esito.tipo === 'foglio' && (
                <p className="text-xs text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />Foglio DICHIARAZIONI esportato: nel secondo foglio ci sono i mesi che il gestionale ha e quelli che gli mancano.</p>
              )}
              {esito && esito.tipo === 'registrata' && (
                <p className="text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />Registrata: la dichiarazione di {mese} è nel gestionale, in mano. Diventa caricata quando la carichi a portale e il report delle dichiarazioni la riconosce.</p>
              )}
            </Passo>
          )}
        </>
      )}
    </div>
  );
}

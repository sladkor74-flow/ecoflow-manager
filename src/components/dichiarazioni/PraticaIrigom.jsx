import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertTriangle, Info, FileSpreadsheet, FolderDown, CheckCircle2, Ship, FileCheck2, Circle, ClipboardCheck } from 'lucide-react';
import { formatKg, formatTonnellate } from '@/lib/utils';
import { usePermessi } from '@/lib/permessi';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { giornoRoma } from '@/lib/giornoItaliano';
import { leggiRegistroIrigom } from '@/lib/registroIrigom';
import { componiMese, dividiExtra, MESI } from '@/lib/praticaIrigom';
import { wordDelMese, excelDelMese, cartellaZip, dataIt } from '@/lib/documentiIrigom';
import { scarica } from '@/lib/docxModello';
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
      const [p, m, e] = await Promise.all([
        base44.entities.PraticaIrigom.filter({ anno }),
        base44.entities.ModelloDocumento.list(),
        base44.entities.ExtraRaccolta.list('-trasporto_finito_il', 500),
      ]);
      setPratiche(p || []);
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
  const ultimaRegistrata = useMemo(() => pratiche
    .filter(p => p.stato === 'registrata')
    .sort((a, b) => MESI.indexOf(b.mese) - MESI.indexOf(a.mese))[0] || null, [pratiche]);

  // Scegliendo un mese si riparte da quello che la pratica aveva gia'; se non c'e',
  // la nave e la ripartizione dell'extra si propongono come l'ultima volta.
  const scegliMese = (m) => {
    setMese(m);
    setEsito(null);
    setDocumenti([]);
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
  const giaDichiarate = useMemo(() => {
    const s = new Set();
    for (const p of pratiche) {
      if (p.stato !== 'registrata' || p.mese === mese) continue;
      try { for (const f of (JSON.parse(p.extra_json || '{}').formulari || [])) s.add(f.id); } catch (e) { /* niente */ }
    }
    return s;
  }, [pratiche, mese]);
  // Per fine trasporto, sul giorno italiano: fino all'ultimo giorno del mese che si dichiara.
  const extraCandidati = useMemo(() => extraArchivio.filter(r => {
    const giorno = giornoRoma(r.trasporto_finito_il);
    return String(r.stato || '').toLowerCase() === 'terminato'
      && normalizzaRagioneSociale(r.destinazione) === nsIrigom
      && giorno.startsWith(String(anno))
      && (idx < 0 || giorno <= `${anno}-${String(idx + 1).padStart(2, '0')}-31`)
      && !giaDichiarate.has(r.id);
  }), [extraArchivio, nsIrigom, anno, idx, giaDichiarate]);
  // Un'extra raccolta il cui mese ha gia' una dichiarazione scritta a mano non si
  // propone di nuovo: si vede, e la si spunta solo se va rifatta.
  const dichiarataAMano = useCallback((r) => {
    const flusso = (irigom && irigom.flussi || []).find(f => f.canale === 'EXTRA_RACCOLTA');
    const g = giornoRoma(r.trasporto_finito_il);
    const m = flusso && g ? flusso.mesi[Number(g.slice(5, 7)) - 1] : null;
    return !!(m && m.dichiarazione && m.dichiarazione.quantita_kg > 0 && !String(m.dichiarazione.note || '').includes(`pratica di ${mese}`));
  }, [irigom, mese]);
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
      rete_kg: pratica.rete_kg, extra_kg: pratica.extra_kg,
      cippato_kg: pratica.materiali.cippato_kg, metalli_kg: pratica.materiali.metalli_kg, cssc_kg: pratica.materiali.cssc_kg,
      terziarie, data_lettera: dataLettera,
      nave_json: JSON.stringify(nave),
      extra_json: JSON.stringify(extra ? { formulari: extra.formulari, cippato_kg: extra.cippato_kg, ferro_kg: extra.ferro_kg, quota_ferro: extra.quota_ferro } : {}),
      dati_json: JSON.stringify({ ...pratica, allegati: { scelti: pratica.allegati.scelti, coperto_kg: pratica.allegati.coperto_kg } }),
      documenti_json: JSON.stringify(richiesti.map(r => ({ tipo: r.tipo, chiave: r.chiave, file: r.file ? r.file.nome : '' }))),
      ...extraCampi,
    };
    if (praticaDelMese && praticaDelMese.stato === 'in_preparazione') return base44.entities.PraticaIrigom.update(praticaDelMese.id, dati);
    return base44.entities.PraticaIrigom.create({ ...dati, versione: praticaDelMese ? (praticaDelMese.versione || 1) + 1 : 1 });
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
        // I PDF forniti, dove li vuole il repository; gli allegati VII anche col
        // numero della terziaria, come si caricano a portale.
        for (const d of documenti) {
          const bytes = new Uint8Array(await d.file.arrayBuffer());
          if (d.tipo === 'formulario') file.push({ percorso: `${MESE}/FERRO/${d.chiave}.pdf`, bytes });
          else if (d.tipo === 'ddt') file.push({ percorso: `${MESE}/CSS-C/DOC/DDT ${d.chiave}.pdf`, bytes });
          else if (d.tipo === 'nave') file.push({ percorso: `${MESE}/EXPORT/ALLEGATI VII/ANNEX VII NAVE/${d.nome}`, bytes });
          else if (d.tipo === 'allegato') {
            file.push({ percorso: `${MESE}/EXPORT/ALLEGATI VII/${d.nome}`, bytes });
            const r = pratica.terziarie.righe.find(x => String(x.allegato) === d.chiave);
            if (r && r.terziaria) file.push({ percorso: `${MESE}/EXPORT/TERZIARIE/${r.terziaria}.pdf`, bytes });
          } else file.push({ percorso: `${MESE}/ALTRI/${d.nome}`, bytes });
        }
        scarica(cartellaZip(file), `${nomeCartella(mese, anno)}.zip`);
        const vuoti = [...new Set(word.flatMap(w => w.vuoti))];
        const mancanoModelli = ['ferro', 'nave', 'extra', 'cssc'].filter(k => !m[k]);
        setEsito({ tipo: 'cartella', vuoti, word: word.length, mancanoModelli });
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
      const nota = `Preparata nel gestionale il ${dataIt(oggi)} dal registro ${registro.file_nome}: ${pratica.terziarie.righe.length} terziarie${terziarie.length ? ` (${terziarie[0]} - ${terziarie[terziarie.length - 1]})` : ''}, ${pratica.cssc.righe.length} dichiarazioni di CSS-C${nave.nome ? `, nave ${nave.nome}` : ''}; lettura dalla ${pratica.letture.usata === 'giacenza' ? 'giacenza a portale' : 'uscite del registro'}.`;
      // La dichiarazione di rete del mese: si aggiorna quella che c'e', con traccia di prima.
      const esistenti = await base44.entities.DichiarazioneSito.filter({ anno, mese });
      const suIrigom = (d) => normalizzaRagioneSociale(d.sito) === nsIrigom;
      const reteEsistente = esistenti.find(d => suIrigom(d) && (d.canale || 'RETE') === 'RETE' && !d.provenienza);
      const campiRete = {
        quantita_kg: pratica.rete_kg, cippato_kg: pratica.materiali.cippato_kg, metalli_kg: pratica.materiali.metalli_kg, cssc_kg: pratica.materiali.cssc_kg,
        ricevuta_email: true, ricevuta_il: (reteEsistente && reteEsistente.ricevuta_il) || oggi,
        note: [reteEsistente && reteEsistente.note, reteEsistente && reteEsistente.quantita_kg ? `Prima: ${formatKg(reteEsistente.quantita_kg)} kg; aggiornata il ${dataIt(oggi)}${motivo ? ` perche' ${motivo}` : ''}.` : '', nota].filter(Boolean).join('\n'),
      };
      const rete = reteEsistente
        ? await base44.entities.DichiarazioneSito.update(reteEsistente.id, campiRete)
        : await base44.entities.DichiarazioneSito.create({ sito: irigom ? irigom.sito : 'Irigom S.r.l.', operazione: 'R1', canale: 'RETE', provenienza: '', anno, mese, ...campiRete });
      // L'extra raccolta si scrive sul mese del formulario, canale a parte.
      if (pratica.extra) {
        const perMese = new Map();
        for (const f of pratica.extra.formulari) {
          const m = MESI[Number(String(f.fine_trasporto).slice(5, 7)) - 1];
          perMese.set(m, (perMese.get(m) || 0) + f.peso_kg);
        }
        for (const [m, pfu] of perMese) {
          const quota = pfu / pratica.extra.totale_kg;
          const ferro = Math.round(pratica.extra.ferro_kg * quota);
          const giaExtra = (await base44.entities.DichiarazioneSito.filter({ anno, mese: m })).find(d => suIrigom(d) && d.canale === 'EXTRA_RACCOLTA');
          const campiExtra = {
            quantita_kg: pfu, cippato_kg: pfu - ferro, metalli_kg: ferro, ricevuta_email: true, ricevuta_il: (giaExtra && giaExtra.ricevuta_il) || oggi,
            note: [giaExtra && giaExtra.note, `Dichiarata con la pratica di ${mese} ${anno}, terziaria ${pratica.extra.terziaria || '—'} (allegato VII ${pratica.extra.allegato}).`].filter(Boolean).join('\n'),
          };
          if (giaExtra) await base44.entities.DichiarazioneSito.update(giaExtra.id, campiExtra);
          else await base44.entities.DichiarazioneSito.create({ sito: irigom ? irigom.sito : 'Irigom S.r.l.', operazione: 'R1', canale: 'EXTRA_RACCOLTA', provenienza: '', anno, mese: m, ...campiExtra });
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
        spiega="Il file dell'impianto, con i fogli Cons. e Dettaglio. Si legge nel browser.">
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={inputRegistro} type="file" className="hidden" accept=".xlsx,.xlsm,.xls"
            onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) caricaRegistro(f); }} />
          <Button variant={registro ? 'outline' : 'default'} disabled={caricando} onClick={() => inputRegistro.current && inputRegistro.current.click()}>
            {caricando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {registro ? 'Cambia registro' : 'Carica il registro Irigom'}
          </Button>
          {registro && <span className="text-xs text-muted-foreground">{registro.file_nome}</span>}
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
        {mese && !registro && praticaDelMese && (
          <p className="text-xs text-muted-foreground">
            {mese}: pratica {praticaDelMese.stato === 'registrata' ? 'registrata' : 'in preparazione'}, dichiarati di rete {t(praticaDelMese.rete_kg)} t
            {praticaDelMese.extra_kg ? ` ed extra raccolta ${t(praticaDelMese.extra_kg)} t a parte` : ''}. Carica il registro per rifarla o scaricare di nuovo i documenti.
          </p>
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
                  <button type="button" className="text-left" onClick={() => setLettura('uscite')}>
                    <Riquadro titolo="Uscite del registro" valore={`${t(pratica.letture.uscite.rete_kg)} t`} tono={pratica.letture.usata === 'uscite' ? 'scelto' : ''}
                      nota={`ciabattato ${t(riga.uscite_cippato_kg)} + ferro ${t(riga.uscite_ferro_kg)} + CSS-C ${t(riga.uscite_cssc_kg)}${extra ? `, extra a parte` : ''}`} />
                  </button>
                  <button type="button" className="text-left" disabled={!pratica.letture.giacenza} onClick={() => setLettura('giacenza')}>
                    <Riquadro titolo="Giacenza a portale a fine mese" tono={pratica.letture.usata === 'giacenza' ? 'scelto' : ''}
                      valore={pratica.letture.giacenza ? `${t(pratica.letture.giacenza.rete_kg)} t` : 'non disponibile'}
                      nota={pratica.letture.giacenza ? `${t(pratica.letture.giacenza.portale_kg)} a portale meno ${t(pratica.letture.giacenza.resta_kg)} che devono restare (gomma AD + ferro AE del registro)${pratica.letture.giacenza.extra_in_giacenza_kg ? ` (tolti ${t(pratica.letture.giacenza.extra_in_giacenza_kg)} di extra raccolta ancora in impianto)` : ''}` : 'serve il file degli ordini non dichiarati'} />
                  </button>
                  {pratica.letture.scarto_kg !== null && (
                    <Riquadro titolo="Scarto fra le due letture" valore={`${pratica.letture.scarto_kg > 0 ? '+' : ''}${formatKg(pratica.letture.scarto_kg)} kg`}
                      tono={Math.abs(pratica.letture.scarto_kg) > 500 ? 'attenzione' : ''} nota="va capito prima di caricare" />
                  )}
                  <Riquadro titolo="Da dichiarare, rete" valore={`${t(pratica.rete_kg)} t`} tono="scelto" nota={`${formatKg(pratica.rete_kg)} kg`} />
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
                        <p className="text-muted-foreground">Prima quelli trasportati da SMOCO, poi TRANSAR, poi gli altri, finché coprono il ciabattato uscito: {formatKg(pratica.allegati.coperto_kg)} kg per {formatKg(riga.uscite_cippato_kg)}.</p>
                        <p className="text-sm pt-1 flex items-center gap-2 text-primary font-medium">
                          <ClipboardCheck className="w-4 h-4" /> Apri a portale {pratica.terziarie_da_aprire} {pratica.terziarie_da_aprire === 1 ? 'terziaria' : 'terziarie'} da Irigom, con peso indicativo 1 kg.
                        </p>
                      </div>
                    )}
                    {extraCandidati.length > 0 && (
                      <div className="border rounded-lg px-3 py-2 text-xs space-y-1.5">
                        <p className="font-semibold">Extra raccolta arrivata a Irigom e non ancora dichiarata</p>
                        {extraCandidati.map(r => (
                          <label key={r.id} className="flex items-center gap-2">
                            <input type="checkbox" checked={sceltiExtra.has(r.id)} onChange={e => {
                              const s = new Set(sceltiExtra);
                              if (e.target.checked) s.add(r.id); else s.delete(r.id);
                              setExtraScelti(s);
                            }} />
                            <span className="font-mono">{r.numero_fir || '—'}</span>
                            <span>{dataIt(giornoRoma(r.trasporto_finito_il))}</span>
                            <span>{r.produttore || r.ragione_sociale}</span>
                            {dichiarataAMano(r) && <span className="text-muted-foreground">già dichiarata nel suo mese</span>}
                            <span className="tabular-nums ml-auto">{formatKg(r.peso_effettivo)} kg</span>
                          </label>
                        ))}
                        {extra && (
                          <p className="flex items-center gap-2 flex-wrap pt-1">
                            Ferro sul totale:
                            <input value={quotaFerroExtra} onChange={e => setQuotaFerroExtra(e.target.value)} className="w-14 border rounded px-1.5 py-0.5 text-right tabular-nums" />%
                            <span className="text-muted-foreground">= {formatKg(extra.cippato_kg)} kg di ciabattato e {formatKg(extra.ferro_kg)} di ferro, sull&apos;ultima terziaria e in una tabella a parte. La ripartizione la dà l&apos;impianto: correggila se ti ha dato numeri diversi.</span>
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
              spiega="Quello che il gestionale non può sapere da solo. I PDF non si caricano da nessuna parte: servono a controllarli e a metterli nella cartella del mese.">
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
                  <input ref={inputDocumenti} type="file" multiple accept=".pdf" className="hidden"
                    onChange={e => { const f = e.target.files; if (f && f.length) aggiungiDocumenti(f); e.target.value = ''; }} />
                  <Button size="sm" variant="outline" onClick={() => inputDocumenti.current && inputDocumenti.current.click()}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Aggiungi i PDF
                  </Button>
                  <ul className="text-xs space-y-0.5 max-h-48 overflow-y-auto">
                    {richiesti.map(r => (
                      <li key={`${r.tipo}-${r.chiave}`} className="flex items-center gap-1.5">
                        {r.file ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span className={r.file ? '' : 'text-muted-foreground'}>{r.nome}</span>
                      </li>
                    ))}
                    {navePresente && <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />File intero della nave</li>}
                    {documenti.filter(d => d.tipo === 'altro').map(d => <li key={d.nome} className="text-amber-700">Non riconosciuto dal nome: {d.nome}</li>)}
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
                      {pratica.terziarie.righe.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1 font-mono">{r.terziaria || <span className="text-muted-foreground">da indicare</span>}</td>
                          <td className="px-2 py-1 tabular-nums">{r.allegato}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(r.peso_allegato_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(r.cippato_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(r.ferro_kg)}</td>
                          <td className="px-2 py-1 tabular-nums font-semibold">{formatKg(r.totale_kg)} kg</td>
                          <td className="px-2 py-1 tabular-nums text-muted-foreground">{formatKg(r.residuo_kg)}</td>
                        </tr>
                      ))}
                      {pratica.extra && (
                        <tr className="border-t bg-amber-50/60">
                          <td className="px-2 py-1 font-mono">{pratica.extra.terziaria || '—'}</td>
                          <td className="px-2 py-1 tabular-nums">{pratica.extra.allegato}</td>
                          <td className="px-2 py-1" colSpan={1}>extra raccolta</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(pratica.extra.cippato_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(pratica.extra.ferro_kg)}</td>
                          <td className="px-2 py-1 tabular-nums">{formatKg(pratica.extra.totale_kg)} kg, a parte</td>
                          <td />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-sm">
                <Riquadro titolo="Rete" valore={`${formatKg(pratica.rete_kg)} kg`} nota="CSS-C + terziarie: va nella riga IRIGOM" tono="scelto" />
                {pratica.extra_kg > 0 && <Riquadro titolo="Extra raccolta" valore={`${formatKg(pratica.extra_kg)} kg`} nota="a parte, riga EXTRA RACCOLTA" />}
              </div>
              {mancaNave && <Avviso testo="Mancano i dati della nave: la dichiarazione del ciabattato li usa." />}
              {mancanoTer && <Avviso testo={`Servono ${pratica.terziarie.righe.length} numeri di terziaria: senza, nei documenti la colonna resta vuota.`} />}
              <div className="flex flex-wrap gap-2">
                <Button disabled={bloccata || !!lavoro} onClick={() => scaricaCartella(false)}>
                  {lavoro === 'cartella' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderDown className="w-4 h-4 mr-2" />} Scarica la cartella del mese
                </Button>
                <Button variant="outline" disabled={bloccata || !!lavoro} onClick={() => scaricaCartella(true)}>
                  {lavoro === 'excel' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />} Solo il riepilogo Excel
                </Button>
                {isAdmin && (
                  <Button variant="outline" disabled={bloccata || !!lavoro || mancanoTer} onClick={registra}
                    title="Scrive la dichiarazione del mese nel gestionale, come dichiarazione in mano: diventa caricata quando il report del portale la riconosce">
                    {lavoro === 'registra' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Registra la dichiarazione di {mese}
                  </Button>
                )}
              </div>
              {esito && esito.tipo === 'cartella' && (
                <div className="text-xs border rounded-lg px-3 py-2 bg-muted/30 space-y-0.5">
                  <p><CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600 mr-1" />Cartella scaricata: {esito.word} Word, il riepilogo Excel e i PDF forniti.</p>
                  {esito.mancanoModelli.length > 0 && <p className="text-amber-700">Mancano i modelli per: {esito.mancanoModelli.join(', ')}. Caricali qui sopra.</p>}
                  {esito.vuoti.length > 0 && <p className="text-amber-700">Nei Word sono rimasti da riempire: {esito.vuoti.join(', ')}.</p>}
                </div>
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

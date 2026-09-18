import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckSquare, Square, AlertTriangle, Mail, Search, Upload } from 'lucide-react';
import { giorniAllaScadenza, statoRichiesta } from '@/lib/richiesteEct';

// Richieste del consorzio arrivate via email: ci chiedono di anticipare certi
// ritiri. L'ID ordine non sta nella richiesta e lo riconosce il gestionale fra
// gli assegnati; quando quell'ordine risulta terminato l'evasione si propone da
// sola e la spunta la mette chi poi risponde alla mail.

const OGGI = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
const gg = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

const ESITI = {
  aperta: { nome: 'In attesa del ritiro', classe: 'bg-amber-50 text-amber-800 border-amber-200' },
  da_confermare: { nome: 'Ritiro fatto, da spuntare', classe: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  evasa: { nome: 'Evasa', classe: 'bg-emerald-600 text-white border-emerald-700' },
  annullata: { nome: 'Annullata', classe: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function Scadenza({ r }) {
  if (!r.scadenza) return <span className="text-muted-foreground">—</span>;
  const g = giorniAllaScadenza(String(r.scadenza).slice(0, 10), OGGI());
  const chiusa = r.esito === 'evasa' || r.esito === 'annullata';
  const colore = chiusa ? 'text-muted-foreground' : g < 0 ? 'text-red-700 font-medium' : g <= 7 ? 'text-amber-700 font-medium' : '';
  const quando = chiusa ? '' : g < 0 ? ` (in ritardo di ${-g} ${-g === 1 ? 'giorno' : 'giorni'})` : g === 0 ? ' (oggi)' : ` (fra ${g} ${g === 1 ? 'giorno' : 'giorni'})`;
  return <span className={colore}>{gg(r.scadenza)}{quando}</span>;
}

export default function RichiesteEct({ isAdmin }) {
  const [righe, setRighe] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [filtro, setFiltro] = useState('da_fare');
  const [cerca, setCerca] = useState('');
  const [occupato, setOccupato] = useState(null);
  const [caricando, setCaricando] = useState(false);
  const [esitoImport, setEsitoImport] = useState(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const anno = new Date().getUTCFullYear();
      const r = await base44.entities.RichiestaEct.filter({ anno }, '-mail_inviata_il', 500);
      setRighe(r);
    } catch (e) {
      setErrore(e?.message || String(e));
    } finally {
      setCaricamento(false);
    }
  }, []);
  useEffect(() => { carica(); }, [carica]);

  // Il file di gestione si carica da qui: le richieste arrivano da un foglio suo
  // e non c'entrano con gli export del portale.
  const importa = async (file) => {
    if (!file) return;
    setCaricando(true);
    setErrore('');
    setEsitoImport(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importaRichiesteEct', { file_url });
      setEsitoImport(res.data);
      await carica();
    } catch (e) {
      setErrore(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setCaricando(false);
    }
  };

  const spunta = async (r) => {
    if (!isAdmin) return;
    setOccupato(r.id);
    try {
      const adesso = !r.evasione_confermata;
      const campi = {
        evasione_confermata: adesso,
        evasione_confermata_il: adesso ? OGGI() : '',
      };
      campi.esito = statoRichiesta({ ...r, ...campi });
      if (adesso && !r.evaso_il && r.evasione_rilevata_il) campi.evaso_il = String(r.evasione_rilevata_il).slice(0, 10);
      await base44.entities.RichiestaEct.update(r.id, campi);
      await carica();
    } catch (e) {
      setErrore(e?.message || String(e));
    } finally {
      setOccupato(null);
    }
  };

  const conteggi = useMemo(() => ({
    da_fare: righe.filter(r => r.esito === 'aperta').length,
    da_confermare: righe.filter(r => r.esito === 'da_confermare').length,
    evasa: righe.filter(r => r.esito === 'evasa').length,
    annullata: righe.filter(r => r.esito === 'annullata').length,
    in_ritardo: righe.filter(r => r.esito === 'aperta' && r.scadenza && giorniAllaScadenza(String(r.scadenza).slice(0, 10), OGGI()) < 0).length,
  }), [righe]);

  const viste = useMemo(() => {
    let v = righe;
    if (filtro === 'da_fare') v = v.filter(r => r.esito === 'aperta');
    else if (filtro === 'da_confermare') v = v.filter(r => r.esito === 'da_confermare');
    else if (filtro === 'chiuse') v = v.filter(r => r.esito === 'evasa' || r.esito === 'annullata');
    else if (filtro === 'senza_ordine') v = v.filter(r => !r.id_ordine && !r.id_ordine_manuale);
    const q = cerca.trim().toLowerCase();
    if (q) v = v.filter(r => `${r.pdr_nome} ${r.provincia} ${r.id_ordine} ${r.id_ordine_manuale || ''} ${r.trasportatore}`.toLowerCase().includes(q));
    const peso = { aperta: 0, da_confermare: 1, evasa: 2, annullata: 3 };
    return [...v].sort((a, b) => (peso[a.esito] ?? 9) - (peso[b.esito] ?? 9)
      || String(a.scadenza || '9999').localeCompare(String(b.scadenza || '9999'))
      || String(b.mail_inviata_il || '').localeCompare(String(a.mail_inviata_il || '')));
  }, [righe, filtro, cerca]);

  const FILTRI = [
    ['da_fare', 'Da ritirare', conteggi.da_fare],
    ['da_confermare', 'Da spuntare', conteggi.da_confermare],
    ['senza_ordine', 'Senza ID ordine', righe.filter(r => !r.id_ordine && !r.id_ordine_manuale).length],
    ['chiuse', 'Chiuse', conteggi.evasa + conteggi.annullata],
    ['tutte', 'Tutte', righe.length],
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-3xl">
        Le richieste che il consorzio ci manda per email, fuori dal portale, per anticipare certi ritiri. L&apos;ID ordine non c&apos;è
        nella richiesta: lo riconosce il gestionale fra gli assegnati, dal nome del produttore e dalla data di immissione.
        Quando quell&apos;ordine compare fra i terminati la riga passa a <strong>da spuntare</strong> con la data del ritiro:
        la spunta la metti tu, e da lì puoi rispondere alla mail.
      </p>

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-3 border rounded-lg px-3 py-2 bg-muted/30">
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${caricando ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'}`}>
            {caricando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {caricando ? 'Leggo il foglio…' : 'Carica il file di gestione'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={caricando}
              onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; importa(file); }}
            />
          </label>
          <span className="text-xs text-muted-foreground max-w-xl">
            Il file «Gestione Ecotyre», foglio «Richieste ECT». Le richieste nuove si aggiungono, quelle già in elenco si
            aggiornano e le tue spunte non vengono toccate.
          </span>
        </div>
      )}

      {esitoImport && (
        <div className="text-sm border rounded-lg px-3 py-2 bg-muted/40 space-y-1">
          <p>
            Lette <strong>{esitoImport.righe_lette}</strong> richieste: {esitoImport.creati} nuove, {esitoImport.aggiornati} aggiornate,
            {' '}{esitoImport.invariati} già in linea. ID ordine riconosciuto per <strong>{esitoImport.riconosciuti}</strong>.
          </p>
          {esitoImport.da_confermare?.length > 0 && (
            <p className="text-emerald-800">
              Risultano ritirate e aspettano la tua spunta: {esitoImport.da_confermare.map(x => `${x.pdr} (${String(x.evasa_il).split('-').reverse().join('/')})`).join(', ')}.
            </p>
          )}
          {esitoImport.orfane > 0 && (
            <p className="text-muted-foreground">{esitoImport.orfane} righe non sono più nel foglio: restano qui nello storico.</p>
          )}
        </div>
      )}

      {conteggi.in_ritardo > 0 && (
        <div className="flex items-start gap-2 text-sm border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>{conteggi.in_ritardo}</strong> {conteggi.in_ritardo === 1 ? 'richiesta ha superato' : 'richieste hanno superato'} il
            termine chiesto dal consorzio e {conteggi.in_ritardo === 1 ? 'aspetta' : 'aspettano'} ancora il ritiro: da sollecitare.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTRI.map(([k, nome, n]) => (
          <button
            key={k}
            onClick={() => setFiltro(k)}
            className={`px-3 py-1.5 rounded-md text-sm border ${filtro === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted'}`}
          >
            {nome} <span className="opacity-70">{n}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
          <input
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder="produttore, ID ordine, trasportatore"
            className="border rounded-md pl-8 pr-3 py-2 text-sm w-72"
          />
        </div>
      </div>

      {errore && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errore}</p>}
      {caricamento && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico le richieste…</p>}

      {!caricamento && righe.length === 0 && (
        <p className="text-sm text-muted-foreground border rounded-lg px-3 py-6 text-center">
          Ancora nessuna richiesta. Si riempie col pulsante qui sopra, caricando il file di gestione.
        </p>
      )}

      {righe.length > 0 && (
        <div className="border rounded-xl bg-card" data-scorre-lato>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/50 min-w-[230px]">Produttore</th>
                <th className="text-left px-2 py-2 font-semibold">Pr.</th>
                <th className="text-left px-2 py-2 font-semibold">Cl.</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">ID ordine</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Ordine immesso</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Mail del</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Entro</th>
                <th className="text-left px-2 py-2 font-semibold">Trasportatore</th>
                <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Ritiro</th>
                <th className="text-left px-3 py-2 font-semibold">Stato</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {viste.map(r => {
                const e = ESITI[r.esito] || ESITI.aperta;
                const id = r.id_ordine_manuale || r.id_ordine;
                return (
                  <tr key={r.id} className="border-b last:border-b-0 align-top">
                    <td className="px-3 py-2 sticky left-0 bg-card">
                      <span className="font-medium">{r.pdr_nome}</span>
                      {r.nota && <span className="block text-[11px] text-muted-foreground">{r.nota}</span>}
                    </td>
                    <td className="px-2 py-2">{r.provincia || '—'}</td>
                    <td className="px-2 py-2">{r.classe || '—'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {id ? <span className="font-mono text-xs">{id}</span> : <span className="text-amber-700 text-xs">da trovare</span>}
                      {r.id_ordine_stato === 'ambiguo' && (
                        <span className="block text-[11px] text-amber-700" title={`Possibili: ${r.id_ordine_candidati}`}>più ordini possibili</span>
                      )}
                      {r.id_ordine_stato === 'approssimato' && !r.id_ordine_manuale && (
                        <span className="block text-[11px] text-muted-foreground" title="La data della richiesta e quella dell ordine non coincidono al giorno: da confermare">data non esatta</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{gg(r.ordine_immesso_il)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{gg(r.mail_inviata_il)}</td>
                    <td className="px-2 py-2 whitespace-nowrap"><Scadenza r={r} /></td>
                    <td className="px-2 py-2">{r.trasportatore || '—'}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {gg(r.evaso_il || r.evasione_rilevata_il)}
                      {!r.evaso_il && r.evasione_rilevata_il && <span className="block text-[11px] text-muted-foreground">dai terminati</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs ${e.classe}`}>{e.nome}</span>
                      {r.motivo_annullamento && <span className="block text-[11px] text-muted-foreground mt-0.5">{r.motivo_annullamento}</span>}
                      {r.evasione_confermata_il && <span className="block text-[11px] text-muted-foreground mt-0.5">spuntata il {gg(r.evasione_confermata_il)}</span>}
                    </td>
                    <td className="px-2 py-2">
                      {isAdmin && r.esito !== 'annullata' && (
                        <button
                          onClick={() => spunta(r)}
                          disabled={occupato === r.id}
                          title={r.evasione_confermata ? 'Togli la spunta' : 'Segna come evasa: la data del ritiro va nella risposta al consorzio'}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted whitespace-nowrap"
                        >
                          {occupato === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : r.evasione_confermata ? <CheckSquare className="w-3.5 h-3.5 text-emerald-700" /> : <Square className="w-3.5 h-3.5" />}
                          {r.evasione_confermata ? 'evasa' : 'spunta'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {viste.length === 0 && (
                <tr><td colSpan={11} className="text-center py-6 text-muted-foreground">Nessuna richiesta in questo filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {conteggi.da_confermare > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Mail className="w-3.5 h-3.5" /> Le righe «da spuntare» hanno il ritiro già fatto: spuntandole resta scritta la data da comunicare al consorzio.
        </p>
      )}
    </div>
  );
}

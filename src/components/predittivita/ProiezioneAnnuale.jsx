import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, Info, RefreshCw, Truck } from 'lucide-react';
import { formatTonnellate, formatIntero } from '@/lib/utils';

// Quante secondarie restano da portare a ogni impianto per arrivare al target,
// mese per mese fino alla data obiettivo.
//
// Due letture affiancate, come nel foglio di gestione: quanti viaggi servono e
// quanti se ne possono fare col materiale che gli stoccaggi hanno e che ci
// arrivera'. Dove le due non coincidono, il piano non sta in piedi e lo si dice.
//
// La primaria attesa di ogni mese e i viaggi si possono fissare a mano: finche'
// non si fissano, li stima il gestionale - la primaria con la media degli ultimi
// tre mesi conclusi, i viaggi spalmando il residuo sui mesi che restano.

const t = (kg) => formatTonnellate((Number(kg) || 0) / 1000);

function Cella({ children, classe = '' }) {
  return <td className={`px-3 py-2 tabular-nums whitespace-nowrap ${classe}`}>{children}</td>;
}

function Impianto({ p, kgPerViaggio, isAdmin, onIpotesi, occupato }) {
  const [apri, setApri] = useState(null); // mese in modifica
  const [primaria, setPrimaria] = useState('');
  const [viaggi, setViaggi] = useState('');

  const inizia = (r) => {
    setApri(r.mese);
    setPrimaria(r.primaria_da_ipotesi ? String(Math.round(r.primaria_kg / 1000 * 100) / 100) : '');
    setViaggi(r.viaggi_da_ipotesi ? String(r.viaggi) : '');
  };

  const salva = async (mese) => {
    const pk = primaria.trim() === '' ? null : Math.round(Number(primaria.replace(',', '.')) * 1000);
    const vv = viaggi.trim() === '' ? null : Number(viaggi.replace(',', '.'));
    setApri(null);
    await onIpotesi(p.impianto_registrato || p.impianto, mese, pk, vv);
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-heading font-semibold">{p.impianto}</h3>
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">obiettivo {p.data_fine ? p.data_fine.split('-').reverse().join('/') : ''}</span>
          <span className="ml-auto text-sm">
            <strong className="tabular-nums">{p.viaggi_totali}</strong> <span className="text-muted-foreground">viaggi da qui alla fine</span>
          </span>
        </div>
        <div className="flex gap-2 flex-wrap text-sm">
          <div className="px-3 py-1.5 rounded-md border bg-muted/30">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Target di rete</div>
            <div className="tabular-nums">{t(p.target_kg)} t</div>
          </div>
          <div className="px-3 py-1.5 rounded-md border bg-muted/30">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Già arrivato (rete)</div>
            <div className="tabular-nums">{t(p.conferito_kg)} t</div>
            <div className="text-[11px] text-muted-foreground">primaria {t(p.conferito_primaria_kg)} · secondaria {t(p.conferito_secondaria_kg)}</div>
          </div>
          <div className="px-3 py-1.5 rounded-md border bg-muted/30">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Residuo</div>
            <div className="tabular-nums font-semibold">{t(p.residuo_kg)} t</div>
          </div>
          <div className="px-3 py-1.5 rounded-md border bg-muted/30">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Primaria attesa</div>
            <div className="tabular-nums">{t(p.media_primaria_mensile_kg)} t / mese</div>
            <div className="text-[11px] text-muted-foreground">media degli ultimi tre mesi</div>
          </div>
        </div>
        {p.avvisi.map((a, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{a}</span>
          </div>
        ))}
        {p.stoccaggi.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Alimentato da: {p.stoccaggi.map(s => `${s.nome} (${s.giacenza_kg == null ? 'giacenza non rilevata' : t(s.giacenza_kg) + ' t in giacenza'}, ${t(s.media_ingressi_kg)} t/mese in arrivo)`).join(' · ')}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Mese</th>
              <th className="px-3 py-2 font-semibold">Conferito primaria</th>
              <th className="px-3 py-2 font-semibold">Viaggi di secondaria</th>
              <th className="px-3 py-2 font-semibold">Conferito secondaria</th>
              <th className="px-3 py-2 font-semibold">Residuo da conferire</th>
              <th className="px-3 py-2 font-semibold">Viaggi possibili</th>
              {isAdmin && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {p.mesi.map((r) => (
              <React.Fragment key={r.mese}>
                <tr className="border-t">
                  <Cella classe="font-medium">{r.mese}</Cella>
                  <Cella>
                    {t(r.primaria_kg)} t
                    {r.primaria_da_ipotesi && <span className="ml-1 text-[11px] text-primary">fissata</span>}
                  </Cella>
                  <Cella classe="font-semibold">
                    {formatIntero(r.viaggi)}
                    {r.viaggi_da_ipotesi && <span className="ml-1 text-[11px] text-primary font-normal">fissati</span>}
                  </Cella>
                  <Cella>{t(r.secondarie_kg)} t</Cella>
                  <Cella classe={r.residuo_kg > 0 ? '' : 'text-emerald-700'}>{t(r.residuo_kg)} t</Cella>
                  <Cella classe={r.viaggi_mancanti > 0 ? 'text-red-700 font-medium' : 'text-muted-foreground'}>
                    {r.viaggi_disponibili == null ? <span title="Manca la rilevazione di uno stoccaggio: la disponibilita non si puo calcolare">—</span> : formatIntero(r.viaggi_disponibili)}
                    {r.viaggi_mancanti > 0 && <span className="ml-1 text-[11px]">ne mancano {r.viaggi_mancanti}</span>}
                  </Cella>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={occupato} onClick={() => (apri === r.mese ? setApri(null) : inizia(r))}>
                        {apri === r.mese ? 'chiudi' : 'fissa'}
                      </Button>
                    </td>
                  )}
                </tr>
                {apri === r.mese && (
                  <tr className="border-t border-dashed bg-muted/10">
                    <td colSpan={isAdmin ? 7 : 6} className="px-3 py-2">
                      <div className="flex items-end gap-3 flex-wrap text-xs">
                        <label className="space-y-1">
                          <span className="block text-muted-foreground">Primaria di rete attesa (t)</span>
                          <input value={primaria} onChange={e => setPrimaria(e.target.value)} placeholder={t(r.primaria_kg)}
                            className="border rounded px-2 py-1 w-28 tabular-nums" />
                        </label>
                        <label className="space-y-1">
                          <span className="block text-muted-foreground">Viaggi</span>
                          <input value={viaggi} onChange={e => setViaggi(e.target.value)} placeholder={String(r.viaggi)}
                            className="border rounded px-2 py-1 w-20 tabular-nums" />
                        </label>
                        <Button size="sm" className="h-8" onClick={() => salva(r.mese)}>Salva</Button>
                        <span className="text-muted-foreground">
                          Lascia un campo vuoto per tornare alla stima del gestionale. Un viaggio vale {t(kgPerViaggio)} t.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProiezioneAnnuale({ isAdmin, versione = 0 }) {
  const [dati, setDati] = useState(null);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [occupato, setOccupato] = useState(false);

  const carica = useCallback(async () => {
    setCaricando(true);
    setErrore(null);
    try {
      const res = await base44.functions.invoke('proiezioneSecondarie', {});
      setDati(res.data || res);
    } catch (e) {
      setErrore((e && e.data && e.data.error) || e.message || 'Errore nel calcolo');
    }
    setCaricando(false);
  }, []);

  // Si ricalcola all'apertura e a ogni caricamento chiuso (versione la fa
  // crescere la pagina): la proiezione non deve restare a un archivio vecchio.
  useEffect(() => { carica(); }, [carica, versione]);

  // Fissa o libera l'ipotesi di un mese: un valore vuoto torna alla stima.
  const salvaIpotesi = async (impianto, mese, primariaKg, viaggi) => {
    setOccupato(true);
    try {
      const anno = dati.anno;
      const esistenti = await base44.entities.IpotesiMensileSecondarie.filter({ anno, impianto, mese });
      const dentro = esistenti && esistenti[0];
      const vuoto = primariaKg == null && viaggi == null;
      if (dentro && vuoto) await base44.entities.IpotesiMensileSecondarie.delete(dentro.id);
      else if (dentro) await base44.entities.IpotesiMensileSecondarie.update(dentro.id, { primaria_attesa_kg: primariaKg, viaggi_previsti: viaggi });
      else if (!vuoto) await base44.entities.IpotesiMensileSecondarie.create({ anno, impianto, mese, primaria_attesa_kg: primariaKg, viaggi_previsti: viaggi });
      await carica();
    } catch (e) {
      setErrore((e && e.data && e.data.error) || e.message || 'Non sono riuscito a salvare');
    }
    setOccupato(false);
  };

  if (caricando && !dati) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Calcolo la proiezione…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Per ogni impianto: quanto manca al target e come si copre da {dati && dati.mese_da_nome ? dati.mese_da_nome.toLowerCase() : 'questo mese'} in poi, fra quello che arriva
          direttamente in primaria e i viaggi di secondaria dagli stoccaggi, contati a {dati ? t(dati.kg_per_viaggio) : '13,50'} tonnellate per viaggio.
          Il residuo si trascina di mese in mese: se a fine anno non arriva a zero, il piano non basta e te lo dice.
          L&apos;ultima colonna guarda l&apos;altra metà della questione, cioè se allo stoccaggio ci sarà materiale per fare quei viaggi.
          Solo rete: ACI ed extra raccolta non entrano nella predittività, né nel target, né nel già arrivato, né nella giacenza
          degli stoccaggi (classi 1-4 della rilevazione e soli movimenti di rete).
        </span>
      </div>

      {dati && (dati.avvisi_generali || []).map((a, i) => (
        <div key={i} className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-4 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{a}</span>
        </div>
      ))}

      {errore && (
        <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
        </div>
      )}

      {dati && (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {dati.viaggi_per_mese.map(m => (
                <div key={m.mese} className="px-3 py-2 rounded-md border bg-card">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{m.mese}</div>
                  <div className="text-lg font-heading font-bold tabular-nums flex items-center gap-1">
                    <Truck className="w-4 h-4 text-muted-foreground" />{m.viaggi}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{m.per_impianto.map(x => `${x.impianto.split(' ')[0]} ${x.viaggi}`).join(' · ')}</div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={carica} disabled={occupato}><RefreshCw className="w-4 h-4 mr-1.5" />Ricalcola</Button>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Viaggi di secondaria di rete che servono ogni mese, su tutti gli impianti.</p>

          {dati.impianti.length === 0 && (
            <div className="border rounded-lg bg-card p-6 text-center text-sm text-muted-foreground">
              Nessun impianto attivo nella configurazione della predittività.
            </div>
          )}
          {dati.impianti.map(p => (
            <Impianto key={p.impianto_id || p.impianto} p={p} kgPerViaggio={dati.kg_per_viaggio}
              isAdmin={isAdmin} onIpotesi={salvaIpotesi} occupato={occupato} />
          ))}

          {dati.registro_piazzali && dati.registro_piazzali.length > 0 && dati.piazzali_condivisi && dati.piazzali_condivisi.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="font-heading font-semibold">Gli stoccaggi, mese per mese</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dati.piazzali_condivisi.join(' e ')} {dati.piazzali_condivisi.length === 1 ? 'alimenta' : 'alimentano'} più di un impianto: la giacenza è una sola,
                  e i piani sono calcolati insieme. Qui si vede quanto ne prende ciascuno e quanto resta sul piazzale.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Mese</th>
                      <th className="px-3 py-2 font-semibold">Stoccaggio</th>
                      <th className="px-3 py-2 font-semibold">Chi preleva</th>
                      <th className="px-3 py-2 font-semibold text-right">Resta a fine mese</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dati.registro_piazzali.flatMap(riga => (riga.piazzali || []).map((pz, i) => (
                      <tr key={riga.mese + pz.nome} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{i === 0 ? riga.mese : ''}</td>
                        <td className="px-3 py-2">{pz.nome}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {pz.prelievi && pz.prelievi.length
                            ? pz.prelievi.map(x => `${x.impianto} ${t(x.kg)} t`).join(' · ')
                            : 'nessun prelievo'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{pz.ignoto ? '—' : `${t(pz.saldo_fine_mese_kg)} t`}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dati.impianti.every(p => p.avvisi.length === 0) && dati.impianti.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4" />
              Con questo piano tutti gli impianti arrivano al target e gli stoccaggi hanno materiale per i viaggi previsti.
            </div>
          )}
        </>
      )}
    </div>
  );
}

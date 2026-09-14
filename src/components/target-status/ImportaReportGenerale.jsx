import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { leggiFileReportGenerale, pianificaImportazione } from '@/lib/reportGenerale';
import { tonnellate, conModifica, nomeUtente, chiaveNome } from '@/lib/target';

// Importa i target assegnati dei raccoglitori dal foglio "Report Generale" del file
// di gestione: annuo e mesi, per impianto e regione. Prima mostra cosa cambierebbe;
// si scrive solo cio' che si conferma. Nulla viene cancellato.

export default function ImportaReportGenerale({ open, onClose, anno, annui, mensili, user, onImportato }) {
  const { toast } = useToast();
  const inputFile = useRef(null);
  const [lettura, setLettura] = useState(null);
  const [scelte, setScelte] = useState({});
  const [leggendo, setLeggendo] = useState(false);
  const [avanzamento, setAvanzamento] = useState(null);

  const chiudi = () => { if (avanzamento) return; setLettura(null); onClose(); };

  const leggi = async (file) => {
    setLeggendo(true);
    try {
      const r = await leggiFileReportGenerale(file);
      const { piano, restanti } = pianificaImportazione(r.voci, annui, mensili, chiaveNome);
      setLettura({ file: file.name, ...r, piano, restanti });
      setScelte(Object.fromEntries(piano.map((_, i) => [i, true])));
    } catch (e) {
      toast({ title: 'Lettura non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setLeggendo(false);
  };

  const conta = (p, stato) => (p.annuo && p.annuo.stato === stato ? 1 : 0) + Object.values(p.mesi).filter(x => x.stato === stato).length;
  const daFare = lettura ? lettura.piano.filter((p, i) => scelte[i]) : [];
  const operazioni = daFare.reduce((n, p) => n + conta(p, 'crea') + conta(p, 'aggiorna'), 0);
  const annoDiverso = lettura && lettura.anno && lettura.anno !== anno;

  const importa = async () => {
    const utente = nomeUtente(user);
    const nota = `importato da ${lettura.file} (Report Generale)`;
    let fatte = 0;
    setAvanzamento({ fatte: 0, totale: operazioni });
    try {
      for (const p of daFare) {
        const v = p.voce;
        const dove = { regione: v.regione, impianto: v.impianto };
        if (p.annuo && p.annuo.stato !== 'uguale') {
          const r = p.annuo.record;
          if (r) {
            await base44.entities.TargetRaccoglitore.update(r.id, {
              ...dove, target_tonnellate: v.annuo,
              storico_json: conModifica(r.storico_json, { utente, nota, prima: { target_tonnellate: r.target_tonnellate ?? null, attivo_dal: r.attivo_dal || '' } }),
            });
          } else {
            await base44.entities.TargetRaccoglitore.create({ raccoglitore: v.raccoglitore, ...dove, anno, target_tonnellate: v.annuo, storico_json: conModifica('[]', { utente, nota, prima: null }) });
          }
          setAvanzamento({ fatte: ++fatte, totale: operazioni });
        }
        for (const [mese, op] of Object.entries(p.mesi)) {
          if (op.stato === 'uguale') continue;
          const r = op.record;
          if (r) {
            await base44.entities.TargetMensile.update(r.id, {
              ...dove, target: op.valore, non_raccoglie: false,
              storico_json: conModifica(r.storico_json, { utente, nota, prima: { target: r.target ?? null, non_raccoglie: !!r.non_raccoglie } }),
            });
          } else {
            await base44.entities.TargetMensile.create({ raccoglitore: v.raccoglitore, ...dove, mese, anno, target: op.valore, non_raccoglie: false, storico_json: conModifica('[]', { utente, nota, prima: null }) });
          }
          setAvanzamento({ fatte: ++fatte, totale: operazioni });
        }
      }
      toast({ title: 'Target importati', description: `${fatte} valori scritti dal Report Generale.` });
      setAvanzamento(null);
      setLettura(null);
      await onImportato();
    } catch (e) {
      setAvanzamento(null);
      toast({ title: 'Importazione interrotta', description: `${fatte} valori scritti prima dell'errore: ${e.message || String(e)}. Riaprendo l'importazione vedrai cosa manca.`, variant: 'destructive' });
      await onImportato();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) chiudi(); }}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importa i target {anno} dal Report Generale</DialogTitle>
          <DialogDescription>
            Scegli il file di gestione Ecotyre: leggo il foglio "Report Generale" e ti mostro cosa cambierebbe prima di scrivere. I valori già presenti uguali
            restano come sono, quelli diversi si aggiornano con lo storico, nulla viene cancellato.
          </DialogDescription>
        </DialogHeader>

        <input ref={inputFile} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) leggi(f); }} />
        {!lettura && (
          <div className="py-8 text-center">
            <Button onClick={() => inputFile.current && inputFile.current.click()} disabled={leggendo}>
              {leggendo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1" />}Scegli il file di gestione
            </Button>
          </div>
        )}

        {lettura && (
          <div className="space-y-3">
            <p className="text-sm">
              <strong>{lettura.file}</strong>: {lettura.piano.length} righe di target, somma annua {tonnellate(lettura.somma)} t
              {lettura.totale !== null ? ` (totale del foglio ${tonnellate(lettura.totale)} t)` : ''}, mesi presenti: {lettura.mesiPresenti.join(', ') || 'nessuno'}.
            </p>
            {(annoDiverso || lettura.avvisi.length > 0) && (
              <div className="flex items-start gap-2 text-sm border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  {annoDiverso && <p>Il foglio riguarda il {lettura.anno}, ma stai importando nel {anno}: cambia l'anno in alto prima di importare.</p>}
                  {lettura.avvisi.map((a, i) => <p key={i}>{a}</p>)}
                </div>
              </div>
            )}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-2 py-2 w-8" />
                    <th className="px-2 py-2">Impianto</th>
                    <th className="px-2 py-2">Regione</th>
                    <th className="px-2 py-2">Raccoglitore</th>
                    <th className="px-2 py-2 text-right">Annuo nel file</th>
                    <th className="px-2 py-2 text-right">Annuo attuale</th>
                    <th className="px-2 py-2">Mesi</th>
                  </tr>
                </thead>
                <tbody>
                  {lettura.piano.map((p, i) => {
                    const nuovi = Object.values(p.mesi).filter(x => x.stato === 'crea').length;
                    const diversi = Object.entries(p.mesi).filter(([, x]) => x.stato === 'aggiorna');
                    const uguali = Object.values(p.mesi).filter(x => x.stato === 'uguale').length;
                    return (
                      <tr key={i} className="border-t align-top">
                        <td className="px-2 py-1.5"><input type="checkbox" checked={!!scelte[i]} onChange={e => setScelte(prev => ({ ...prev, [i]: e.target.checked }))} /></td>
                        <td className="px-2 py-1.5">{p.voce.impianto}</td>
                        <td className="px-2 py-1.5">{p.voce.regione}</td>
                        <td className="px-2 py-1.5 font-medium">{p.voce.raccoglitore}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{p.annuo ? tonnellate(p.annuo.valore, 3) : '—'}</td>
                        <td className={`px-2 py-1.5 text-right tabular-nums ${p.annuo && p.annuo.stato === 'aggiorna' ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
                          {p.annuo ? (p.annuo.record ? tonnellate(p.annuo.record.target_tonnellate, 3) : 'nuovo') : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          {nuovi ? <span className="mr-2">{nuovi} {nuovi === 1 ? 'nuovo' : 'nuovi'}</span> : null}
                          {diversi.length ? <span className="mr-2 text-amber-700" title={diversi.map(([m, x]) => `${m}: ${tonnellate(x.record.target, 3)} → ${tonnellate(x.valore, 3)} t`).join('\n')}>{diversi.length} da aggiornare ({diversi.map(([m, x]) => `${m.slice(0, 3)} ${tonnellate(x.record.target)}→${tonnellate(x.valore)}`).join(', ')})</span> : null}
                          {uguali ? <span className="text-muted-foreground">{uguali} {uguali === 1 ? 'uguale' : 'uguali'}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lettura.restanti.length > 0 && (
              <div className="text-xs border border-amber-200 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
                Nella tabella restano {lettura.restanti.length} target degli stessi raccoglitori che il file non prevede, per esempio doppioni:{' '}
                {lettura.restanti.slice(0, 6).map(x => `${x.record.raccoglitore}${x.record.regione ? ` ${x.record.regione}` : ''}${x.tipo === 'mese' ? ` ${x.record.mese}` : ' annuo'} ${tonnellate(x.tipo === 'mese' ? x.record.target : x.record.target_tonnellate)} t`).join('; ')}
                {lettura.restanti.length > 6 ? '…' : ''}. Non li tocco: dopo l'importazione li trovi nella griglia e puoi azzerarli.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {lettura && !avanzamento && <Button variant="ghost" onClick={() => setLettura(null)}>Scegli un altro file</Button>}
          <Button variant="ghost" onClick={chiudi} disabled={!!avanzamento}>Chiudi</Button>
          {lettura && (
            <Button onClick={importa} disabled={!!avanzamento || operazioni === 0 || annoDiverso}>
              {avanzamento ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{avanzamento.fatte} di {avanzamento.totale}</> : `Importa ${operazioni} valori`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

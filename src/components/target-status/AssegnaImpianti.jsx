import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { tonnellate, chiaveNome, conModifica, nomeUtente } from '@/lib/target';
import { stessoNome } from '@/lib/reportGeneraleVista';

// Assegna l'impianto di destinazione alle righe dei target che non lo hanno,
// ricavandolo dal raccolto RETE dell'anno: se quasi tutto il raccolto di quel
// raccoglitore in quella regione va a un impianto, e' quello proposto. Cambia
// solo il campo impianto dei target, mai i valori, e lo annota nello storico.

const QUOTA_PROPOSTA = 0.8;

export default function AssegnaImpianti({ open, onClose, righe, raccoltoImpianto, impiantiNoti, anno, user, onFatto }) {
  const { toast } = useToast();
  const senza = useMemo(() => righe.filter(r => !r.impianto && r.regione), [righe]);

  const proposte = useMemo(() => senza.map(r => {
    const mappa = new Map();
    for (const x of raccoltoImpianto) {
      if (x.regione !== r.regione || !stessoNome(r.chiave, chiaveNome(x.raccoglitore))) continue;
      const k = chiaveNome(x.impianto);
      if (!mappa.has(k)) mappa.set(k, { impianto: x.impianto, totale: 0 });
      mappa.get(k).totale += x.totale || 0;
    }
    const destinazioni = [...mappa.values()].sort((a, b) => b.totale - a.totale);
    const totale = destinazioni.reduce((s, d) => s + d.totale, 0);
    const prima = destinazioni[0];
    return { riga: r, destinazioni, totale, proposta: prima && totale > 0 && prima.totale / totale >= QUOTA_PROPOSTA ? prima.impianto : '' };
  }), [senza, raccoltoImpianto]);

  const [scelte, setScelte] = useState({});
  const [avanzamento, setAvanzamento] = useState(null);
  const sceltaDi = (p) => (scelte[p.riga.chiave + '|' + p.riga.regione] ?? p.proposta);

  const applica = async () => {
    const daFare = proposte.filter(p => sceltaDi(p));
    const operazioni = daFare.reduce((s, p) => s + (p.riga.annuo ? 1 : 0) + Object.keys(p.riga.mesi).length, 0);
    const utente = nomeUtente(user);
    let fatte = 0;
    setAvanzamento({ fatte, totale: operazioni });
    try {
      for (const p of daFare) {
        const impianto = sceltaDi(p);
        const nota = `impianto di destinazione assegnato: ${impianto}`;
        if (p.riga.annuo) {
          const r = p.riga.annuo;
          await base44.entities.TargetRaccoglitore.update(r.id, { impianto, storico_json: conModifica(r.storico_json, { utente, nota, prima: { impianto: r.impianto || '' } }) });
          setAvanzamento({ fatte: ++fatte, totale: operazioni });
        }
        for (const m of Object.values(p.riga.mesi)) {
          await base44.entities.TargetMensile.update(m.id, { impianto, storico_json: conModifica(m.storico_json, { utente, nota, prima: { impianto: m.impianto || '' } }) });
          setAvanzamento({ fatte: ++fatte, totale: operazioni });
        }
      }
      toast({ title: 'Impianti assegnati', description: `${daFare.length} righe aggiornate; i valori dei target non sono cambiati.` });
      setAvanzamento(null);
      await onFatto();
    } catch (e) {
      toast({ title: 'Assegnazione interrotta', description: `${e.message || e}. Le righe gia' aggiornate restano; puoi ripetere per le altre.`, variant: 'destructive' });
      setAvanzamento(null);
      await onFatto();
    }
  };

  const daApplicare = proposte.filter(p => sceltaDi(p)).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !avanzamento && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assegna l'impianto di destinazione {anno}</DialogTitle>
          <DialogDescription>
            Righe dei target senza impianto. La proposta viene dal raccolto RETE dell'anno: se almeno l'{Math.round(QUOTA_PROPOSTA * 100)}% va a un impianto, è quello.
            Cambia solo l'impianto, non i valori, e resta nello storico. Se un raccoglitore lavora per due impianti con target distinti, lascia la riga senza impianto
            o assegna quello principale e aggiungi una riga per il secondo.
          </DialogDescription>
        </DialogHeader>
        {proposte.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tutte le righe hanno già un impianto.</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="px-2 py-2">Raccoglitore</th>
                  <th className="px-2 py-2">Regione</th>
                  <th className="px-2 py-2">Raccolto RETE {anno} per impianto</th>
                  <th className="px-2 py-2">Impianto da assegnare</th>
                </tr>
              </thead>
              <tbody>
                {proposte.map(p => {
                  const chiave = p.riga.chiave + '|' + p.riga.regione;
                  const opzioni = [...new Set([...p.destinazioni.map(d => d.impianto), ...impiantiNoti])];
                  return (
                    <tr key={chiave} className="border-t align-top">
                      <td className="px-2 py-2 font-medium">{p.riga.nome}</td>
                      <td className="px-2 py-2">{p.riga.regione}</td>
                      <td className="px-2 py-2 text-xs">
                        {p.destinazioni.length === 0 ? <span className="text-muted-foreground">nessun raccolto nell'anno</span> : p.destinazioni.map(d => (
                          <div key={d.impianto}>{d.impianto}: {tonnellate(d.totale)} t ({Math.round(d.totale / p.totale * 100)}%)</div>
                        ))}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={sceltaDi(p)}
                          onChange={e => setScelte(s => ({ ...s, [chiave]: e.target.value }))}
                          disabled={!!avanzamento}
                          className="border rounded-md px-2 py-1 text-sm bg-background max-w-[240px]"
                        >
                          <option value="">Lascia senza impianto</option>
                          {opzioni.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter className="items-center">
          {avanzamento && <span className="text-sm text-muted-foreground mr-auto">Aggiornati {avanzamento.fatte} di {avanzamento.totale} target…</span>}
          <Button variant="outline" onClick={onClose} disabled={!!avanzamento}>Annulla</Button>
          <Button onClick={applica} disabled={!!avanzamento || daApplicare === 0}>
            {avanzamento && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Assegna a {daApplicare} {daApplicare === 1 ? 'riga' : 'righe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

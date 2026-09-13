import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Plus, Upload, History, ClipboardEdit, Trash2 } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import RilevazioneForm from './RilevazioneForm';
import StoricoRilevazioni from './StoricoRilevazioni';

function fmt(n, dec = 2) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT');
}
function isObsolete(dateStr) {
  if (!dateStr) return false;
  const ms = new Date(dateStr).getTime();
  return ms < Date.now() - 30 * 24 * 60 * 60 * 1000;
}

export default function StoccaggiManager({ stoccaggiFromCalcolo, isAdmin, onSaved }) {
  const [rilevazioni, setRilevazioni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [precompilato, setPrecompilato] = useState(null);
  const [showStorico, setShowStorico] = useState(false);
  const [storicoSito, setStoricoSito] = useState('');
  const [storicoRecords, setStoricoRecords] = useState([]);
  const [seedSimula, setSeedSimula] = useState(null);
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [daEliminare, setDaEliminare] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const loadRilevazioni = useCallback(async () => {
    setLoading(true);
    try {
      const records = await base44.entities.GiacenzaStoccaggio.list('-data_rilevazione', 10000);
      setRilevazioni(records);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadRilevazioni(); }, [loadRilevazioni]);

  // Group by normalized sito, keep most recent (list is sorted desc)
  const grouped = new Map();
  for (const r of rilevazioni) {
    const ns = normalizzaRagioneSociale(r.sito);
    if (!grouped.has(ns)) grouped.set(ns, { record: r, all: [] });
    grouped.get(ns).all.push(r);
  }
  const righe = [...grouped.values()]
    // Ogni riga si porta dietro l'intero storico del sito: serve per eliminarlo
    // per intero, visto che a video compare solo la rilevazione piu' recente.
    .map(g => ({ ...g.record, tutteLeRilevazioni: g.all }))
    .sort((a, b) => new Date(b.data_rilevazione).getTime() - new Date(a.data_rilevazione).getTime());

  const sitiSuggeriti = [...new Set([
    ...stoccaggiFromCalcolo.map(s => s.sito).filter(Boolean),
    ...rilevazioni.map(r => r.sito).filter(Boolean),
  ])].sort();

  // Rimuove un'unita' locale dall'elenco cancellando tutte le sue rilevazioni.
  // Cancellare solo l'ultima farebbe riaffiorare la precedente, e il sito
  // resterebbe in tabella con numeri piu' vecchi.
  const handleElimina = async () => {
    if (!daEliminare) return;
    setEliminando(true);
    try {
      for (const rec of (daEliminare.tutteLeRilevazioni || [daEliminare])) {
        await base44.entities.GiacenzaStoccaggio.delete(rec.id);
      }
      setDaEliminare(null);
      await loadRilevazioni();
      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    setEliminando(false);
  };

  const handleNuova = (record) => { setPrecompilato(record); setShowForm(true); };
  const handleAggiungi = () => { setPrecompilato(null); setShowForm(true); };
  const handleStorico = (record) => {
    const ns = normalizzaRagioneSociale(record.sito);
    setStoricoSito(record.sito);
    setStoricoRecords(grouped.get(ns)?.all || []);
    setShowStorico(true);
  };

  const handleSeedSimula = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke('seedGiacenzeStoccaggio', { simula: true });
      setSeedSimula(res.data);
      setSeedConfirm(true);
    } catch (e) { alert(e.message); }
    setSeeding(false);
  };
  const handleSeedConfirm = async () => {
    setSeeding(true);
    try {
      await base44.functions.invoke('seedGiacenzeStoccaggio', { simula: false });
      setSeedConfirm(false);
      await loadRilevazioni();
      onSaved?.();
    } catch (e) { alert(e.message); }
    setSeeding(false);
  };

  return (
    <div className="space-y-3">
      <div className="bg-muted/40 border rounded-lg p-3 text-sm text-muted-foreground">
        Il portale espone il saldo degli stoccaggi nella pagina Unita' Locali di Stoccaggio, che non e' esportabile. Rileva qui i valori per classe quando consulti il portale: il modulo usa sempre la rilevazione piu' recente di ciascun sito.
      </div>

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleAggiungi}><Plus className="w-4 h-4 mr-1" /> Aggiungi rilevazione</Button>
          <Button variant="outline" size="sm" onClick={handleSeedSimula} disabled={seeding}><Upload className="w-4 h-4 mr-1" /> Importa rilevazione iniziale</Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Unità</th>
                  <th className="px-3 py-2 font-semibold">Sito</th>
                  <th className="px-3 py-2 font-semibold">Data rilevazione</th>
                  <th className="px-3 py-2 font-semibold text-right">P (kg)</th>
                  <th className="px-3 py-2 font-semibold text-right">M (kg)</th>
                  <th className="px-3 py-2 font-semibold text-right">G1 (kg)</th>
                  <th className="px-3 py-2 font-semibold text-right">G2 (kg)</th>
                  <th className="px-3 py-2 font-semibold text-right">ACI (kg)</th>
                  <th className="px-3 py-2 font-semibold text-right">Totale (t)</th>
                  <th className="px-3 py-2 font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {righe.map(r => {
                  const tot = (r.class1_kg || 0) + (r.class2_kg || 0) + (r.class3_kg || 0) + (r.class4_kg || 0) + (r.class9_kg || 0);
                  const obs = isObsolete(r.data_rilevazione);
                  return (
                    <tr key={r.id} className={`border-t hover:bg-muted/30 ${obs ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2">
                        <div>{r.descrizione_unita || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.id_unita_stoccaggio ? `#${r.id_unita_stoccaggio}` : ''}{r.comune ? ` · ${r.comune} (${r.provincia || ''})` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.sito}</td>
                      <td className="px-3 py-2">{fmtDate(r.data_rilevazione)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.class1_kg, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.class2_kg, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.class3_kg, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.class4_kg, 0)}</td>
                      <td className="px-3 py-2 text-right">{fmt(r.class9_kg, 0)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(tot / 1000)}</td>
                      <td className="px-3 py-2">
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-7" onClick={() => handleNuova(r)}>
                              <ClipboardEdit className="w-3 h-3 mr-1" /> Nuova
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7" onClick={() => handleStorico(r)}>
                              <History className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-red-600 hover:text-red-700" onClick={() => setDaEliminare(r)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {righe.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-4 text-center text-muted-foreground">Nessuna rilevazione. Usa "Importa rilevazione iniziale" o "Aggiungi rilevazione".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RilevazioneForm
        open={showForm}
        onClose={() => setShowForm(false)}
        precompilato={precompilato}
        sitiSuggeriti={sitiSuggeriti}
        onSaved={loadRilevazioni}
      />

      <StoricoRilevazioni
        open={showStorico}
        onClose={() => setShowStorico(false)}
        sito={storicoSito}
        rilevazioni={storicoRecords}
      />

      <AlertDialog open={!!daEliminare} onOpenChange={(open) => { if (!open) setDaEliminare(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina unità locale di stoccaggio</AlertDialogTitle>
            <AlertDialogDescription>
              {daEliminare && (
                <span>
                  Verranno cancellate tutte le rilevazioni di <strong>{daEliminare.sito}</strong>,
                  {' '}{(daEliminare.tutteLeRilevazioni || []).length} in totale, e il sito sparirà dalla situazione giacenze.
                  {' '}L'operazione non si può annullare e non tocca gli ordini né le dichiarazioni.
                  {' '}Usala per le unità che non sono più contrattualizzate come stoccaggio.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminando}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleElimina} disabled={eliminando} className="bg-red-600 hover:bg-red-700">
              {eliminando ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={seedConfirm} onOpenChange={setSeedConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importa rilevazione iniziale</AlertDialogTitle>
            <AlertDialogDescription>
              {seedSimula && (
                <span>
                  Verranno inseriti {seedSimula.da_creare} record GiacenzaStoccaggio con data {seedSimula.data_rilevazione}.
                  {seedSimula.ignorati > 0 && ` (${seedSimula.ignorati} già presenti e saranno saltati).`}
                  {' '}Confermi l'inserimento?
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={seeding}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleSeedConfirm} disabled={seeding}>
              {seeding ? 'Inserimento...' : 'Conferma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Plus, PencilLine, Loader2, ListPlus, Trash2 } from 'lucide-react';
import { RUOLI, CATEGORIE, CATALOGO_PROPOSTO } from '@/lib/qualifica';

// Catalogo dei documenti richiesti per la qualifica.
// Ogni voce dice a quali ruoli si applica e come si calcola la scadenza.

const VUOTO = {
  nome: '', categoria: 'altro', si_applica_a: '', obbligatorio: true, tipo_scadenza: 'da_documento',
  validita_mesi: '', validita_giorni: '', preavviso_giorni: 60, riferimento_normativo: '', descrizione: '',
  ordine: 100, attivo: true,
};

const SCADENZE = {
  da_documento: 'Scritta sul documento',
  da_emissione: 'Periodo fisso dalla data di emissione',
  nessuna: 'Non scade',
};

function descriviScadenza(t) {
  if (t.tipo_scadenza === 'nessuna') return 'Non scade';
  if (t.tipo_scadenza === 'da_emissione') {
    const parti = [];
    if (t.validita_mesi) parti.push(t.validita_mesi + ' mesi');
    if (t.validita_giorni) parti.push(t.validita_giorni + ' giorni');
    return (parti.join(' e ') || 'Periodo da definire') + ' dall\'emissione';
  }
  return 'Scritta sul documento';
}

export default function CatalogoDocumenti({ open, onClose, onModificato }) {
  const [voci, setVoci] = useState([]);
  const [caricando, setCaricando] = useState(false);
  const [modifica, setModifica] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const { toast } = useToast();

  const carica = async () => {
    setCaricando(true);
    try {
      const r = await base44.entities.TipoDocumentoQualifica.list('ordine', 500);
      setVoci(r);
    } catch (e) {
      toast({ title: 'Catalogo non disponibile', description: e.message || String(e), variant: 'destructive' });
    }
    setCaricando(false);
  };

  useEffect(() => { if (open) { carica(); setModifica(null); } }, [open]);

  const salva = async () => {
    if (!modifica.nome.trim()) { toast({ title: 'Il nome è obbligatorio', variant: 'destructive' }); return; }
    if (!modifica.si_applica_a) { toast({ title: 'Scegli almeno un ruolo', variant: 'destructive' }); return; }
    setSalvando(true);
    const numero = (v) => (v === '' || v == null ? null : Number(v));
    const dati = {
      nome: modifica.nome.trim(),
      categoria: modifica.categoria,
      si_applica_a: modifica.si_applica_a,
      obbligatorio: !!modifica.obbligatorio,
      tipo_scadenza: modifica.tipo_scadenza,
      validita_mesi: modifica.tipo_scadenza === 'da_emissione' ? numero(modifica.validita_mesi) : null,
      validita_giorni: modifica.tipo_scadenza === 'da_emissione' ? numero(modifica.validita_giorni) : null,
      preavviso_giorni: numero(modifica.preavviso_giorni) ?? 60,
      riferimento_normativo: modifica.riferimento_normativo,
      descrizione: modifica.descrizione,
      ordine: numero(modifica.ordine) ?? 100,
      attivo: modifica.attivo !== false,
    };
    try {
      if (modifica.id) await base44.entities.TipoDocumentoQualifica.update(modifica.id, dati);
      else await base44.entities.TipoDocumentoQualifica.create(dati);
      setModifica(null);
      await carica();
      onModificato();
    } catch (e) {
      toast({ title: 'Salvataggio non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setSalvando(false);
  };

  // Una voce gia' usata da documenti caricati non si cancella: si disattiva, cosi'
  // lo storico resta leggibile.
  const disattivaOElimina = async (voce) => {
    try {
      const usati = await base44.entities.DocumentoQualifica.filter({ tipo_documento_id: voce.id }, '-created_date', 1);
      if (usati.length > 0) {
        await base44.entities.TipoDocumentoQualifica.update(voce.id, { attivo: false });
        toast({ title: 'Voce disattivata', description: 'Ci sono documenti caricati di questo tipo, quindi la voce resta in archivio.' });
      } else {
        await base44.entities.TipoDocumentoQualifica.delete(voce.id);
      }
      await carica();
      onModificato();
    } catch (e) {
      toast({ title: 'Operazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
  };

  const caricaProposto = async () => {
    setSalvando(true);
    try {
      const presenti = new Set(voci.map(v => String(v.nome).trim().toLowerCase()));
      const nuove = CATALOGO_PROPOSTO.filter(v => !presenti.has(v.nome.toLowerCase()));
      for (const v of nuove) await base44.entities.TipoDocumentoQualifica.create({ ...v, attivo: true });
      await carica();
      onModificato();
      toast({ title: nuove.length ? `${nuove.length} voci aggiunte` : 'L\'elenco proposto è già presente' });
    } catch (e) {
      toast({ title: 'Caricamento non riuscito', description: e.message || String(e), variant: 'destructive' });
    }
    setSalvando(false);
  };

  const ruoliScelti = modifica ? modifica.si_applica_a.split(',').filter(Boolean) : [];
  const commutaRuolo = (r) => {
    const s = new Set(ruoliScelti);
    s.has(r) ? s.delete(r) : s.add(r);
    setModifica({ ...modifica, si_applica_a: Object.keys(RUOLI).filter(k => s.has(k)).join(',') });
  };

  const campo = 'block mt-1 w-full px-2 py-1.5 rounded-md border bg-card text-sm text-foreground';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catalogo dei documenti</DialogTitle>
          <DialogDescription>
            Quali documenti chiedere a ciascun ruolo e come si calcola la loro scadenza. L'agente usa queste regole e,
            dove mancano, ricava da solo la validità dalla normativa.
          </DialogDescription>
        </DialogHeader>

        {modifica ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-muted-foreground sm:col-span-2">
                Nome del documento
                <input className={campo} value={modifica.nome} onChange={(e) => setModifica({ ...modifica, nome: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Categoria
                <select className={campo} value={modifica.categoria} onChange={(e) => setModifica({ ...modifica, categoria: e.target.value })}>
                  {Object.entries(CATEGORIE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Scadenza
                <select className={campo} value={modifica.tipo_scadenza} onChange={(e) => setModifica({ ...modifica, tipo_scadenza: e.target.value })}>
                  {Object.entries(SCADENZE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              {modifica.tipo_scadenza === 'da_emissione' && (
                <>
                  <label className="text-xs text-muted-foreground">
                    Validità in mesi
                    <input type="number" min="0" className={campo} value={modifica.validita_mesi ?? ''} onChange={(e) => setModifica({ ...modifica, validita_mesi: e.target.value })} />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    Validità in giorni
                    <input type="number" min="0" className={campo} value={modifica.validita_giorni ?? ''} onChange={(e) => setModifica({ ...modifica, validita_giorni: e.target.value })} />
                  </label>
                </>
              )}
              <label className="text-xs text-muted-foreground">
                Preavviso in giorni
                <input type="number" min="0" className={campo} value={modifica.preavviso_giorni ?? ''} onChange={(e) => setModifica({ ...modifica, preavviso_giorni: e.target.value })} />
              </label>
              <label className="text-xs text-muted-foreground">
                Ordine di visualizzazione
                <input type="number" className={campo} value={modifica.ordine ?? ''} onChange={(e) => setModifica({ ...modifica, ordine: e.target.value })} />
              </label>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Richiesto a</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(RUOLI).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => commutaRuolo(k)}
                    className={`px-2.5 py-1 rounded-full border text-xs ${ruoliScelti.includes(k) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!modifica.obbligatorio} onChange={(e) => setModifica({ ...modifica, obbligatorio: e.target.checked })} />
              Obbligatorio per la qualifica
            </label>

            <label className="block text-xs text-muted-foreground">
              Cosa deve contenere
              <textarea rows={2} className={campo} value={modifica.descrizione || ''} onChange={(e) => setModifica({ ...modifica, descrizione: e.target.value })} />
            </label>
            <label className="block text-xs text-muted-foreground">
              Riferimento normativo
              <input className={campo} value={modifica.riferimento_normativo || ''} onChange={(e) => setModifica({ ...modifica, riferimento_normativo: e.target.value })} />
            </label>

            <div className="flex gap-2 pt-1">
              <Button onClick={salva} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Salva</Button>
              <Button variant="ghost" onClick={() => setModifica(null)}>Annulla</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setModifica({ ...VUOTO })}><Plus className="w-4 h-4 mr-1" />Nuovo documento</Button>
              <Button size="sm" variant="outline" onClick={caricaProposto} disabled={salvando}>
                {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ListPlus className="w-4 h-4 mr-1" />}
                Aggiungi l'elenco proposto
              </Button>
            </div>

            {caricando ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Caricamento…</div>
            ) : voci.length === 0 ? (
              <div className="border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
                Il catalogo è vuoto. Inserisci i tuoi documenti oppure parti dall'elenco proposto e adattalo.
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {voci.map(v => (
                  <div key={v.id} className={`flex items-start justify-between gap-3 px-3 py-2.5 ${v.attivo === false ? 'opacity-50' : ''}`}>
                    <div className="min-w-0">
                      <div className="font-medium">
                        {v.nome}
                        {!v.obbligatorio && <span className="ml-2 text-xs font-normal text-muted-foreground">facoltativo</span>}
                        {v.attivo === false && <span className="ml-2 text-xs font-normal text-muted-foreground">disattivato</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {String(v.si_applica_a || '').split(',').filter(Boolean).map(r => RUOLI[r] || r).join(', ')}
                        {' · '}{descriviScadenza(v)}
                        {' · preavviso '}{v.preavviso_giorni ?? 60}{' giorni'}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setModifica({ ...VUOTO, ...v })}><PencilLine className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700" onClick={() => disattivaOElimina(v)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

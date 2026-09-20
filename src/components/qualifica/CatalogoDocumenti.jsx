import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Plus, PencilLine, Loader2, ListPlus, Trash2, X, AlertTriangle } from 'lucide-react';
import { RUOLI, CATEGORIE, CATALOGO_PROPOSTO } from '@/lib/qualifica';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';

// Catalogo dei documenti richiesti per la qualifica.
//
// Una voce si chiede in due modi, mai insieme:
// - per ruolo: vale per tutti i soggetti che quell'anno fanno raccolta, trasporto
//   secondarie, impianto, stoccaggio o cliente;
// - per fornitore: vale solo per i nomi indicati e i ruoli non contano. Serve ai
//   documenti che non riguardano una categoria intera ma un fornitore solo, per
//   esempio le patenti degli autisti o la CQC.

const VUOTO = {
  nome: '', categoria: 'altro', si_applica_a: '', solo_per_soggetti: [], obbligatorio: true, tipo_scadenza: 'da_documento',
  validita_mesi: '', validita_giorni: '', preavviso_giorni: 60, riferimento_normativo: '', descrizione: '',
  ordine: 100, attivo: true,
};

// I fornitori indicati su una voce, sempre nella forma { chiave, nome }.
const nominati = (v) => (Array.isArray(v && v.solo_per_soggetti) ? v.solo_per_soggetti : [])
  .map(s => (typeof s === 'string' ? { chiave: normalizzaRagioneSociale(s), nome: s } : s))
  .filter(s => s && s.chiave);

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

export default function CatalogoDocumenti({ open, onClose, onModificato, soggetti = [], anno }) {
  const [voci, setVoci] = useState([]);
  const [caricando, setCaricando] = useState(false);
  const [modifica, setModifica] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [anagrafica, setAnagrafica] = useState([]);
  const [cercaSoggetto, setCercaSoggetto] = useState('');
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

  useEffect(() => {
    if (!open) return;
    carica();
    setModifica(null);
    setCercaSoggetto('');
    // Si sceglie fra i soggetti dell'anno e, per chi non ha ancora lavorato,
    // fra tutta l'anagrafica dei fornitori.
    base44.entities.Fornitore.list('ragione_sociale', 1000).then(setAnagrafica).catch(() => setAnagrafica([]));
  }, [open]);

  // L'elenco da cui scegliere: prima i soggetti da qualificare quest'anno, poi il resto.
  const scegliibili = React.useMemo(() => {
    const visti = new Map();
    for (const s of soggetti) if (s.chiave && !visti.has(s.chiave)) visti.set(s.chiave, { chiave: s.chiave, nome: s.nome, nellAnno: true });
    for (const f of anagrafica) {
      const k = normalizzaRagioneSociale(f.ragione_sociale);
      if (k && !visti.has(k)) visti.set(k, { chiave: k, nome: f.ragione_sociale, nellAnno: false });
    }
    return [...visti.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));
  }, [soggetti, anagrafica]);

  const chiaviAnno = React.useMemo(() => new Set(soggetti.map(s => s.chiave)), [soggetti]);
  const scelti = modifica ? nominati(modifica) : [];

  const aggiungiSoggetto = (testo) => {
    const nome = String(testo || '').trim();
    const chiave = normalizzaRagioneSociale(nome);
    if (!chiave) return;
    if (scelti.some(s => s.chiave === chiave)) { setCercaSoggetto(''); return; }
    // Se il nome corrisponde a un soggetto noto si salva la sua ragione sociale intera.
    const noto = scegliibili.find(s => s.chiave === chiave);
    setModifica({ ...modifica, solo_per_soggetti: [...scelti, { chiave, nome: noto ? noto.nome : nome }] });
    setCercaSoggetto('');
  };

  const togliSoggetto = (chiave) => setModifica({ ...modifica, solo_per_soggetti: scelti.filter(s => s.chiave !== chiave) });

  const salva = async () => {
    if (!modifica.nome.trim()) { toast({ title: 'Il nome è obbligatorio', variant: 'destructive' }); return; }
    if (!modifica.si_applica_a && scelti.length === 0) {
      toast({ title: 'A chi va chiesto?', description: 'Scegli almeno un ruolo oppure indica i fornitori a cui chiederlo.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    const numero = (v) => (v === '' || v == null ? null : Number(v));
    const dati = {
      nome: modifica.nome.trim(),
      categoria: modifica.categoria,
      // Con i fornitori indicati i ruoli non contano: non si salvano, altrimenti
      // la voce direbbe una cosa e ne farebbe un'altra.
      si_applica_a: scelti.length > 0 ? '' : modifica.si_applica_a,
      solo_per_soggetti: scelti,
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

  const ruoliScelti = modifica ? String(modifica.si_applica_a || '').split(',').filter(Boolean) : [];
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

            <div className={scelti.length > 0 ? 'opacity-40 pointer-events-none' : ''}>
              <div className="text-xs text-muted-foreground mb-1">Richiesto a tutti i soggetti con questo ruolo</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(RUOLI).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => commutaRuolo(k)}
                    className={`px-2.5 py-1 rounded-full border text-xs ${ruoliScelti.includes(k) ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">
                Oppure richiesto solo a questi fornitori
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Per i documenti che non riguardano una categoria intera ma un fornitore solo: le patenti degli autisti,
                la CQC, un’autorizzazione particolare. Indicando anche un solo nome, i ruoli qui sopra non contano più
                e il documento non viene chiesto agli altri.
              </p>
              {scelti.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {scelti.map(s => {
                    const noto = scegliibili.find(x => x.chiave === s.chiave);
                    return (
                      <span key={s.chiave} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-card text-xs">
                        {s.nome || s.chiave}
                        {noto && !noto.nellAnno && <span className="text-amber-700" title={`Non risulta fra i soggetti da qualificare del ${anno}`}>·&nbsp;fuori anno</span>}
                        {!noto && <span className="text-amber-700" title="Non trovato né fra i soggetti dell’anno né in anagrafica">·&nbsp;non trovato</span>}
                        <button type="button" onClick={() => togliSoggetto(s.chiave)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  list="qualifica-soggetti"
                  className="flex-1 px-2 py-1.5 rounded-md border bg-card text-sm text-foreground"
                  placeholder="Ragione sociale del fornitore…"
                  value={cercaSoggetto}
                  onChange={(e) => setCercaSoggetto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); aggiungiSoggetto(cercaSoggetto); } }}
                />
                <datalist id="qualifica-soggetti">
                  {scegliibili.map(s => <option key={s.chiave} value={s.nome} />)}
                </datalist>
                <Button type="button" size="sm" variant="outline" onClick={() => aggiungiSoggetto(cercaSoggetto)} disabled={!cercaSoggetto.trim()}>
                  Aggiungi
                </Button>
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
                {voci.map(v => {
                  const suoi = nominati(v);
                  const fuoriAnno = suoi.filter(s => !chiaviAnno.has(s.chiave));
                  return (
                  <div key={v.id} className={`flex items-start justify-between gap-3 px-3 py-2.5 ${v.attivo === false ? 'opacity-50' : ''}`}>
                    <div className="min-w-0">
                      <div className="font-medium">
                        {v.nome}
                        {!v.obbligatorio && <span className="ml-2 text-xs font-normal text-muted-foreground">facoltativo</span>}
                        {v.attivo === false && <span className="ml-2 text-xs font-normal text-muted-foreground">disattivato</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {suoi.length > 0
                          ? <span className="text-foreground">Solo per {suoi.map(s => s.nome || s.chiave).join(', ')}</span>
                          : String(v.si_applica_a || '').split(',').filter(Boolean).map(r => RUOLI[r] || r).join(', ')}
                        {' · '}{descriviScadenza(v)}
                        {' · preavviso '}{v.preavviso_giorni ?? 60}{' giorni'}
                      </div>
                      {v.attivo !== false && fuoriAnno.length > 0 && (
                        <div className="text-xs text-amber-700 flex items-start gap-1 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                          <span>
                            {fuoriAnno.map(s => s.nome || s.chiave).join(', ')} non {fuoriAnno.length === 1 ? 'risulta' : 'risultano'} fra i soggetti da
                            qualificare del {anno}: questo documento non verrà mai chiesto. Controlla la ragione sociale
                            oppure includi il soggetto nell’anno.
                          </span>
                        </div>
                      )}
                      {v.attivo !== false && suoi.length === 0 && !String(v.si_applica_a || '').split(',').filter(Boolean).length && (
                        <div className="text-xs text-amber-700 flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Non è richiesto a nessuno: manca sia il ruolo sia il fornitore.</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setModifica({ ...VUOTO, ...v })}><PencilLine className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700" onClick={() => disattivaOElimina(v)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

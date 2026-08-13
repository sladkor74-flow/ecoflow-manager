import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Save, X, AlertTriangle, Pencil, Lock, CalendarX, RotateCcw } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

const REGIONI = ['Campania', 'Puglia', 'Basilicata', 'Calabria', 'Lazio', 'Molise', 'Abruzzo', 'Sicilia', 'Sardegna', 'Toscana', 'Lombardia', 'Piemonte', 'Veneto', 'Emilia-Romagna', 'Marche', 'Umbria', 'Liguria', 'Friuli-Venezia Giulia', 'Trentino-Alto Adige', 'Valle d\'Aosta'];

// Verifica se una tariffa è archiviata (non più modificabile nelle date)
const isArchiviata = (t) => {
  if (t.stato === 'non_attivo') return true;
  if (t.data_fine_validita) {
    const fine = new Date(t.data_fine_validita);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    if (fine < oggi) return true;
  }
  return false;
};

// Verifica se una tariffa è "aperta" (attiva senza data fine)
const isAperta = (t) => t.stato === 'attivo' && !t.data_fine_validita;

export default function TariffePassivaManager() {
  const [tariffe, setTariffe] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [erroreSalvataggio, setErroreSalvataggio] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ valore: 0, unita_misura: '€/t', note: '', regione: '', data_inizio_validita: '', data_fine_validita: '' });
  const [editErrore, setEditErrore] = useState('');
  const [form, setForm] = useState({
    fornitore_id: '', fornitore_nome: '',
    unita_misura: '€/t', valore: 0, regione: '', data_inizio_validita: '', data_fine_validita: '', note: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([
        base44.entities.Tariffa.filter({ direzione: 'PASSIVA', tipologia: 'RETE' }),
        base44.entities.Fornitore.filter({ stato: 'attivo' }),
      ]);
      // Ordina per fornitore poi regione poi data inizio desc
      t.sort((a, b) =>
        (a.fornitore_nome || '').localeCompare(b.fornitore_nome || '') ||
        (a.regione || '').localeCompare(b.regione || '') ||
        new Date(b.data_inizio_validita || 0).getTime() - new Date(a.data_inizio_validita || 0).getTime()
      );
      setTariffe(t); setFornitori(f);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Verifica sovrapposizione date con tariffe esistenti (esclude eventuali tariffe aperte che verranno chiuse automaticamente)
  const verificaSovrapposizione = (fNorm, regioneForm, inizio, fine, excludeId = null) => {
    for (const t of tariffe) {
      if (excludeId && t.id === excludeId) continue;
      if ((t.fornitore_nome || '').toLowerCase().trim() !== fNorm) continue;
      const tReg = (t.regione || '').trim().toUpperCase();
      if (tReg !== regioneForm) continue;
      const tInizio = t.data_inizio_validita ? new Date(t.data_inizio_validita) : null;
      const tFine = t.data_fine_validita ? new Date(t.data_fine_validita) : null;
      const inizioMax = inizio && tInizio ? new Date(Math.max(inizio.getTime(), tInizio.getTime())) : (inizio || tInizio);
      const fineMin = fine && tFine ? new Date(Math.min(fine.getTime(), tFine.getTime())) : (fine || tFine);
      if (!inizioMax && !fineMin) return t;
      if (inizioMax && fineMin && inizioMax <= fineMin) return t;
      if (inizioMax && !fineMin) return t;
    }
    return null;
  };

  const add = async () => {
    if (!form.fornitore_id || !form.valore) return;
    setErroreSalvataggio('');
    const f = fornitori.find(x => x.id === form.fornitore_id);
    const fNome = f?.ragione_sociale;
    const fNorm = (fNome || '').toLowerCase().trim();
    const regioneForm = (form.regione || '').trim().toUpperCase();
    const inizioNuova = form.data_inizio_validita ? new Date(form.data_inizio_validita) : new Date();
    inizioNuova.setHours(0, 0, 0, 0);

    // Cerca tariffa attiva aperta (senza data fine) per stesso fornitore+regione
    const attivaAperta = tariffe.find(t => {
      if ((t.fornitore_nome || '').toLowerCase().trim() !== fNorm) return false;
      const tReg = (t.regione || '').trim().toUpperCase();
      if (tReg !== regioneForm) return false;
      return isAperta(t);
    });

    if (attivaAperta) {
      // Verifica coerenza: la nuova data inizio deve essere successiva alla data inizio della tariffa aperta
      const tInizioAperta = attivaAperta.data_inizio_validita ? new Date(attivaAperta.data_inizio_validita) : null;
      if (tInizioAperta && inizioNuova <= tInizioAperta) {
        setErroreSalvataggio(`La nuova tariffa ha data inizio (${inizioNuova.toLocaleDateString('it-IT')}) precedente o uguale alla tariffa attiva aperta (${tInizioAperta.toLocaleDateString('it-IT')}). Imposta una data inizio successiva.`);
        return;
      }
      // Chiudi automaticamente la tariffa aperta: data_fine = inizioNuova - 1 giorno
      const fineChiusura = new Date(inizioNuova);
      fineChiusura.setDate(fineChiusura.getDate() - 1);
      await base44.entities.Tariffa.update(attivaAperta.id, {
        data_fine_validita: fineChiusura.toISOString().slice(0, 10),
        stato: 'non_attivo',
      });
    } else {
      // Nessuna tariffa aperta: verifica sovrapposizioni con tariffe a date definite
      const fineNuova = form.data_fine_validita ? new Date(form.data_fine_validita) : null;
      const sovrapposta = verificaSovrapposizione(fNorm, regioneForm, inizioNuova, fineNuova);
      if (sovrapposta) {
        const periodoEsistente = `${sovrapposta.data_inizio_validita ? new Date(sovrapposta.data_inizio_validita).toLocaleDateString('it-IT') : 'n.d.'} → ${sovrapposta.data_fine_validita ? new Date(sovrapposta.data_fine_validita).toLocaleDateString('it-IT') : 'aperto'}`;
        setErroreSalvataggio(`Sovrapposizione rilevata con tariffa esistente per ${sovrapposta.fornitore_nome} (${sovrapposta.regione || 'tutte le zone'}, periodo: ${periodoEsistente}). Modifica le date di validità prima di salvare.`);
        return;
      }
    }

    await base44.entities.Tariffa.create({
      fornitore_id: form.fornitore_id,
      fornitore_nome: f?.ragione_sociale,
      servizio_id: '', servizio_nome: 'TRASPORTO RETE',
      unita_misura: form.unita_misura,
      valore: Number(form.valore),
      regione: form.regione,
      data_inizio_validita: form.data_inizio_validita || undefined,
      data_fine_validita: form.data_fine_validita || undefined,
      direzione: 'PASSIVA',
      tipologia: 'RETE',
      stato: 'attivo',
      note: form.note,
    });
    setForm({ fornitore_id: '', fornitore_nome: '', unita_misura: '€/t', valore: 0, regione: '', data_inizio_validita: '', data_fine_validita: '', note: '' });
    setShowForm(false); load();
  };

  // Avvia modifica di una tariffa
  const startEdit = (t) => {
    setEditingId(t.id);
    setEditErrore('');
    setEditForm({
      valore: t.valore || 0,
      unita_misura: t.unita_misura || '€/t',
      note: t.note || '',
      regione: t.regione || '',
      data_inizio_validita: t.data_inizio_validita ? t.data_inizio_validita.slice(0, 10) : '',
      data_fine_validita: t.data_fine_validita ? t.data_fine_validita.slice(0, 10) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditErrore('');
  };

  const saveEdit = async (t) => {
    setEditErrore('');
    const archiviata = isArchiviata(t);
    const updateData = {
      valore: Number(editForm.valore),
      unita_misura: editForm.unita_misura,
      note: editForm.note,
    };

    // Per tariffe non archiviate, permetti modifica anche di regione e date (con verifica sovrapposizione)
    if (!archiviata) {
      updateData.regione = editForm.regione;
      const nuovaInizio = editForm.data_inizio_validita ? new Date(editForm.data_inizio_validita) : null;
      const nuovaFine = editForm.data_fine_validita ? new Date(editForm.data_fine_validita) : null;
      updateData.data_inizio_validita = editForm.data_inizio_validita || undefined;
      updateData.data_fine_validita = editForm.data_fine_validita || undefined;

      // Verifica sovrapposizione escludendo se stesso
      const fNorm = (t.fornitore_nome || '').toLowerCase().trim();
      const regioneForm = (editForm.regione || '').trim().toUpperCase();
      const sovrapposta = verificaSovrapposizione(fNorm, regioneForm, nuovaInizio, nuovaFine, t.id);
      if (sovrapposta) {
        setEditErrore(`Sovrapposizione con tariffa esistente (${sovrapposta.data_inizio_validita || 'n.d.'} → ${sovrapposta.data_fine_validita || 'aperto'}).`);
        return;
      }
    }

    await base44.entities.Tariffa.update(t.id, updateData);
    setEditingId(null);
    load();
  };

  // Chiudi il periodo di validità di una tariffa aperta
  const closePeriod = async (t) => {
    const dataFine = prompt('Inserisci la data di fine validità (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!dataFine) return;
    const dt = new Date(dataFine);
    if (isNaN(dt.getTime())) {
      alert('Data non valida');
      return;
    }
    await base44.entities.Tariffa.update(t.id, {
      data_fine_validita: dataFine,
      stato: 'non_attivo',
    });
    load();
  };

  // Riapri una tariffa archiviata (rimuovi data fine, riattiva)
  const reopenPeriod = async (t) => {
    if (!confirm('Riaprire questa tariffa? Verrà impostata come attiva senza data di fine. Verifica che non ci siano sovrapposizioni.')) return;
    await base44.entities.Tariffa.update(t.id, {
      data_fine_validita: undefined,
      stato: 'attivo',
    });
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const tariffeVisibili = showOnlyActive ? tariffe.filter(t => t.stato === 'attivo') : tariffe;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading font-semibold text-lg">Tariffe Fatturazione Passiva — Rete (Raccoglitori)</h2>
          <p className="text-sm text-muted-foreground">Configura i compensi ai raccoglitori per la raccolta RETE. Metodo esclusivo: €/t oppure €/Viaggio. Le tariffe sono storicizzate: la modifica chiude automaticamente il periodo precedente.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
              className="w-4 h-4 rounded border-input accent-primary"
            />
            <span className="text-muted-foreground">Mostra solo tariffe attive</span>
          </label>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? 'Annulla' : 'Aggiungi Tariffa'}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="border-2 border-primary/30 rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fornitore (Raccoglitore) *</label>
              <Select value={form.fornitore_id} onValueChange={v => setForm({ ...form, fornitore_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleziona fornitore" /></SelectTrigger>
                <SelectContent>
                  {fornitori.filter(f => f.tipo === 'trasportatore' || !f.tipo).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Metodo di Calcolo *</label>
              <Select value={form.unita_misura} onValueChange={v => setForm({ ...form, unita_misura: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="€/t">€/t (al tonnellaggio)</SelectItem>
                  <SelectItem value="€/viaggio">€/Viaggio (a viaggio)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Zona/Regione (opzionale)</label>
              <Select value={form.regione} onValueChange={v => setForm({ ...form, regione: v })}>
                <SelectTrigger><SelectValue placeholder="Tutte le zone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Tutte le zone</SelectItem>
                  {REGIONI.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Valore Tariffa *</label>
              <Input type="number" step="0.01" placeholder="es. 71" value={form.valore} onChange={e => setForm({ ...form, valore: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data Inizio Validità</label>
              <Input type="date" value={form.data_inizio_validita} onChange={e => setForm({ ...form, data_inizio_validita: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Data Fine Validità (opz.)</label>
              <Input type="date" value={form.data_fine_validita} onChange={e => setForm({ ...form, data_fine_validita: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Note</label>
              <Input placeholder="Note opzionali" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          {erroreSalvataggio && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erroreSalvataggio}</span>
            </div>
          )}
          <Button size="sm" onClick={add} disabled={!form.fornitore_id || !form.valore}>
            <Save className="w-4 h-4 mr-1" /> Salva Tariffa
          </Button>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-heading font-semibold">Fornitore (Raccoglitore)</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Metodo</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Zona/Regione</th>
              <th className="text-right px-3 py-2 font-heading font-semibold">Valore</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Validità dal</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Validità al</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Stato</th>
              <th className="text-left px-3 py-2 font-heading font-semibold">Note</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tariffeVisibili.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nessuna tariffa {showOnlyActive ? 'attiva' : 'configurata'}. Clicca "Aggiungi Tariffa" per iniziare.
                </td>
              </tr>
            )}
            {tariffeVisibili.map((t, i) => {
              const archiviata = isArchiviata(t);
              const aperta = isAperta(t);
              const isEditing = editingId === t.id;
              return (
                <tr key={t.id} className={`${i % 2 ? 'bg-muted/30' : ''} ${archiviata ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 font-medium">{t.fornitore_nome || '-'}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Select value={editForm.unita_misura} onValueChange={v => setEditForm({ ...editForm, unita_misura: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="€/t">€/t</SelectItem>
                          <SelectItem value="€/viaggio">€/Viaggio</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">{t.unita_misura}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing && !archiviata ? (
                      <Select value={editForm.regione} onValueChange={v => setEditForm({ ...editForm, regione: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Tutte</SelectItem>
                          {REGIONI.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      t.regione || <span className="text-muted-foreground italic">Tutte</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.valore}
                        onChange={e => setEditForm({ ...editForm, valore: e.target.value })}
                        className="h-8 w-24 text-right"
                      />
                    ) : (
                      <span className="font-semibold">{formatNumber(t.valore, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {isEditing && !archiviata ? (
                      <Input type="date" value={editForm.data_inizio_validita} onChange={e => setEditForm({ ...editForm, data_inizio_validita: e.target.value })} className="h-8 w-36" />
                    ) : (
                      t.data_inizio_validita ? new Date(t.data_inizio_validita).toLocaleDateString('it-IT') : '-'
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {isEditing && !archiviata ? (
                      <Input type="date" value={editForm.data_fine_validita} onChange={e => setEditForm({ ...editForm, data_fine_validita: e.target.value })} className="h-8 w-36" />
                    ) : (
                      t.data_fine_validita ? new Date(t.data_fine_validita).toLocaleDateString('it-IT') : <span className="italic">aperto</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {t.stato === 'attivo' ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">Attivo</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">Archiviata</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {isEditing ? (
                      <Input value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} className="h-8" />
                    ) : (
                      t.note || '-'
                    )}
                  </td>
                  <td className="text-right px-3 py-2 whitespace-nowrap">
                    {isEditing ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => saveEdit(t)} className="p-1 hover:bg-green-50 rounded" title="Salva">
                          <Save className="w-4 h-4 text-green-600" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 hover:bg-muted rounded" title="Annulla">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {editErrore && <span className="text-xs text-destructive ml-1" title={editErrore}>⚠</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => startEdit(t)} className="p-1 hover:bg-muted rounded" title={archiviata ? 'Modifica valore/note (date bloccate)' : 'Modifica'}>
                          {archiviata ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Pencil className="w-4 h-4 text-blue-500" />}
                        </button>
                        {aperta && (
                          <button onClick={() => closePeriod(t)} className="p-1 hover:bg-amber-50 rounded" title="Chiudi periodo (imposta data fine)">
                            <CalendarX className="w-4 h-4 text-amber-500" />
                          </button>
                        )}
                        {archiviata && (
                          <button onClick={() => reopenPeriod(t)} className="p-1 hover:bg-green-50 rounded" title="Riapri (riattiva senza data fine)">
                            <RotateCcw className="w-4 h-4 text-green-500" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!showOnlyActive && tariffe.length > tariffeVisibili.length && (
        <p className="text-xs text-muted-foreground text-center">
          {tariffe.length - tariffeVisibili.length} tariffe archiviate nascoste. Disattiva il filtro per visualizzarle.
        </p>
      )}
    </div>
  );
}
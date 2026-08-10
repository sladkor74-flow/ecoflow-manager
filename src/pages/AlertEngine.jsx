import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, Trash2, Power, PowerOff, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import AlertsPanel from '@/components/alerts/AlertsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MODULI = [
  { value: 'secondarie', label: 'Secondarie' },
  { value: 'primarie_rete', label: 'Primarie Rete' },
  { value: 'primarie_aci', label: 'Primarie ACI' },
  { value: 'terziarie', label: 'Terziarie' },
  { value: 'assegnati', label: 'Assegnati' },
];

const TIPI_REGOLA = [
  { value: 'tratta_autorizzata', label: 'Tratta Autorizzata (origine → destinazioni ammesse)' },
  { value: 'tratta_combinazione', label: 'Combinazione Classe + Tratta' },
  { value: 'campo_obbligatorio', label: 'Campo Obbligatorio' },
  { value: 'range_valori', label: 'Range Valori' },
  { value: 'sla_tempi', label: 'SLA Tempi' },
  { value: 'peso_congruenza', label: 'Congruenza Peso' },
  { value: 'province_inattive', label: 'Province Inattive (2 mesi consecutivi a zero)' },
  { value: 'mix_classi_deviazione', label: 'Deviazione Mix Classi Consorziale' },
  { value: 'scostamento_target', label: 'Scostamento Target Grave (Δ < -15%)' },
  { value: 'ritardo_sla', label: 'Ritardo SLA Critico (>12 gg o >20% fuori tempo)' },
  { value: 'anomalia_peso', label: 'Anomalia Peso/Destinazione (peso=0 o incongruente)' },
  { value: 'custom', label: 'Custom' },
];

export default function AlertEngine() {
  const [regole, setRegole] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [configJson, setConfigJson] = useState('{}');
  const [form, setForm] = useState({
    nome: '', descrizione: '', modulo: 'secondarie', tipo_regola: 'tratta_autorizzata',
    severita: 'warning', messaggio_alert: '', attiva: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await base44.entities.RegolaAlert.list('-created_date', 200);
      setRegole(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let config = {};
      try { config = JSON.parse(configJson); } catch (e) {
        alert('Config JSON non valido'); setSaving(false); return;
      }
      await base44.entities.RegolaAlert.create({ ...form, config });
      setShowForm(false);
      setForm({ nome: '', descrizione: '', modulo: 'secondarie', tipo_regola: 'tratta_autorizzata', severita: 'warning', messaggio_alert: '', attiva: true });
      setConfigJson('{}');
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleToggle = async (regola) => {
    try {
      await base44.entities.RegolaAlert.update(regola.id, { attiva: !regola.attiva });
      load();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (regola) => {
    if (!confirm(`Eliminare la regola "${regola.nome}"?`)) return;
    try {
      await base44.entities.RegolaAlert.delete(regola.id);
      load();
    } catch (e) { console.error(e); }
  };

  const handleRun = async (modulo) => {
    setRunning(modulo);
    try {
      const res = await base44.functions.invoke('runAlertEngine', { modulo });
      alert(`${res.data.alerts_creati} alert creati su ${res.data.record_scansionati} record scansionati`);
      load();
    } catch (e) { alert(e.message); }
    setRunning(null);
  };

  const sevBadge = {
    critico: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary" /> Alert & Engine di Controllo
        </h1>
        <p className="text-muted-foreground mt-1">Motore di validazione automatica per rilevare anomalie, discrepanze ed eccezioni operative.</p>
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts"><AlertTriangle className="w-4 h-4 mr-1.5" /> Alert Attivi</TabsTrigger>
          <TabsTrigger value="regole"><Shield className="w-4 h-4 mr-1.5" /> Gestione Regole</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <h2 className="text-lg font-heading font-semibold">Alert Operativi</h2>
              <AlertsPanel maxHeight="600px" />
            </div>
            <div className="space-y-3">
              <h2 className="text-lg font-heading font-semibold">Esecuzione Manuale</h2>
              <p className="text-sm text-muted-foreground">Lancia il motore di validazione su un modulo specifico:</p>
              <div className="space-y-2">
                {MODULI.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => handleRun(m.value)}
                    disabled={running === m.value}
                    className="w-full flex items-center justify-between px-4 py-2.5 border rounded-md hover:bg-accent disabled:opacity-50 text-sm"
                  >
                    <span>{m.label}</span>
                    {running === m.value ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="regole" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold">Regole di Validazione ({regole.length})</h2>
            <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Nuova Regola
            </button>
          </div>

          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h3 className="font-heading font-semibold">Nuova Regola di Alert</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">Nome regola *</label>
                  <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="es. REGOLA_ORIGINE_XYZ" />
                </div>
                <div>
                  <label className="text-xs font-medium">Modulo *</label>
                  <select value={form.modulo} onChange={e => setForm(p => ({ ...p, modulo: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    {MODULI.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Tipo regola *</label>
                  <select value={form.tipo_regola} onChange={e => setForm(p => ({ ...p, tipo_regola: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    {TIPI_REGOLA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Severità *</label>
                  <select value={form.severita} onChange={e => setForm(p => ({ ...p, severita: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critico">Critico</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium">Descrizione</label>
                  <input value={form.descrizione} onChange={e => setForm(p => ({ ...p, descrizione: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Descrizione della regola" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium">Messaggio alert</label>
                  <input value={form.messaggio_alert} onChange={e => setForm(p => ({ ...p, messaggio_alert: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Messaggio mostrato quando la regola è violata" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium">Config (JSON)</label>
                  <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} rows={5} className="w-full border rounded-md px-3 py-2 text-sm font-mono" placeholder='es. {"campo_origine":"stoccaggio","valore_origine":"NAPPI SUD SRL","destinazioni_ammesse":["TECNOGUM"]}' />
                  <p className="text-xs text-muted-foreground mt-1">Per tratta_autorizzata: campo_origine, valore_origine, campo_destinazione, destinazioni_ammesse[], case_sensitive. Per tratta_combinazione: campo_classe, valore_classe, campo_origine, origine_ammessa, campo_destinazione, destinazione_ammessa.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving || !form.nome} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Salva regola
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border text-sm hover:bg-accent">Annulla</button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Caricamento regole...</div>
          ) : (
            <div className="space-y-2">
              {regole.map((r) => (
                <div key={r.id} className={`border rounded-lg p-4 ${r.attiva ? '' : 'opacity-50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-heading font-semibold text-sm">{r.nome}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded border ${sevBadge[r.severita]}`}>{r.severita}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">{r.modulo}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-muted">{r.tipo_regola}</span>
                        {!r.attiva && <span className="text-xs px-2 py-0.5 rounded bg-muted">disattivata</span>}
                      </div>
                      {r.descrizione && <p className="text-sm text-muted-foreground">{r.descrizione}</p>}
                      {r.messaggio_alert && <p className="text-xs mt-1 italic">"{r.messaggio_alert}"</p>}
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Config</summary>
                        <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">{JSON.stringify(r.config, null, 2)}</pre>
                      </details>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleToggle(r)} title={r.attiva ? 'Disattiva' : 'Attiva'} className="p-2 rounded-md hover:bg-accent">
                        {r.attiva ? <Power className="w-4 h-4 text-green-600" /> : <PowerOff className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <button onClick={() => handleDelete(r)} title="Elimina" className="p-2 rounded-md hover:bg-accent">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {regole.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">Nessuna regola configurata. Crea la prima regola per iniziare.</div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
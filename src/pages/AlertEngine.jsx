import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Plus, Trash2, Power, PowerOff, Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import AlertsPanel from '@/components/alerts/AlertsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermessi } from '@/lib/permessi';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
// Il messaggio dopo «Esegui», coi record dell'anno prima e i numeri all'italiana
// (revisione del 13/10/2026): sta in src/lib perche' le prove lo leggono in node.
import { messaggioEsecuzione } from '@/lib/messaggioMotoreAlert';
// Il giorno della configurazione di una regola (decisioni dell'utente del
// 13/10/2026): si scrive quando la regola si crea, e Attiva/Disattiva non lo
// cambia. Il motore lo legge con la stessa regola (base44/shared, stesso nome).
import { configurataOggi, cambioAttivazione, giornoDellaConfigurazione } from '@/lib/configurazioneRegolaAlert';

const MODULI = [
  { value: 'secondarie', label: 'Secondarie' },
  { value: 'primarie_rete', label: 'Primarie Rete' },
  { value: 'primarie_aci', label: 'Primarie ACI' },
  { value: 'terziarie', label: 'Terziarie' },
  { value: 'assegnati', label: 'Assegnati' },
  { value: 'extra_raccolta', label: 'Extra Raccolta' },
];

// I controlli che il motore fa sempre, in ogni modulo di movimenti, senza una
// regola da configurare: li chiede la commessa. Le date obbligatorie sono la
// regola dell'utente del 22/09/2026 ("vanno segnalate e questo vale sempre dove
// ci sono ordini terminati").
// Il testo dice dove si rivaluta da solo: dal 22/09/2026 anche le schede di
// extra raccolta avviano il motore (il workflow AlertEngineAutoRun ascolta le
// righe 'extra_raccolta' del registro; una scheda senza fine trasporto, che la
// riga non la scrive, lo avvia dalla pagina con dopoCaricamento). L'avviso che
// diceva il contrario e' tolto.
const CONTROLLI_FISSI = [
  {
    nome: 'Ordini terminati con date obbligatorie mancanti o incoerenti',
    testo: 'Immissione, inizio e fine trasporto sono obbligatorie nei formulari. Un alert per modulo (primarie rete, primarie ACI, secondarie, terziarie, extra raccolta) e per canale, con l\'elenco degli ordini: ID ordine, formulario e date che mancano o non tornano, di qualunque anno. Critico se a qualcuno manca la fine trasporto, che lo toglie da ogni periodo. Si chiude da solo quando le date arrivano. Primarie, secondarie e terziarie si rivalutano a ogni caricamento del loro file, l\'extra raccolta a ogni scheda salvata.',
  },
  {
    nome: 'Conferimento fuori rotta',
    testo: 'Formulari chiusi su una destinazione dove quell\'origine non va mai, letti dalla storia dell\'anno: primarie e secondarie, rete e ACI separate.',
  },
];

// I tipi di regola che il motore valuta davvero (runAlertEngine: checkRegola e
// i controlli aggregati), e soltanto quelli. Fino all'11/10/2026 il menu offriva
// anche campo obbligatorio, range valori, SLA tempi, congruenza peso e custom, che
// il motore non ha mai trattato: una regola di quei tipi risultava attiva e non
// produceva mai niente, senza un errore. Le tre liste - questo menu, l'elenco
// dell'archivio (base44/entities/RegolaAlert.jsonc) e il motore - le tiene
// allineate prove/regoleAlert.mjs.
const TIPI_REGOLA = [
  { value: 'tratta_autorizzata', label: 'Tratta Autorizzata (origine → destinazioni ammesse)' },
  { value: 'tratta_combinazione', label: 'Combinazione Classe + Tratta' },
  { value: 'tratte_autorizzate_classe', label: 'Tratte autorizzate per classe (origine → destinazione ammesse)' },
  { value: 'province_inattive', label: 'Province Inattive (2 mesi consecutivi a zero)' },
  { value: 'mix_classi_deviazione', label: 'Deviazione Mix Classi Consorziale' },
  { value: 'scostamento_target', label: 'Scostamento Target Grave (Δ < -15%)' },
  { value: 'ritardo_sla', label: 'Ritardo SLA Critico (>12 gg o >20% fuori tempo)' },
  { value: 'anomalia_peso', label: 'Anomalia peso (ritirato ma peso effettivo mancante)' },
];
const TIPI_VALUTATI = new Set(TIPI_REGOLA.map(t => t.value));

// Il giorno della configurazione all'italiana (gg/mm/aaaa), o '' se la regola
// non ne ha uno di cui il motore si fidi.
const dataConfigurazione = (r) => {
  const g = giornoDellaConfigurazione(r);
  return g ? g.split('-').reverse().join('/') : '';
};

export default function AlertEngine() {
  const { isAdmin } = usePermessi();
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
      await base44.entities.RegolaAlert.create({ ...form, config, ...configurataOggi({ ...form, config }) });
      setShowForm(false);
      setForm({ nome: '', descrizione: '', modulo: 'secondarie', tipo_regola: 'tratta_autorizzata', severita: 'warning', messaggio_alert: '', attiva: true });
      setConfigJson('{}');
      load();
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  // Attivare e disattivare non cambia che cosa la regola controlla: si scrive
  // solo attiva, e il giorno della configurazione resta quello (13/10/2026). Una
  // regola di prima, senza quel giorno, prende quello della sua ultima scrittura
  // prima di adesso: cosi' una regola di tratta del 2026 riattivata a gennaio
  // misura ancora il 2026.
  const handleToggle = async (regola) => {
    try {
      await base44.entities.RegolaAlert.update(regola.id, cambioAttivazione(regola));
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
      const d = res.data;
      if (d.messaggio) { alert(d.messaggio); setRunning(null); return; }
      alert(messaggioEsecuzione(d));
      load();
    } catch (e) {
      // Gli errori delle funzioni portano il testo nella risposta (e.data):
      // e.message e' solo "Request failed with status code 409".
      alert(e?.data?.error || e?.response?.data?.error || e.message);
    }
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

      <BannerSolaLettura cosa="gli alert" />

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
              {!isAdmin && <p className="text-sm text-muted-foreground">Il motore lo lancia l'amministratore; gli alert qui accanto si leggono comunque.</p>}
              {isAdmin && <>
              <p className="text-sm text-muted-foreground">Lancia il motore di validazione su un modulo specifico:</p>
              <div className="space-y-2">
                {MODULI.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => handleRun(m.value)}
                    disabled={running === m.value}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm btn-secondario"
                  >
                    <span>{m.label}</span>
                    {running === m.value ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </button>
                ))}
              </div>
              </>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="regole" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-semibold">Regole di Validazione ({regole.length})</h2>
            {isAdmin && (
              <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Nuova Regola
              </button>
            )}
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
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm btn-secondario">Annulla</button>
              </div>
            </div>
          )}

          <div className="border rounded-lg p-4 bg-muted/20 space-y-2">
            <h3 className="font-heading font-semibold text-sm">Controlli sempre attivi</h3>
            <p className="text-xs text-muted-foreground">Non si configurano e non si spengono: il motore li fa in ogni modulo di movimenti, anche senza regole qui sotto.</p>
            {CONTROLLI_FISSI.map(c => (
              <div key={c.nome}>
                <p className="text-sm font-medium">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.testo}</p>
                {c.avviso && <p className="text-xs text-amber-800 mt-0.5">{c.avviso}</p>}
              </div>
            ))}
          </div>

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
                        {dataConfigurazione(r) && <span className="text-xs text-muted-foreground" title="Il giorno dell'ultima modifica della configurazione: attivare e disattivare non lo cambiano. Una regola di tratta misura i viaggi dell'anno prima solo se configurata prima del 01/01.">configurata il {dataConfigurazione(r)}</span>}
                        {!TIPI_VALUTATI.has(r.tipo_regola) && <span className="text-xs px-2 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">non valutata dal motore</span>}
                      </div>
                      {/* Una regola salvata quando il menu offriva tipi che il
                          motore non tratta: resta qui, ma non produce niente, e
                          si dice invece di lasciarla sembrare attiva. */}
                      {!TIPI_VALUTATI.has(r.tipo_regola) && <p className="text-xs text-amber-800 mb-1">Il motore non valuta il tipo «{r.tipo_regola}»: questa regola non apre mai un alert. Si può eliminare, o ricreare con uno dei tipi del menu.</p>}
                      {r.descrizione && <p className="text-sm text-muted-foreground">{r.descrizione}</p>}
                      {r.messaggio_alert && <p className="text-xs mt-1 italic">"{r.messaggio_alert}"</p>}
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer">Config</summary>
                        <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">{JSON.stringify(r.config, null, 2)}</pre>
                      </details>
                    </div>
                    <div className={`flex items-center gap-1 flex-shrink-0 ${isAdmin ? '' : 'hidden'}`}>
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
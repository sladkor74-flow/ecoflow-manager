import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Plus, Trash2 } from 'lucide-react';

export default function TariffeManager() {
  const [tab, setTab] = useState('tariffe');
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="tariffe">Tariffe</TabsTrigger>
        <TabsTrigger value="eer">Codici EER</TabsTrigger>
        <TabsTrigger value="servizi">Servizi</TabsTrigger>
      </TabsList>
      <TabsContent value="tariffe" className="mt-4"><TariffeList /></TabsContent>
      <TabsContent value="eer" className="mt-4"><EerList /></TabsContent>
      <TabsContent value="servizi" className="mt-4"><ServiziList /></TabsContent>
    </Tabs>
  );
}

function TariffeList() {
  const [tariffe, setTariffe] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fornitore_id: '', servizio_id: '', classe_materiale: '', eer_codice: '', unita_misura: '€/t', valore: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [t, f, s] = await Promise.all([
        base44.entities.Tariffa.list('-created_date', 500),
        base44.entities.Fornitore.filter({ stato: 'attivo' }),
        base44.entities.Servizio.filter({ stato: 'attivo' }),
      ]);
      setTariffe(t); setFornitori(f); setServizi(s);
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.fornitore_id || !form.servizio_id || !form.valore) return;
    const f = fornitori.find(x => x.id === form.fornitore_id);
    const s = servizi.find(x => x.id === form.servizio_id);
    await base44.entities.Tariffa.create({
      ...form, valore: Number(form.valore),
      fornitore_nome: f?.ragione_sociale, servizio_nome: s?.nome, stato: 'attivo',
    });
    setForm({ fornitore_id: '', servizio_id: '', classe_materiale: '', eer_codice: '', unita_misura: '€/t', valore: 0 });
    setShowForm(false); load();
  };

  const remove = async (t) => {
    if (!confirm('Eliminare questa tariffa?')) return;
    await base44.entities.Tariffa.delete(t.id); load();
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-heading font-semibold">Tariffe ({tariffe.length})</h2>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-1" /> Aggiungi</Button>
      </div>
      {showForm && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Select value={form.fornitore_id} onValueChange={v => setForm({ ...form, fornitore_id: v })}>
              <SelectTrigger><SelectValue placeholder="Fornitore" /></SelectTrigger>
              <SelectContent>{fornitori.map(f => <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.servizio_id} onValueChange={v => setForm({ ...form, servizio_id: v })}>
              <SelectTrigger><SelectValue placeholder="Servizio" /></SelectTrigger>
              <SelectContent>{servizi.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Classe (P/M/G1/G2)" value={form.classe_materiale} onChange={e => setForm({ ...form, classe_materiale: e.target.value })} />
            <Input placeholder="EER (opz.)" value={form.eer_codice} onChange={e => setForm({ ...form, eer_codice: e.target.value })} />
            <Select value={form.unita_misura} onValueChange={v => setForm({ ...form, unita_misura: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="€/t">€/ton</SelectItem>
                <SelectItem value="€/viaggio">€/viaggio</SelectItem>
                <SelectItem value="€/vg">€/vg</SelectItem>
                <SelectItem value="€/mese">€/mese</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Valore" value={form.valore} onChange={e => setForm({ ...form, valore: e.target.value })} />
          </div>
          <Button size="sm" onClick={add}>Salva</Button>
        </div>
      )}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2 font-semibold">Fornitore</th>
            <th className="text-left px-3 py-2 font-semibold">Servizio</th>
            <th className="text-left px-3 py-2 font-semibold">Classe</th>
            <th className="text-left px-3 py-2 font-semibold">EER</th>
            <th className="text-left px-3 py-2 font-semibold">Unità</th>
            <th className="text-right px-3 py-2 font-semibold">Valore</th>
            <th className="text-right px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {tariffe.map((t, i) => (
              <tr key={t.id} className={i % 2 ? 'bg-muted/30' : ''}>
                <td className="px-3 py-2">{t.fornitore_nome || '-'}</td>
                <td className="px-3 py-2">{t.servizio_nome || '-'}</td>
                <td className="px-3 py-2">{t.classe_materiale || '-'}</td>
                <td className="px-3 py-2">{t.eer_codice || '-'}</td>
                <td className="px-3 py-2">{t.unita_misura}</td>
                <td className="px-3 py-2 text-right font-medium">€ {t.valore}</td>
                <td className="text-right px-3 py-2"><button onClick={() => remove(t)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EerList() {
  const [codici, setCodici] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ codice: '', descrizione: '', categoria: '' });

  const load = async () => {
    try { setCodici(await base44.entities.CodiceEer.list('-created_date', 200)); } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.codice) return;
    await base44.entities.CodiceEer.create({ ...form, stato: 'attivo' });
    setForm({ codice: '', descrizione: '', categoria: '' }); load();
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-3 bg-muted/30 flex flex-wrap gap-2">
        <Input placeholder="Codice (es. 160103)" value={form.codice} onChange={e => setForm({ ...form, codice: e.target.value })} className="w-40" />
        <Input placeholder="Descrizione" value={form.descrizione} onChange={e => setForm({ ...form, descrizione: e.target.value })} className="flex-1 min-w-40" />
        <Input placeholder="Categoria" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-48" />
        <Button size="sm" onClick={add}><Plus className="w-4 h-4 mr-1" /> Aggiungi</Button>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr>
            <th className="text-left px-3 py-2 font-semibold">Codice</th>
            <th className="text-left px-3 py-2 font-semibold">Descrizione</th>
            <th className="text-left px-3 py-2 font-semibold">Categoria</th>
          </tr></thead>
          <tbody>
            {codici.map((c, i) => (
              <tr key={c.id} className={i % 2 ? 'bg-muted/30' : ''}>
                <td className="px-3 py-2 font-mono font-medium">{c.codice}</td>
                <td className="px-3 py-2">{c.descrizione || '-'}</td>
                <td className="px-3 py-2">{c.categoria || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiziList() {
  const [servizi, setServizi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');

  const load = async () => {
    try { setServizi(await base44.entities.Servizio.list('-created_date', 50)); } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!nome) return;
    await base44.entities.Servizio.create({ nome, stato: 'attivo' });
    setNome(''); load();
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin" />;

  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-3 bg-muted/30 flex gap-2">
        <Input placeholder="Nome servizio" value={nome} onChange={e => setNome(e.target.value)} className="flex-1" />
        <Button size="sm" onClick={add}><Plus className="w-4 h-4 mr-1" /> Aggiungi</Button>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted"><tr><th className="text-left px-3 py-2 font-semibold">Servizio</th></tr></thead>
          <tbody>
            {servizi.map((s, i) => (
              <tr key={s.id} className={i % 2 ? 'bg-muted/30' : ''}><td className="px-3 py-2 font-medium">{s.nome}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
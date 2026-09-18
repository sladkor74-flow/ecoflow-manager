import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';

const RUOLI = [
  { key: 'ruolo_raccolta', label: 'Raccolta' },
  { key: 'ruolo_trasporto_secondaria', label: 'Trasporto secondaria' },
  { key: 'ruolo_trattamento', label: 'Trattamento' },
  { key: 'ruolo_stoccaggio', label: 'Stoccaggio' },
];

export default function TariffeRuoliFornitori() {
  const [fornitori, setFornitori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [soloSenzaRuoli, setSoloSenzaRuoli] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setFornitori(await base44.entities.Fornitore.filter({ stato: 'attivo' })); } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const salva = async (f, dati) => {
    try {
      await base44.functions.invoke('gestisciAnagrafiche', {
        entita: 'Fornitore', operazione: 'update', id: f.id, dati,
      });
      setFornitori(prev => prev.map(x => x.id === f.id ? { ...x, ...dati } : x));
    } catch (e) { alert(e?.response?.data?.error || e?.message); }
  };

  const toggle = (f, key) => salva(f, { [key]: !f[key] });

  // Un subfornitore lavora sotto un altro fornitore: le sue prestazioni le
  // fattura il principale, con la tariffa del principale, e nella fatturazione
  // restano visibili come "di cui". Il soggetto resta se stesso nei formulari e
  // nei target: qui si dice soltanto a chi si paga.
  const cambiaTramite = (f, id) => {
    const scelto = fornitori.find(x => x.id === id);
    salva(f, { fattura_tramite_id: scelto ? scelto.id : '', fattura_tramite_nome: scelto ? scelto.ragione_sociale : '' });
  };

  const hasAnyRuolo = f => RUOLI.some(r => f[r.key]);

  const filtered = fornitori.filter(f => {
    if (search && !f.ragione_sociale.toLowerCase().includes(search.toLowerCase())) return false;
    if (soloSenzaRuoli && hasAnyRuolo(f)) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Cerca ragione sociale..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={soloSenzaRuoli} onChange={e => setSoloSenzaRuoli(e.target.checked)} className="w-4 h-4 rounded border-input accent-primary" />
          <span className="text-muted-foreground">Solo fornitori senza ruoli</span>
        </label>
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Ragione Sociale</th>
              <th className="text-left px-3 py-2 font-semibold">Partita IVA</th>
              <th className="text-left px-3 py-2 font-semibold">Prov.</th>
              {RUOLI.map(r => <th key={r.key} className="text-center px-2 py-2 font-semibold whitespace-nowrap">{r.label}</th>)}
              <th className="text-center px-2 py-2 font-semibold">Interno</th>
              <th className="text-center px-2 py-2 font-semibold whitespace-nowrap">Tratt. Ecotyre</th>
              <th className="text-left px-2 py-2 font-semibold whitespace-nowrap">Fattura tramite</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={f.id} className={i % 2 ? 'bg-muted/30' : ''}>
                <td className="px-3 py-2 font-medium">{f.ragione_sociale}</td>
                <td className="px-3 py-2 font-mono text-xs">{f.piva || '—'}</td>
                <td className="px-3 py-2">{f.provincia || '—'}</td>
                {RUOLI.map(r => (
                  <td key={r.key} className="text-center px-2 py-2">
                    <input type="checkbox" checked={!!f[r.key]} onChange={() => toggle(f, r.key)} className="w-4 h-4 rounded border-input accent-primary cursor-pointer" />
                  </td>
                ))}
                <td className="text-center px-2 py-2">
                  <input type="checkbox" checked={!!f.interno} onChange={() => toggle(f, 'interno')} className="w-4 h-4 rounded border-input accent-primary cursor-pointer" />
                </td>
                <td className="text-center px-2 py-2">
                  {(f.ruolo_trattamento || f.ruolo_stoccaggio) ? (
                    <input type="checkbox" checked={!!f.trattamento_fatturato_da_ecotyre} onChange={() => toggle(f, 'trattamento_fatturato_da_ecotyre')} className="w-4 h-4 rounded border-input accent-primary cursor-pointer" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <select
                    value={f.fattura_tramite_id || ''}
                    onChange={e => cambiaTramite(f, e.target.value)}
                    className="w-full max-w-[210px] px-2 py-1 rounded-md border bg-card text-xs"
                    title="Se questo soggetto è un subfornitore, scegli il fornitore che ne fattura le prestazioni"
                  >
                    <option value="">fattura in proprio</option>
                    {fornitori.filter(x => x.id !== f.id && !x.fattura_tramite_id).map(x => (
                      <option key={x.id} value={x.id}>{x.ragione_sociale}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-muted-foreground">Nessun fornitore.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Un fornitore può svolgere più ruoli. Contrassegna come Interno le società del gruppo: compariranno nei riepiloghi con le tonnellate ma senza importo. «Tratt. Ecotyre» si attiva solo per impianti (ruolo Trattamento o Stoccaggio): indica che Ecotyre paga il trattamento direttamente, quindi SMOCO percepisce il solo trasporto (voce Trasp della prefattura).
        «Fattura tramite» serve per i subfornitori: chi raccoglie con il proprio nome ma viene pagato attraverso un altro fornitore. Nella fatturazione le sue tonnellate si accorpano al principale, con la tariffa del principale, e restano visibili come «di cui»; nei formulari, nei target e nei report il soggetto resta se stesso.</p>
    </div>
  );
}
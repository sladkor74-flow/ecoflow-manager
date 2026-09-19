import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, AlertTriangle, X } from 'lucide-react';

const REGIONI = ['Campania', 'Puglia', 'Basilicata', 'Calabria', 'Lazio', 'Molise', 'Abruzzo', 'Sicilia', 'Sardegna', 'Toscana', 'Lombardia', 'Piemonte', 'Veneto', 'Emilia-Romagna', 'Marche', 'Umbria', 'Liguria', 'Friuli-Venezia Giulia', 'Trentino-Alto Adige', "Valle d'Aosta"];
const CLASSI = ['P', 'M', 'G1', 'G2'];
const UNITA = ['€/t', '€/kg', '€/viaggio'];
const PRESTAZIONI_LABEL = { RACCOLTA: 'Raccolta', TRASPORTO_SECONDARIA: 'Trasporto secondaria', TRATTAMENTO: 'Trattamento', CONFERIMENTO_STOCCAGGIO: 'Conferimento stoccaggio' };
const RUOLO_TO_PREST = { ruolo_raccolta: 'RACCOLTA', ruolo_trasporto_secondaria: 'TRASPORTO_SECONDARIA', ruolo_trattamento: 'TRATTAMENTO', ruolo_stoccaggio: 'CONFERIMENTO_STOCCAGGIO' };

function isArchiviata(t) {
  if (t.stato === 'non_attivo') return true;
  if (t.data_fine_validita) { const f = new Date(t.data_fine_validita); const o = new Date(); o.setHours(0,0,0,0); if (f < o) return true; }
  return false;
}

export default function TariffeForm({ open, onClose, onSaved, editing, duplicating, excludePrestazione, fornitori, province, destinazioniRaccolta, stoccaggi, destinazioniSecondaria, switchToRuoliTab }) {
  const [form, setForm] = useState({});
  const [multiClasse, setMultiClasse] = useState(false);
  const [valoriPerClasse, setValoriPerClasse] = useState({ P: '', M: '', G1: '', G2: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState([]);
  const [conflict, setConflict] = useState(null);
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const isEdit = !!editing;
  const isDup = !!duplicating;
  const archiviata = isEdit && isArchiviata(editing);

  useEffect(() => {
    if (!open) return;
    setError(''); setFieldErrors([]); setConflict(null); setSuccess('');
    if (editing) {
      setForm({ ...editing, data_inizio_validita: editing.data_inizio_validita ? editing.data_inizio_validita.slice(0,10) : '', data_fine_validita: editing.data_fine_validita ? editing.data_fine_validita.slice(0,10) : '' });
      setMultiClasse(false);
    } else if (duplicating) {
      setForm({ ...duplicating, id: undefined, prestazione: '', data_inizio_validita: duplicating.data_inizio_validita ? duplicating.data_inizio_validita.slice(0,10) : '', data_fine_validita: duplicating.data_fine_validita ? duplicating.data_fine_validita.slice(0,10) : '' });
      setMultiClasse(false);
    } else {
      setForm({ direzione: 'PASSIVA', tipologia: '', unita_misura: '€/t', valore: 0, data_inizio_validita: '', data_fine_validita: '', note: '', classe_materiale: '', fornitore_id: '', prestazione: '', provincia: '', regione: '', destinazione: '', produttore: '', destinatario: '', cliente: 'ECOTYRE', eer_codice: '', servizio_ecotyre: '', comprensiva_trattamento: false });
      setMultiClasse(false);
    }
  }, [open, editing, duplicating]);

  // Auto-set tipologia TUTTE for TRASPORTO_SECONDARIA
  useEffect(() => {
    if (form.prestazione === 'TRASPORTO_SECONDARIA' && !form.tipologia) setForm(f => ({ ...f, tipologia: 'TUTTE' }));
    if (form.prestazione && form.prestazione !== 'TRASPORTO_SECONDARIA' && form.tipologia === 'TUTTE') setForm(f => ({ ...f, tipologia: '' }));
  }, [form.prestazione]);

  const isAttiva = form.direzione === 'ATTIVA';
  const fornitore = fornitori.find(f => f.id === form.fornitore_id);
  const prestazioniOpts = fornitore ? Object.entries(RUOLO_TO_PREST).filter(([k]) => fornitore[k]).map(([, v]) => v).filter(v => v !== excludePrestazione) : [];

  const tipologiaOpts = isAttiva
    ? [{ value: 'RETE', label: 'Rete' }, { value: 'ACI', label: 'ACI' }, { value: 'EXTRA_RACCOLTA', label: 'Extra Raccolta' }]
    : form.prestazione === 'TRASPORTO_SECONDARIA'
      ? [{ value: 'TUTTE', label: 'Tutte (RETE e ACI)' }, { value: 'RETE', label: 'Rete' }, { value: 'ACI', label: 'ACI' }]
      : [{ value: 'RETE', label: 'Rete' }, { value: 'ACI', label: 'ACI' }, { value: 'EXTRA_RACCOLTA', label: 'Extra Raccolta' }];

  const buildBase = () => {
    if (isAttiva) {
      return {
        cliente: form.cliente || 'ECOTYRE',
        direzione: 'ATTIVA',
        tipologia: form.tipologia,
        unita_misura: form.unita_misura,
        classe_materiale: form.classe_materiale || undefined,
        regione: form.regione || undefined,
        eer_codice: form.eer_codice || undefined,
        servizio_ecotyre: form.servizio_ecotyre || undefined,
        data_inizio_validita: form.data_inizio_validita || new Date().toISOString().slice(0,10),
        data_fine_validita: form.data_fine_validita || undefined,
        stato: 'attivo', note: form.note,
      };
    }
    const f = fornitori.find(x => x.id === form.fornitore_id);
    const data = {
      fornitore_id: form.fornitore_id, fornitore_nome: f?.ragione_sociale,
      direzione: 'PASSIVA', tipologia: form.tipologia, prestazione: form.prestazione,
      unita_misura: form.unita_misura,
      data_inizio_validita: form.data_inizio_validita || new Date().toISOString().slice(0,10),
      data_fine_validita: form.data_fine_validita || undefined,
      stato: 'attivo', note: form.note,
    };
    if (form.prestazione === 'RACCOLTA') {
      data.provincia = form.provincia || undefined;
      data.regione = form.regione || undefined;
      data.destinazione = form.destinazione || undefined;
      data.comprensiva_trattamento = !!form.comprensiva_trattamento;
    }
    if (form.prestazione === 'TRASPORTO_SECONDARIA') { data.produttore = form.produttore || undefined; data.destinatario = form.destinatario || undefined; }
    return data;
  };

  const handleResponseError = (e) => {
    const status = e?.response?.status;
    const data = e?.response?.data;
    if (status === 409) { setConflict(data); }
    else if (status === 400) { setFieldErrors(data?.mancanti || []); setError(data?.error || 'Errore di validazione'); }
    else { setError(data?.error || e?.message || 'Errore'); }
  };

  const save = async () => {
    setError(''); setFieldErrors([]); setConflict(null); setSuccess(''); setSaving(true);
    try {
      if (isEdit) {
        const updateData = { valore: Number(form.valore), unita_misura: form.unita_misura, note: form.note };
        if (!archiviata) {
          updateData.data_inizio_validita = form.data_inizio_validita || undefined;
          updateData.data_fine_validita = form.data_fine_validita || undefined;
          updateData.tipologia = form.tipologia;
          updateData.classe_materiale = form.classe_materiale || undefined;
          if (isAttiva) {
            updateData.regione = form.regione || undefined;
            updateData.eer_codice = form.eer_codice || undefined;
            updateData.servizio_ecotyre = form.servizio_ecotyre || undefined;
          } else {
            if (form.prestazione === 'RACCOLTA') {
              updateData.provincia = form.provincia || undefined;
              updateData.regione = form.regione || undefined;
              updateData.destinazione = form.destinazione || undefined;
              updateData.comprensiva_trattamento = !!form.comprensiva_trattamento;
            }
            if (form.prestazione === 'TRASPORTO_SECONDARIA') {
              updateData.produttore = form.produttore || undefined;
              updateData.destinatario = form.destinatario || undefined;
            }
          }
        }
        const res = await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'update', id: editing.id, dati: updateData });
        if (res.data?.tariffe_chiuse?.length > 0) {
          const chiusa = res.data.tariffe_chiuse[0];
          setSuccess(`Tariffa salvata. Il prezzo precedente è stato chiuso al ${chiusa.data_fine_validita || 'giorno indicato'}.`);
        }
        onSaved(); onClose();
      } else {
        const base = buildBase();
        if (multiClasse) {
          for (const c of CLASSI) {
            const v = valoriPerClasse[c] === '' || valoriPerClasse[c] === undefined ? 0 : Number(valoriPerClasse[c]);
            await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'create', dati: { ...base, classe_materiale: c, valore: v } });
          }
        } else {
          await base44.functions.invoke('gestisciAnagrafiche', { entita: 'Tariffa', operazione: 'create', dati: { ...base, classe_materiale: form.classe_materiale || undefined, valore: Number(form.valore) } });
        }
        onSaved(); onClose();
      }
    } catch (e) {
      handleResponseError(e);
    } finally {
      setSaving(false);
    }
  };

  const fieldErr = (name) => fieldErrors.includes(name) ? 'border-destructive' : '';
  const tipologiaNote = !isAttiva && form.prestazione === 'TRASPORTO_SECONDARIA'
    ? 'Sulle secondarie il prezzo dipende dalla tratta, non dal canale: lo stesso viaggio può trasportare sia RETE sia ACI. Scegli Tutte salvo contratti che distinguano espressamente i due canali.'
    : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifica tariffa' : isDup ? 'Duplica per altra prestazione' : 'Aggiungi tariffa'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* 1. Direzione */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Direzione</label>
            {isEdit ? (
              <div className="text-sm font-medium py-2">{form.direzione || '—'}</div>
            ) : (
              <Select value={form.direzione} onValueChange={v => setForm({ ...form, direzione: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="PASSIVA">Passiva</SelectItem><SelectItem value="ATTIVA">Attiva</SelectItem></SelectContent>
              </Select>
            )}
          </div>

          {isAttiva ? (
            <>
              {/* Cliente */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Cliente *</label>
                {isEdit ? (
                  <div className="text-sm font-medium py-2">{form.cliente || 'ECOTYRE'}</div>
                ) : (
                  <Select value={form.cliente || 'ECOTYRE'} onValueChange={v => setForm({ ...form, cliente: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ECOTYRE">ECOTYRE</SelectItem></SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground mt-1">La fatturazione attiva è il corrispettivo che Ecotyre riconosce per le tonnellate raccolte: non prevede prestazioni, che riguardano solo i costi passivi.</p>
              </div>
              {/* Tipologia */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tipologia *</label>
                {archiviata ? (
                  <div className="text-sm font-medium py-2">{form.tipologia || '—'}</div>
                ) : (
                  <Select value={form.tipologia} onValueChange={v => setForm({ ...form, tipologia: v })}>
                    <SelectTrigger className={fieldErr('tipologia')}><SelectValue placeholder="Seleziona tipologia" /></SelectTrigger>
                    <SelectContent>{tipologiaOpts.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              {/* Servizio Ecotyre */}
              {!archiviata && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Servizio Ecotyre</label>
                  <Select value={form.servizio_ecotyre || ''} onValueChange={v => setForm({ ...form, servizio_ecotyre: v })}>
                    <SelectTrigger><SelectValue placeholder="Entrambi" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Entrambi</SelectItem>
                      <SelectItem value="TRASP">Solo trasporto</SelectItem>
                      <SelectItem value="TRASP_TRATT">Trasporto e trattamento</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Lascia Entrambi se Ecotyre riconosce lo stesso prezzo nei due casi, come avviene oggi.</p>
                </div>
              )}
              {/* Regione */}
              {!archiviata && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Regione</label>
                  <Select value={form.regione} onValueChange={v => setForm({ ...form, regione: v })}>
                    <SelectTrigger><SelectValue placeholder="Tutte le regioni" /></SelectTrigger>
                    <SelectContent><SelectItem value={null}>Tutte le regioni</SelectItem>{REGIONI.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {/* Classe materiale */}
              {!archiviata && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Classe materiale</label>
                  <Select value={form.classe_materiale || ''} onValueChange={v => setForm({ ...form, classe_materiale: v })}>
                    <SelectTrigger><SelectValue placeholder="Tutte le classi" /></SelectTrigger>
                    <SelectContent><SelectItem value={null}>Tutte le classi</SelectItem>{CLASSI.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {/* Codice EER */}
              {!archiviata && (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Codice EER (opzionale)</label>
                  <Input value={form.eer_codice || ''} onChange={e => setForm({ ...form, eer_codice: e.target.value })} />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Fornitore */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Fornitore *</label>
                {isEdit ? (
                  <div className="text-sm font-medium py-2">{fornitore?.ragione_sociale || '—'}</div>
                ) : (
                  <Select value={form.fornitore_id} onValueChange={v => setForm({ ...form, fornitore_id: v, prestazione: '' })} disabled={isDup}>
                    <SelectTrigger className={fieldErr('fornitore_id')}><SelectValue placeholder="Seleziona fornitore" /></SelectTrigger>
                    <SelectContent>{fornitori.map(f => <SelectItem key={f.id} value={f.id}>{f.ragione_sociale}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              {/* Prestazione */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Prestazione *</label>
                {isEdit ? (
                  <div className="text-sm font-medium py-2">{PRESTAZIONI_LABEL[form.prestazione] || form.prestazione || '—'}</div>
                ) : form.fornitore_id && prestazioniOpts.length === 0 ? (
                  <div className="text-sm text-destructive py-2">Nessun ruolo assegnato a questo fornitore: impostalo nella scheda <button onClick={switchToRuoliTab} className="underline font-medium">Ruoli fornitori</button>.</div>
                ) : (
                  <Select value={form.prestazione} onValueChange={v => setForm({ ...form, prestazione: v })} disabled={!form.fornitore_id}>
                    <SelectTrigger className={fieldErr('prestazione')}><SelectValue placeholder="Seleziona prestazione" /></SelectTrigger>
                    <SelectContent>{prestazioniOpts.map(p => <SelectItem key={p} value={p}>{PRESTAZIONI_LABEL[p]}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              {/* Tipologia */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Tipologia *</label>
                {archiviata ? (
                  <div className="text-sm font-medium py-2">{form.tipologia === 'TUTTE' ? 'RETE + ACI' : form.tipologia || '—'}</div>
                ) : (
                  <Select value={form.tipologia} onValueChange={v => setForm({ ...form, tipologia: v })}>
                    <SelectTrigger className={fieldErr('tipologia')}><SelectValue placeholder="Seleziona tipologia" /></SelectTrigger>
                    <SelectContent>{tipologiaOpts.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {tipologiaNote && <p className="text-xs text-muted-foreground mt-1">{tipologiaNote}</p>}
              </div>
              {/* Campi dipendenti */}
              {form.prestazione === 'RACCOLTA' && !archiviata && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Provincia</label>
                      <Select value={form.provincia} onValueChange={v => setForm({ ...form, provincia: v })}>
                        <SelectTrigger><SelectValue placeholder="Tutte le province" /></SelectTrigger>
                        <SelectContent><SelectItem value={null}>Tutte le province</SelectItem>{province.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Regione</label>
                      <Select value={form.regione} onValueChange={v => setForm({ ...form, regione: v })}>
                        <SelectTrigger><SelectValue placeholder="Tutte le regioni" /></SelectTrigger>
                        <SelectContent><SelectItem value={null}>Tutte le regioni</SelectItem>{REGIONI.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Destinazione</label>
                    <Select value={form.destinazione} onValueChange={v => setForm({ ...form, destinazione: v })}>
                      <SelectTrigger><SelectValue placeholder="Qualsiasi destinazione" /></SelectTrigger>
                      <SelectContent><SelectItem value={null}>Qualsiasi destinazione</SelectItem>{destinazioniRaccolta.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">In fase di calcolo vince la tariffa più specifica: prima destinazione, poi provincia, poi regione, infine generica.</p>
                  {/* Prezzo unico: la raccolta comprende anche il trattamento presso
                      l'impianto dello stesso fornitore, e il trattamento non si
                      fattura a parte. Nel 2026 riguarda solo Green Tyre Project
                      sull'ACI, a 225 €/t. */}
                  <label className="flex items-start gap-2 rounded-md border bg-muted/20 p-2 cursor-pointer">
                    <Checkbox
                      checked={!!form.comprensiva_trattamento}
                      onCheckedChange={v => setForm({ ...form, comprensiva_trattamento: !!v })}
                      className="mt-0.5"
                    />
                    <span className="text-xs">
                      <span className="font-medium">Prezzo unico: comprende anche il trattamento</span>
                      <span className="block text-muted-foreground">
                        Da spuntare solo quando il contratto non distingue raccolta e trattamento. Il
                        trattamento presso l'impianto di questo stesso fornitore non verrà fatturato a
                        parte e in fatturazione comparirà come «compreso nel prezzo unico».
                      </span>
                    </span>
                  </label>
                </div>
              )}
              {form.prestazione === 'TRASPORTO_SECONDARIA' && !archiviata && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Produttore (stoccaggio)</label>
                      <Select value={form.produttore} onValueChange={v => setForm({ ...form, produttore: v })}>
                        <SelectTrigger><SelectValue placeholder="Qualsiasi" /></SelectTrigger>
                        <SelectContent><SelectItem value={null}>Qualsiasi</SelectItem>{stoccaggi.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Destinatario</label>
                      <Select value={form.destinatario} onValueChange={v => setForm({ ...form, destinatario: v })}>
                        <SelectTrigger><SelectValue placeholder="Qualsiasi" /></SelectTrigger>
                        <SelectContent><SelectItem value={null}>Qualsiasi</SelectItem>{destinazioniSecondaria.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Il prezzo delle secondarie dipende dalla tratta completa.</p>
                </div>
              )}
              {(form.prestazione === 'TRATTAMENTO' || form.prestazione === 'CONFERIMENTO_STOCCAGGIO') && !archiviata && (
                <p className="text-xs text-muted-foreground">Trattamento e conferimento vengono distinti automaticamente dal campo Tipo_Destinazione del formulario: imp per il trattamento, stoc per lo stoccaggio.</p>
              )}
              {/* Classe materiale + multi-classe */}
              {!archiviata && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground block mb-1">Classe materiale</label>
                      <Select value={multiClasse ? '__MULTI__' : (form.classe_materiale || '')} onValueChange={v => { if (v === '__MULTI__') { setMultiClasse(true); } else { setMultiClasse(false); setForm({ ...form, classe_materiale: v }); } }}>
                        <SelectTrigger><SelectValue placeholder="Tutte le classi" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>Tutte le classi</SelectItem>
                          {CLASSI.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          <SelectItem value="__MULTI__">Inserisci un prezzo per ogni classe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {multiClasse && (
                    <div className="grid grid-cols-4 gap-2">
                      {CLASSI.map(c => (
                        <div key={c}>
                          <label className="text-xs text-muted-foreground block mb-1">{c}</label>
                          <Input type="number" step="0.01" placeholder="0.00" value={valoriPerClasse[c]} onChange={e => setValoriPerClasse({ ...valoriPerClasse, [c]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {/* Unità */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Unità di misura *</label>
            <Select value={form.unita_misura} onValueChange={v => setForm({ ...form, unita_misura: v })}>
              <SelectTrigger className={fieldErr('unita_misura')}><SelectValue /></SelectTrigger>
              <SelectContent>{UNITA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* Valore */}
          {!multiClasse && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Valore * (lo zero è ammesso)</label>
              <Input type="number" step="0.01" value={form.valore} onChange={e => setForm({ ...form, valore: e.target.value })} className={fieldErr('valore')} />
              {Number(form.valore) === 0 && <p className="text-xs text-muted-foreground mt-1">Nessun compenso da contratto.</p>}
            </div>
          )}
          {/* Date */}
          {!archiviata && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Valido dal</label>
                <Input type="date" value={form.data_inizio_validita} onChange={e => setForm({ ...form, data_inizio_validita: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Valido al</label>
                <Input type="date" value={form.data_fine_validita} onChange={e => setForm({ ...form, data_fine_validita: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">Lascialo vuoto se il prezzo vale fino a nuovo accordo</p>
              </div>
            </div>
          )}
          {/* Note */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Note</label>
            <Input value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          {/* Errori */}
          {error && <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span></div>}
          {conflict && (
            <div className="bg-amber-50 border border-amber-300 rounded-md p-3 text-sm text-amber-800 space-y-1">
              <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{conflict.error}</span></div>
              {conflict.conflitto && <p className="text-xs">Tariffa in conflitto: {conflict.conflitto.fornitore_nome || conflict.conflitto.cliente} — {conflict.conflitto.prestazione || conflict.conflitto.tipologia} — periodo: {conflict.conflitto.periodo}</p>}
            </div>
          )}
          {success && <div className="bg-success/10 border border-success/30 rounded-md p-3 text-sm text-success">{success}</div>}
          {/* Bottoni */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-1" /> Annulla</Button>
            <Button onClick={save} disabled={saving || (!isEdit && !isAttiva && !form.fornitore_id)}>{saving ? 'Salvataggio...' : <><Save className="w-4 h-4 mr-1" /> Salva</>}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { leggiModello } from '@/lib/docxModello';

// I modelli Word delle dichiarazioni di Irigom: uno per documento. Sono i
// documenti di agosto 2026 (luglio per il CSS-C) con i valori che cambiano
// sostituiti da segnaposto. Caricandone uno nuovo il vecchio non si cancella:
// resta nello storico, non attivo, con il motivo.

export const USI = [
  { chiave: 'irigom_ferro', nome: 'Ferro EER 19.12.02', attesi: ['DATA_LETTERA', 'MESE_ANNO', 'FERRO_KG', 'TABELLA_FORMULARI_FERRO'] },
  { chiave: 'irigom_nave', nome: 'Ciabattato in nave', attesi: ['DATA_LETTERA', 'CIABATTATO_KG', 'NAVE', 'IMO', 'PORTO', 'DATA_PARTENZA', 'TABELLA_TERZIARIE'] },
  { chiave: 'irigom_extra', nome: 'Extra raccolta', attesi: ['DATA_LETTERA', 'EXTRA_PFU_KG', 'TABELLA_FORMULARI_EXTRA', 'TABELLA_TERZIARIE_EXTRA'] },
  { chiave: 'irigom_cssc', nome: 'CSS-C, uno per DDT', attesi: ['DATA_LETTERA', 'MESE_ANNO', 'TOTALE_KG', 'CSS_KG', 'METALLI_KG', 'DDT_NUMERO'] },
];

function Riga({ uso, modello, isAdmin, onCaricato }) {
  const input = useRef(null);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');

  const carica = async (file) => {
    setErrore('');
    setLavoro(true);
    try {
      const letto = await leggiModello(file);
      const mancano = uso.attesi.filter(s => !letto.segnaposti.includes(s));
      if (mancano.length) throw new Error(`Nel file mancano i segnaposto ${mancano.join(', ')}: non sembra il modello di "${uso.nome}".`);
      let motivo = '';
      if (modello) {
        motivo = window.prompt(`Perche' sostituisci il modello "${uso.nome}"? Il vecchio resta nello storico con questo motivo.`, '') || '';
        if (!motivo.trim()) { setLavoro(false); return; }
      }
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const oggi = new Date().toISOString();
      if (modello) await base44.entities.ModelloDocumento.update(modello.id, { attivo: false, sostituito_il: oggi, motivo_sostituzione: motivo.trim() });
      await base44.entities.ModelloDocumento.create({ uso: uso.chiave, nome: uso.nome, file_uri, file_nome: file.name, segnaposti: letto.segnaposti, attivo: true, caricato_il: oggi });
      onCaricato();
    } catch (e) {
      setErrore(e?.response?.data?.error || e.message || String(e));
    }
    setLavoro(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b last:border-b-0">
      <div className="flex items-center gap-2 text-sm">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{uso.nome}</span>
        {modello
          ? <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{modello.file_nome}{modello.caricato_il ? `, dal ${modello.caricato_il.slice(0, 10).split('-').reverse().join('/')}` : ''}</span>
          : <span className="text-xs text-amber-700 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />manca il modello</span>}
        {errore && <span className="text-xs text-red-700">{errore}</span>}
      </div>
      {isAdmin && (
        <>
          <input ref={input} type="file" accept=".docx" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) carica(f); }} />
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={lavoro} onClick={() => input.current && input.current.click()}>
            {lavoro ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {modello ? 'Sostituisci' : 'Carica'}
          </Button>
        </>
      )}
    </div>
  );
}

export default function ModelliIrigom({ modelli, isAdmin, onCaricato }) {
  return (
    <div className="border rounded-lg bg-card px-4 py-2">
      <p className="text-xs text-muted-foreground py-1">
        I modelli dei documenti: carta intestata, testo e firma restano quelli del modello, cambiano solo date, quantità e tabelle.
      </p>
      {USI.map(u => <Riga key={u.chiave} uso={u} modello={modelli.find(m => m.uso === u.chiave && m.attivo !== false)} isAdmin={isAdmin} onCaricato={onCaricato} />)}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';

// Prima di pagare un fornitore si guarda se ha le carte in regola. Il riepilogo
// della qualifica (aggiornato dal modulo e dal controllo giornaliero) dice chi ha
// documenti scaduti o non conformi: qui si incrocia con i fornitori che compaiono
// nella fatturazione del mese. E' un avviso, non un blocco: decide l'amministratore.
export default function PassivaQualifica({ result, anno }) {
  const [riepilogo, setRiepilogo] = useState(null);

  useEffect(() => {
    let vivo = true;
    base44.entities.RiepilogoQualifica.filter({ anno: Number(anno) }, '-created_date', 1)
      .then(r => { if (vivo) setRiepilogo(r[0] || null); })
      .catch(() => { if (vivo) setRiepilogo(null); });
    return () => { vivo = false; };
  }, [anno]);

  const inFattura = useMemo(() => {
    const nomi = new Map();
    for (const lista of [result?.raccoglitori, result?.impianti_stoccaggi, result?.trasporti_secondaria]) {
      for (const f of lista || []) if (f.fornitore && f.totale_euro > 0) nomi.set(normalizzaRagioneSociale(f.fornitore), f.fornitore);
    }
    return nomi;
  }, [result]);

  const critici = (riepilogo?.soggetti_critici || []).filter(s => inFattura.has(normalizzaRagioneSociale(s.nome)) || inFattura.has(s.chiave));
  if (critici.length === 0) return null;

  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-lg p-4">
      <div className="flex items-center gap-2 font-semibold text-amber-900">
        <ShieldAlert className="w-5 h-5" />
        {critici.length === 1 ? 'Un fornitore di questo mese ha' : `${critici.length} fornitori di questo mese hanno`} documenti di qualifica scaduti o non conformi
      </div>
      <ul className="mt-2 space-y-1 text-sm text-amber-900/90">
        {critici.map(s => (
          <li key={s.chiave || s.nome}>
            <span className="font-medium">{s.nome}</span>
            {s.scaduti.length > 0 && <span> — scaduti: {s.scaduti.join(', ')}</span>}
            {s.non_conformi.length > 0 && <span> — non conformi: {s.non_conformi.join(', ')}</span>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-900/70 mt-2">
        È un avviso prima del pagamento, non un blocco.{riepilogo?.aggiornato_il ? ` Situazione della qualifica al ${String(riepilogo.aggiornato_il).slice(0, 10).split('-').reverse().join('/')}.` : ''}{' '}
        <Link to="/qualifica-fornitori" className="text-primary hover:underline inline-flex items-center gap-0.5">Apri la qualifica <ArrowRight className="w-3 h-3" /></Link>
      </p>
    </div>
  );
}

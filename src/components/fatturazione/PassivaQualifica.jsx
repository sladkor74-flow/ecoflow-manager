import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { normalizzaRagioneSociale } from '@/lib/normalizzaRagioneSocialeClient';
import { dataServer } from '@/lib/utils';
import { qualificaDaRifare, segnaQualificaRinviata, avvisoQualificaRinviata } from '@/lib/importGrandeFile';

// I caricamenti che portano soggetti nuovi da qualificare.
const TIPI_CON_SOGGETTI = ['primarie', 'secondarie'];

// Prima di pagare un fornitore si guarda se ha le carte in regola. Il riepilogo
// della qualifica (aggiornato dal modulo, dal controllo giornaliero e dopo ogni
// caricamento) dice chi ha documenti scaduti o non conformi: qui si incrocia con i
// fornitori che compaiono nella fatturazione del mese. E' un avviso, non un
// blocco: decide l'amministratore.
export default function PassivaQualifica({ result, anno }) {
  const [riepilogo, setRiepilogo] = useState(null);
  // Quando la qualifica non ha potuto salvare: si dice, invece di mostrare i
  // numeri di prima come se fossero freschi.
  const [avviso, setAvviso] = useState(null);

  useEffect(() => {
    let vivo = true;
    const leggi = async () => (await base44.entities.RiepilogoQualifica.filter({ anno: Number(anno) }, '-created_date', 1))[0] || null;
    (async () => {
      try {
        const r = await leggi();
        if (vivo) setRiepilogo(r);
        // Un trasportatore nuovo arriva con un caricamento. Se il riepilogo e' piu'
        // vecchio dell'ultimo caricamento concluso - il ricalcolo che parte dopo il
        // caricamento non e' partito o non e' riuscito - lo si rifa' qui, prima di
        // dire che i fornitori del mese sono in regola.
        const logs = await base44.entities.UploadLog.list('-created_date', 20);
        const ultimo = logs
          .filter(l => TIPI_CON_SOGGETTI.includes(l.tipo_file) && (l.esito === 'successo' || l.esito === 'parziale'))
          .reduce((m, l) => Math.max(m, (dataServer(l.updated_date || l.created_date) || new Date(0)).getTime()), 0);
        const aggiornato = r && r.aggiornato_il ? new Date(r.aggiornato_il).getTime() : 0;
        // Con un caricamento aperto o lasciato a meta' la qualifica CALCOLA ma
        // NON SALVA (risponde "rinviato"): il riepilogo resta vecchio, la
        // condizione resta vera e questa pagina rifaceva il calcolo completo -
        // tutte le primarie, le secondarie e l'extra raccolta - a ogni
        // apertura, per sempre, proprio quando l'app e' gia' affaticata. Dopo
        // un "rinviato" non si insiste piu': si dice com'e' e si aspetta il
        // caricamento concluso, che salva da solo. La regola sta in
        // qualificaDaRifare, dove la controllano le prove.
        if (!qualificaDaRifare(anno, { aggiornatoIl: aggiornato, ultimoCaricamento: ultimo })) {
          // Gia' rinviata: non si richiama, ma la frase si rimostra. Senza,
          // bastava cambiare pagina e tornare indietro perche' l'avviso
          // sparisse e i numeri vecchi tornassero a sembrare freschi.
          const gia = avvisoQualificaRinviata(anno, { ultimoCaricamento: ultimo });
          if (vivo && gia) setAvviso(gia);
          return;
        }
        const res = await base44.functions.invoke('qualificaFornitori', { anno: Number(anno) });
        const dati = (res && res.data) || {};
        if (dati.rinviato) {
          segnaQualificaRinviata(anno, { ultimoCaricamento: ultimo, avviso: dati.avviso || null });
          if (vivo) setAvviso(dati.avviso || null);
          return;
        }
        const nuovo = await leggi();
        if (vivo) setRiepilogo(nuovo);
      } catch {
        // l'avviso resta quello del riepilogo gia' letto
      }
    })();
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
  // Senza fornitori critici non c'e' niente da avvisare, ma se la qualifica non
  // si e' potuta aggiornare va detto lo stesso: "nessun avviso" su numeri
  // vecchi e' un silenzio che si scambia per una buona notizia.
  if (critici.length === 0) {
    return avviso ? <p className="text-xs text-amber-700">{avviso}</p> : null;
  }

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
      {avviso && <p className="text-xs text-amber-900/90 mt-2">{avviso}</p>}
      <p className="text-xs text-amber-900/70 mt-2">
        È un avviso prima del pagamento, non un blocco.{riepilogo?.aggiornato_il ? ` Situazione della qualifica al ${String(riepilogo.aggiornato_il).slice(0, 10).split('-').reverse().join('/')}.` : ''}{' '}
        <Link to="/qualifica-fornitori" className="text-primary hover:underline inline-flex items-center gap-0.5">Apri la qualifica <ArrowRight className="w-3 h-3" /></Link>
      </p>
    </div>
  );
}

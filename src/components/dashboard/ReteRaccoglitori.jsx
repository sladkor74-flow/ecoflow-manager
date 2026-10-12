import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Perche from '@/components/shared/Perche';
import { t, tSegno, pct, intero, giornoMese } from '@/components/dashboard/formato';
import { Tabella } from '@/components/dashboard/Sezione';

// I RACCOGLITORI DELLA RETE (migliorie dell'11/10/2026), al posto del pannello
// «Avvisi Target Trasportatori», che ricalcolava il mese con una lettura sua. Qui
// l'anno: chi e' piu' indietro e chi piu' avanti sul suo target ad oggi, in
// tonnellate (il peso sulla commessa). Gli avvisi del mese stanno in «Da
// gestire», dagli alert gia' scritti.
//
// Un target copiato dall'anno prima e non confermato non e' ancora un target:
// resta fuori dalla classifica e non fa partire avvisi (checkTargetAlerts lo
// restituisce in da_confermare). Lo si dice, perche' «tutti in linea» su target
// che nessuno ha deciso sarebbe falso quanto un «a rischio».

function Classifica({ titolo, righe, vuoto }) {
  return (
    <div className="min-w-0">
      <h4 className="text-xs font-semibold text-muted-foreground mb-1">{titolo}</h4>
      {!righe.length ? <p className="text-xs text-muted-foreground">{vuoto}</p> : (
        <Tabella className="border rounded-md">
          <thead className="bg-muted/40"><tr className="text-left text-xs text-muted-foreground">
            <th className="px-2 py-1.5 font-medium">Raccoglitore</th>
            <th className="px-2 py-1.5 font-medium">Regione</th>
            <th className="px-2 py-1.5 font-medium text-right">Target ad oggi</th>
            <th className="px-2 py-1.5 font-medium text-right">Raccolto</th>
            <th className="px-2 py-1.5 font-medium text-right">Scarto</th>
            <th className="px-2 py-1.5 font-medium text-right">%</th>
          </tr></thead>
          <tbody>
            {righe.map(r => (
              <tr key={`${r.raccoglitore}|${r.regione}`} className="border-t">
                <td className="px-2 py-1.5 max-w-[14rem] truncate">{r.raccoglitore}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{r.regione}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.target_ad_oggi_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{t(r.raccolto_t)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums whitespace-nowrap ${r.scarto_t >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{tSegno(r.scarto_t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{pct(r.pct)}</td>
              </tr>
            ))}
          </tbody>
        </Tabella>
      )}
    </div>
  );
}

export default function ReteRaccoglitori({ raccoglitori, perche, giornoDati, anno }) {
  if (!raccoglitori) return <p className="text-sm text-muted-foreground">{perche || 'La classifica dei raccoglitori non c\'è.'}</p>;
  const r = raccoglitori;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          Raccoglitori sul loro target{giornoDati ? ` al ${giornoMese(giornoDati)}` : ''}
          <Perche>
            <p>Il target ad oggi di un raccoglitore è la somma dei suoi target mensili in Target &amp; Status, il mese dei dati in proporzione ai giorni coperti: la regola del controllo dei target mensili.</p>
            <p>Il raccolto è abbinato al target col nome del portale o con la sua abbreviazione, come nell&apos;Andamento. La classifica è in tonnellate: chi è indietro di 50 t pesa sulla commessa più di chi è al 40% su un target di 10 t.</p>
          </Perche>
        </h3>
        <Link to={`/target-status?tab=andamento&anno=${anno}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">Tutti in Target &amp; Status <ArrowRight className="w-3 h-3" aria-hidden="true" /></Link>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Classifica titolo="Più indietro sul loro target" righe={r.indietro || []} vuoto={r.con_target ? 'Nessun raccoglitore indietro sul suo target.' : 'Nessun target mensile confermato per quest\'anno.'} />
        <Classifica titolo="Più avanti" righe={r.avanti || []} vuoto={r.con_target ? 'Nessun raccoglitore avanti sul suo target.' : '—'} />
      </div>
      {(r.da_confermare > 0 || (r.senza_target && r.senza_target.quanti > 0)) && (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {/* da_confermare: i target copiati e non confermati, come checkTargetAlerts */}
          {r.da_confermare > 0 && (
            <p>
              <Link to={`/target-status?tab=raccoglitori&anno=${anno}`} className="hover:underline">
                {r.da_confermare === 1 ? 'Un target è copiato' : `${intero(r.da_confermare)} target sono copiati`} dall&apos;anno prima, da confermare in Target &amp; Status: {r.da_confermare === 1 ? 'resta fuori' : 'restano fuori'} da questa classifica e non fanno partire avvisi.
              </Link>
            </p>
          )}
          {r.senza_target && r.senza_target.quanti > 0 && (
            <p>{r.senza_target.quanti === 1 ? 'Un raccoglitore senza target ha' : `${intero(r.senza_target.quanti)} raccoglitori senza target hanno`} raccolto {t(r.senza_target.raccolto_t)}.</p>
          )}
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Warehouse } from 'lucide-react';
import { ton, it, SCENARI, SCENARIO_PROGRAMMA, Cifra, Vuoto } from './Comuni';

// Gli stoccaggi che alimentano gli impianti seguiti: quanto c'e' nel piazzale
// adesso (l'ancora dell'anno piu' i movimenti dopo, mai la lettura del portale),
// quanto ci entrera', quanto se ne puo' spedire nei limiti del plafond e a chi
// va, in ordine di priorita'. Si programma sul target dei raccoglitori; il
// ritmo reale resta accanto (utente, 27/09/2026).

/** 'prima Tecnogum, poi Irigom'; senza priorita' diverse, 'Tecnogum e Irigom insieme'. */
function ordineDestinazioni(destinazioni) {
  const gruppi = [];
  for (const d of destinazioni || []) {
    const g = gruppi.find(x => x.priorita === d.priorita);
    if (g) g.nomi.push(d.nome); else gruppi.push({ priorita: d.priorita, nomi: [d.nome] });
  }
  const insieme = (nomi) => (nomi.length > 1 ? `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}` : nomi[0]);
  if (gruppi.length === 0) return '';
  if (gruppi.length === 1) return gruppi[0].nomi.length > 1 ? `${insieme(gruppi[0].nomi)}, insieme` : gruppi[0].nomi[0];
  return gruppi.map((g, n) => `${n === 0 ? 'prima' : 'poi'} ${insieme(g.nomi)}`).join(', ');
}

function Stoccaggio({ s, impianti }) {
  const colonna = (sc) => (sc === SCENARIO_PROGRAMMA ? 'bg-primary/10 border-x-2 border-primary/40' : '');
  const assegnato = (d) => {
    const imp = impianti.find(i => i.chiave === d.impianto);
    const rotta = imp && (imp.da_stoccaggi || []).find(r => r.stoccaggio === s.chiave);
    return rotta ? rotta.kg || {} : {};
  };
  const ordine = ordineDestinazioni(s.destinazioni);
  const flussi = s.entrate_flussi || [];
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Warehouse className="w-5 h-5 text-amber-600" />
        <h3 className="font-heading font-bold text-lg">{s.nome}</h3>
        {s.e_impianto && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">è anche un impianto</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {s.giacenza_kg === null || s.giacenza_kg === undefined
          ? <Cifra etichetta="Nel piazzale adesso" valore="Non calcolabile" nota="Manca l'ancora da cui partire: la rilevazione va inserita in Giacenze, scheda Stoccaggi." classe="text-amber-700" />
          : <Cifra etichetta="Nel piazzale adesso" valore={ton(s.giacenza_kg)} nota={s.giacenza_da ? `Dall'ancora del ${it(s.giacenza_da)}, più i movimenti dopo.` : null} />}
        {s.plafond_kg === null || s.plafond_kg === undefined
          ? <Cifra etichetta="Plafond" valore="Nessuno" nota="Si può spedire tutto quello che c'è." />
          : <Cifra etichetta="Plafond" valore={ton(s.plafond_kg)} nota={`Già partite per altri impianti: ${ton(s.partiti_verso_altri_kg)}.`} />}
        {s.residuo_plafond_kg === null || s.residuo_plafond_kg === undefined
          ? <Cifra etichetta="Resta del plafond" valore="—" />
          : <Cifra etichetta="Resta del plafond" valore={ton(s.residuo_plafond_kg)} classe={s.residuo_plafond_kg <= 0 ? 'text-red-700' : ''} />}
      </div>
      {ordine && <p className="text-sm">A chi va: <strong>{ordine}</strong>.</p>}

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left px-3 py-2 font-semibold">Fino al {it(s.fine)}</th>
              {SCENARI.map(x => (
                <th key={x.chiave} className={`text-right px-3 py-2 font-semibold ${colonna(x.chiave)}`}>
                  {x.nome}
                  {x.nota && <span className="block text-[11px] font-normal text-primary">{x.nota}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="px-3 py-2">Entrerà nel piazzale</td>
              {SCENARI.map(x => <td key={x.chiave} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${colonna(x.chiave)}`}>{ton((s.entrate_attese || {})[x.chiave])}</td>)}
            </tr>
            <tr className="border-t">
              <td className="px-3 py-2 font-medium">Si può spedire</td>
              {SCENARI.map(x => <td key={x.chiave} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium ${colonna(x.chiave)}`}>{ton((s.disponibile || {})[x.chiave])}</td>)}
            </tr>
            {(s.destinazioni || []).map(d => {
              const kg = assegnato(d);
              return (
                <tr key={d.impianto} className="border-t">
                  <td className="px-3 py-2">A {d.nome}</td>
                  {SCENARI.map(x => <td key={x.chiave} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${colonna(x.chiave)}`}>{ton(kg[x.chiave])}</td>)}
                </tr>
              );
            })}
            <tr className="border-t">
              <td className="px-3 py-2">Non assegnato</td>
              {SCENARI.map(x => <td key={x.chiave} className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${colonna(x.chiave)}`}>{ton((s.non_assegnato || {})[x.chiave])}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Si può spedire: quello che c&apos;è adesso più quello che entrerà{s.residuo_plafond_kg !== null && s.residuo_plafond_kg !== undefined ? ', entro quello che resta del plafond' : ''}.
        {' '}Il programma si fa sulla colonna del target: quello che resta da raccogliere a ogni raccoglitore; chi non ha un target vale il suo ritmo.
        {s.e_impianto && ' Per un impianto che è anche piazzale le entrate si stimano sul ritmo reale.'}
      </p>

      {flussi.length > 0 && (
        <details className="border rounded-lg">
          <summary className="px-3 py-2 text-sm font-medium cursor-pointer select-none">Chi scarica nel piazzale ({flussi.length})</summary>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Raccoglitore</th>
                  <th className="text-right px-3 py-2 font-semibold">Target dell&apos;anno</th>
                  <th className="text-right px-3 py-2 font-semibold">Già portato</th>
                  <th className="text-right px-3 py-2 font-semibold">Ritmo a settimana</th>
                  <th className="text-right px-3 py-2 font-semibold bg-primary/10">Porterà sul target</th>
                  <th className="text-right px-3 py-2 font-semibold">Porterà sul ritmo</th>
                </tr>
              </thead>
              <tbody>
                {flussi.map((f, n) => (
                  <tr key={`${f.raccoglitore}-${n}`} className="border-t">
                    <td className="px-3 py-2">{f.raccoglitore}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{f.target_kg === null || f.target_kg === undefined ? <span className="text-muted-foreground">nessuno</span> : ton(f.target_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(f.consuntivo_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(f.ritmo_settimanale_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap bg-primary/5 font-medium">{f.target_kg === null || f.target_kg === undefined ? <span className="font-normal text-muted-foreground" title="Senza target vale il ritmo">{ton(f.attesa.target)}</span> : ton(f.attesa.target)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(f.attesa.ritmo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

export { ordineDestinazioni };

export default function SchedaStoccaggi({ risposta }) {
  const stoccaggi = risposta.stoccaggi || [];
  if (!stoccaggi.length) return <Vuoto>Nessuno stoccaggio alimenta gli impianti seguiti nel {risposta.anno}.</Vuoto>;
  return (
    <div className="space-y-4">
      {stoccaggi.map(s => <Stoccaggio key={s.chiave} s={s} impianti={risposta.impianti || []} />)}
    </div>
  );
}

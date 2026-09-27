import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FlaskConical, CheckCircle2, AlertTriangle } from 'lucide-react';
import { percorsiDaSimulare, simulaViaggi, scelteDellaProposta, scelteDelProgramma, scelteAlmenoUno } from '@/lib/simulazioneViaggi';
import { ton, it, viaggiDec, senzaProiezioni, Vuoto } from './Comuni';

// La simulazione accanto alla predittivita' (utente, 27/09/2026): chi programma
// prova i suoi viaggi a settimana, percorso per percorso, e vede subito cosa
// succede a ogni impianto fino alla fine della programmazione, accanto a quello
// che succede con la proposta del gestionale. Serve a decidere come
// accontentare il piu' possibile tutti e due gli impianti. Non scrive niente: il
// programma si fissa nella scheda Programma della settimana.

const numero = (v) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** L'esito di un impianto in uno scenario, a parole. */
function Esito({ x }) {
  if (!x) return <span className="text-muted-foreground">—</span>;
  if (x.quando === 'gia') return <span className="text-green-700">Già raggiunto</span>;
  if (x.raggiunge) {
    return (
      <span className="text-green-700">
        Raggiunge{x.quando ? ` il ${it(x.quando)}` : ''}
        {x.differenza_kg > 0 && <span className="block text-xs text-muted-foreground">avanzano {ton(x.differenza_kg)}</span>}
      </span>
    );
  }
  return <span className="text-red-700">Mancano {ton(-x.differenza_kg)}</span>;
}

export default function SimulazioneViaggi({ risposta }) {
  // un percorso senza materiale e senza viaggi (T-Cycle col plafond esaurito) non si prova
  const percorsi = useMemo(() => {
    const disponibile = new Map((risposta.stoccaggi || []).map(s => [s.nome, Number(s.disponibile && s.disponibile.target) || 0]));
    return percorsiDaSimulare(risposta).filter(p => p.media > 0 || p.programmati > 0 || (disponibile.get(p.stoccaggio) || 0) >= risposta.kg_per_viaggio);
  }, [risposta]);
  const proposta = useMemo(() => scelteDellaProposta(risposta), [risposta]);
  const [scelte, setScelte] = useState(() => scelteDellaProposta(risposta));
  const [testi, setTesti] = useState({});

  // Un nuovo calcolo (dati caricati, target cambiato) tiene le scelte fatte sui
  // percorsi che ci sono ancora, e da' la proposta a quelli nuovi.
  useEffect(() => {
    setScelte(prima => Object.fromEntries(percorsi.map(p => [p.chiave, p.chiave in prima ? prima[p.chiave] : proposta[p.chiave]])));
  }, [percorsi, proposta]);

  const conProposta = useMemo(() => simulaViaggi(risposta, proposta), [risposta, proposta]);
  const conScelte = useMemo(() => simulaViaggi(risposta, scelte), [risposta, scelte]);

  if (risposta.sola_lettura) return <Vuoto>Il {risposta.anno} è chiuso: non c'è più niente da simulare.</Vuoto>;
  if (!percorsi.length) return <Vuoto>Non ci sono percorsi da simulare: nessuno stoccaggio alimenta gli impianti seguiti la settimana prossima.</Vuoto>;

  const usa = (nuove) => { setScelte(nuove); setTesti({}); };
  const cambia = (k, v) => { setTesti(t => ({ ...t, [k]: v })); setScelte(s => ({ ...s, [k]: numero(v) })); };
  const impiantiSimulati = conScelte.impianti.filter(i => percorsi.some(p => p.impianto === i.chiave) && !senzaProiezioni(i, risposta));
  const proposti = new Map(conProposta.impianti.map(i => [i.chiave, i]));
  const kgv = risposta.kg_per_viaggio;

  return (
    <div className="space-y-5">
      <div className="text-sm text-muted-foreground space-y-1">
        <p className="flex items-start gap-2"><FlaskConical className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          Prova quanti viaggi a settimana fare su ogni percorso, da qui alla fine della programmazione, e guarda cosa succede a ogni impianto accanto alla proposta del gestionale. Puoi usare anche i mezzi viaggi: 2,5 vuol dire tre e due a settimane alterne.
        </p>
        <p>È solo una prova: non cambia il programma. Un viaggio vale {ton(kgv)}. Se chiedi a uno stoccaggio più viaggi di quelli che il suo materiale permette, quelli possibili si dividono in proporzione e te lo dice.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => usa(scelteDellaProposta(risposta))}>La media della predittività</Button>
        <Button size="sm" variant="outline" onClick={() => usa(scelteDelProgramma(risposta))}>Come la prossima settimana, fino alla fine</Button>
        <Button size="sm" variant="outline" onClick={() => usa(scelteAlmenoUno(risposta))}>Almeno un viaggio a ogni impianto</Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Percorso</th>
              <th className="text-right px-3 py-2 font-semibold">Proposta (media a settimana)</th>
              <th className="text-right px-3 py-2 font-semibold bg-primary/10">La tua prova (viaggi a settimana)</th>
            </tr>
          </thead>
          <tbody>
            {percorsi.map(p => (
              <tr key={p.chiave} className="border-t">
                <td className="px-3 py-2">{p.stoccaggio} → {p.nome_impianto}</td>
                <td className="px-3 py-2 text-right tabular-nums">{viaggiDec(p.media)}</td>
                <td className="px-3 py-1.5 text-right bg-primary/5">
                  <Input
                    className="w-24 ml-auto text-right h-8"
                    inputMode="decimal"
                    aria-label={`Viaggi a settimana da ${p.stoccaggio} a ${p.nome_impianto}`}
                    value={p.chiave in testi ? testi[p.chiave] : String(scelte[p.chiave] ?? 0).replace('.', ',')}
                    onChange={e => cambia(p.chiave, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        {conScelte.stoccaggi.filter(s => percorsi.some(p => p.stoccaggio === s.stoccaggio)).map(s => (
          <div key={s.stoccaggio} className={`text-sm rounded-lg border px-3 py-2 flex items-start gap-2 ${s.basta ? 'border-green-200 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
            {s.basta ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-700 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" />}
            <span>
              <strong>{s.stoccaggio}</strong>: con la tua prova fa circa {viaggiDec(s.viaggi_chiesti)} viaggi fino alla fine; il suo materiale ne permette circa {viaggiDec(s.viaggi_possibili)}.
              {s.basta
                ? (s.avanza_kg >= kgv ? ` Avanzano ${ton(s.avanza_kg)}.` : '')
                : ` Mancano ${ton(s.mancano_kg)}: i viaggi possibili si dividono in proporzione a quelli che hai chiesto.`}
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold" rowSpan={2}>Impianto</th>
              <th className="text-right px-3 py-2 font-semibold" rowSpan={2}>Manca al target oggi</th>
              <th className="text-center px-3 py-2 font-semibold border-l" colSpan={2}>Con la proposta</th>
              <th className="text-center px-3 py-2 font-semibold border-l bg-primary/10" colSpan={3}>Con la tua prova</th>
            </tr>
            <tr className="text-xs">
              <th className="text-right px-3 py-1 font-medium border-l">Viaggi a settimana</th>
              <th className="text-left px-3 py-1 font-medium">Sul target dei raccoglitori</th>
              <th className="text-right px-3 py-1 font-medium border-l bg-primary/10">Viaggi a settimana</th>
              <th className="text-left px-3 py-1 font-medium bg-primary/10">Sul target dei raccoglitori</th>
              <th className="text-left px-3 py-1 font-medium bg-primary/10">Al ritmo reale</th>
            </tr>
          </thead>
          <tbody>
            {impiantiSimulati.map(i => {
              const p = proposti.get(i.chiave);
              return (
                <tr key={i.chiave} className="border-t align-top">
                  <td className="px-3 py-2 font-medium">{i.nome}<span className="block text-xs text-muted-foreground font-normal">fino al {it(i.fine)}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.residuo_kg > 0 ? ton(i.residuo_kg) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums border-l">{p ? viaggiDec(p.viaggi_settimana) : '—'}</td>
                  <td className="px-3 py-2"><Esito x={p && p.scenari.target} /></td>
                  <td className="px-3 py-2 text-right tabular-nums border-l bg-primary/5">
                    {viaggiDec(i.viaggi_settimana)}
                    {i.limitato && <span className="block text-xs text-amber-700">limitati dal materiale</span>}
                  </td>
                  <td className="px-3 py-2 bg-primary/5"><Esito x={i.scenari.target} /></td>
                  <td className="px-3 py-2 bg-primary/5"><Esito x={i.scenari.ritmo} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        "Sul target dei raccoglitori" conta che i raccoglitori portino quello che resta del loro target (la base del programma); "al ritmo reale" che continuino come nelle ultime 12 settimane. La data è quella in cui, allo stesso passo, l'impianto arriverebbe al target.
      </p>
    </div>
  );
}

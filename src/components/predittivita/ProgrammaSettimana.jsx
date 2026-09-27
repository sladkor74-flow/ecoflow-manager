import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CalendarCheck, RotateCcw, CheckCircle2, AlertTriangle, Warehouse } from 'lucide-react';
import { ton, it, viaggi, elenco, programmiNonLetti, testoErrore, Vuoto } from './Comuni';

// La scheda che si apre per prima: i viaggi da programmare la settimana
// prossima, stoccaggio per impianto (utente, 26/09/2026: "ogni settimana il
// modulo deve dare chiaramente i viaggi da programmare per la settimana
// successiva"). Il mercoledi' alle 8 il programma si fissa da solo; qui
// l'amministratore lo corregge e lo fissa a mano, e il mercoledi' non tocca piu'
// le righe corrette.

const chiaveRiga = (r) => `${r.stoccaggio}|${r.impianto}`;
/** I viaggi di una riga: quelli fissati, se ci sono, altrimenti quelli calcolati. */
export const viaggiDellaRiga = (r) => (r.fissato ? Number(r.fissato.viaggi) || 0 : Number(r.viaggi) || 0);

/**
 * Perche' il programma della settimana prossima e' vuoto, detto a parole, e se
 * e' perche' la programmazione e' finita per tutti. Si guarda la fine di ogni
 * impianto: uno puo' avere una fine sua, dopo quella dell'anno.
 */
export function programmaVuoto(risposta) {
  if (risposta.sola_lettura) return { finita: true, testo: `Il ${risposta.anno} è chiuso: non c'è più un programma da fare.` };
  const dal = (risposta.prossima_settimana || {}).dal;
  const impianti = risposta.impianti || [];
  const finiti = impianti.filter(i => i.fine && dal && i.fine < dal);
  if (impianti.length > 0 && finiti.length === impianti.length) {
    const ultima = finiti.map(i => i.fine).sort().pop();
    return { finita: true, testo: `La programmazione del ${risposta.anno} è finita il ${it(ultima)}: non ci sono più viaggi da programmare.` };
  }
  if (finiti.length) {
    return { finita: false, testo: `Nessun viaggio da programmare: per ${elenco(finiti.map(i => i.nome))} la programmazione è finita, e nessuno stoccaggio alimenta gli altri impianti seguiti.` };
  }
  return { finita: false, testo: 'Nessun viaggio da programmare: nessuno stoccaggio alimenta gli impianti seguiti la settimana prossima.' };
}

function StatoRiga({ r, ignoto }) {
  if (!r.fissato) {
    return ignoto
      ? <span className="text-xs text-red-700">Non si sa: i programmi fissati non si sono potuti leggere</span>
      : <span className="text-xs text-muted-foreground">Non ancora fissato</span>;
  }
  const diverso = Number(r.fissato.viaggi) !== Number(r.viaggi);
  return (
    <div className="text-xs">
      <span className={`inline-flex items-center gap-1 font-medium ${r.fissato.manuale ? 'text-violet-700' : 'text-emerald-700'}`}>
        <CheckCircle2 className="w-3 h-3" /> {r.fissato.manuale ? 'Fissato a mano' : 'Fissato il mercoledì'}
      </span>
      {diverso && <div className="text-muted-foreground">il calcolo di oggi ne darebbe {r.viaggi}</div>}
    </div>
  );
}

export default function ProgrammaSettimana({ risposta, onFissa, isAdmin = false }) {
  const { toast } = useToast();
  const [bozza, setBozza] = useState({}); // solo i viaggi toccati a mano
  const [salvataggio, setSalvataggio] = useState(false);
  const [esito, setEsito] = useState(null); // { ok, testo }

  const programma = risposta.programma || [];
  const kgv = Number(risposta.kg_per_viaggio) || 13000;
  const settimana = risposta.prossima_settimana || {};
  const modificabile = !!risposta.puo_fissare && !risposta.sola_lettura;
  // l'amministratore che adesso non puo' fissare, per esempio perche' i
  // programmi gia' fissati non si sono potuti leggere: "Fissa" resta spento
  const bloccato = !!isAdmin && !modificabile && !risposta.sola_lettura;
  const nonLetti = programmiNonLetti(risposta);

  const valore = (r) => (bozza[chiaveRiga(r)] !== undefined ? bozza[chiaveRiga(r)] : String(viaggiDellaRiga(r)));
  const numero = (r) => {
    const v = String(valore(r)).trim();
    return /^\d+$/.test(v) ? Number(v) : null;
  };
  const nonValide = modificabile ? programma.filter(r => numero(r) === null) : [];
  const viaggiMostrati = (r) => (modificabile ? (numero(r) ?? 0) : viaggiDellaRiga(r));
  const totaleViaggi = programma.reduce((t, r) => t + viaggiMostrati(r), 0);
  const toccata = Object.keys(bozza).length > 0;

  const fissa = async () => {
    if (!modificabile || nonValide.length) return;
    setSalvataggio(true);
    setEsito(null);
    try {
      await onFissa({
        settimana: settimana.dal,
        righe: programma.map(r => ({ stoccaggio: r.stoccaggio, impianto: r.impianto, viaggi: numero(r) })),
      });
      setBozza({});
      const testo = `Programma dal ${it(settimana.dal)} al ${it(settimana.al)} fissato: ${viaggi(totaleViaggi)}. Il mercoledì non lo cambia più.`;
      setEsito({ ok: true, testo });
      toast({ title: 'Programma fissato', description: testo });
    } catch (e) {
      const testo = `Il programma non è stato fissato: ${testoErrore(e)}`;
      setEsito({ ok: false, testo });
      toast({ title: 'Programma non fissato', description: testoErrore(e), variant: 'destructive' });
    }
    setSalvataggio(false);
  };

  if (risposta.sola_lettura) {
    return <Vuoto>Il {risposta.anno} è chiuso: non c&apos;è più un programma da fare. Le settimane dell&apos;anno sono nella scheda Settimane.</Vuoto>;
  }

  const vuoto = programma.length === 0 ? programmaVuoto(risposta) : null;

  // per stoccaggio: quanti viaggi potra' fare e quanti ne sono in programma
  const perStoccaggio = (risposta.stoccaggi || []).map(s => {
    const righe = programma.filter(r => r.stoccaggio === s.nome);
    const programmati = righe.reduce((t, r) => t + viaggiMostrati(r), 0);
    const possibili = s.viaggi_prossima_settimana ? Number(s.viaggi_prossima_settimana.possibili) || 0 : 0;
    return { chiave: s.chiave, nome: s.nome, possibili, programmati, righe: righe.length };
  }).filter(s => s.righe > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" />
            Settimana dal {it(settimana.dal)} al {it(settimana.al)}
          </h2>
          <p className="text-sm text-muted-foreground">
            Un viaggio vale {ton(kgv)}.
            {!(vuoto && vuoto.finita) && (
              <> Il programma si fissa da solo il mercoledì alle 8
                {modificabile
                  ? '; puoi correggerlo qui e fissarlo a mano, e il mercoledì non lo cambia più.'
                  : bloccato ? '; adesso non si può correggere a mano (vedi sotto).' : "; può correggerlo l'amministratore."}
              </>
            )}
          </p>
        </div>
        {(modificabile || bloccato) && programma.length > 0 && (
          <div className="flex gap-2">
            {modificabile && toccata && (
              <Button size="sm" variant="outline" onClick={() => setBozza({})} disabled={salvataggio}>
                <RotateCcw className="w-4 h-4 mr-1" /> Annulla le modifiche
              </Button>
            )}
            <Button size="sm" onClick={fissa} disabled={!modificabile || salvataggio || nonValide.length > 0} title={bloccato ? 'Adesso il programma non si può fissare' : undefined}>
              {salvataggio ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Fissa il programma
            </Button>
          </div>
        )}
      </div>

      {(bloccato || nonLetti) && programma.length > 0 && (
        <div className="text-sm rounded-md border-2 border-red-400 bg-red-50 text-red-900 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {bloccato ? 'Adesso il programma non si può fissare. ' : ''}
            {nonLetti ? nonLetti.testo : 'Ricalcola la pagina e riprova.'}
          </span>
        </div>
      )}
      {esito && (
        <div className={`text-sm rounded-md border px-3 py-2 flex items-start gap-2 ${esito.ok ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
          {esito.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{esito.testo}</span>
        </div>
      )}
      {nonValide.length > 0 && (
        <p className="text-sm text-red-700">Scrivi i viaggi come numeri interi, zero compreso.</p>
      )}

      {vuoto ? (
        <Vuoto>{vuoto.testo}</Vuoto>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Da</th>
                <th className="text-left px-3 py-2 font-semibold">A</th>
                <th className="text-right px-3 py-2 font-semibold">Viaggi</th>
                <th className="text-right px-3 py-2 font-semibold">Tonnellate</th>
                <th className="text-left px-3 py-2 font-semibold">Perché</th>
                <th className="text-left px-3 py-2 font-semibold">Fissato</th>
              </tr>
            </thead>
            <tbody>
              {programma.map(r => {
                const k = chiaveRiga(r);
                const v = viaggiMostrati(r);
                return (
                  <tr key={k} className="border-t align-top">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.stoccaggio}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.impianto}</td>
                    <td className="px-3 py-2 text-right">
                      {modificabile ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`Viaggi da ${r.stoccaggio} a ${r.impianto}`}
                          value={valore(r)}
                          onChange={e => setBozza(b => ({ ...b, [k]: e.target.value }))}
                          className={`w-16 text-right tabular-nums border rounded px-2 py-1 bg-background ${numero(r) === null ? 'border-red-500' : ''}`}
                        />
                      ) : (
                        <span className="font-semibold tabular-nums">{v}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(v * kgv)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground min-w-[260px]">
                      {r.motivo}
                      {r.limitato && <span className="block text-amber-700">Il piazzale non ha materiale per tutti i viaggi che servirebbero.</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap"><StatoRiga r={r} ignoto={!!nonLetti} /></td>
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/40 font-semibold">
                <td className="px-3 py-2" colSpan={2}>Totale</td>
                <td className="px-3 py-2 text-right tabular-nums">{totaleViaggi}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{ton(totaleViaggi * kgv)}</td>
                <td className="px-3 py-2" colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {perStoccaggio.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold mb-2">Gli stoccaggi, la settimana prossima</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {perStoccaggio.map(s => (
              <div key={s.chiave} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 font-medium"><Warehouse className="w-4 h-4 text-amber-600" /> {s.nome}</div>
                <p className="text-sm">
                  Viaggi possibili: <strong className="tabular-nums">{s.possibili}</strong>
                  <span className="text-muted-foreground"> · </span>
                  programmati: <strong className="tabular-nums">{s.programmati}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.programmati > s.possibili
                    ? `Sono più di quelli che il materiale del piazzale permette: ne mancherebbero ${s.programmati - s.possibili}.`
                    : s.possibili > s.programmati
                      ? `Ne avanzano ${s.possibili - s.programmati}: agli impianti non ne servono di più.`
                      : 'Il piazzale fa tutti i viaggi che può.'}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Possibili: la giacenza del piazzale adesso, più quello che ci entrerà al ritmo reale, meno quello che partirà prima di lunedì.
          </p>
        </div>
      )}
    </div>
  );
}

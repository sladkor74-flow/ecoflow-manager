import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { MESI } from '@/lib/pfuConstants';
import { tonnellate, leggiNumero, nomeUtente } from '@/lib/target';
import { commessaDellAnno } from '@/lib/annoTarget';
import { variazioneDelContratto, storicoConVariazione } from '@/lib/attesoContratto';
import { oggiRoma, giornoRoma } from '@/lib/giornoItaliano';
import { scriviConTraccia, avvisoTraccia } from '@/lib/scriviConTraccia';

// LA VARIAZIONE DEL CONTRATTO IN CORSO D'ANNO (richiesta dell'utente del 14/10/2026).
//
// Il consorzio ha dato 100 t in piu' a ottobre in Puglia, e l'utente le aveva
// aggiunte solo al target di SMOCO nella scheda dei raccoglitori: il contratto
// era rimasto a 11.550 t, e dashboard, atteso alla data, proiezione, Andamento
// ed EcoTyna, che leggono il contratto, non si muovevano. Qui la variazione si
// registra nel contratto: mese, regione, tonnellate in piu' o in meno, la
// destinazione se si sa, il motivo e il giorno della comunicazione. Una
// scrittura sola sulla commessa (scriviConTraccia, come il modulo della
// commessa): target annuo, target della regione, target mensile rivisto del
// mese, quantita' della destinazione, e la voce nello storico della commessa.
// Le regole stanno in attesoContratto (variazioneDelContratto), uguali per la
// pagina e per le prove.
//
// Si apre dalla scheda Commessa Ecotyre e, gia' compilata, dall'avviso della
// scheda Target raccoglitori. Solo l'amministratore, e mai su un anno chiuso:
// chi monta il componente lo sa (isAdmin della pagina).

const ORIGINE = 'Target & Status, variazione del contratto';
// 'AAAA-MM-GG' come gg/mm/aaaa
const giorno = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '');
const conSegno = (t) => `${Number(t) > 0 ? '+' : ''}${tonnellate(t)}`;
const leggiLista = (json) => { try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

/** Prima e dopo, riga per riga: quello che la variazione cambia nel contratto. */
export function RigheVariazione({ righe }) {
  if (!righe || !righe.length) return null;
  return (
    <table className="w-full text-sm">
      <tbody>
        {righe.map(r => (
          <tr key={r.cosa} className="border-t first:border-t-0">
            <td className="py-1 pr-2">{r.cosa}</td>
            <td className="py-1 px-2 text-right tabular-nums text-muted-foreground">{tonnellate(r.prima_t)} t</td>
            <td className="py-1 px-1 text-muted-foreground"><ArrowRight className="w-3.5 h-3.5" /></td>
            <td className="py-1 pl-2 text-right tabular-nums font-semibold">{tonnellate(r.dopo_t)} t</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Chi e quando ha riscritto i numeri di una variazione superata, per l'elenco.
const superataDa = (s) => (s && s.il
  ? `riscritto il ${giorno(giornoRoma(s.il))}${s.da ? ` da ${s.da}` : ''}${s.nota ? ` (${s.nota})` : ''}`
  : 'cambiato senza passare dallo storico');

/**
 * Le variazioni registrate nell'anno, ognuna col suo motivo. targetAnnuo e' il
 * target del contratto di oggi: accanto si dice quanto sarebbe senza.
 * Una variazione superata (in_vigore falso: il contratto e' stato riscritto
 * dopo, revisione del 14/10/2026) resta in elenco barrata, col salvataggio che
 * l'ha superata, e non entra nei totali.
 */
export function ElencoVariazioni({ variazioni, anno, targetAnnuo = null }) {
  if (!variazioni || !variazioni.length) {
    return <p className="text-sm text-muted-foreground">Nessuna variazione registrata nel {anno}: il contratto è quello inserito.</p>;
  }
  const vigenti = variazioni.filter(v => v.in_vigore !== false);
  const superate = variazioni.length - vigenti.length;
  const totale = vigenti.reduce((s, v) => s + (Number(v.t) || 0), 0);
  const annuo = Number(targetAnnuo);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left py-1 pr-2">Comunicata il</th>
              <th className="text-left py-1 px-2">Mese</th>
              <th className="text-left py-1 px-2">Regione</th>
              <th className="text-right py-1 px-2">Tonnellate</th>
              <th className="text-left py-1 px-2">Destinazione</th>
              <th className="text-left py-1 px-2">Motivo</th>
              <th className="text-left py-1 pl-2">Registrata</th>
            </tr>
          </thead>
          <tbody>
            {variazioni.map((v, i) => {
              const fuori = v.in_vigore === false;
              return (
                <tr key={`${v.il}|${i}`} className={`border-t align-top ${fuori ? 'text-muted-foreground' : ''}`}>
                  <td className="py-1 pr-2 tabular-nums">{giorno(v.comunicata_il) || '—'}</td>
                  <td className="py-1 px-2">{v.mese || '—'}</td>
                  <td className="py-1 px-2">{v.regione}</td>
                  <td className={`py-1 px-2 text-right tabular-nums font-semibold ${fuori ? 'line-through' : Number(v.t) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{conSegno(v.t)} t</td>
                  <td className="py-1 px-2">{v.destinazione || '—'}</td>
                  <td className="py-1 px-2 whitespace-normal min-w-[180px]">
                    {v.motivo}
                    {fuori && <span className="block text-[11px] text-amber-800">Non più nel contratto: {superataDa(v.superata)}.</span>}
                  </td>
                  <td className="py-1 pl-2 text-muted-foreground">{giorno(giornoRoma(v.il))}{v.da ? ` · ${v.da}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {vigenti.length > 0 ? (
          <>
            In tutto {conSegno(totale)} t.
            {annuo > 0 && ` Il target annuo del contratto è ${tonnellate(annuo)} t: senza le variazioni sarebbe ${tonnellate(annuo - totale)} t.`}
            {' '}Le variazioni sono già nel target annuo, nella regione e nel target mensile rivisto: la dashboard, l&apos;Andamento, gli avvisi ed EcoTyna le leggono da lì.
            Nell&apos;atteso alla data ognuna conta intera nel suo mese e nella sua regione.
          </>
        ) : 'Il contratto di oggi non comprende nessuna variazione registrata.'}
        {superate > 0 && ` ${superate === 1 ? 'Quella barrata non è più' : `Le ${superate} barrate non sono più`} nei numeri del contratto: dopo, il contratto è stato riscritto (un foglio importato o la tabella corretta a mano) e vale quello scritto. ${superate === 1 ? 'Resta' : 'Restano'} qui per memoria, fuori dai totali.`}
      </p>
    </div>
  );
}

/**
 * L'avviso della scheda Commessa quando un salvataggio della tabella
 * toglierebbe dai numeri delle variazioni in vigore (variazioniCheSiChiudono):
 * stringa vuota se non ce ne sono.
 */
export function avvisoVariazioniChiuse(chiuse) {
  if (!chiuse || !chiuse.length) return '';
  const una = chiuse.length === 1;
  const quali = chiuse.map(v => `${String(v.mese || '').toLowerCase()} in ${v.regione} (${conSegno(v.t)} t)`).join(', ');
  return `Salvando così, ${una ? 'la variazione' : 'le variazioni'} di ${quali} ${una ? 'esce' : 'escono'} dai numeri del contratto: la tabella cambia la regione o il mese che ${una ? 'aveva' : 'avevano'} scritto. Se il consorzio non l'ha revocata, lascia quei numeri come sono.`;
}

/**
 * Gli avvisi della scheda Target raccoglitori: le regioni dove i target annui dei
 * raccoglitori non fanno il contratto (scartiDalContratto). Una differenza puo'
 * essere una variazione del consorzio non ancora registrata nel contratto
 * (l'utente il 14/10/2026: 100 t in piu' a ottobre in Puglia scritte solo nel
 * target di SMOCO): il pulsante apre la variazione gia' compilata.
 */
export function AvvisiScarti({ scarti, isAdmin, onRegistra }) {
  if (!scarti || !scarti.length) return null;
  return (
    <div className="space-y-2">
      {scarti.map(s => {
        const piu = s.differenza_t > 0;
        const cambio = s.proposta && s.proposta.cambi && s.proposta.cambi.length === 1 ? s.proposta.cambi[0] : null;
        return (
          <div key={s.regione} className="flex items-start justify-between gap-3 flex-wrap text-sm text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
            <div className="flex items-start gap-2 max-w-3xl">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p>
                  I raccoglitori della {s.regione} hanno <strong>{tonnellate(Math.abs(s.differenza_t))} t {piu ? 'più' : 'meno'}</strong> del contratto
                  ({tonnellate(s.raccoglitori_t)} t contro {tonnellate(s.contratto_t)} t){piu
                    ? ': se è una variazione del consorzio, registrala nel contratto, così la vedono la dashboard, l\'Andamento ed EcoTyna.'
                    : ': assegnale ai raccoglitori o, se il consorzio ha ridotto il contratto, registra la variazione.'}
                </p>
                {s.proposta && (
                  <p className="text-xs mt-0.5">
                    {cambio
                      ? `A ${s.proposta.mese.toLowerCase()} il target di ${cambio.raccoglitore} è passato ${cambio.prima_t === null ? 'da nessuno' : `da ${tonnellate(cambio.prima_t)} t`} a ${tonnellate(cambio.dopo_t)} t il ${giorno(giornoRoma(cambio.il))}: la variazione si propone su ${s.proposta.mese.toLowerCase()}.`
                      : `I target di ${s.proposta.mese.toLowerCase()} della regione sono cambiati proprio di ${conSegno(s.differenza_t)} t: la variazione si propone su ${s.proposta.mese.toLowerCase()}.`}
                  </p>
                )}
                {!isAdmin && <p className="text-xs mt-0.5">La registra l&apos;amministratore nella scheda Commessa Ecotyre.</p>}
              </div>
            </div>
            {isAdmin && <Button size="sm" variant="outline" onClick={() => onRegistra(s)}>Registra la variazione</Button>}
          </div>
        );
      })}
    </div>
  );
}

/** I valori iniziali della finestra da un avviso della scheda dei raccoglitori. */
export const inizialeDaScarto = (s) => ({
  regione: s.regione,
  verso: s.differenza_t < 0 ? 'meno' : 'piu',
  t: String(Math.abs(s.differenza_t)).replace('.', ','),
  mese_idx: s.proposta ? String(s.proposta.mese_idx) : '',
  destinazione: (s.proposta && s.proposta.destinazione) || '',
});

/**
 * La finestra della variazione. commessa e' quella a video (regioni,
 * destinazioni, anteprima); al salvataggio si rilegge il contratto dell'anno e
 * la variazione si applica a quello, perche' a video puo' esserci una lettura di
 * qualche minuto prima. onSalvata riceve la commessa scritta.
 */
export default function VariazioneContratto({ anno, commessa, user, aperta, onChiudi, iniziale = null, onSalvata }) {
  const { toast } = useToast();
  const [mese, setMese] = useState('');
  const [regione, setRegione] = useState('');
  const [verso, setVerso] = useState('piu');
  const [quantita, setQuantita] = useState('');
  const [destinazione, setDestinazione] = useState('');
  const [motivo, setMotivo] = useState('');
  const [comunicataIl, setComunicataIl] = useState('');
  const [errori, setErrori] = useState([]);
  const [salvando, setSalvando] = useState(false);

  // Si compila quando la finestra si apre, e solo allora: un iniziale nuovo a
  // ogni disegno di chi la monta cancellerebbe quello che si sta scrivendo.
  useEffect(() => {
    if (!aperta) return;
    const i = iniziale || {};
    setMese(i.mese_idx !== undefined && i.mese_idx !== null ? String(i.mese_idx) : '');
    setRegione(i.regione || '');
    setVerso(i.verso === 'meno' ? 'meno' : 'piu');
    setQuantita(i.t || '');
    setDestinazione(i.destinazione || '');
    setMotivo('');
    setComunicataIl(oggiRoma());
    setErrori([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperta]);

  const regioni = useMemo(() => leggiLista(commessa && commessa.regioni_json).filter(r => r && r.regione).map(r => r.regione), [commessa]);
  const destinazioni = useMemo(() => leggiLista(commessa && commessa.destinazioni_json).filter(d => d && d.destinazione).map(d => d.destinazione), [commessa]);

  const variazione = () => {
    const n = leggiNumero(quantita);
    return {
      mese_idx: mese,
      regione,
      t: n === null || Number.isNaN(n) ? NaN : (verso === 'meno' ? -n : n),
      destinazione,
      motivo,
      comunicata_il: comunicataIl,
    };
  };
  const anteprima = variazioneDelContratto(commessa, variazione());

  const registra = async () => {
    const prova = variazioneDelContratto(commessa, variazione());
    if (prova.errori.length) { setErrori(prova.errori); return; }
    setSalvando(true);
    setErrori([]);
    try {
      // Il contratto dell'anno com'e' adesso, non quello letto all'apertura della scheda.
      const fresca = commessaDellAnno(await base44.entities.CommessaEcotyre.filter({ anno }), anno);
      if (!fresca) throw new Error(`il contratto del ${anno} non si trova piu': ricarica la pagina`);
      const esito = variazioneDelContratto(fresca, variazione());
      if (esito.errori.length) { setErrori(esito.errori); setSalvando(false); return; }
      const v = esito.voce;
      const storico_json = storicoConVariazione(fresca.storico_json, { il: new Date().toISOString(), da: nomeUtente(user), voce: v, prima: esito.prima });
      const motivoTraccia = `variazione del contratto, ${MESI[v.mese_idx].toLowerCase()} ${v.regione} ${conSegno(v.t)} t: ${v.motivo} (comunicata il ${giorno(v.comunicata_il)})`;
      const scritta = await scriviConTraccia('CommessaEcotyre', fresca.id, { ...esito.patch, storico_json }, { origine: ORIGINE, motivo: motivoTraccia });
      const avviso = avvisoTraccia(scritta);
      const riassunto = esito.righe.map(r => `${r.cosa} ${tonnellate(r.dopo_t)} t`).join(', ');
      toast(avviso ? { ...avviso, title: 'Variazione registrata, ma fuori dallo storico delle modifiche' } : { title: 'Variazione registrata nel contratto', description: riassunto });
      if (onSalvata) await onSalvata({ ...fresca, ...esito.patch, storico_json });
      onChiudi();
    } catch (e) {
      setErrori([`Registrazione non riuscita: ${e.message || String(e)}`]);
    }
    setSalvando(false);
  };

  return (
    <Dialog open={aperta} onOpenChange={(v) => { if (!v && !salvando) onChiudi(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Variazione del contratto {anno}</DialogTitle>
          <DialogDescription>
            Tonnellate in più o in meno decise dal consorzio in corso d&apos;anno. Cambiano il target annuo, quello della regione e il target mensile
            rivisto del mese: la dashboard, l&apos;Andamento, gli avvisi ed EcoTyna le leggono da lì.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Mese
              <select value={mese} onChange={e => setMese(e.target.value)} className="mt-1 w-full h-9 border rounded-md px-2 bg-background text-sm">
                <option value="">Scegli…</option>
                {MESI.map((m, i) => <option key={m} value={String(i)}>{m} {anno}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Regione
              <select value={regione} onChange={e => setRegione(e.target.value)} className="mt-1 w-full h-9 border rounded-md px-2 bg-background text-sm">
                <option value="">Scegli…</option>
                {regioni.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-sm">
              Tonnellate
              <div className="mt-1 flex gap-1">
                {[['piu', 'In più'], ['meno', 'In meno']].map(([v, etichetta]) => (
                  <button key={v} type="button" onClick={() => setVerso(v)}
                    className={`flex-1 text-xs rounded-md border px-2 py-1.5 ${verso === v ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>{etichetta}</button>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Input value={quantita} onChange={e => setQuantita(e.target.value)} inputMode="decimal" className="h-9 text-right tabular-nums" placeholder="100" />
                <span className="text-sm text-muted-foreground">t</span>
              </div>
            </div>
            <label className="block text-sm">
              Destinazione (facoltativa)
              <select value={destinazione} onChange={e => setDestinazione(e.target.value)} className="mt-1 w-full h-9 border rounded-md px-2 bg-background text-sm">
                <option value="">Nessuna</option>
                {destinazioni.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <span className="block text-[11px] text-muted-foreground mt-1">Se il consorzio la indica, cambia anche la quantità di quella destinazione.</span>
            </label>
          </div>
          <label className="block text-sm">
            Motivo
            <Input value={motivo} onChange={e => setMotivo(e.target.value)} className="mt-1 h-9" placeholder="per esempio assegnazione del consorzio di ottobre" />
          </label>
          <label className="block text-sm max-w-[220px]">
            Giorno della comunicazione
            <Input type="date" value={comunicataIl} onChange={e => setComunicataIl(e.target.value)} className="mt-1 h-9" />
          </label>
          {anteprima.errori.length === 0 && (
            <div className="border rounded-md px-3 py-2 bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Il contratto dopo la variazione</div>
              <RigheVariazione righe={anteprima.righe} />
              {anteprima.avvisi.map(a => <p key={a} className="text-xs text-amber-800 mt-1">{a}</p>)}
            </div>
          )}
          {errori.length > 0 && <ul className="text-sm text-destructive list-disc pl-5">{errori.map(e => <li key={e}>{e}</li>)}</ul>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onChiudi} disabled={salvando}>Annulla</Button>
          <Button onClick={registra} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Registra la variazione</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

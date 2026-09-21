import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatTonnellate, formatKg } from '@/lib/utils';
import { CANALI, MESI_BREVI } from '@/lib/dichiarazioniImpianti';
import { AlertTriangle, ArrowRight, Warehouse } from 'lucide-react';

// Gli stoccaggi: non trattano e quindi non dichiarano. Ricevono i PFU e li
// rimandano in secondaria verso gli impianti, e in quel viaggio sono il
// produttore. La dichiarazione si chiede all'impianto che li riceve, solo dopo
// il secondo viaggio: rete, ACI ed extra raccolta allo stesso modo.
//
// Qui si vede, per ogni stoccaggio e canale, cosa e' entrato, cosa e' ripartito
// e verso chi, e quanto resta in piazzale.

const t = (v) => formatTonnellate(Number(v) || 0);
const nomeCanale = (c) => (CANALI.find(x => x.chiave === c) || { nome: c }).nome;
const giorno = (g) => (g ? g.split('-').reverse().join('/') : '');

function Destinazione({ v, canale }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <ArrowRight className="w-3 h-3 text-muted-foreground self-center" />
      <span className="font-medium">{v.impianto}</span>
      <span className="tabular-nums">{t(v.t)} t</span>
      {canale === 'RETE' && v.dichiara === false && (
        <span className="text-muted-foreground">· della rete non manda dichiarazione: quel trattamento non glielo paghiamo</span>
      )}
      {canale === 'RETE' && v.dichiara !== false && v.in_attesa_t > 0 && (
        <span className="text-amber-700">· {t(v.in_attesa_t)} t che il portale aspetta ancora che {v.impianto} dichiari</span>
      )}
      {canale === 'RETE' && v.dichiara !== false && v.in_attesa_t === 0 && (
        <span className="text-emerald-700">· tutto dichiarato da {v.impianto}, secondo il portale</span>
      )}
    </li>
  );
}

function Scheda({ s }) {
  const [aperto, setAperto] = React.useState(false);
  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-muted-foreground" />
            {s.sito}
            <Badge variant="outline" className="font-normal">stoccaggio</Badge>
            {s.anche_impianto && <Badge variant="outline" className="font-normal">anche impianto</Badge>}
          </p>
          {s.anche_impianto && (
            <p className="text-xs text-muted-foreground mt-0.5">
              È anche impianto: quello che arriva all&apos;impianto lo dichiara lui e sta nella scheda Impianti; qui c&apos;è solo il suo piazzale di stoccaggio.
            </p>
          )}
        </div>
        <div className="text-right text-sm">
          <p>In piazzale <strong className="tabular-nums">{t(s.in_piazzale_t)} t</strong></p>
          <p className="text-xs text-muted-foreground">
            {s.in_piazzale_da === 'rilevazione'
              ? `dalla rilevazione del ${giorno(s.rilevazione_il)}, più i movimenti dopo`
              : `dalla giacenza di inizio anno (${t(s.giacenza_iniziale_t)} t), più entrate meno partenze`}
          </p>
        </div>
      </div>

      {s.dichiarazioni_registrate.length > 0 && (
        <div className="mx-4 mt-3 flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Su questo stoccaggio risultano dichiarazioni registrate: {s.dichiarazioni_registrate.map(d => `${d.mese} ${nomeCanale(d.canale)}${d.provenienza ? ` ${d.provenienza}` : ''} ${formatKg(d.quantita_kg)} kg`).join(', ')}.
            Uno stoccaggio non dichiara: vanno riportate sull&apos;impianto che ha ricevuto le secondarie. Non le ho cancellate.
          </span>
        </div>
      )}

      <div className="px-4 py-3 space-y-3">
        {s.canali.map(c => (
          <div key={c.canale} className="text-xs">
            <p className="text-sm font-medium">
              {nomeCanale(c.canale)}
              <span className="text-xs text-muted-foreground font-normal">
                {' '}— entrati {t(c.entrato_t)} t, ripartiti in secondaria {t(c.uscito_t)} t, saldo dell&apos;anno {t(c.saldo_t)} t
              </span>
            </p>
            {c.verso.length > 0
              ? <ul className="mt-1 space-y-0.5">{c.verso.map(v => <Destinazione key={v.chiave} v={v} canale={c.canale} />)}</ul>
              : <p className="mt-1 text-muted-foreground">Nessuna secondaria partita quest&apos;anno.</p>}
          </div>
        ))}
        <button type="button" onClick={() => setAperto(v => !v)} className="text-xs text-primary hover:underline">
          {aperto ? 'Nascondi il dettaglio mese per mese' : 'Mese per mese'}
        </button>
        {aperto && (
          <div className="border rounded-lg" data-scorre-lato>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-1.5 font-semibold sticky left-0 bg-muted/40 min-w-[150px]">Canale</th>
                  {MESI_BREVI.map(m => <th key={m} className="px-2 py-1.5 font-semibold text-right min-w-[64px]">{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {s.canali.flatMap(c => [
                  <tr key={`${c.canale}-e`} className="border-b">
                    <td className="px-3 py-1 sticky left-0 bg-card">{nomeCanale(c.canale)} · entrati (kg)</td>
                    {c.mesi.map(m => <td key={m.mese} className="px-2 py-1 text-right tabular-nums">{m.entrato_kg ? formatKg(m.entrato_kg) : ''}</td>)}
                  </tr>,
                  <tr key={`${c.canale}-u`} className="border-b last:border-b-0">
                    <td className="px-3 py-1 sticky left-0 bg-card text-muted-foreground">{nomeCanale(c.canale)} · ripartiti (kg)</td>
                    {c.mesi.map(m => <td key={m.mese} className="px-2 py-1 text-right tabular-nums text-muted-foreground">{m.uscito_kg ? formatKg(m.uscito_kg) : ''}</td>)}
                  </tr>,
                ])}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Stoccaggi({ stoccaggi }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground max-w-4xl">
        Gli stoccaggi non trattano i PFU e quindi non fanno dichiarazioni: li ricevono e li rimandano in secondaria verso gli impianti,
        e in quel viaggio sono il produttore. Solo dopo questo secondo passaggio si può chiedere la dichiarazione, e la fa l&apos;impianto
        che li ha ricevuti: vale per la rete, per l&apos;ACI e per l&apos;extra raccolta. Le secondarie compaiono perciò sulle righe
        dell&apos;impianto di destinazione, nel mese in cui arrivano.
      </p>
      {(!stoccaggi || stoccaggi.length === 0) && <p className="text-sm text-muted-foreground">Nessuno stoccaggio con movimenti quest&apos;anno.</p>}
      {(stoccaggi || []).map(s => <Scheda key={s.chiave} s={s} />)}
    </div>
  );
}

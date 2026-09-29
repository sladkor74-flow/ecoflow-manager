import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Trash2, MapPin, Lightbulb, AlertTriangle } from 'lucide-react';
import { formatKg } from '@/lib/utils';
import { chiaveNome } from '@/lib/target';

// LE ZONE DI COMPETENZA DEI RACCOGLITORI, anno per anno.
//
// Decisione dell'utente (29/09/2026): la zona si DICHIARA, non si deduce da dove
// uno ha raccolto. Un perimetro dedotto renderebbe impossibile, per costruzione,
// accorgersi che qualcuno ha lavorato fuori perimetro: sarebbe sempre dentro.
//
// Qui si scrive; a leggerla e' il modulo Verifiche Fornitori, che segna in ambra le
// province fuori zona. Finche' una zona non e' scritta, quel modulo dice di non
// poter giudicare quel raccoglitore, invece di dare per buono.
//
// La PROPOSTA nasce da dove ciascuno ha davvero raccolto nell'anno, scartando i
// ritiri isolati: e' un punto di partenza da correggere, e resta marcata come
// proposta finche' non la si conferma. Scrive solo l'amministratore.

const ANNI = [new Date().getFullYear(), new Date().getFullYear() - 1];

export default function ZoneRaccoglitori({ isAdmin }) {
  const [anno, setAnno] = useState(ANNI[0]);
  const [dati, setDati] = useState(null);
  const [zone, setZone] = useState([]);
  const [bozze, setBozze] = useState({});
  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState('');
  const [errore, setErrore] = useState('');

  const carica = useCallback(async () => {
    setCaricando(true);
    setErrore('');
    try {
      const [r, z] = await Promise.all([
        base44.functions.invoke('andamentoRaccoglitori', { anno }),
        base44.entities.ZonaRaccoglitore.filter({ anno }, 'raccoglitore', 500),
      ]);
      const corpo = (r && r.data) || r;
      if (!corpo || corpo.error) throw new Error((corpo && corpo.error) || 'La raccolta dell\'anno non e\' arrivata.');
      setDati(corpo);
      setZone(z || []);
      setBozze({});
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
    } finally {
      setCaricando(false);
    }
  }, [anno]);

  useEffect(() => { carica(); }, [carica]);

  // LA STESSA CHIAVE DEL MOTORE. Confrontare i nomi con un toLowerCase mentre il
  // motore li normalizza con normalizzaRagioneSociale voleva dire che la pagina ne
  // vedeva una e il modulo ne univa due: premendo il cestino l'admin credeva di
  // aver tolto la zona, e Verifiche Fornitori continuava a giudicare con la riga
  // superstite, marcando come fuori zona dei chili che fuori zona non erano.
  const righeZonaDi = (nome) => {
    const k = chiaveNome(nome);
    return k ? zone.filter(z => chiaveNome(z.raccoglitore) === k) : [];
  };
  const zonaDi = (nome) => righeZonaDi(nome)[0] || null;
  // Le province che il modulo applica davvero: l'unione di tutte le righe, come fa
  // zonePerRaccoglitore. Se le righe sono piu' di una, la casella lo deve dire.
  // Il testo grezzo di tutte le righe, unito: a interpretarlo resta il motore
  // (provinceDiZona), cosi' la regola di che cosa e' una provincia non ha una
  // seconda copia qui che puo' scostarsi.
  const provinceApplicate = (nome) => righeZonaDi(nome).map(z => String(z.province || '').trim()).filter(Boolean).join(', ');
  const propostaDi = (nome) => (dati && dati.proposte || []).find(p => p.raccoglitore === nome) || null;

  const salva = async (riga, province, proposta = false) => {
    if (!isAdmin) return;
    setSalvando(riga.nome);
    setErrore('');
    try {
      const esistenti = righeZonaDi(riga.nome);
      const campi = { raccoglitore: riga.nome, anno, province, proposta };
      if (esistenti.length) {
        await base44.entities.ZonaRaccoglitore.update(esistenti[0].id, campi);
        // Le righe in piu' dello stesso raccoglitore si tolgono: il motore le
        // unirebbe, e quello che si legge nella casella non sarebbe quello che il
        // modulo applica.
        for (const z of esistenti.slice(1)) await base44.entities.ZonaRaccoglitore.delete(z.id);
      } else await base44.entities.ZonaRaccoglitore.create(campi);
      await carica();
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
    } finally {
      setSalvando('');
    }
  };

  const cancella = async (riga) => {
    const esistenti = righeZonaDi(riga.nome);
    if (!isAdmin || !esistenti.length) return;
    setSalvando(riga.nome);
    try {
      // TUTTE le righe di quel raccoglitore: cancellandone una sola, il modulo
      // continuava a giudicarlo con quella rimasta.
      for (const z of esistenti) await base44.entities.ZonaRaccoglitore.delete(z.id);
      await carica();
    } catch (e) {
      setErrore(e && e.message ? e.message : String(e));
    } finally {
      setSalvando('');
    }
  };

  const righe = (dati && dati.andamento && dati.andamento.righe) || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium mb-1">Anno</label>
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={anno} onChange={e => setAnno(Number(e.target.value))}>
            {ANNI.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={carica} disabled={caricando}>
          {caricando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Aggiorna
        </Button>
      </div>

      <p className="text-xs text-muted-foreground max-w-3xl">
        Le province che competono a ciascun raccoglitore, per quest&apos;anno. Si scrivono come viene — <span className="font-mono">SA, NA; CE</span> —
        e le legge Verifiche Fornitori, che segna in ambra i ritiri fatti fuori zona. <strong>Finché una zona non è scritta, quel modulo non
        giudica quel raccoglitore</strong> e lo dichiara: è il motivo per cui la zona si dichiara invece di dedurla da dove ha lavorato.
        Le zone cambiano con i contratti, perciò valgono per un anno.
      </p>

      {errore && (
        <div className="flex items-start gap-2 text-sm border border-destructive/30 bg-destructive/10 text-destructive rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{errore}</span>
        </div>
      )}
      {caricando && !dati && <p className="text-sm text-muted-foreground">Sto leggendo la raccolta dell&apos;anno…</p>}

      {righe.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-2 py-2 font-semibold">Raccoglitore</th>
                  <th className="px-2 py-2 font-semibold">Dove ha raccolto nel {anno}</th>
                  <th className="px-2 py-2 font-semibold">Zona di competenza</th>
                  <th className="px-2 py-2 font-semibold w-px" />
                </tr>
              </thead>
              <tbody>
                {righe.map(r => {
                  const z = zonaDi(r.nome);
                  // Quello che si legge nella casella e' quello che il modulo
                  // APPLICA: con due righe per lo stesso raccoglitore, mostrarne una
                  // sola faceva credere che la zona fosse meta' di quella vera.
                  const applicate = provinceApplicate(r.nome);
                  const altreRighe = righeZonaDi(r.nome).length;
                  const valore = bozze[r.nome] !== undefined ? bozze[r.nome] : applicate;
                  const proposta = propostaDi(r.nome);
                  const inCorso = salvando === r.nome;
                  return (
                    <tr key={r.chiave} className="border-t align-top">
                      <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                        {r.nome}
                        <span className="block text-xs text-muted-foreground">{formatKg(r.kg)} kg</span>
                      </td>
                      <td className="px-2 py-1.5 text-xs">
                        {r.province.map(p => (
                          <span key={p.provincia} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded bg-muted" title={`${formatKg(p.kg)} kg in ${p.ritiri} ritiri`}>
                            {p.provincia}
                          </span>
                        ))}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={valore}
                          disabled={!isAdmin || inCorso}
                          onChange={e => setBozze(b => ({ ...b, [r.nome]: e.target.value }))}
                          placeholder={isAdmin ? 'SA, NA, CE' : 'non scritta'}
                          className="border rounded px-2 py-1 text-sm font-mono w-48 disabled:bg-muted/40"
                        />
                        {altreRighe > 1 && (
                          <span className="block text-[11px] text-amber-800 mt-0.5">Questo raccoglitore ha {altreRighe} righe di zona: il modulo le unisce, e salvando qui restera' una riga sola.</span>
                        )}
                        {z && z.proposta && (
                          <span className="block text-[11px] text-amber-800 mt-0.5">proposta dal gestionale, da confermare</span>
                        )}
                        {!z && proposta && proposta.province.length > 0 && isAdmin && (
                          <button type="button" className="block text-[11px] text-primary hover:underline mt-0.5"
                            onClick={() => setBozze(b => ({ ...b, [r.nome]: proposta.province.join(', ') }))}>
                            <Lightbulb className="w-3 h-3 inline mr-0.5" />
                            proponi: {proposta.province.join(', ')}
                            {proposta.scartate.length > 0 ? ` (fuori ${proposta.scartate.map(s => s.provincia).join(', ')}: pochi chili)` : ''}
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2" disabled={inCorso || valore === (z ? z.province || '' : '')}
                              onClick={() => salva(r, valore, false)} title="Salva la zona di competenza">
                              {inCorso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            </Button>
                            {z && (
                              <Button size="sm" variant="outline" className="h-7 px-2" disabled={inCorso}
                                onClick={() => cancella(r)} title="Togli la zona: il modulo tornera' a non giudicare questo raccoglitore">
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-muted-foreground border-t flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              La proposta prende le province da cui quel raccoglitore ha davvero ritirato nell&apos;anno, lasciando fuori i ritiri isolati
              (meno di una tonnellata in dodici mesi): una provincia toccata una volta non è una zona di competenza, e proporla la
              renderebbe tale. Resta un punto di partenza: la zona è quella che decidi tu.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

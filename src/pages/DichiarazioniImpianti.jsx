import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, FileSpreadsheet, Link2 } from 'lucide-react';
import { usePermessi } from '@/lib/permessi';
import { BannerSolaLettura } from '@/components/shared/SolaLettura';
import { formatTonnellate, formatKg, formatIntero } from '@/lib/utils';
import { CANALI } from '@/lib/dichiarazioniImpianti';
import Riepilogo from '@/components/dichiarazioni/Riepilogo';
import SezioneImpianto from '@/components/dichiarazioni/SezioneImpianto';
import Quadratura from '@/components/dichiarazioni/Quadratura';
import DialogoMese from '@/components/dichiarazioni/DialogoMese';
import PraticaIrigom from '@/components/dichiarazioni/PraticaIrigom';
import Stoccaggi from '@/components/dichiarazioni/Stoccaggi';
import { esportaDichiarazioni } from '@/lib/dichiarazioniExport';

// Dichiarazioni degli impianti: che cosa ogni impianto ricava dai PFU che gli
// conferiamo, mese per mese, e come questo decurta la giacenza a portale.

const ANNI = [2026, 2025];

function Kpi({ titolo, valore, nota, tono }) {
  const colore = tono === 'buono' ? 'text-emerald-700' : tono === 'attenzione' ? 'text-amber-700' : tono === 'male' ? 'text-red-700' : '';
  return (
    <div className="border rounded-xl bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{titolo}</p>
      <p className={`text-xl font-semibold tabular-nums ${colore}`}>{valore}</p>
      {nota && <p className="text-xs text-muted-foreground mt-0.5">{nota}</p>}
    </div>
  );
}

// I formulari terminati senza tutte le date obbligatorie (regola dell'utente,
// 22/09/2026: immissione, inizio e fine trasporto vanno sempre segnalate dove
// mancano). Un conteggio per canale, ciascun formulario una volta sola: rete, ACI
// ed extra raccolta non si sommano. Gli elenchi stanno nelle schede.
// Dei senza fine trasporto, arrivi e partenze restano divisi, ciascuno col suo
// peso (22/09/2026): un arrivo di PFU e una terziaria in uscita sono materiali
// diversi, in versi opposti, e un peso che li somma non vuol dire niente.
const senzaFineInBreve = (c) => {
  const parti = [];
  if (c.arrivi_senza_fine) parti.push(`${formatIntero(c.arrivi_senza_fine)} ${c.arrivi_senza_fine === 1 ? 'arrivato' : 'arrivati'} (${formatKg(c.arrivi_senza_fine_kg)} kg)`);
  if (c.partenze_senza_fine) parti.push(`${formatIntero(c.partenze_senza_fine)} in uscita (${formatKg(c.partenze_senza_fine_kg)} kg)`);
  return parti.length ? `, di cui senza fine trasporto ${parti.join(' e ')}` : '';
};

function DateInBreve({ conti }) {
  if (!conti) return null;
  const voci = CANALI.map(c => ({ ...c, ...(conti[c.chiave] || { n: 0, senza_fine: 0 }) })).filter(c => c.n > 0);
  if (!voci.length) return null;
  const senzaFine = voci.some(c => c.senza_fine > 0);
  return (
    <div className="flex items-start gap-2 text-xs border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p>
          <strong>Formulari terminati con le date da sistemare</strong> (immissione, inizio e fine trasporto sono obbligatorie):{' '}
          {voci.map(c => `${c.nome} ${formatIntero(c.n)}${senzaFineInBreve(c)}`).join(' · ')}.
        </p>
        {senzaFine && (
          <p>
            Senza fine trasporto un ordine non si colloca in nessun mese e non entra nella giacenza calcolata finche&apos; la data non arriva;
            il portale, se lo conosce, lo conta. Quali sono lo trovi nelle schede Impianti e Stoccaggi, che cosa cambia nella Quadratura.
          </p>
        )}
      </div>
    </div>
  );
}

export default function DichiarazioniImpianti() {
  const { isAdmin, soloLettura } = usePermessi();
  const [anno, setAnno] = useState(2026);
  const [dati, setDati] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [apertura, setApertura] = useState(null);
  const [allineo, setAllineo] = useState(false);
  const [esitoAllineamento, setEsitoAllineamento] = useState(null);

  // silenzioso: rilegge senza mostrare il caricamento (la seconda lettura dopo un salvataggio).
  const carica = useCallback(async ({ silenzioso = false } = {}) => {
    if (!silenzioso) setCaricamento(true);
    setErrore('');
    try {
      const res = await base44.functions.invoke('riepilogoDichiarazioni', { anno });
      setDati(res.data);
    } catch (e) {
      setErrore(e?.response?.data?.error || e.message);
    } finally {
      setCaricamento(false);
    }
  }, [anno]);
  useEffect(() => { carica(); }, [carica]);

  const apri = (sito, flusso, mese) => { if (!soloLettura) setApertura({ sito, flusso, mese }); };

  // Le dichiarazioni caricate a portale si riconoscono dai pesi del report: questo
  // lo rifa' a comando, ma succede gia' da solo a ogni caricamento del report.
  const allinea = async () => {
    setAllineo(true);
    setEsitoAllineamento(null);
    try {
      const res = await base44.functions.invoke('allineaDichiarazioni', { anno });
      setEsitoAllineamento(res.data);
      await carica();
    } catch (e) {
      setErrore(e?.response?.data?.error || e.message);
    } finally {
      setAllineo(false);
    }
  };
  const totali = dati ? dati.totali : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dichiarazioni Impianti</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Ogni mese gli impianti dichiarano che cosa hanno ricavato dai PFU che abbiamo conferito: granulo, metalli ferrosi e fibre
            per chi fa recupero di materia, ciabattato o cippato per chi fa valorizzazione energetica. Le dichiarazioni di Irigom le prepariamo noi.
            Gli stoccaggi non trattano e non dichiarano: quello che rimandano in secondaria lo dichiara l'impianto che lo riceve.
            Quando una dichiarazione viene caricata a portale, decurta la giacenza dell'impianto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(anno)} onValueChange={v => setAnno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{ANNI.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" className="gap-1" onClick={carica} disabled={caricamento}>
            {caricamento ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Aggiorna
          </Button>
          {isAdmin && (
            <Button variant="outline" className="gap-1" onClick={allinea} disabled={allineo} title="Rilegge il report delle dichiarazioni di trattamento e segna quali mesi risultano caricati a portale, con la data e i materiali">
              {allineo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} Allinea dal portale
            </Button>
          )}
          <Button variant="outline" className="gap-1" disabled={!dati} onClick={() => esportaDichiarazioni(dati)}>
            <FileSpreadsheet className="w-4 h-4" /> Esporta
          </Button>
        </div>
      </div>

      {soloLettura && <BannerSolaLettura cosa="le dichiarazioni degli impianti" />}
      {errore && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errore}</p>}

      {esitoAllineamento && (
        <div className="text-sm border rounded-lg px-3 py-2 bg-muted/40">
          {esitoAllineamento.aggiornate?.length
            ? <p><strong>{esitoAllineamento.aggiornate.length}</strong> {esitoAllineamento.aggiornate.length === 1 ? 'dichiarazione riconosciuta' : 'dichiarazioni riconosciute'} fra quelle caricate a portale: {esitoAllineamento.aggiornate.map(a => `${a.sito} ${a.mese}${a.canale && a.canale !== 'RETE' ? ` ${a.canale}` : ''} (${a.caricata_il.split('-').reverse().join('/')})`).join(', ')}.</p>
            : <p>Nessuna novita': quello che risulta caricato a portale era gia' segnato.</p>}
          {esitoAllineamento.non_trovate?.filter(n => n.era_segnata).length > 0 && (
            <p className="text-amber-700 mt-1">
              Segnate come caricate ma non trovate nel report del portale: {esitoAllineamento.non_trovate.filter(n => n.era_segnata).map(n => `${n.sito} ${n.mese}${n.canale && n.canale !== 'RETE' ? ` ${n.canale}` : ''}`).join(', ')}.
            </p>
          )}
        </div>
      )}

      {caricamento && !dati && (
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico le dichiarazioni…</p>
      )}

      {dati && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* La rete: e' la rete che fa la giacenza a portale. ACI ed extra raccolta si scrivono a parte e non si sommano. */}
            <Kpi
              titolo="Rete: dichiarato e caricato a portale"
              valore={`${formatTonnellate(totali.dichiarato_caricato_rete_t)} t`}
              nota={[
                `su ${formatTonnellate(totali.dichiarato_totale_rete_t)} t dichiarate`,
                totali.dichiarato_caricato_aci_t > 0 ? `ACI a parte: ${formatTonnellate(totali.dichiarato_caricato_aci_t)} t` : '',
                totali.dichiarato_caricato_extra_t > 0 ? `extra raccolta a parte: ${formatTonnellate(totali.dichiarato_caricato_extra_t)} t` : '',
              ].filter(Boolean).join(' · ')}
            />
            <Kpi titolo="Rete: conferito nell'anno" valore={`${formatTonnellate(totali.conferito_t)} t`} nota="primarie a impianti e stoccaggi, per fine trasporto" />
            <Kpi
              titolo="Rete: giacenza degli impianti"
              valore={`${formatTonnellate(totali.giacenza_calcolata_t)} t`}
              nota={totali.giacenza_calcolata_confrontabile_t === totali.giacenza_calcolata_t
                ? `a portale, aggiornata ai caricamenti: ${formatTonnellate(totali.giacenza_portale_t)} t`
                : `di cui ${formatTonnellate(totali.giacenza_calcolata_confrontabile_t)} t confrontabili col portale, che aggiornato ne segna ${formatTonnellate(totali.giacenza_portale_t)} t`}
            />
            <Kpi
              titolo="Rete: quadratura con il portale"
              valore={`${totali.siti_che_quadrano} su ${totali.siti_che_quadrano + totali.siti_da_quadrare}`}
              nota={[
                totali.siti_da_quadrare ? `${totali.siti_da_quadrare} da verificare` : 'tutti in linea',
                (totali.aci_che_quadrano || 0) + (totali.aci_da_quadrare || 0) > 0
                  ? `ACI negli stoccaggi, a parte: ${totali.aci_che_quadrano} su ${totali.aci_che_quadrano + totali.aci_da_quadrare}` : '',
              ].filter(Boolean).join(' · ')}
              tono={totali.siti_da_quadrare ? 'male' : 'buono'}
            />
          </div>

          <DateInBreve conti={totali.date_da_sistemare} />

          <Tabs defaultValue="riepilogo">
            <TabsList>
              <TabsTrigger value="riepilogo">Riepilogo</TabsTrigger>
              <TabsTrigger value="impianti">Impianti</TabsTrigger>
              <TabsTrigger value="stoccaggi">Stoccaggi</TabsTrigger>
              <TabsTrigger value="irigom">Irigom</TabsTrigger>
              <TabsTrigger value="quadratura" className="gap-1">
                Quadratura
                {totali.siti_da_quadrare > 0 || totali.aci_da_quadrare > 0 ? <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="riepilogo" className="mt-4">
              <Riepilogo dati={dati} onApri={apri} soloLettura={soloLettura} />
            </TabsContent>

            <TabsContent value="impianti" className="mt-4 space-y-4">
              {dati.siti.filter(s => s.tipo_destinazione !== 'stoc').map(s => <SezioneImpianto key={s.chiave} sito={s} onApri={apri} soloLettura={soloLettura} />)}
            </TabsContent>

            <TabsContent value="stoccaggi" className="mt-4">
              <Stoccaggi stoccaggi={dati.stoccaggi} />
            </TabsContent>

            <TabsContent value="irigom" className="mt-4">
              <PraticaIrigom anno={anno} irigom={dati.siti.find(s => s.tipo_destinazione !== 'stoc' && /irigom/i.test(s.sito || s.chiave || '')) || null} fotoPortaleIl={dati.foto_portale_il} onRegistrata={carica} />
            </TabsContent>

            <TabsContent value="quadratura" className="mt-4">
              <Quadratura dati={dati} />
            </TabsContent>
          </Tabs>
        </>
      )}

      {apertura && isAdmin && (
        <DialogoMese
          sito={apertura.sito}
          flusso={apertura.flusso}
          mese={apertura.mese}
          anno={anno}
          onChiudi={() => setApertura(null)}
          // Subito dopo il salvataggio la funzione a volte legge ancora la versione di
          // prima (22/09/2026: aprile di Irigom restava 'nessuna dichiarazione' finche'
          // non si premeva Aggiorna): si rilegge una seconda volta poco dopo.
          onSalvato={() => { setApertura(null); carica(); setTimeout(() => carica({ silenzioso: true }), 3000); }}
        />
      )}
    </div>
  );
}

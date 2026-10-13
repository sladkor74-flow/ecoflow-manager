import React, { useState } from 'react';
import { Loader2, FileSpreadsheet, FileDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import RigaDetailModal from './RigaDetailModal';
import NomeSurplus from './NomeSurplus';
import { formatKg } from '@/lib/utils';
import { euro, prezzoUnitario } from '@/lib/formatoSoldi';
import { testoEuroT } from '@/lib/surplus';
import { eRigaSurplus, soloFormulari, surplusInFondo, contiAttiva, righeAParole, nomiVociSurplus, originiSurplus, partiRigaSurplus, baseSurplus, dettaglioRigaSurplus, tonnellateDaKg, STILE_SURPLUS } from '@/lib/surplusVista';

const TIPS = [
  { key: 'RETE', label: 'Rete' },
  { key: 'ACI', label: 'ACI' },
  { key: 'EXTRA_RACCOLTA', label: 'Extra' },
];
const NOMI = { RETE: 'Rete', ACI: 'ACI', EXTRA_RACCOLTA: 'Extra raccolta', anomalie: 'Anomalie e sospesi' };

const statoRiga = (r) => (r.sospesa ? 'sospesa' : r.stato_validazione === 'errore' ? 'errore' : 'ok');
// Gli importi e i prezzi vengono da formatoSoldi (chiusura dell'audit,
// 11/10/2026): qui un totale che mancava diventava «€ 0,00», e il prezzo usciva
// sempre a quattro decimali («€ 202,0000»).

// Colonne del dettaglio, uguali a video e nelle esportazioni. La regione e' quella
// del punto di raccolta in cui e' avvenuto il ritiro.
//
// LA RIGA DEL SURPLUS (il Fuel Surcharge, 13/10/2026) sta in fondo, sotto i
// formulari, come in fattura, e si legge come nella pagina: il nome nella prima
// cella, poi su che cosa si paga e quando vale («1.120,24 t × 5,00 €/t · dal
// 01/10/2026 al 31/12/2026»); l'origine la dice il sottotitolo. La quantita'
// resta VUOTA: i chili sono quelli dei formulari qui sopra, e scritti anche li'
// li sommerebbe chi fa la somma della colonna. Il TOTALE comprende il surplus,
// che e' quello che si fattura.
// Prima nella colonna FIR c'era la nota intera del calcolo, e il PDF, che tiene
// tre righe per cella, la tagliava proprio sulle tonnellate (revisione del
// 13/10/2026): «..., sulle stesse» e basta. Le tonnellate ora vengono per prime.
const firSurplus = (r) => [baseSurplus(r.kg_riferimento, r.tariffa_valore), partiRigaSurplus(r).periodo].filter(Boolean).join(' · ');
export const COLONNE = [
  { titolo: 'Ordine', valore: r => (eRigaSurplus(r) ? (r.descrizione || 'Surplus') : r.ordine || ''), tipo: 'testo', peso: 1.25 },
  { titolo: 'Fine trasporto', valore: r => r.data_fine_trasporto || null, tipo: 'data', peso: 0.95 },
  // una riga a corpo (sovracosto dell'extra raccolta) porta la sua descrizione accanto al formulario
  { titolo: 'FIR', valore: r => (eRigaSurplus(r) ? firSurplus(r) : [r.numero_fir, r.descrizione].filter(Boolean).join(' · ')), tipo: 'testo', peso: 1.35 },
  { titolo: 'Regione ritiro', valore: r => r.regione || '', tipo: 'testo', peso: 1.1 },
  { titolo: 'Classe', valore: r => r.classe || '', tipo: 'testo', peso: 0.7 },
  { titolo: 'Quantità (kg)', valore: r => (eRigaSurplus(r) ? null : r.quantita ?? null), tipo: 'kg', peso: 0.95 },
  { titolo: 'Prezzo unitario', valore: r => r.tariffa_valore ?? null, tipo: 'prezzo', peso: 1 },
  { titolo: 'Totale', valore: r => r.totale ?? null, tipo: 'euro', peso: 1 },
  { titolo: 'Stato', valore: statoRiga, tipo: 'testo', peso: 0.7 },
];
const I_KG = 5, I_TOT = 7;

/**
 * Le opzioni dell'esportazione di un elenco di righe (Excel e PDF dicono le
 * stesse cose): le righe con quelle del surplus in fondo, i chili dei soli
 * formulari e il totale fatturabile, che comprende il surplus.
 */
export function opzioniEsportazione(chiave, righe, periodoTesto) {
  const ordinate = surplusInFondo(righe);
  // Il totale fatturabile esclude le prestazioni sospese, come nelle esportazioni ufficiali.
  const conti = contiAttiva(ordinate);
  const valide = ordinate.filter(r => !r.sospesa);
  const origini = originiSurplus(ordinate);
  return {
    nomeFile: `Fatturazione attiva ${NOMI[chiave]} ${periodoTesto}`,
    foglio: NOMI[chiave],
    intestazione: 'SMOCO S.r.l.  ·  COMMESSA ECOTYRE  ·  FATTURAZIONE ATTIVA',
    titolo: `Dettaglio ${NOMI[chiave]} — ${periodoTesto}`,
    // «380 righe e la riga del Fuel Surcharge (consorzio Ecotyre)»
    sottotitolo: [righeAParole(ordinate), origini.length ? `(${origini.join(', ')})` : ''].filter(Boolean).join(' '),
    colonne: COLONNE,
    righe: ordinate,
    totali: {
      etichetta: valide.length === ordinate.length ? 'TOTALE' : 'TOTALE (escluse sospese)',
      valori: { [I_KG]: conti.kg, [I_TOT]: conti.totale },
    },
    // 'surplus' dice a esportaTabella che la riga e' del surplus: nel PDF ha la
    // forma dei fogli della passiva, indaco in corsivo con la barra (13/10/2026)
    colore: (r) => (eRigaSurplus(r) ? 'surplus' : r.sospesa ? 'ambra' : r.stato_validazione === 'errore' ? 'rosso' : null),
  };
}

// La barra sopra la tabella di un canale: righe, chili e totale, e con un
// surplus lo standard e il surplus a parte, come le righe della fattura. Due
// righe dello stesso surplus si distinguono dall'importo («Fuel Surcharge a
// 5,00 €/t · Fuel Surcharge a 7,00 €/t»).
export function BarraConti({ righe }) {
  const conti = contiAttiva(righe);
  const nomi = nomiVociSurplus(conti.voci_surplus);
  return (
    <p className="text-sm text-muted-foreground">
      {righeAParole(righe)} · {formatKg(conti.kg)} kg · <span className="font-medium text-foreground">{euro(conti.totale)}</span>
      {conti.voci_surplus.length > 0 && (
        <span> (standard {euro(conti.standard)} · {conti.voci_surplus.map((r, i) => `${nomi[i]} ${euro(r.totale)}`).join(' · ')})</span>
      )}
      {righe.some(r => r.sospesa) && ' (escluse le sospese)'}
    </p>
  );
}

// La tabella delle righe: i formulari, e in fondo la riga del surplus con la
// sua barretta, che si legge da sinistra a destra come in fattura: nome, da dove
// viene e quando vale, le stesse tonnellate, i suoi €/t, l'importo.
export function TabellaRighe({ righe, onApri = () => {} }) {
  if (!righe || righe.length === 0) return <div className="text-center py-6 text-muted-foreground">Nessuna riga.</div>;
  const ordinate = surplusInFondo(righe);
  return (
    <div className="border rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted"><tr>
          <th className="text-left px-2 py-2 font-semibold">Ordine</th>
          <th className="text-left px-2 py-2 font-semibold">FIR</th>
          <th className="text-left px-2 py-2 font-semibold">Regione ritiro</th>
          <th className="text-left px-2 py-2 font-semibold">Classe</th>
          <th className="text-right px-2 py-2 font-semibold">Quantità</th>
          <th className="text-right px-2 py-2 font-semibold">Prezzo</th>
          <th className="text-right px-2 py-2 font-semibold">Totale</th>
          <th className="text-center px-2 py-2 font-semibold">Stato</th>
        </tr></thead>
        <tbody>
          {ordinate.map((r, i) => (eRigaSurplus(r) ? (
            <tr key={r.id || `surplus-${i}`} data-riga="surplus" className={`cursor-pointer border-t-2 ${STILE_SURPLUS.fondo}`} onClick={() => onApri(r)}>
              <td colSpan={4} className="px-2 py-1.5">
                <NomeSurplus nome={r.descrizione} />
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {[dettaglioRigaSurplus(r), r.record_count ? `su ${r.record_count} ${r.record_count === 1 ? 'ordine' : 'ordini'} del mese` : ''].filter(Boolean).join(' · ')}
                </span>
              </td>
              {/* i chili sono quelli dei formulari qui sopra: fra parentesi, come nei fogli, perche' non si sommano */}
              <td className={`px-2 py-1.5 text-right ${STILE_SURPLUS.parentesi}`} title={`Le stesse ${tonnellateDaKg(r.kg_riferimento)} t dei formulari qui sopra: non si sommano un'altra volta`}>({formatKg(r.kg_riferimento)} kg)</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{testoEuroT(r.tariffa_valore) || '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{euro(r.totale)}</td>
              <td className="text-center px-2 py-1.5"><span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">ok</span></td>
            </tr>
          ) : (
            <tr key={r.id || i} className={`cursor-pointer hover:bg-muted/30 ${r.sospesa ? 'opacity-50' : ''} ${i % 2 ? 'bg-muted/20' : ''}`} onClick={() => onApri(r)}>
              <td className="px-2 py-1.5 font-mono text-xs">{r.ordine || '-'}</td>
              <td className="px-2 py-1.5 text-xs">{[r.numero_fir, r.descrizione].filter(Boolean).join(' · ') || '-'}</td>
              <td className="px-2 py-1.5">{r.regione || <span className="text-muted-foreground">—</span>}</td>
              <td className="px-2 py-1.5">{r.classe || '-'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatKg(r.quantita)} kg</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{prezzoUnitario(r.tariffa_valore)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{euro(r.totale)}</td>
              <td className="text-center px-2 py-1.5">
                {r.sospesa ? <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sospesa</span>
                  : r.stato_validazione === 'errore' ? <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">errore</span>
                  : <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">ok</span>}
              </td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

export default function AttivaDetail({ data, loading, periodo }) {
  const [subTab, setSubTab] = useState('RETE');
  const [selectedRiga, setSelectedRiga] = useState(null);
  const [esportando, setEsportando] = useState(null);
  const { toast } = useToast();

  if (loading) return <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></div>;

  const allRighe = [...(data.RETE?.righe || []), ...(data.ACI?.righe || []), ...(data.EXTRA_RACCOLTA?.righe || [])];
  const sospese = allRighe.filter(r => r.sospesa);
  const errori = allRighe.filter(r => r.stato_validazione === 'errore');
  const periodoTesto = periodo ? `${periodo.mese} ${periodo.anno}` : '';

  const esporta = async (formato, chiave, righe) => {
    if (!righe.length) { toast({ title: 'Nessuna riga da esportare' }); return; }
    setEsportando(`${chiave}-${formato}`);
    try {
      const opzioni = opzioniEsportazione(chiave, righe, periodoTesto);
      // esportaTabella si porta dietro jspdf e xlsx: si carica qui, al click.
      const { esportaTabellaExcel, esportaTabellaPdf } = await import('@/lib/esportaTabella');
      if (formato === 'excel') await esportaTabellaExcel(opzioni);
      else await esportaTabellaPdf(opzioni);
    } catch (e) {
      toast({ title: 'Esportazione non riuscita', description: e.message || String(e), variant: 'destructive' });
    }
    setEsportando(null);
  };

  function barraEsportazione(chiave, righe) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <BarraConti righe={righe} />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={!righe.length || !!esportando} onClick={() => esporta('excel', chiave, righe)}>
            {esportando === `${chiave}-excel` ? <Loader2 className="animate-spin" /> : <FileSpreadsheet className="text-emerald-700" />} Excel
          </Button>
          <Button size="sm" variant="outline" disabled={!righe.length || !!esportando} onClick={() => esporta('pdf', chiave, righe)}>
            {esportando === `${chiave}-pdf` ? <Loader2 className="animate-spin" /> : <FileDown className="text-red-700" />} PDF
          </Button>
        </div>
      </div>
    );
  }

  const renderTable = (righe) => <TabellaRighe righe={righe} onApri={setSelectedRiga} />;

  const anomalie = [...sospese, ...errori.filter(r => !r.sospesa)];

  return (
    <>
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          {/* il numero e' quello dei formulari: la riga del surplus non e' una prestazione */}
          {TIPS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label} ({soloFormulari(data[t.key]?.righe).length})</TabsTrigger>)}
          <TabsTrigger value="anomalie">Anomalie & Sospesi ({sospese.length + errori.length})</TabsTrigger>
        </TabsList>
        {TIPS.map(t => (
          <TabsContent key={t.key} value={t.key} className="mt-3">
            {barraEsportazione(t.key, data[t.key]?.righe || [])}
            {renderTable(data[t.key]?.righe)}
          </TabsContent>
        ))}
        <TabsContent value="anomalie" className="mt-3">
          {sospese.length === 0 && errori.length === 0 ? (
            <div className="text-center py-6 text-green-600">Nessuna anomalia. Tutte le prestazioni sono verificate.</div>
          ) : (
            <div className="space-y-3">
              {barraEsportazione('anomalie', anomalie)}
              {sospese.length > 0 && (
                <div>
                  <h3 className="font-semibold text-amber-700 mb-2">⚠ Prestazioni Sospese ({sospese.length})</h3>
                  {renderTable(sospese)}
                </div>
              )}
              {errori.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-700 mb-2">🔴 Prestazioni con Errori ({errori.length})</h3>
                  {renderTable(errori)}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <RigaDetailModal riga={selectedRiga} onClose={() => setSelectedRiga(null)} />
    </>
  );
}

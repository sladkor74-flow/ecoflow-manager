import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw, Download, Save, Upload, AlertTriangle, CheckCircle2, Camera, ClipboardList, ChevronDown, ChevronRight, Info, Anchor } from 'lucide-react';
import { formatKg } from '@/lib/utils';
import { giorno, kgSegno } from '@/components/giacenze/ControlloRilevazione';

// La chiusura dell'anno, da una schermata sola.
//
// Al 31 dicembre la giacenza di ogni piazzale riparte da una fotografia del
// portale, e quella fotografia va presa con l'elenco di dicembre in mano: i
// movimenti finiti a dicembre che il portale non ha ancora chiuso non stanno
// ne' nella fotografia ne' fra i movimenti dell'anno nuovo, e senza una
// decisione su ognuno si perdono. Al passaggio 2025-2026 erano 3 secondarie da
// 41.900 kg chiuse il 07/01, piu' primarie e terziarie chiuse fra gennaio e
// febbraio.
//
// Qui si mostra e si raccoglie; i conti li fa la funzione chiusuraAnno
// (base44/shared/chiusuraAnno.ts), e li rifa' lei anche al salvataggio: quello
// che si salva non dipende mai da un'aritmetica fatta a video.
//
// Chiunque guarda e scarica il dossier; la fotografia la salva l'amministratore.

const CLASSI = ['P', 'M', 'G1', 'G2', 'ACI'];
const NOME_CANALE = { RETE: 'rete', ACI: 'ACI', EXTRA_RACCOLTA: 'extra raccolta', TERZIARIE: 'terziarie' };
const VERDE = 'FF92D050', AZZURRO = 'FF99CCFF', GIALLO = 'FFFFFF00', ROSSO = 'FFC00000';

const kg = (v) => (v === null || v === undefined || v === '' ? '—' : `${formatKg(v)} kg`);
const nomeCanale = (c) => NOME_CANALE[c] || String(c || '').toLowerCase();

/** I canali che il portale rileva: solo per questi una voce si puo' rettificare. */
const rettificabile = (v) => v.canale === 'RETE' || v.canale === 'ACI';

/** Quanto pesa un gruppo di voci, un canale per volta: mai un totale solo. */
function pesoInParole(perCanale) {
  const voci = Object.entries(perCanale || {});
  if (!voci.length) return 'niente in sospeso';
  return voci.map(([canale, s]) => `${nomeCanale(canale)}: ${s.n} per ${formatKg(Math.abs(s.netto_kg))} kg netti`).join(' · ');
}

function Riquadro({ titolo, sottotitolo, icona: Icona, azione, children }) {
  return (
    <div className="bg-card border rounded-lg">
      <div className="flex flex-wrap items-start justify-between gap-2 p-3 border-b">
        <div>
          <div className="flex items-center gap-2 font-semibold text-sm">
            {Icona && <Icona className="w-4 h-4 text-muted-foreground shrink-0" />}{titolo}
          </div>
          {sottotitolo && <p className="text-xs text-muted-foreground mt-0.5">{sottotitolo}</p>}
        </div>
        {azione}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// --- L'elenco di dicembre ---

function VoceDicembre({ v, decisione, onDecidi }) {
  const puo = rettificabile(v) && !!onDecidi;
  const scelta = decisione || '';
  const classeDelPortale = scelta.startsWith('classe:') ? scelta.slice(7) : '';
  return (
    <tr className={`border-t align-top ${puo && !scelta ? 'bg-amber-50' : ''}`}>
      <td className="px-2 py-1.5 whitespace-nowrap font-medium">{v.id_ordine || '—'}</td>
      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{v.numero_fir || '—'}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{v.tipo}{v.verso === 'uscita' ? ' in uscita' : ' in entrata'}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{nomeCanale(v.canale)}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{v.classe}</td>
      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{v.verso === 'uscita' ? '-' : '+'}{formatKg(v.kg)}</td>
      <td className="px-2 py-1.5 whitespace-nowrap">{giorno(v.finito_il)}</td>
      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{v.chiuso_il ? giorno(v.chiuso_il) : 'non ancora'}</td>
      <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{v.controparte || '—'}</td>
      <td className="px-2 py-1.5">
        {!puo ? (
          <span className="text-xs text-muted-foreground">
            {rettificabile(v) ? 'da guardare' : 'fuori dal saldo per classe del portale'}
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant={scelta === 'gia_nel_portale' ? 'default' : 'outline'} className="h-6 px-2 text-[11px]"
              onClick={() => onDecidi(v.chiave, 'gia_nel_portale')}>Gia&apos; nella lettura</Button>
            <Button size="sm" variant={scelta === 'rettifica' ? 'default' : 'outline'} className="h-6 px-2 text-[11px]"
              onClick={() => onDecidi(v.chiave, 'rettifica')}>Da rettificare</Button>
            <select
              className="h-6 rounded border bg-background px-1 text-[11px]"
              value={classeDelPortale}
              onChange={(e) => onDecidi(v.chiave, e.target.value ? `classe:${e.target.value}` : '')}
              title="Il portale lo conta, ma in un'altra classe: il peso si sposta e il totale del canale non cambia"
            >
              <option value="">in un&apos;altra classe…</option>
              {CLASSI.filter(c => c !== v.classe).map(c => <option key={c} value={c}>il portale lo ha in {c}</option>)}
            </select>
          </div>
        )}
      </td>
    </tr>
  );
}

function TabellaVoci({ voci, decisioni, onDecidi }) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr className="text-left">
            {['ID ordine', 'Formulario', 'Movimento', 'Canale', 'Classe', 'Peso', 'Fine trasporto', 'Chiuso a portale', 'Controparte', 'Decisione'].map(h => (
              <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {voci.map(v => <VoceDicembre key={v.chiave} v={v} decisione={decisioni[v.chiave]} onDecidi={onDecidi} />)}
        </tbody>
      </table>
    </div>
  );
}

function ElencoDicembre({ elenco, decisioni, onDecidi }) {
  const [aperti, setAperti] = useState({});
  if (!elenco || (!elenco.n && !elenco.n_prima)) {
    return <p className="text-xs text-muted-foreground">Nessun movimento di quest&apos;anno e&apos; rimasto aperto a portale alla data della fotografia: la lettura del 31 dicembre li contiene tutti.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="border rounded-md p-2 bg-amber-50 border-amber-300 text-amber-900 text-xs">
        <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="w-4 h-4 shrink-0" /> {elenco.n} movimenti finiti a dicembre e non ancora chiusi a portale</div>
        <p className="mt-1">{pesoInParole(elenco.per_canale)}. Non stanno ne&apos; nella fotografia ne&apos; fra i movimenti dell&apos;anno nuovo: senza una decisione su ognuno si perdono.</p>
        {elenco.n_prima > 0 && (
          <p className="mt-1">Ci sono anche {elenco.n_prima} movimenti dell&apos;anno finiti prima di dicembre e ancora aperti ({pesoInParole(elenco.per_canale_prima)}): non si rettificano da qui, ma uno scarto che resta dopo la rettifica di dicembre di solito e&apos; loro.</p>
        )}
      </div>
      {elenco.siti.map(s => {
        const aperto = aperti[s.chiave] !== false;
        const daDecidere = s.voci.filter(v => rettificabile(v) && !decisioni[v.chiave] && s.ruolo === 'stoc').length;
        return (
          <div key={s.chiave} className="border rounded-md">
            <button type="button" className="w-full flex flex-wrap items-center justify-between gap-2 p-2 text-left hover:bg-muted/40"
              onClick={() => setAperti(a => ({ ...a, [s.chiave]: !aperto }))}>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {aperto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {s.nome} <span className="text-xs text-muted-foreground">({s.ruolo === 'stoc' ? 'piazzale' : 'impianto'})</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {s.voci.length} di dicembre · {pesoInParole(s.per_canale)}
                {daDecidere > 0 && <span className="ml-2 text-amber-700 font-medium">{daDecidere} da decidere</span>}
              </span>
            </button>
            {aperto && (
              <div className="p-2 pt-0 space-y-2">
                <TabellaVoci voci={s.voci} decisioni={decisioni} onDecidi={s.ruolo === 'stoc' ? onDecidi : null} />
                {s.ruolo !== 'stoc' && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Sono movimenti di un impianto: la sua giacenza non si legge per classe ma dal file degli ordini non dichiarati, e va chiesta al portale con la data del 31 dicembre. Qui servono a sapere che cosa quel file non conterra&apos; ancora.
                  </p>
                )}
                {s.aperti_prima.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Finiti prima di dicembre e ancora aperti a portale:</p>
                    <TabellaVoci voci={s.aperti_prima} decisioni={decisioni} onDecidi={null} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Che cosa chiedere al portale, e le letture ---

function Richieste({ richieste }) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr className="text-left">
            {['Sito', 'Che cosa serve', 'Dove si legge', 'In sospeso di dicembre', 'Stato'].map(h => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {richieste.map(r => (
            <tr key={`${r.tipo}|${r.chiave}`} className="border-t align-top">
              <td className="px-2 py-1.5 font-medium whitespace-nowrap">{r.nome}<div className="text-[11px] text-muted-foreground">{r.tipo === 'piazzale' ? 'piazzale' : 'impianto'}</div></td>
              <td className="px-2 py-1.5">{r.cosa}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{r.dove}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">{r.dicembre.n ? `${r.dicembre.n} · ${pesoInParole(r.dicembre.per_canale)}` : '—'}</td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                {r.stato === 'inserita'
                  ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> inserita</span>
                  : <span className="text-amber-700">da chiedere</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LetturePiazzali({ piazzali, letture, onCambia }) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-2 py-1.5 font-semibold">Piazzale</th>
            {CLASSI.map(c => <th key={c} className="px-2 py-1.5 font-semibold text-right">{c} (kg)</th>)}
            <th className="px-2 py-1.5 font-semibold">Fotografia</th>
          </tr>
        </thead>
        <tbody>
          {piazzali.map(p => {
            const l = letture[p.sito] || {};
            return (
              <tr key={p.sito} className="border-t">
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                  {p.nome}
                  <div className="text-[11px] text-muted-foreground">ultima rilevazione {p.precedente_del ? `del ${giorno(p.precedente_del)}` : 'mai'}</div>
                </td>
                {CLASSI.map(c => (
                  <td key={c} className="px-1 py-1">
                    <Input type="number" inputMode="numeric" className="h-7 text-xs text-right tabular-nums w-24"
                      value={l[c] ?? ''} onChange={(e) => onCambia(p.sito, c, e.target.value)} />
                  </td>
                ))}
                <td className="px-2 py-1.5 whitespace-nowrap text-[11px]">
                  {p.gia_salvata
                    ? <span className="text-emerald-700">gia&apos; salvata al {giorno(p.giorno)}</span>
                    : p.pronto ? <span className="text-emerald-700">pronta</span> : <span className="text-muted-foreground">{p.blocchi.length} cosa/e da sistemare</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LettureImpianti({ impianti, letture, onCambia }) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr className="text-left">
            {['Impianto', 'PFU di rete non dichiarato (kg)', 'ACI (kg)', 'Lettera: PFU', 'Lettera: ACI', 'Scarto rete', 'Scarto ACI'].map(h => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {impianti.map(i => {
            const l = letture[i.chiave] || {};
            return (
              <tr key={i.chiave} className="border-t">
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{i.nome}</td>
                <td className="px-1 py-1"><Input type="number" inputMode="numeric" className="h-7 text-xs text-right tabular-nums w-28" value={l.pfu_kg ?? ''} onChange={(e) => onCambia(i.chiave, 'pfu_kg', e.target.value)} /></td>
                <td className="px-1 py-1"><Input type="number" inputMode="numeric" className="h-7 text-xs text-right tabular-nums w-28" value={l.aci_kg ?? ''} onChange={(e) => onCambia(i.chiave, 'aci_kg', e.target.value)} /></td>
                <td className="px-2 py-1.5 text-right tabular-nums">{i.lettera ? kg(i.lettera.pfu_kg) : '—'}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{i.lettera ? kg(i.lettera.aci_kg) : '—'}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${i.scarto_kg ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>{i.scarto_kg === null ? '—' : kgSegno(i.scarto_kg)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${i.scarto_aci_kg ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>{i.scarto_aci_kg === null ? '—' : kgSegno(i.scarto_aci_kg)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --- Il confronto di un piazzale ---

function Confronto({ c }) {
  const attesaDi = (classe) => c.attesa.find(a => a.classe === classe) || {};
  const lettaDi = (classe) => (c.verifica_lettura ? c.verifica_lettura.classi.find(x => x.classe === classe) : null);
  const salvataDi = (classe) => (c.verifica_da_salvare ? c.verifica_da_salvare.classi.find(x => x.classe === classe) : null);
  const classi = c.attesa.map(a => a.classe);
  // Il verdetto dell'ancora dell'anno: la chiusura si scosta spesso dalla
  // rilevazione prima, e senza questa riga lo scarto sembrerebbe colpa sua
  // anche quando a sbagliare e' una lettura di mezzo.
  const daAncora = c.verifica_da_salvare ? c.verifica_da_salvare.ancora : null;
  const ancora = daAncora && !daAncora.senza_ancora && !daAncora.e_la_lettura ? daAncora : null;
  return (
    <div className="border rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b">
        <div className="text-sm font-medium">{c.nome}</div>
        <div className="text-xs text-muted-foreground">
          {c.precedente_del ? `si parte dalla rilevazione del ${giorno(c.precedente_del)}` : 'nessuna rilevazione precedente: non c\'e\' un punto di partenza'}
          {c.dicembre.n > 0 && ` · ${c.dicembre.n} voci di dicembre`}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              {['Classe', 'Canale', 'Prima', 'Ingressi', 'Uscite', 'Attesa', 'Letta al 31/12', 'Scarto della lettura', 'Da salvare', 'Scarto dopo la rettifica'].map(h => (
                <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classi.map(cl => {
              const a = attesaDi(cl), letta = lettaDi(cl), salvata = salvataDi(cl);
              return (
                <tr key={cl} className={`border-t ${salvata && salvata.scarto ? 'bg-amber-50' : ''}`}>
                  <td className="px-2 py-1.5 font-medium">{cl}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{a.canale === 'ACI' ? 'ACI' : 'rete'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.precedente_kg === null || a.precedente_kg === undefined ? '—' : kg(a.precedente_kg)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.ingressi ? `${a.ingressi} · ${formatKg(a.ingressi_kg)}` : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.uscite ? `${a.uscite} · ${formatKg(a.uscite_kg)}` : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{a.atteso === null || a.atteso === undefined ? '—' : kg(a.atteso)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{c.lettura ? kg(c.lettura[cl]) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${letta && letta.scarto ? 'text-amber-700' : 'text-muted-foreground'}`}>{letta && letta.scarto ? kgSegno(letta.scarto) : letta ? '—' : ''}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium">{c.lettura ? kg(c.rettifica.classi[cl]) : '—'}</td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${salvata && salvata.scarto ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>{salvata && salvata.scarto ? kgSegno(salvata.scarto) : salvata ? '—' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-2 space-y-1 text-[11px]">
        {ancora && (
          <p className={`flex items-start gap-1 ${ancora.quadra ? 'text-sky-700' : 'text-amber-700'}`}>
            <Anchor className="w-3 h-3 mt-0.5 shrink-0" />{ancora.nota}
          </p>
        )}
        {c.lettera && (
          <p className="text-muted-foreground">
            La lettera delle giacenze dichiara per questo piazzale {CLASSI.map(cl => `${cl} ${formatKg(c.lettera.classi[cl])}`).join(', ')} kg.
          </p>
        )}
        {c.blocchi.map(b => (
          <p key={b.tipo} className="text-amber-700 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{b.testo}</p>
        ))}
        {c.pronto && <p className="text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Pronta da salvare: da qui ripartiranno le giacenze del {c.anno + 1}.</p>}
      </div>
    </div>
  );
}

// --- Il dossier Excel ---

/**
 * Tutto quello che si e' visto, in un file: le letture, l'elenco di dicembre con
 * le decisioni, gli scarti e il confronto con la lettera. Colori e formati come
 * negli altri fogli del gestionale: kg interi, intestazioni piene, gli scarti in
 * rosso.
 */
export async function scaricaDossierChiusura(dossier) {
  const modulo = await import('exceljs');
  const ExcelJS = modulo.default || modulo;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestionale PFU';
  wb.created = new Date();

  const riempi = (c, argb) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; };
  const bordi = (c) => { c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; };
  const intesta = (ws, voci, colore = VERDE) => {
    const riga = ws.addRow(voci);
    riga.eachCell(c => { c.font = { bold: true }; c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; riempi(c, colore); bordi(c); });
    return riga;
  };
  const numeri = (riga, colonne) => colonne.forEach(k => { riga.getCell(k).numFmt = '#,##0'; });
  const scarto = (riga, k) => { const c = riga.getCell(k); c.numFmt = '#,##0'; if (Number(c.value)) c.font = { bold: true, color: { argb: ROSSO } }; };

  // 1. Il riepilogo e gli avvisi
  const r = wb.addWorksheet(`Chiusura ${dossier.anno}`, { views: [{ showGridLines: false }] });
  r.columns = [{ width: 52 }, { width: 18 }, { width: 90 }];
  r.addRow([`Chiusura dell'anno ${dossier.anno} · fotografia del ${dossier.giorno}`]).font = { bold: true, size: 14 };
  r.addRow([]);
  const voce = (a, b, nota = '') => { const riga = r.addRow([a, b, nota]); if (typeof b === 'number') riga.getCell(2).numFmt = '#,##0'; riga.getCell(3).alignment = { wrapText: true }; return riga; };
  voce('Piazzali da fotografare', dossier.riepilogo.piazzali, 'da qui ripartiranno le giacenze dell\'anno dopo');
  voce('Fotografie pronte', dossier.riepilogo.piazzali_pronti, 'lettura inserita ed elenco di dicembre deciso voce per voce');
  voce('Fotografie gia\' salvate', dossier.riepilogo.piazzali_salvati);
  voce('Letture del portale mancanti', dossier.riepilogo.letture_mancanti);
  voce('Movimenti di dicembre in sospeso', dossier.riepilogo.voci_dicembre, pesoInParole(dossier.elenco_dicembre.per_canale));
  voce('di cui senza decisione', dossier.riepilogo.voci_da_decidere);
  voce('Aperti da prima di dicembre', dossier.riepilogo.voci_aperte_prima, pesoInParole(dossier.elenco_dicembre.per_canale_prima));
  voce('Impianti', dossier.riepilogo.impianti, `${dossier.riepilogo.impianti_letti} con la lettura del file degli ordini non dichiarati`);
  r.addRow([]);
  for (const a of dossier.avvisi || []) r.addRow(['Da guardare', '', a.testo]).getCell(3).alignment = { wrapText: true };

  // 2. Che cosa chiedere al portale
  const d = wb.addWorksheet('Da chiedere al portale');
  d.columns = [{ width: 34 }, { width: 12 }, { width: 40 }, { width: 60 }, { width: 34 }, { width: 14 }];
  intesta(d, ['Sito', 'Ruolo', 'Che cosa serve', 'Dove si legge', 'In sospeso di dicembre', 'Stato']);
  for (const q of dossier.richieste) {
    d.addRow([q.nome, q.tipo, q.cosa, q.dove, q.dicembre.n ? pesoInParole(q.dicembre.per_canale) : '', q.stato === 'inserita' ? 'inserita' : 'da chiedere'])
      .getCell(4).alignment = { wrapText: true };
  }

  // 3. L'elenco di dicembre, voce per voce
  const e = wb.addWorksheet('Elenco dicembre');
  e.columns = [{ width: 28 }, { width: 10 }, { width: 14 }, { width: 10 }, { width: 14 }, { width: 14 }, { width: 8 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 28 }, { width: 22 }, { width: 46 }];
  intesta(e, ['Sito', 'Ruolo', 'Movimento', 'Canale', 'ID ordine', 'Formulario', 'Classe', 'Verso', 'Peso (kg)', 'Fine trasporto', 'Chiuso a portale', 'Controparte', 'Decisione', 'Perche\'']);
  const decisioneDi = (v) => {
    const c = v.ruolo === 'stoc' ? dossier.piazzali.find(p => p.sito === v.sito) : null;
    // Le voci di un impianto non si decidono: la sua giacenza non si legge per
    // classe, si chiede il file degli ordini non dichiarati.
    if (!c) return 'riguarda un impianto';
    if (c.rettifica.applicate.some(x => x.chiave === v.chiave)) {
      const a = c.rettifica.applicate.find(x => x.chiave === v.chiave);
      return a.classe_del_portale ? `il portale lo ha in ${a.classe_del_portale}` : 'rettificata';
    }
    if (c.rettifica.ignorate.some(x => x.chiave === v.chiave)) return 'gia\' nella lettura';
    if (c.rettifica.fuori_portale.some(x => x.chiave === v.chiave)) return 'fuori dal portale';
    return 'da decidere';
  };
  const scriviVoce = (ws, v, quando) => {
    const riga = ws.addRow([v.nome, v.ruolo === 'stoc' ? 'piazzale' : 'impianto', v.tipo, nomeCanale(v.canale), v.id_ordine, v.numero_fir, v.classe,
      v.verso === 'uscita' ? 'uscita' : 'entrata', v.verso === 'uscita' ? -v.kg : v.kg, v.finito_il, v.chiuso_il || 'non ancora', v.controparte, quando, v.perche]);
    numeri(riga, [9]);
    if (quando === 'da decidere') riempi(riga.getCell(13), GIALLO);
    return riga;
  };
  for (const v of dossier.elenco_dicembre.voci) scriviVoce(e, v, decisioneDi(v));
  if (dossier.elenco_dicembre.n_prima) {
    e.addRow([]);
    e.addRow(['Finiti prima di dicembre e ancora aperti a portale alla fotografia']).font = { bold: true };
    intesta(e, ['Sito', 'Ruolo', 'Movimento', 'Canale', 'ID ordine', 'Formulario', 'Classe', 'Verso', 'Peso (kg)', 'Fine trasporto', 'Chiuso a portale', 'Controparte', 'Decisione', 'Perche\''], AZZURRO);
    for (const v of dossier.elenco_dicembre.aperti_prima) scriviVoce(e, v, 'non si rettifica da qui');
  }

  // 4. Le letture e gli scarti, classe per classe
  const s = wb.addWorksheet('Letture e scarti');
  s.columns = [{ width: 30 }, { width: 8 }, { width: 8 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }];
  intesta(s, ['Piazzale', 'Classe', 'Canale', 'Prima (kg)', 'Ingressi (kg)', 'Uscite (kg)', 'Attesa (kg)', 'Letta al 31/12 (kg)', 'Scarto lettura (kg)', 'Da salvare (kg)', 'Scarto dopo (kg)']);
  for (const c of dossier.piazzali) {
    for (const a of c.attesa) {
      const letta = c.verifica_lettura ? c.verifica_lettura.classi.find(x => x.classe === a.classe) : null;
      const salvata = c.verifica_da_salvare ? c.verifica_da_salvare.classi.find(x => x.classe === a.classe) : null;
      const riga = s.addRow([c.nome, a.classe, a.canale === 'ACI' ? 'ACI' : 'rete', a.precedente_kg, a.ingressi_kg, a.uscite_kg, a.atteso,
        c.lettura ? c.lettura[a.classe] : null, letta ? letta.scarto : null, c.lettura ? c.rettifica.classi[a.classe] : null, salvata ? salvata.scarto : null]);
      numeri(riga, [4, 5, 6, 7, 8, 10]);
      scarto(riga, 9); scarto(riga, 11);
      if (c.lettura) riempi(riga.getCell(10), GIALLO);
    }
    // Il verdetto dell'ancora dell'anno, sotto le classi del piazzale: senza di
    // esso il foglio direbbe solo di quanto la chiusura si scosta dalla lettura
    // prima, che e' proprio il confronto che puo' accusare la chiusura giusta.
    const va = c.verifica_da_salvare ? c.verifica_da_salvare.ancora : null;
    if (va && !va.senza_ancora && !va.e_la_lettura) s.addRow([va.nota]).font = { italic: true };
  }

  // 5. Il confronto con la lettera delle giacenze
  if (dossier.lettera) {
    const l = wb.addWorksheet('Lettera');
    l.columns = [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];
    l.addRow([`Lettera delle giacenze${dossier.lettera.al ? ` al ${dossier.lettera.al}` : ''}`]).font = { bold: true, size: 12 };
    l.addRow([]);
    intesta(l, ['Impianto', 'Letto a portale (kg)', 'Lettera EER 16.01.03 PFU (kg)', 'Scarto (kg)', 'ACI letto (kg)', 'Lettera ACI (kg)', 'Scarto ACI (kg)', 'CSS-C (kg)', 'EER 19.12.04 ciabattato (kg)']);
    for (const i of dossier.impianti) {
      const riga = l.addRow([i.nome, i.lettura_kg, i.lettera ? i.lettera.pfu_kg : null, i.scarto_kg, i.lettura_aci_kg, i.lettera ? i.lettera.aci_kg : null, i.scarto_aci_kg,
        i.lettera ? i.lettera.cssc_kg : null, i.lettera ? i.lettera.ciabattato_kg : null]);
      numeri(riga, [2, 3, 5, 6, 8, 9]);
      scarto(riga, 4); scarto(riga, 7);
    }
    l.addRow([]);
    l.addRow(['I derivati (CSS-C, ciabattato, cippato, metalli) si mostrano e basta: non sono giacenza di PFU e non si sommano.']).font = { italic: true };
    if (dossier.lettera.stoccaggi.length) {
      l.addRow([]);
      intesta(l, ['Piazzale dichiarato in lettera', ...CLASSI.map(c => `${c} (kg)`)]);
      for (const p of dossier.lettera.stoccaggi) {
        const riga = l.addRow([p.nome, p.P, p.M, p.G1, p.G2, p.aci_kg]);
        numeri(riga, [2, 3, 4, 5, 6]);
      }
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Chiusura_${dossier.anno}_giacenze_al_31-12.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// --- La schermata ---

export default function ChiusuraAnno({ anno, isAdmin, onSaved }) {
  const { toast } = useToast();
  const [dossier, setDossier] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [inCorso, setInCorso] = useState('');
  const [letture, setLetture] = useState({});
  const [lettureImpianti, setLettureImpianti] = useState({});
  const [decisioni, setDecisioni] = useState({});
  const [letteraFogli, setLetteraFogli] = useState(null);
  const [daAggiornare, setDaAggiornare] = useState(false);
  const [conferma, setConferma] = useState(false);
  const [sostituisci, setSostituisci] = useState(false);

  const chiama = async (azione, corpo = {}) => {
    const res = await base44.functions.invoke('chiusuraAnno', {
      anno, azione,
      letture, decisioni, letture_impianti: lettureImpianti, lettera_fogli: letteraFogli,
      ...corpo,
    });
    return res.data;
  };

  const carica = async (corpo = {}) => {
    setCaricamento(true);
    try {
      const dati = await chiama('prepara', corpo);
      if (dati && dati.error) throw new Error(dati.error);
      setDossier(dati);
      setDaAggiornare(false);
    } catch (e) {
      toast({ title: 'Non si e\' riusciti a preparare la chiusura', description: e.message, variant: 'destructive' });
    }
    setCaricamento(false);
  };

  // Cambiando anno si riparte da capo: le letture sono di quell'anno.
  useEffect(() => {
    setLetture({}); setLettureImpianti({}); setDecisioni({}); setLetteraFogli(null); setSostituisci(false);
    carica({ letture: {}, decisioni: {}, letture_impianti: {}, lettera_fogli: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno]);

  const cambiaLettura = (sito, classe, valore) => {
    setLetture(l => ({ ...l, [sito]: { ...(l[sito] || {}), [classe]: valore === '' ? undefined : Number(valore) } }));
    setDaAggiornare(true);
  };
  const cambiaLetturaImpianto = (chiave, campo, valore) => {
    setLettureImpianti(l => ({ ...l, [chiave]: { ...(l[chiave] || {}), [campo]: valore === '' ? undefined : Number(valore) } }));
    setDaAggiornare(true);
  };
  const decidi = (chiave, scelta) => {
    setDecisioni(d => { const n = { ...d }; if (!scelta) delete n[chiave]; else n[chiave] = scelta; return n; });
    setDaAggiornare(true);
  };

  const caricaLettera = async (file) => {
    if (!file) return;
    setInCorso('lettera');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true });
      const fogli = wb.SheetNames.map(nome => ({
        nome,
        righe: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: '' }).slice(0, 500),
      }));
      setLetteraFogli(fogli);
      await carica({ lettera_fogli: fogli });
      toast({ title: 'Lettera caricata', description: 'Il confronto con le giacenze dichiarate e\' nella tabella degli impianti.' });
    } catch (e) {
      toast({ title: 'Non si e\' riusciti a leggere la lettera', description: e.message, variant: 'destructive' });
    }
    setInCorso('');
  };

  const salva = async () => {
    setInCorso('salva');
    try {
      const dati = await chiama('salva', { sostituisci });
      if (dati && dati.error) throw new Error(dati.error);
      setDossier(dati);
      setConferma(false);
      const salvati = (dati.salvati || []).length;
      const saltati = dati.saltati || [];
      toast({
        title: salvati ? `${salvati} ${salvati === 1 ? 'fotografia salvata' : 'fotografie salvate'} al ${dossier.giorno}` : 'Nessuna fotografia salvata',
        description: saltati.length ? `Non salvate: ${saltati.map(s => `${s.sito} (${s.motivo})`).join(' · ')}` : 'Da qui ripartiranno le giacenze dell\'anno dopo.',
        variant: salvati ? undefined : 'destructive',
      });
      if (salvati) { onSaved?.(); await carica(); }
    } catch (e) {
      toast({ title: 'Non si e\' riusciti a salvare', description: e.message, variant: 'destructive' });
    }
    setInCorso('');
  };

  const pronti = useMemo(() => (dossier ? dossier.piazzali.filter(p => p.pronto && (sostituisci || !p.gia_salvata)) : []), [dossier, sostituisci]);

  if (caricamento && !dossier) {
    return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!dossier) return <div className="text-center py-12 text-muted-foreground">Errore nel caricamento.</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading font-bold text-lg">Chiusura {dossier.anno}</h2>
          <p className="text-xs text-muted-foreground">
            La fotografia del {giorno(dossier.giorno)} e&apos; il punto da cui ripartiranno le giacenze del {dossier.anno + 1}: si prende dal portale, si confronta con quello che i movimenti dicono e si salva.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={daAggiornare ? 'default' : 'outline'} size="sm" onClick={() => carica()} disabled={caricamento}>
            <RefreshCw className={`w-4 h-4 mr-1 ${caricamento ? 'animate-spin' : ''}`} /> {daAggiornare ? 'Aggiorna il confronto' : 'Ricalcola'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => scaricaDossierChiusura(dossier)} disabled={caricamento}>
            <Download className="w-4 h-4 mr-1" /> Scarica il dossier
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={() => setConferma(true)} disabled={caricamento || inCorso === 'salva' || !pronti.length}>
              <Save className="w-4 h-4 mr-1" /> Salva {pronti.length ? `${pronti.length} ` : ''}fotografie
            </Button>
          )}
        </div>
      </div>

      {daAggiornare && (
        <div className="border rounded-md p-2 bg-muted/50 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-muted-foreground" />
          Letture o decisioni cambiate: il confronto qui sotto e&apos; ancora quello di prima. Premi «Aggiorna il confronto» per rifare i conti.
        </div>
      )}

      {(dossier.avvisi || []).map((a, i) => (
        <div key={i} className="border rounded-md p-2 bg-amber-50 border-amber-300 text-amber-900 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{a.testo}
        </div>
      ))}

      <Riquadro
        titolo="L'elenco di dicembre"
        icona={ClipboardList}
        sottotitolo="I movimenti finiti a dicembre che il portale non aveva ancora chiuso quando la fotografia e' stata presa. Il periodo di un movimento e' sempre la fine del trasporto: la chiusura a portale dice soltanto se la fotografia lo contiene gia'."
      >
        <ElencoDicembre elenco={dossier.elenco_dicembre} decisioni={decisioni} onDecidi={decidi} />
      </Riquadro>

      <Riquadro
        titolo="Che cosa chiedere al portale"
        icona={Camera}
        sottotitolo="Questi numeri non li calcola il gestionale: si leggono a portale e si scrivono qui sotto."
      >
        <Richieste richieste={dossier.richieste} />
      </Riquadro>

      <Riquadro titolo={`Le letture del ${giorno(dossier.giorno)}`} icona={Camera} sottotitolo="Per ogni piazzale il saldo per classe; per ogni impianto il peso non ancora dichiarato del file degli ordini.">
        <div className="space-y-3">
          <LetturePiazzali piazzali={dossier.piazzali} letture={letture} onCambia={cambiaLettura} />
          <LettureImpianti impianti={dossier.impianti} letture={lettureImpianti} onCambia={cambiaLetturaImpianto} />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { caricaLettera(e.target.files && e.target.files[0]); e.target.value = ''; }} />
              <span className="inline-flex items-center gap-1 border rounded-md px-2 py-1 hover:bg-muted">
                <Upload className="w-3.5 h-3.5" /> {inCorso === 'lettera' ? 'Lettura in corso…' : 'Carica la lettera delle giacenze'}
              </span>
            </label>
            <span className="text-[11px] text-muted-foreground">
              {dossier.lettera
                ? `Lettera letta${dossier.lettera.al ? ` (dichiara le giacenze al ${giorno(dossier.lettera.al)})` : ''}: ${dossier.lettera.impianti.length} impianti e ${dossier.lettera.stoccaggi.length} piazzali.`
                : 'Il foglio con le colonne EER 16.01.03 PFU, CSS-C, EER 19.12.04 ciabattato e cippato, EER 19.12.02 metalli e ACI.'}
            </span>
          </div>
        </div>
      </Riquadro>

      <Riquadro
        titolo="Il confronto"
        icona={CheckCircle2}
        sottotitolo="Che cosa ci si aspettava di leggere, che cosa e' stato letto e che cosa si salva. E' lo stesso conto che sorveglia le rilevazioni di tutti i giorni."
      >
        <div className="space-y-3">
          {dossier.piazzali.map(c => <Confronto key={c.sito} c={c} />)}
          {!dossier.piazzali.length && <p className="text-xs text-muted-foreground">Nessun piazzale da fotografare per quest&apos;anno.</p>}
        </div>
      </Riquadro>

      <AlertDialog open={conferma} onOpenChange={setConferma}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salvare le fotografie del {giorno(dossier.giorno)}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Da qui ripartiranno le giacenze del {dossier.anno + 1}. Si salvano {pronti.length} {pronti.length === 1 ? 'piazzale' : 'piazzali'}:</p>
                <ul className="text-xs space-y-0.5 max-h-48 overflow-y-auto">
                  {pronti.map(p => (
                    <li key={p.sito}>
                      <span className="font-medium">{p.nome}</span>: {CLASSI.map(c => `${c} ${formatKg(p.rettifica.classi[c])}`).join(', ')} kg
                      {p.rettifica.applicate.length ? ` — ${p.rettifica.applicate.length} rettifiche dall'elenco di dicembre` : ' — nessuna rettifica'}
                    </li>
                  ))}
                </ul>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={sostituisci} onChange={(e) => setSostituisci(e.target.checked)} />
                  Rifai anche le fotografie gia&apos; salvate per questo 31 dicembre (il motivo resta scritto nella nota)
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={inCorso === 'salva'}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); salva(); }} disabled={inCorso === 'salva'}>
              {inCorso === 'salva' ? 'Salvataggio…' : 'Salva le fotografie'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

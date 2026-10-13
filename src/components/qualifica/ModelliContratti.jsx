import React, { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, FileText, Upload, Plus, ChevronDown, ChevronRight, ExternalLink, CheckCircle2 } from 'lucide-react';
import { nomeTipo, nomeCanale } from '@/lib/contrattiFornitori';
import { leggiFormat, proponiPunti, cercaNelFormat, costruisciModello, puntiDelModello } from '@/lib/modelliContratto';
import { PUNTI_CONTRATTO, CATEGORIE_PUNTI, puntoDi } from '@/lib/segnapostiContratto';
import { linkFile, motivoApertura } from '@/lib/apriFile';

// IL POSTO DEI MODELLI DEI CONTRATTI (giro K3 delle segnalazioni del 20/09,
// 12/10/2026). Solo amministratore.
//
// Richiesta dell'utente dell'11/10/2026, testuale: «crea un posto dove caricarti i
// vari format affinche' tu possa compilarli seguendo quello schema ed inserendo
// solo le cose che variano ovvero i dati del fornitore, le quantita' annue, il
// prezzo concordato, le date di validita', ecc...».
//
// Si carica il format Word di un tipo e di un canale («raccolta ACI»). Il
// gestionale legge il testo e propone da solo i punti che cambiano
// (src/lib/modelliContratto.js); se il format e' un contratto gia' compilato
// riconosce i valori di quel fornitore e di quell'anno, e i segnaposto {{...}}
// gia' scritti li tiene. L'amministratore vede la proposta, spegne o accende un
// punto o una sua occorrenza, ne aggiunge uno, e conferma: il modello si salva coi
// segnaposto e i contratti si generano cambiando SOLO quei punti.
//
// Il format e il modello sono documenti aziendali: si caricano nell'area privata
// (UploadPrivateFile) e si aprono dalla funzione apriFile, mai col riferimento
// al file nel browser. Un modello sostituito resta nello storico col motivo.

// Le combinazioni che hanno un contratto annuale: il trasporto delle secondarie e'
// uno solo per vettore, per rete e ACI insieme (contrattiDellAnno.ts).
const COMBINAZIONI = [
  { tipo: 'raccolta', canale: 'RETE' }, { tipo: 'raccolta', canale: 'ACI' },
  { tipo: 'stoccaggio', canale: 'RETE' }, { tipo: 'stoccaggio', canale: 'ACI' },
  { tipo: 'trattamento', canale: 'RETE' }, { tipo: 'trattamento', canale: 'ACI' },
  { tipo: 'trasporto_secondaria', canale: 'RETE' },
];

const nomeCombinazione = (tipo, canale) => `${nomeTipo(tipo)} ${tipo === 'trasporto_secondaria' ? 'rete e ACI' : nomeCanale(canale)}`;
const giorno = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : '');
const erroreDi = (e) => e?.response?.data?.error || e?.data?.error || e?.message || String(e);

export default function ModelliContratti({ modelli, onCambiati }) {
  const [aperta, setAperta] = useState(true);
  const [carica, setCarica] = useState(null); // { tipo, canale }
  const [errore, setErrore] = useState('');

  const apri = async (m) => {
    setErrore('');
    try { window.open(await linkFile('ModelloContratto', m.id), '_blank', 'noopener'); } catch (e) { setErrore(motivoApertura(e)); }
  };

  const modelloDi = (tipo, canale) => (modelli || [])
    .filter(m => m.tipo_contratto === tipo && (m.canale || 'RETE') === canale)
    .sort((a, b) => Number(b.anno_riferimento || 0) - Number(a.anno_riferimento || 0) || String(b.created_date || '').localeCompare(String(a.created_date || '')))[0] || null;

  const mancano = COMBINAZIONI.filter(c => !modelloDi(c.tipo, c.canale)).length;

  return (
    <div className="border rounded-lg bg-card">
      <button type="button" onClick={() => setAperta(a => !a)} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 font-semibold text-sm">
          {aperta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <FileText className="w-4 h-4" />Modelli dei contratti
        </span>
        <span className="text-xs text-muted-foreground">{mancano ? `${mancano} su ${COMBINAZIONI.length} senza modello` : 'tutti i tipi hanno il modello'}</span>
      </button>
      {aperta && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Carica il format Word di un tipo e di un canale, anche un contratto già compilato per un fornitore: il gestionale trova da solo i punti che
            cambiano (dati del fornitore, quantità annua, prezzi, date di validità, data della firma, pagamento, polizza, anno) e te li fa confermare.
            I contratti poi si generano cambiando solo quei punti; il resto del documento resta com&apos;è. Rete e ACI hanno modelli distinti.
          </p>
          {errore && <div className="text-xs text-red-700">{errore}</div>}
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Contratto</th>
                  <th className="px-3 py-2 font-semibold">Modello</th>
                  <th className="px-3 py-2 font-semibold">Punti che cambiano</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {COMBINAZIONI.map(c => {
                  const m = modelloDi(c.tipo, c.canale);
                  const punti = m ? puntiDelModello(m) : [];
                  const quanti = punti.length || (m && m.segnaposti_json ? (() => { try { return JSON.parse(m.segnaposti_json).length; } catch { return 0; } })() : 0);
                  return (
                    <tr key={`${c.tipo}|${c.canale}`} className="border-t align-top">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{nomeCombinazione(c.tipo, c.canale)}</td>
                      <td className="px-3 py-2">
                        {m ? (
                          <>
                            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />{m.nome}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {m.file_nome}{m.anno_riferimento ? ` · dal contratto ${m.anno_riferimento}` : ''}{m.fornitore_origine ? ` di ${m.fornitore_origine}` : ''}{m.created_date ? ` · caricato il ${giorno(m.created_date)}` : ''}
                            </div>
                          </>
                        ) : <span className="text-amber-800 text-xs inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />manca il modello</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {m ? (punti.length ? punti.map(p => p.nome || puntoDi(p.segnaposto).nome).join(', ') : `${quanti} segnaposto`) : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right space-x-1">
                        {m && m.ha_file && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => apri(m)}><ExternalLink className="w-3.5 h-3.5 mr-1" />Apri</Button>}
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setCarica(c)}><Upload className="w-3.5 h-3.5 mr-1" />{m ? 'Sostituisci' : 'Carica il format'}</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {carica && (
        <CaricaFormat
          tipo={carica.tipo}
          canale={carica.canale}
          vecchio={modelloDi(carica.tipo, carica.canale)}
          onChiudi={() => setCarica(null)}
          onSalvato={() => { setCarica(null); onCambiati(); }}
        />
      )}
    </div>
  );
}

// ─── il format: la proposta dei punti e la conferma ───

function CaricaFormat({ tipo, canale, vecchio, onChiudi, onSalvato }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [letto, setLetto] = useState(null);
  const [proposta, setProposta] = useState(null);
  const [punti, setPunti] = useState([]);
  const [nome, setNome] = useState('');
  const [annoRif, setAnnoRif] = useState('');
  const [aperti, setAperti] = useState({});
  const [nuovo, setNuovo] = useState({ segnaposto: '', altro: '', testo: '' });
  const [saltate, setSaltate] = useState(null);
  // I punti che il lettore non e' sicuro di aver preso tutti (revisione del
  // 13/10/2026): prima risultavano accesi e completi, e un dato del fornitore di
  // partenza restava nel contratto senza nessun avviso. Ora si vedono col segno
  // «da controllare» e i motivi; salvando con qualcuno non controllato serve un
  // secondo clic, e la nota del modello lo dice.
  const [avvisoControllo, setAvvisoControllo] = useState(null);
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState('');

  const scegli = async (f) => {
    setErrore(''); setSaltate(null); setAvvisoControllo(null); setLetto(null); setProposta(null); setPunti([]);
    setFile(f);
    setLavoro(true);
    try {
      const l = await leggiFormat(f);
      // L'anagrafica serve a dire di chi e' il contratto compilato.
      const fornitori = await base44.entities.Fornitore.list('ragione_sociale', 1000).catch(() => []);
      const p = proponiPunti(l, { tipo, canale, fornitori });
      setLetto(l);
      setProposta(p);
      setPunti(p.punti.map(x => ({ ...x, occorrenze: x.occorrenze.map(o => ({ ...o })) })));
      setAperti(Object.fromEntries(p.punti.filter(x => x.da_controllare).map(x => [x.segnaposto, true])));
      setAnnoRif(p.anno ? String(p.anno) : '');
      setNome(`${nomeCombinazione(tipo, canale)}${p.fornitore ? ` (dal contratto ${p.anno || ''} di ${p.fornitore.ragione_sociale})` : ''}`.replace(/\s+\)/, ')'));
    } catch (e) {
      setErrore(erroreDi(e));
    }
    setLavoro(false);
  };

  const cambiaPunto = (i, campi) => { setSaltate(null); setAvvisoControllo(null); setPunti(ps => ps.map((p, k) => (k === i ? { ...p, ...campi } : p))); };
  const cambiaOccorrenza = (i, j, attiva) => {
    setSaltate(null);
    setAvvisoControllo(null);
    setPunti(ps => ps.map((p, k) => {
      if (k !== i) return p;
      const occorrenze = p.occorrenze.map((o, h) => (h === j ? { ...o, attiva } : o));
      return { ...p, occorrenze, attivo: occorrenze.some(o => o.attiva) ? p.attivo || attiva : false };
    }));
  };

  const aggiungi = () => {
    setErrore('');
    const segnaposto = (nuovo.segnaposto === '__altro' ? nuovo.altro : nuovo.segnaposto).trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
    if (!segnaposto) { setErrore('Scegli quale punto è, o scrivine il nome.'); return; }
    const occorrenze = cercaNelFormat(letto, nuovo.testo);
    if (!occorrenze.length) { setErrore(`«${nuovo.testo}» non c'è nel documento: scrivilo esattamente com'è, maiuscole comprese.`); return; }
    const voce = puntoDi(segnaposto);
    setPunti(ps => {
      const i = ps.findIndex(p => p.segnaposto === segnaposto);
      if (i >= 0) return ps.map((p, k) => (k === i ? { ...p, attivo: true, occorrenze: [...p.occorrenze, ...occorrenze] } : p));
      return [...ps, { segnaposto, nome: voce.nome, categoria: voce.categoria, tipo: voce.tipo, originale: nuovo.testo, stile: null, attivo: true, occorrenze, aggiunto: true }];
    });
    setNuovo({ segnaposto: '', altro: '', testo: '' });
    setSaltate(null);
    setAvvisoControllo(null);
  };

  const salva = async () => {
    setErrore('');
    if (!letto || !file) { setErrore('Carica prima il format.'); return; }
    const attivi = punti.filter(p => p.attivo || p.gia_segnaposto);
    if (!attivi.length) { setErrore('Nessun punto acceso: così il modello non cambierebbe niente.'); return; }
    const nonControllati = punti.filter(p => p.da_controllare && !p.controllato);
    if (nonControllati.length && !avvisoControllo) { setAvvisoControllo(nonControllati.map(p => p.nome)); return; }
    setLavoro(true);
    try {
      const costruito = costruisciModello(letto, punti);
      // Un'occorrenza che non si e' potuta sostituire (attraversa una
      // tabulazione, o si sovrappone a un altro punto) resta com'era nel
      // documento: si dice, e si salva solo con un secondo clic.
      if (costruito.saltate.length && !saltate) { setSaltate(costruito.saltate); setLavoro(false); return; }
      if (!costruito.segnaposti.length) throw new Error('Nel modello non è rimasto nessun segnaposto.');
      const nomeFile = `Modello ${nomeCombinazione(tipo, canale)} - ${file.name}`.replace(/[\\/:*?"<>|]+/g, '-');
      const doc = new File([costruito.blob], nomeFile, { type: costruito.blob.type });
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: doc });
      const creato = await base44.entities.ModelloContratto.create({
        nome: nome.trim() || nomeCombinazione(tipo, canale), tipo_contratto: tipo, canale,
        anno_riferimento: Number(annoRif) || undefined,
        file_uri, file_nome: nomeFile,
        segnaposti_json: JSON.stringify(costruito.segnaposti),
        punti_json: JSON.stringify(costruito.punti),
        fornitore_origine: proposta && proposta.fornitore ? proposta.fornitore.ragione_sociale : undefined,
        stato: 'attivo', sostituisce_id: vecchio ? vecchio.id : undefined,
        note: [
          letto.revisioni_accettate ? `Il format aveva ${letto.revisioni} revisioni aperte: sono state accettate prima di leggerlo.` : '',
          costruito.saltate.length ? `${costruito.saltate.length} occorrenze non sostituite: ${costruito.saltate.map(s => `${s.segnaposto} «${s.testo}» (${s.motivo})`).join('; ')}.` : '',
          nonControllati.length ? `Punti lasciati da controllare: ${nonControllati.map(p => `${p.nome} (${p.da_controllare.join('; ')})`).join('; ')}.` : '',
        ].filter(Boolean).join(' ') || undefined,
      });
      if (vecchio) {
        await base44.entities.ModelloContratto.update(vecchio.id, {
          stato: 'sostituito',
          motivo_sostituzione: `Sostituito il ${new Date().toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })} dal modello «${nome.trim() || nomeFile}» (${creato.id}).`,
        });
      }
      onSalvato();
    } catch (e) {
      setErrore(erroreDi(e));
    }
    setLavoro(false);
  };

  const perCategoria = useMemo(() => {
    const out = new Map();
    punti.forEach((p, i) => {
      const c = CATEGORIE_PUNTI[p.categoria] ? p.categoria : 'altro';
      if (!out.has(c)) out.set(c, []);
      out.get(c).push({ p, i });
    });
    return [...out.entries()].sort((a, b) => Object.keys(CATEGORIE_PUNTI).indexOf(a[0]) - Object.keys(CATEGORIE_PUNTI).indexOf(b[0]));
  }, [punti]);

  const accesi = punti.filter(p => p.attivo).length;
  const daControllare = punti.filter(p => p.da_controllare && !p.controllato).length;

  return (
    <Dialog open onOpenChange={(x) => { if (!x) onChiudi(); }}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modello: {nomeCombinazione(tipo, canale)}</DialogTitle>
          <DialogDescription>
            Il format resta com&apos;è, parola per parola: cambiano solo i punti accesi qui sotto, che diventano segnaposto.
            {vecchio ? ` Il modello di adesso («${vecchio.nome}») resta nello storico come sostituito.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={input} type="file" accept=".docx" className="hidden" onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) scegli(f); }} />
            <Button variant="outline" size="sm" disabled={lavoro} onClick={() => input.current && input.current.click()}>
              <Upload className="w-4 h-4 mr-1.5" />{file ? 'Cambia il format' : 'Scegli il format (.docx)'}
            </Button>
            {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
            {lavoro && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>

          {proposta && (
            <div className="text-xs space-y-1">
              {proposta.fornitore
                ? <div>È il contratto {proposta.anno ? `${proposta.anno} ` : ''}di <b>{proposta.fornitore.ragione_sociale}</b>{proposta.fornitore.anagrafica ? ' (in anagrafica)' : ''}: i suoi valori diventano segnaposto.</div>
                : <div>Non riconosco un fornitore: il format sembra vuoto o da compilare.</div>}
              {letto && letto.revisioni_accettate && <div className="text-amber-800">Il documento aveva {letto.revisioni} revisioni aperte: le ho accettate prima di leggerlo, come farebbe Word con «Accetta tutte le revisioni».</div>}
              {proposta.avvisi.map(a => <div key={a} className="text-amber-800">{a}</div>)}
            </div>
          )}

          {proposta && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="md:col-span-2 space-y-1"><span className="text-xs text-muted-foreground">Nome del modello</span>
                  <input value={nome} onChange={e => setNome(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /></label>
                <label className="space-y-1"><span className="text-xs text-muted-foreground">Anno del contratto di partenza</span>
                  <input value={annoRif} onChange={e => setAnnoRif(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full border rounded px-2 py-1 text-sm tabular-nums" /></label>
              </div>

              <div className="text-sm font-medium">{accesi} punti accesi su {punti.length}</div>
              {daControllare > 0 && (
                <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {daControllare === 1 ? 'Un punto è' : `${daControllare} punti sono`} da controllare: non sono sicuro di aver trovato tutti i posti in cui il format ha
                    quel dato. Guarda le occorrenze spente qui sotto e accendi quelle che vanno cambiate, poi segna il punto come controllato: altrimenti nel
                    contratto nuovo può restare un dato del fornitore di partenza.
                  </span>
                </div>
              )}
              {perCategoria.map(([categoria, elenco]) => (
                <div key={categoria} className="border rounded-md">
                  <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold">{CATEGORIE_PUNTI[categoria]}</div>
                  {elenco.map(({ p, i }) => {
                    const attive = p.occorrenze.filter(o => o.attiva).length;
                    return (
                      <div key={p.segnaposto} className="px-3 py-2 border-t first:border-t-0 text-sm">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" checked={!!p.attivo} disabled={p.gia_segnaposto || !p.occorrenze.some(o => o.attiva)}
                            onChange={e => cambiaPunto(i, { attivo: e.target.checked })} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{p.nome}</span>
                              <code className="text-[11px] text-muted-foreground">{`{{${p.segnaposto}}}`}</code>
                              {p.gia_segnaposto && <span className="text-[10px] px-1 rounded bg-emerald-100 text-emerald-800">già segnaposto nel format</span>}
                              {p.aggiunto && <span className="text-[10px] px-1 rounded bg-blue-100 text-blue-800">aggiunto da te</span>}
                              {p.da_controllare && !p.controllato && <span className="text-[10px] px-1 rounded bg-amber-100 text-amber-800">da controllare</span>}
                              {p.da_controllare && p.controllato && <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">controllato</span>}
                            </div>
                            {!p.gia_segnaposto && <div className="text-xs text-muted-foreground truncate">nel format: «{String(p.originale || '').slice(0, 120)}» · {attive} {attive === 1 ? 'volta' : 'volte'} su {p.occorrenze.length}</div>}
                            {p.nota && <div className="text-xs text-amber-800">{p.nota}</div>}
                            {p.da_controllare && !p.controllato && (
                              <div className="text-xs text-amber-800 space-y-0.5">
                                <ul className="list-disc ml-4">{p.da_controllare.map(m => <li key={m}>{m}</li>)}</ul>
                                <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => cambiaPunto(i, { controllato: true })}>ho controllato</button>
                              </div>
                            )}
                            <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setAperti(a => ({ ...a, [p.segnaposto]: !a[p.segnaposto] }))}>
                              {aperti[p.segnaposto] ? 'nascondi dove' : 'mostra dove'}
                            </button>
                            {aperti[p.segnaposto] && (
                              <ul className="mt-1 space-y-0.5">
                                {p.occorrenze.map((o, j) => (
                                  <li key={`${o.parte}|${o.riga}|${o.da}`} className="flex items-start gap-1.5 text-[11px]">
                                    <input type="checkbox" className="mt-0.5" checked={!!o.attiva} disabled={p.gia_segnaposto} onChange={e => cambiaOccorrenza(i, j, e.target.checked)} />
                                    <span className={o.attiva ? '' : 'text-muted-foreground'}>{o.contesto}{o.motivo ? ` — ${o.motivo}` : ''}{o.parte !== 'word/document.xml' ? ` (${o.parte.replace('word/', '').replace('.xml', '')})` : ''}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="border rounded-md p-3 space-y-2">
                <div className="text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4" />Aggiungi un punto</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select value={nuovo.segnaposto} onChange={e => setNuovo(n => ({ ...n, segnaposto: e.target.value }))} className="border rounded px-2 py-1 text-sm">
                    <option value="">— quale punto —</option>
                    {PUNTI_CONTRATTO.map(p => <option key={p.segnaposto} value={p.segnaposto}>{p.nome}</option>)}
                    <option value="__altro">un altro punto…</option>
                  </select>
                  {nuovo.segnaposto === '__altro' && (
                    <input placeholder="nome, es. NOME_IMPIANTO" value={nuovo.altro} onChange={e => setNuovo(n => ({ ...n, altro: e.target.value }))} className="border rounded px-2 py-1 text-sm" />
                  )}
                  <input placeholder="il testo com'è scritto nel format" value={nuovo.testo} onChange={e => setNuovo(n => ({ ...n, testo: e.target.value }))}
                    className={`border rounded px-2 py-1 text-sm ${nuovo.segnaposto === '__altro' ? '' : 'md:col-span-2'}`} />
                </div>
                <Button size="sm" variant="outline" disabled={!nuovo.testo.trim() || !nuovo.segnaposto} onClick={aggiungi}>Cerca e aggiungi</Button>
              </div>
            </>
          )}

          {saltate && saltate.length > 0 && (
            <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                {saltate.length} {saltate.length === 1 ? 'occorrenza non si può' : 'occorrenze non si possono'} sostituire e {saltate.length === 1 ? 'resterà' : 'resteranno'} come nel format:
                <ul className="list-disc ml-4 mt-1">{saltate.map((s, k) => <li key={k}>{s.segnaposto}: «{s.testo}» ({s.motivo})</li>)}</ul>
                Se va bene così, salva di nuovo.
              </div>
            </div>
          )}

          {avvisoControllo && avvisoControllo.length > 0 && (
            <div className="flex items-start gap-2 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                {avvisoControllo.length === 1 ? 'Un punto non è stato controllato' : `${avvisoControllo.length} punti non sono stati controllati`}: {avvisoControllo.join(', ')}.
                Nel contratto nuovo può restare un dato del fornitore di partenza. Se va bene così, salva di nuovo: la nota del modello lo ricorderà.
              </div>
            </div>
          )}

          {errore && (
            <div className="flex items-start gap-2 border border-red-300 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errore}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onChiudi}>Chiudi</Button>
          <Button onClick={salva} disabled={lavoro || !proposta}>
            {lavoro ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {saltate || avvisoControllo ? 'Salva lo stesso' : 'Salva il modello'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

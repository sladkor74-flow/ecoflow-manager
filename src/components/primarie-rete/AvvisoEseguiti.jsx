import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { ordiniEseguiti, fraseFuoriExport } from '@/lib/ordiniEseguiti';
import { oggiRoma } from '@/lib/giornoItaliano';
import { formatIntero } from '@/lib/utils';
import { ElencoEseguiti } from '@/components/shared/OrdiniInEseguito';

// Gli ordini che a portale sono in stato "eseguito": hanno tutti i dati
// inseriti - peso, date, formulario - ma nessuno ha premuto il pulsante
// "chiudi". E' un limbo.
//
// Il gestionale conta solo i "terminato" (eTerminato in src/lib/movimenti.js),
// quindi quegli ordini spariscono in silenzio dal raccolto, dalle giacenze, dai
// report, dalla copertura del target e dalla fatturazione. Sui dati veri
// (24/09/2026) ce n'era uno, ET26152600 da 3.620 kg, e mancava dal raccolto
// senza che nessuno lo dicesse.
//
// Non si sommano ai terminati, che sarebbe inventarsi un movimento, e non
// cambiano nessun conto: si contano a parte e si dicono, un canale per volta
// (regola 3). Spariscono da soli quando a portale l'ordine viene chiuso e il
// file si ricarica; quelli immessi prima dell'anno da cui parte l'export solo
// con un file che parte dal loro anno (fraseFuoriExport).
//
// LA REGOLA E' UNA SOLA (14/10/2026): src/lib/ordiniEseguiti.js, la stessa
// dell'esito del caricamento e della voce della dashboard. Qui si passano le
// righe dell'archivio della pagina e si mostra lo stesso elenco - ID,
// formulario, raccoglitore o trasportatore, punto di raccolta o stoccaggio,
// fine trasporto e da quanti giorni, chili, che cosa manca - con gli stessi
// pulsanti per copiare gli ID e scaricarli. Prima la pagina diceva ID, righe e
// chili, la finestra del caricamento solo i conti e la dashboard niente: tre
// posti, tre versioni.

// La pagina dice il suo tipo di file con la frase del file da ricaricare
// (08/10/2026): da li' si sa quale archivio sta guardando.
const TIPO_DEL_FILE = { 'delle primarie': 'primarie', 'delle secondarie': 'secondarie', 'delle terziarie': 'terziarie' };
const archivioDi = (tipo, canale) => (tipo === 'secondarie' ? 'Secondaria' : tipo === 'terziarie' ? 'Terziaria' : canale === 'ACI' ? 'PrimariaAci' : 'PrimariaRete');

/**
 * L'avviso in testa a un elenco di terminati. righe: le righe dell'archivio di
 * QUEL canale (mai rete e ACI insieme); canale: 'Rete', 'ACI'.
 *
 * 'file' dice quale file si ricarica dopo aver chiuso gli ordini a portale: lo
 * stesso avviso serve alle primarie, alle secondarie e alle terziarie, e mandare
 * a ricaricare il file sbagliato e' un giro a vuoto (08/10/2026).
 */
export default function AvvisoEseguiti({ righe, canale, file = 'delle primarie', className = '' }) {
  const gruppi = useMemo(() => {
    const tipo = TIPO_DEL_FILE[file] || 'primarie';
    const voluto = String(canale || '').toUpperCase() === 'ACI' ? 'ACI' : 'RETE';
    // Le righe sono gia' di un canale solo; il filtro sul canale e' una
    // cintura: se arrivassero insieme, rete e ACI resterebbero separati.
    return ordiniEseguiti({ [archivioDi(tipo, voluto)]: righe || [] }, { oggi: oggiRoma() }).gruppi.filter(g => g.canale === voluto);
  }, [righe, canale, file]);
  const n = gruppi.reduce((s, g) => s + g.ordini, 0);
  if (!n) return null;
  const kg = gruppi.reduce((s, g) => s + (g.kg || 0), 0);
  // Quelli immessi prima dell'anno da cui parte l'export il file di sempre non
  // li riscrive: ricaricarlo non basta, e la frase lo dice con gli anni, con la
  // stessa regola della dashboard e dell'esito (revisione del 14/10/2026).
  const fuori = fraseFuoriExport(gruppi);
  return (
    <div className={`border border-amber-300 bg-amber-50 text-amber-900 rounded-lg px-3 py-2 text-sm space-y-1 ${className}`}>
      <div className="flex items-start gap-2">
        <Clock className="w-4 h-4 mt-0.5 shrink-0" />
        <p className="flex-1">
          <strong>{canale ? `${canale} · ` : ''}{formatIntero(n)} {n === 1 ? 'ordine ha' : 'ordini hanno'} tutti i dati ma a portale non è stato premuto Chiudi</strong>
          {kg ? ` (${formatIntero(kg)} kg)` : ''}: finché resta così non {n === 1 ? 'entra' : 'entrano'} in nessun conto —
          {' '}raccolto, giacenze, report, copertura del target e fatturazione.
          {' '}Vanno chiusi a portale, poi si ricarica il file {file}.
          {fuori ? ` ${fuori}` : ''}
        </p>
      </div>
      <div className="pl-6"><ElencoEseguiti gruppi={gruppi} conNome={false} /></div>
    </div>
  );
}

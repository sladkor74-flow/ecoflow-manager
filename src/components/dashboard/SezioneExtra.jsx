import React from 'react';
import { Recycle } from 'lucide-react';
import Sezione, { Cifra } from '@/components/dashboard/Sezione';
import { TabellaMesi } from '@/components/dashboard/SezioneAci';
import { t, intero, giorno } from '@/components/dashboard/formato';

// L'EXTRA RACCOLTA (migliorie dell'11/10/2026): le campagne occasionali fuori
// dal contratto di rete, sempre a parte. Gli interventi terminati per fine
// trasporto; i trasferimenti in secondaria dello stesso archivio non contano,
// perche' porterebbero lo stesso peso una seconda volta.
export default function SezioneExtra({ quadro, daGestire, onDaGestire }) {
  const extra = quadro.extra;
  const anno = quadro.anno;
  return (
    <Sezione
      id="extra" icona={Recycle}
      titolo={`Extra raccolta ${anno}`}
      sottotitolo="Campagne occasionali fuori dal contratto di rete: interventi terminati, sempre a parte."
      perche={<p>Gli interventi di extra raccolta terminati del {anno}, per giorno italiano di fine trasporto. I trasferimenti in secondaria dello stesso archivio non contano: porterebbero lo stesso peso una seconda volta.</p>}
      collegamenti={[{ a: '/extra-raccolta', testo: 'Extra Raccolta' }]}
      daGestire={daGestire} onDaGestire={onDaGestire}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 content-start">
          <Cifra etichetta="Interventi terminati" valore={intero(extra.interventi)} sotto="ordini distinti" />
          <Cifra etichetta="Tonnellate" valore={t(extra.raccolto_t)} />
          <Cifra etichetta="Ultimo intervento" valore={giorno(extra.ultimo_giorno)} sotto="per fine trasporto" />
        </div>
        <div className="lg:col-span-2">
          <h3 className="text-sm font-semibold mb-2">Mese per mese</h3>
          <TabellaMesi mesi={extra.mesi} etichetta="Tonnellate" />
        </div>
      </div>
    </Sezione>
  );
}

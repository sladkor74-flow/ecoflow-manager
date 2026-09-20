// Il testo di un PDF, riga per riga, estratto qui nel browser con pdf.js.
// Ogni riga e' un array di celle da sinistra a destra: gli elementi di testo con
// la stessa altezza nella pagina. Serve alla prefattura Ecotyre, che in PDF ha
// oltre quattrocento righe: leggerla col testo e' esatto, farla leggere a un
// agente no. La libreria si carica solo quando serve.
export async function lineeDelPdf(file) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const linee = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const testo = await pagina.getTextContent();
    const perY = new Map();
    for (const it of testo.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const k = [...perY.keys()].find(v => Math.abs(v - y) <= 2) ?? y;
      if (!perY.has(k)) perY.set(k, []);
      perY.get(k).push({ x: it.transform[4], s: it.str.trim() });
    }
    for (const k of [...perY.keys()].sort((a, b) => b - a)) linee.push(perY.get(k).sort((a, b) => a.x - b.x).map(e => e.s));
  }
  return linee;
}

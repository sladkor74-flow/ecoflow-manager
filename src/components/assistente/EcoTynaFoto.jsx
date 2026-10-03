import React, { useEffect, useRef, useState } from 'react';
import { RIPOSO } from '@/lib/visemi';
import ritratto from '@/assets/ecotyna.jpg';

// ECOTYNA IN FOTOGRAFIA, MOSSA COME UNA MARIONETTA.
//
// Il volto e' una fotografia (generata, non una persona vera). Non si puo' far
// parlare una fotografia deformandola tutta: quello che si fa, ed e' come si
// muovono i pupazzi da sempre, e' tenere ferma l'immagine e muovere i pochi
// pezzi che nel vero si muovono.
//
//   LA BOCCA   si apre dove sta la bocca vera: l'apertura e' scura, dentro si
//              intravedono i denti, e le forme arrivano dall'orario delle sillabe
//              (src/lib/visemi.js). E' il movimento che l'occhio guarda.
//   IL MENTO   scende insieme alla bocca, ed e' un pezzo della fotografia stessa
//              spostato in giu' con i bordi sfumati: niente taglio, niente scalino.
//   LE PALPEBRE si chiudono mettendo sull'occhio la pelle della fotografia presa
//              appena piu' in basso. Battere le ciglia con un colore finto si
//              vedrebbe; con la pelle vera no.
//   LA TESTA   oscilla di un grado e respira, e quando pensa si inclina.
//
// I PUNTI DEL VISO stanno qui sotto in costanti, in unita' del riquadro 100x100.
// Se un giorno si cambia fotografia si rimettono quelli e basta: il resto del
// meccanismo non sa niente di questa faccia. Si trovano guardando: si accende
// `riferimenti` e si vedono i segni sopra la foto.
//
// Questo componente ha la stessa interfaccia del disegno (src/.../EcoTyna.jsx),
// che resta ed e' la riserva: se la fotografia non si carica, si vede quello.

const IMG = { x: -8, y: 3.1, lato: 108 };
const OCCHIO_S = { x: 41.4, y: 35.8, rx: 3.8, ry: 2.4 };
const OCCHIO_D = { x: 58.5, y: 39.2, rx: 3.8, ry: 2.4 };
const BOCCA = { x: 50.8, y: 57.5, angolo: 10, rx: 4.6, ry: 2.8 };
const MENTO = { x: 52.7, y: 68.8, rx: 11, ry: 8.4 };

// Le stesse forme del disegno: quanto si allarga e quanto si apre la bocca.
const FORME = {
  [RIPOSO]: { x: 0.94, y: 0.04 },
  M: { x: 0.90, y: 0.01 },
  F: { x: 0.90, y: 0.14 },
  C: { x: 0.97, y: 0.40 },
  I: { x: 1.10, y: 0.28 },
  E: { x: 1.06, y: 0.52 },
  A: { x: 1.00, y: 1.00 },
  O: { x: 0.70, y: 0.88 },
  U: { x: 0.58, y: 0.64 },
};

const PASSO = 45;
const BATTITO_MIN = 2200;
const BATTITO_MAX = 6000;

const pocoMovimento = () => {
  try { return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
};
const fra = (a, b) => a + Math.random() * (b - a);

export default function EcoTynaFoto({ stato = 'ferma', bocca = null, dimensione = 96, riferimenti = false, onErrore = null }) {
  const parla = stato === 'parla';
  const fermo = useRef(pocoMovimento());
  const [visema, setVisema] = useState(RIPOSO);
  const [ciglia, setCiglia] = useState(false);

  useEffect(() => {
    if (!parla) { setVisema(RIPOSO); return undefined; }
    if (fermo.current) { setVisema('C'); return undefined; }
    let n = 0;
    const battito = setInterval(() => {
      n++;
      const prossima = bocca && bocca.current ? bocca.current : (n % 4 < 2 ? 'A' : 'C');
      setVisema(v => (v === prossima ? v : prossima));
    }, PASSO);
    return () => clearInterval(battito);
  }, [parla, bocca]);

  // Se la fotografia non si carica bisogna saperlo per mostrare il disegno al
  // suo posto. Si prova a caricarla a parte invece di stare a sentire l'errore
  // dell'elemento del disegno: dentro un SVG quell'avviso non e' garantito.
  const avvisa = useRef(onErrore);
  avvisa.current = onErrore;
  useEffect(() => {
    const prova = new window.Image();
    const fallita = () => { if (avvisa.current) avvisa.current(); };
    prova.addEventListener('error', fallita);
    prova.src = ritratto;
    return () => prova.removeEventListener('error', fallita);
  }, []);

  useEffect(() => {
    if (fermo.current) return undefined;
    let attesa, chiusura;
    const giro = () => {
      const fretta = stato === 'pensa' ? 0.6 : 1;
      attesa = setTimeout(() => {
        setCiglia(true);
        chiusura = setTimeout(() => { setCiglia(false); giro(); }, 120);
      }, fra(BATTITO_MIN, BATTITO_MAX) * fretta);
    };
    giro();
    return () => { clearTimeout(attesa); clearTimeout(chiusura); };
  }, [stato]);

  const f = FORME[parla && FORME[visema] ? visema : RIPOSO];
  const apre = f.y;
  const inclina = stato === 'pensa' ? -3 : stato === 'ascolta' ? 1.2 : 0;
  const morbido = { transition: fermo.current ? 'none' : 'transform 60ms linear' };
  const lento = { transition: fermo.current ? 'none' : 'transform 220ms ease-out' };

  const immagine = (extra = {}) => (
    <image href={ritratto} x={IMG.x} y={IMG.y} width={IMG.lato} height={IMG.lato} {...extra} />
  );

  return (
    <svg
      viewBox="0 0 100 100"
      width={dimensione}
      height={dimensione}
      role="img"
      aria-label={`EcoTyna, assistente della commessa${parla ? ', sta parlando' : stato === 'ascolta' ? ', in ascolto' : stato === 'pensa' ? ', sta pensando' : ''}`}
    >
      <defs>
        <clipPath id="ecof-tondo"><circle cx="50" cy="50" r="50" /></clipPath>
        <radialGradient id="ecof-morbido">
          <stop offset="55%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Il mento si sposta con i bordi che si perdono: un ritaglio netto
            lascerebbe lo scalino in mezzo alla guancia. */}
        <mask id="ecof-mento">
          <ellipse cx={MENTO.x} cy={MENTO.y} rx={MENTO.rx} ry={MENTO.ry} fill="url(#ecof-morbido)" />
        </mask>
        <mask id="ecof-occhioS">
          <ellipse cx={OCCHIO_S.x} cy={OCCHIO_S.y} rx={OCCHIO_S.rx} ry={OCCHIO_S.ry} fill="url(#ecof-morbido)" />
        </mask>
        <mask id="ecof-occhioD">
          <ellipse cx={OCCHIO_D.x} cy={OCCHIO_D.y} rx={OCCHIO_D.rx} ry={OCCHIO_D.ry} fill="url(#ecof-morbido)" />
        </mask>
        <linearGradient id="ecof-cavita" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a1118" />
          <stop offset="100%" stopColor="#64262f" />
        </linearGradient>
        <filter id="ecof-sfuma" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>

      <g clipPath="url(#ecof-tondo)">
        <circle cx="50" cy="50" r="50" fill="#1a1a1c" />
        <g className="eco-oscilla" style={{ transformOrigin: '50px 95px' }}>
          <g className="eco-respiro" style={{ transformOrigin: '50px 92px' }}>
            <g style={{ transform: `rotate(${inclina}deg)`, transformOrigin: '50px 70px', ...lento }}>

              {immagine()}

              {/* il mento, pezzo della fotografia che scende con la bocca */}
              <g mask="url(#ecof-mento)" style={{ transform: `translateY(${apre * 1.5}px)`, ...morbido }}>
                {immagine({ 'aria-hidden': true })}
              </g>

              {/* la bocca che si apre, inclinata come le labbra vere */}
              <g transform={`rotate(${BOCCA.angolo} ${BOCCA.x} ${BOCCA.y})`}>
                <g style={{ transform: `scaleX(${f.x})`, transformOrigin: `${BOCCA.x}px ${BOCCA.y}px`, ...morbido }}>
                  <g style={{ transform: `scaleY(${apre})`, transformOrigin: `${BOCCA.x}px ${BOCCA.y - BOCCA.ry * 0.55}px`, ...morbido }}>
                    <ellipse cx={BOCCA.x} cy={BOCCA.y} rx={BOCCA.rx} ry={BOCCA.ry} fill="url(#ecof-cavita)" filter="url(#ecof-sfuma)" />
                    <path
                      d={`M${BOCCA.x - BOCCA.rx * 0.78} ${BOCCA.y - BOCCA.ry * 0.5}Q${BOCCA.x} ${BOCCA.y - BOCCA.ry * 1.05} ${BOCCA.x + BOCCA.rx * 0.78} ${BOCCA.y - BOCCA.ry * 0.5}Z`}
                      fill="#f6ece6" opacity={Math.min(1, apre * 2.4)}
                    />
                  </g>
                </g>
              </g>

              {/* le palpebre: la pelle della fotografia, presa appena piu' in basso */}
              {ciglia && (
                <g>
                  <g mask="url(#ecof-occhioS)">{immagine({ transform: 'translate(0,-3.2)', 'aria-hidden': true })}</g>
                  <g mask="url(#ecof-occhioD)">{immagine({ transform: 'translate(0,-3.2)', 'aria-hidden': true })}</g>
                  <path
                    d={`M${OCCHIO_S.x - OCCHIO_S.rx * 0.8} ${OCCHIO_S.y}q${OCCHIO_S.rx * 0.8} ${OCCHIO_S.ry * 0.6} ${OCCHIO_S.rx * 1.6} 0`}
                    fill="none" stroke="#4b3328" strokeWidth="0.55" opacity="0.75" strokeLinecap="round"
                  />
                  <path
                    d={`M${OCCHIO_D.x - OCCHIO_D.rx * 0.8} ${OCCHIO_D.y}q${OCCHIO_D.rx * 0.8} ${OCCHIO_D.ry * 0.6} ${OCCHIO_D.rx * 1.6} 0`}
                    fill="none" stroke="#4b3328" strokeWidth="0.55" opacity="0.75" strokeLinecap="round"
                  />
                </g>
              )}

              {riferimenti && (
                <g opacity="0.85">
                  <ellipse cx={OCCHIO_S.x} cy={OCCHIO_S.y} rx={OCCHIO_S.rx} ry={OCCHIO_S.ry} fill="none" stroke="#39f" strokeWidth="0.5" />
                  <ellipse cx={OCCHIO_D.x} cy={OCCHIO_D.y} rx={OCCHIO_D.rx} ry={OCCHIO_D.ry} fill="none" stroke="#39f" strokeWidth="0.5" />
                  <ellipse cx={BOCCA.x} cy={BOCCA.y} rx={BOCCA.rx} ry={BOCCA.ry} fill="none" stroke="#f33" strokeWidth="0.5" transform={`rotate(${BOCCA.angolo} ${BOCCA.x} ${BOCCA.y})`} />
                  <ellipse cx={MENTO.x} cy={MENTO.y} rx={MENTO.rx} ry={MENTO.ry} fill="none" stroke="#3f3" strokeWidth="0.5" />
                </g>
              )}
            </g>
          </g>
        </g>
      </g>
      <circle cx="50" cy="50" r="49" fill="none" stroke={stato === 'ferma' ? 'rgba(255,255,255,.25)' : '#8ed08a'} strokeWidth="2" />
    </svg>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { RIPOSO } from '@/lib/visemi';

// ECOTYNA, IL VOLTO DELL'ASSISTENTE.
//
// Un disegno vettoriale: nessuna immagine da scaricare, nessun servizio esterno,
// e resta nitido a qualunque misura. La somiglianza a una persona non viene dai
// dettagli in piu' ma da quattro cose che il disegno precedente non aveva:
//
// 1) LA LUCE. Una faccia piatta sembra un adesivo. Qui la luce viene da sopra a
//    sinistra: fronte e pomello chiari, lato destro e sotto il mento in ombra,
//    ombra sotto il naso e sotto il labbro. Sono le sfumature, non le linee, a
//    dare il volume.
// 2) GLI OCCHI. Iride con la sua sfumatura, anello scuro intorno, pupilla, e il
//    riflesso di luce in alto a sinistra: senza quel punto bianco un occhio
//    sembra spento. Le palpebre sbattono a tempi irregolari, perche' un battito
//    a orologio si riconosce subito come finto.
// 3) LO SGUARDO. Ogni tanto gli occhi si spostano di un filo, da soli: e' il
//    movimento che fa dire "e' vivo". Mentre pensa guarda in alto di lato, come
//    chi sta cercando una cosa; mentre ascolta guarda te.
// 4) LA BOCCA SULLE SILLABE. Le forme arrivano da src/lib/visemi.js, che legge
//    il testo e dice che forma prende la bocca a ogni millesimo. Prima si apriva
//    a caso - e in realta' nemmeno quello: `intensita` non gliela passava
//    nessuno, quindi stava ferma socchiusa per tutta la risposta.
//
// Il movimento della bocca NON passa da uno stato di React condiviso: cambia
// ventidue volte al secondo, e farebbe ridisegnare tutta la chat. La chat passa
// un riferimento (`bocca`), questo componente lo guarda da solo e ridisegna
// solo se stesso.
//
// Chi non vuole animazioni (prefers-reduced-motion) ottiene una faccia ferma:
// niente battito di ciglia, niente sguardo che si muove, e mentre parla la bocca
// resta appena aperta, che e' l'informazione utile, senza il movimento.
//
// stato: 'ferma' | 'ascolta' | 'pensa' | 'parla'
// bocca: riferimento alla forma corrente (da useVoce in src/lib/voce.js)

const C = {
  fondo1: '#0b3d4a', fondo2: '#1b8495',
  pelle: '#f6d7bd', pelleLuce: '#fde7d4', pelleOmbra: '#dfae8c', pelleScura: '#c68f6f',
  capelli: '#2f211c', capelliLuce: '#5a3b2e', capelliRiflesso: '#7b5440',
  iride1: '#7fa7a0', iride2: '#2f5c57', anello: '#1b332f',
  labbro: '#c06a6a', labbroScuro: '#9d4a52', cavita: '#5e2730', lingua: '#b4565e',
  maglia: '#0e6f68', maglieColletto: '#0a5750', foglia: '#8ed08a',
};

// Quanto si apre e si allarga la bocca per ogni forma. L'orizzontale conta
// quanto il verticale: su "u" le labbra si stringono, su "i" si allargano, e se
// cambia solo l'apertura si vede una bocca che fa su e giu' come un cardine.
const FORME = {
  [RIPOSO]: { x: 0.94, y: 0.05 },
  M: { x: 0.90, y: 0.02 },
  F: { x: 0.90, y: 0.16 },
  C: { x: 0.97, y: 0.42 },
  I: { x: 1.10, y: 0.30 },
  E: { x: 1.06, y: 0.55 },
  A: { x: 1.00, y: 1.00 },
  O: { x: 0.70, y: 0.90 },
  U: { x: 0.58, y: 0.66 },
};

const PASSO = 45;              // ogni quanto si guarda la forma della bocca
const BATTITO_MIN = 2200;      // il battito di ciglia non e' un orologio:
const BATTITO_MAX = 6000;      // ogni volta aspetta un tempo diverso
const SGUARDO_MIN = 1600;
const SGUARDO_MAX = 4800;

const pocoMovimento = () => {
  try { return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch { return false; }
};
const fra = (a, b) => a + Math.random() * (b - a);

export default function EcoTyna({ stato = 'ferma', bocca = null, dimensione = 96, nome = true }) {
  const parla = stato === 'parla';
  const fermo = useRef(pocoMovimento());
  const [visema, setVisema] = useState(RIPOSO);
  const [ciglia, setCiglia] = useState(false);
  const [sguardo, setSguardo] = useState({ x: 0, y: 0 });

  // La bocca: si legge il riferimento, e si ridisegna solo quando la forma
  // cambia davvero. Se nessuno passa il riferimento (l'avatar usato altrove,
  // senza voce) la bocca si muove comunque, in modo generico, per non restare
  // immobile mentre si sente parlare.
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

  // Il battito di ciglia, a tempi irregolari. Mentre pensa sbatte piu' spesso:
  // succede anche alle persone quando stanno cercando una cosa.
  useEffect(() => {
    if (fermo.current) return undefined;
    let attesa;
    let chiusura;
    const giro = () => {
      const fretta = stato === 'pensa' ? 0.6 : 1;
      attesa = setTimeout(() => {
        setCiglia(true);
        chiusura = setTimeout(() => { setCiglia(false); giro(); }, 110);
      }, fra(BATTITO_MIN, BATTITO_MAX) * fretta);
    };
    giro();
    return () => { clearTimeout(attesa); clearTimeout(chiusura); };
  }, [stato]);

  // Lo sguardo. Mentre pensa guarda in alto di lato; mentre ascolta guarda te,
  // fermo; negli altri casi si sposta ogni tanto di un filo, da solo.
  useEffect(() => {
    if (fermo.current) return undefined;
    if (stato === 'pensa') { setSguardo({ x: 1.5, y: -1.5 }); return undefined; }
    if (stato === 'ascolta') { setSguardo({ x: 0, y: 0 }); return undefined; }
    let attesa;
    const giro = () => {
      attesa = setTimeout(() => {
        setSguardo({ x: fra(-1.3, 1.3), y: fra(-0.8, 0.9) });
        giro();
      }, fra(SGUARDO_MIN, SGUARDO_MAX));
    };
    giro();
    return () => clearTimeout(attesa);
  }, [stato]);

  const f = FORME[parla ? (FORME[visema] ? visema : RIPOSO) : RIPOSO];
  const apre = f.y;                          // quanto e' aperta, da 0 a 1
  const mascella = apre * 1.7;               // la bocca scende con la mascella
  const sopracciglia = stato === 'ascolta' ? -1.1 : -apre * 0.9;
  const inclina = stato === 'pensa' ? -3.2 : stato === 'ascolta' ? 1.4 : 0;
  const morbido = { transition: fermo.current ? 'none' : 'transform 60ms linear' };
  const lento = { transition: fermo.current ? 'none' : 'transform 220ms ease-out' };

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: dimensione, height: dimensione }}>
        {stato === 'ascolta' && (
          <span className="absolute inset-0 rounded-full border-2 border-emerald-400/70 eco-onda" aria-hidden="true" />
        )}
        <svg
          viewBox="0 0 100 100"
          width={dimensione}
          height={dimensione}
          role="img"
          aria-label={`EcoTyna, assistente della commessa${parla ? ', sta parlando' : stato === 'ascolta' ? ', in ascolto' : stato === 'pensa' ? ', sta pensando' : ''}`}
        >
          <defs>
            <radialGradient id="eco-fondo" cx="50%" cy="30%" r="80%">
              <stop offset="0%" stopColor={C.fondo2} />
              <stop offset="100%" stopColor={C.fondo1} />
            </radialGradient>
            {/* La luce viene da sopra a sinistra: la pelle e' chiara da quel lato
                e si scurisce verso il basso a destra. */}
            <linearGradient id="eco-pelle" x1="25%" y1="10%" x2="85%" y2="95%">
              <stop offset="0%" stopColor={C.pelleLuce} />
              <stop offset="45%" stopColor={C.pelle} />
              <stop offset="100%" stopColor={C.pelleOmbra} />
            </linearGradient>
            <linearGradient id="eco-capelli" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor={C.capelliLuce} />
              <stop offset="55%" stopColor={C.capelli} />
              <stop offset="100%" stopColor="#241915" />
            </linearGradient>
            <radialGradient id="eco-iride" cx="38%" cy="32%" r="75%">
              <stop offset="0%" stopColor={C.iride1} />
              <stop offset="100%" stopColor={C.iride2} />
            </radialGradient>
            <linearGradient id="eco-cavita" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4a1d25" />
              <stop offset="100%" stopColor={C.cavita} />
            </linearGradient>
            <linearGradient id="eco-maglia" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={C.maglia} />
              <stop offset="100%" stopColor={C.maglieColletto} />
            </linearGradient>
            {/* Il volume del viso in una sfumatura sola: chiaro dove batte la
                luce, scuro verso il bordo. Prima le ombre erano forme piene con
                un po' di trasparenza, e si vedeva il loro contorno netto in
                mezzo alla guancia: una faccia non ha spigoli. */}
            <radialGradient id="eco-volume" cx="36%" cy="28%" r="80%">
              <stop offset="55%" stopColor="#7a3f1e" stopOpacity="0" />
              <stop offset="100%" stopColor="#7a3f1e" stopOpacity="0.42" />
            </radialGradient>
            {/* Tutto cio' che e' ombra o luce passa di qui: sfumato, senza bordo. */}
            <filter id="eco-sfuma" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.5" />
            </filter>
            <filter id="eco-sfumaPoco" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
            <clipPath id="eco-tondo"><circle cx="50" cy="50" r="50" /></clipPath>
            <clipPath id="eco-occhioS"><path d="M36.6 45.3Q42.6 39.9 48.6 45.3Q42.6 50.2 36.6 45.3Z" /></clipPath>
            <clipPath id="eco-occhioD"><path d="M51.4 45.3Q57.4 39.9 63.4 45.3Q57.4 50.2 51.4 45.3Z" /></clipPath>
            <clipPath id="eco-bocca"><path d="M40.6 59.6Q50 55.6 59.4 59.6Q50 68.4 40.6 59.6Z" /></clipPath>
          </defs>

          <g clipPath="url(#eco-tondo)">
            <circle cx="50" cy="50" r="50" fill="url(#eco-fondo)" />
            <ellipse cx="50" cy="96" rx="46" ry="26" fill="#062a33" opacity="0.35" />

            {/* spalle, maglia e colletto */}
            <path d="M12 100c2-17 15-25 38-25s36 8 38 25z" fill="url(#eco-maglia)" />
            <path d="M41 76c3 6 15 6 18 0l-9 9z" fill={C.maglieColletto} />
            <path d="M41 76l9 9 9-9 2 2-11 11-11-11z" fill="#0a4f49" opacity="0.7" />

            <g className="eco-oscilla" style={{ transformOrigin: '50px 78px' }}>
              <g className="eco-respiro" style={{ transformOrigin: '50px 76px' }}>
                <g style={{ transform: `rotate(${inclina}deg)`, transformOrigin: '50px 70px', ...lento }}>

                  {/* collo, con l'ombra che il mento gli fa addosso */}
                  <path d="M43.5 62h13v13c0 5-13 5-13 0z" fill={C.pelleOmbra} />
                  <path d="M43.5 61h13v5.5c-4 3-9 3-13 0z" fill={C.pelleScura} opacity="0.6" filter="url(#eco-sfuma)" />

                  {/* capelli dietro */}
                  <path d="M27 48c0-19 10-30 23-30s23 11 23 30c0 13-1 22-4 29 1-13-1-22-4-28-7 4-23 5-32 1-3 6-5 15-4 27-3-7-4-16-4-29z" fill="url(#eco-capelli)" />

                  {/* orecchie */}
                  <ellipse cx="30.4" cy="47.5" rx="2.6" ry="3.8" fill={C.pelleOmbra} />
                  <ellipse cx="69.6" cy="47.5" rx="2.6" ry="3.8" fill={C.pelleOmbra} />

                  {/* viso */}
                  <path
                    d="M50 22c11 0 18.5 7.5 19 19.5.3 8.5-2 17-6.5 23.5-3.7 5.3-7.9 7.5-12.5 7.5s-8.8-2.2-12.5-7.5C33 58.5 30.7 50 31 41.5 31.5 29.5 39 22 50 22z"
                    fill="url(#eco-pelle)"
                  />
                  {/* la stessa sagoma, riempita con la sfumatura del volume */}
                  <path
                    d="M50 22c11 0 18.5 7.5 19 19.5.3 8.5-2 17-6.5 23.5-3.7 5.3-7.9 7.5-12.5 7.5s-8.8-2.2-12.5-7.5C33 58.5 30.7 50 31 41.5 31.5 29.5 39 22 50 22z"
                    fill="url(#eco-volume)"
                  />
                  {/* luce sulla fronte e sul pomello, ombra sotto lo zigomo in
                      ombra e sotto il mento: tutto sfumato, niente contorni */}
                  <ellipse cx="43.5" cy="34" rx="8.5" ry="5.5" fill={C.pelleLuce} opacity="0.5" filter="url(#eco-sfuma)" />
                  <ellipse cx="39.5" cy="51.5" rx="5" ry="3.4" fill={C.pelleLuce} opacity="0.32" filter="url(#eco-sfuma)" />
                  <ellipse cx="62.5" cy="51" rx="5" ry="9" fill={C.pelleScura} opacity="0.22" filter="url(#eco-sfuma)" />
                  <ellipse cx="50" cy="70.5" rx="7.5" ry="2.6" fill={C.pelleScura} opacity="0.28" filter="url(#eco-sfuma)" />

                  {/* sopracciglia: si alzano con la bocca che si apre, e in ascolto */}
                  <g style={{ transform: `translateY(${sopracciglia}px)`, ...lento }}>
                    <path d="M37.4 41.8q3-2.1 6.6-1.6 1.5.2 2.2.9-3.2-.1-8.8 1.9z" fill={C.capelli} opacity="0.88" filter="url(#eco-sfumaPoco)" />
                    <path d="M62.6 41.7q-3-2.1-6.6-1.6-1.5.2-2.2.9 3.2-.1 8.8 1.9z" fill={C.capelli} opacity="0.88" filter="url(#eco-sfumaPoco)" />
                  </g>

                  {/* occhi */}
                  <g>
                    {[{ c: 'eco-occhioS', x: 42.6 }, { c: 'eco-occhioD', x: 57.4 }].map((o) => (
                      <g key={o.c}>
                        <g clipPath={`url(#${o.c})`}>
                          <rect x={o.x - 7} y="39" width="14" height="12" fill="#fffaf4" />
                          {/* L'ombra che la palpebra fa sul bianco dell'occhio.
                              Segue l'arco dell'occhio: da rettangolo dritto
                              sembrava la stanghetta di un paio di occhiali. */}
                          <path
                            d={o.x < 50 ? 'M36.6 45.3Q42.6 39.3 48.6 45.3Q42.6 42.6 36.6 45.3Z' : 'M51.4 45.3Q57.4 39.3 63.4 45.3Q57.4 42.6 51.4 45.3Z'}
                            fill={C.pelleScura} opacity="0.4" filter="url(#eco-sfumaPoco)"
                          />
                          <g style={{ transform: `translate(${sguardo.x}px, ${sguardo.y}px)`, ...lento }}>
                            <circle cx={o.x} cy="45.3" r="3.05" fill="url(#eco-iride)" />
                            <circle cx={o.x} cy="45.3" r="3.05" fill="none" stroke={C.anello} strokeWidth="0.7" />
                            <circle cx={o.x} cy="45.3" r="1.35" fill="#14201f" />
                            <circle cx={o.x - 1} cy="44.2" r="0.78" fill="#fff" opacity="0.95" />
                            <circle cx={o.x + 1.1} cy="46.4" r="0.38" fill="#fff" opacity="0.5" />
                          </g>
                          {/* la palpebra che scende: sbatte */}
                          <rect
                            x={o.x - 7} y="38.6" width="14" height="8.6" fill="url(#eco-pelle)"
                            style={{ transform: `scaleY(${ciglia ? 1 : 0})`, transformOrigin: `${o.x}px 38.6px`, transition: fermo.current ? 'none' : 'transform 80ms ease-out' }}
                          />
                        </g>
                        {/* ciglia sopra, e la piega della palpebra inferiore */}
                        <path
                          d={o.x < 50 ? 'M36.6 45.3Q42.6 39.9 48.6 45.3' : 'M51.4 45.3Q57.4 39.9 63.4 45.3'}
                          fill="none" stroke={C.capelli} strokeWidth="1.15" strokeLinecap="round"
                        />
                        <path
                          d={o.x < 50 ? 'M37.8 48.4Q42.6 51.2 47.6 48.3' : 'M52.6 48.4Q57.4 51.2 62.4 48.3'}
                          fill="none" stroke={C.pelleScura} strokeWidth="0.55" opacity="0.6"
                        />
                      </g>
                    ))}
                  </g>

                  {/* Il naso non si disegna con una linea: si disegna con la luce
                      sulla punta e l'ombra dalla parte opposta. */}
                  <path d="M51.4 46.6c.4 3.4 1.2 5.6 2.4 6.9-1.2 1.2-5.4 1.2-6.6 0 1.8-1.3 3.4-3.5 4.2-6.9z" fill={C.pelleScura} opacity="0.26" filter="url(#eco-sfuma)" />
                  <ellipse cx="49.6" cy="53" rx="2.3" ry="1.5" fill={C.pelleLuce} opacity="0.55" filter="url(#eco-sfumaPoco)" />
                  <ellipse cx="47.6" cy="54.3" rx="0.8" ry="0.52" fill={C.pelleScura} opacity="0.6" filter="url(#eco-sfumaPoco)" />
                  <ellipse cx="52.4" cy="54.3" rx="0.8" ry="0.52" fill={C.pelleScura} opacity="0.6" filter="url(#eco-sfumaPoco)" />

                  {/* guance */}
                  <ellipse cx="38.8" cy="55.5" rx="4" ry="2.6" fill="#e79a90" opacity="0.42" filter="url(#eco-sfuma)" />
                  <ellipse cx="61.2" cy="55.5" rx="4" ry="2.6" fill="#e79a90" opacity="0.42" filter="url(#eco-sfuma)" />

                  {/* bocca: tutta dentro un gruppo che scende con la mascella */}
                  <g style={{ transform: `translateY(${mascella}px)`, ...morbido }}>
                    <g style={{ transform: `scaleX(${f.x})`, transformOrigin: '50px 60px', ...morbido }}>
                      {/* la cavita' si apre verso il basso, come fa la mascella */}
                      <g style={{ transform: `scaleY(${apre})`, transformOrigin: '50px 58.8px', ...morbido }}>
                        <g clipPath="url(#eco-bocca)">
                          <path d="M40.6 59.6Q50 55.6 59.4 59.6Q50 68.4 40.6 59.6Z" fill="url(#eco-cavita)" />
                          <path d="M42.4 68Q50 63.4 57.6 68Q50 71 42.4 68Z" fill={C.lingua} />
                        </g>
                      </g>
                      {/* i denti di sopra restano sottili: si vedono appena si apre */}
                      <path d="M43.4 59.4Q50 56.7 56.6 59.4Z" fill="#fdf8f3" opacity={Math.min(1, apre * 2.6)} />
                      {/* labbro di sopra, con l'arco di Cupido */}
                      <path d="M40.6 59.8q2.6-3 4.6-2.9 2 .1 4.8 1.5 2.8-1.4 4.8-1.5 2-.1 4.6 2.9-4.4-1.6-9.4-1.6t-9.4 1.6z" fill={C.labbro} />
                      {/* labbro di sotto: scende con l'apertura */}
                      <g style={{ transform: `translateY(${apre * 3.2}px)`, ...morbido }}>
                        <path d="M41.4 60.2q3.6 4.4 8.6 4.4t8.6-4.4q-4 1.9-8.6 1.9t-8.6-1.9z" fill={C.labbro} />
                        <path d="M44 63.4q3 1.4 6 1.4t6-1.4q-2.6 2.4-6 2.4t-6-2.4z" fill={C.labbroScuro} opacity="0.45" />
                      </g>
                      {/* a bocca chiusa resta solo la linea delle labbra, appena sorridente */}
                      <path
                        d="M41.2 60.1Q50 63.2 58.8 60.1" fill="none" stroke={C.labbroScuro} strokeWidth="0.85"
                        strokeLinecap="round" opacity={Math.max(0, 1 - apre * 3)}
                      />
                    </g>
                    {/* l'ombra sotto il labbro cresce con l'apertura: da' il mento */}
                    <ellipse cx="50" cy="68.6" rx="5" ry="1.6" fill={C.pelleScura} opacity={0.12 + apre * 0.2} />
                  </g>

                  {/* I capelli davanti. La riga sta di lato e la frangia attraversa
                      la fronte da destra verso sinistra: un caschetto simmetrico,
                      con le punte sulle tempie, era la cosa che piu' di tutte
                      faceva "disegnino". L'attaccatura e' una curva sola, e le
                      ciocche sono due righe chiare appena sopra. */}
                  <path
                    d="M30.3 46C29.3 30 38 20.4 50 20.4S70.7 30 69.7 46c-.6-5.6-2.3-10.6-5.3-15-4.6 5.4-15.2 7.6-23.8 4.6-4.4 1.8-7.8 5.6-10.6 10.4z"
                    fill="url(#eco-capelli)"
                  />
                  <path d="M36 27C41 22.6 47 20.9 53 21.3c-5.6 1.6-11.4 4.3-17 9z" fill={C.capelliRiflesso} opacity="0.4" filter="url(#eco-sfumaPoco)" />
                  <path d="M61.8 30.6C56.4 34.6 47.4 36.6 40.8 34.6" fill="none" stroke={C.capelliRiflesso} strokeWidth="0.55" opacity="0.4" />
                  <path d="M63 27.6C57.8 31.4 49.6 33.2 43.4 31.6" fill="none" stroke={C.capelliRiflesso} strokeWidth="0.45" opacity="0.28" />

                  {/* orecchini a foglia */}
                  <path d="M30 52.4c2 .4 3 2.4 2.6 4.6-2-.4-3-2.4-2.6-4.6z" fill={C.foglia} />
                  <path d="M70 52.4c-2 .4-3 2.4-2.6 4.6 2-.4 3-2.4 2.6-4.6z" fill={C.foglia} />
                </g>
              </g>
            </g>

            {stato === 'pensa' && (
              <g>
                <circle cx="77" cy="25" r="2.8" fill="#fff" className="eco-punto" />
                <circle cx="85" cy="20" r="2.1" fill="#fff" className="eco-punto" style={{ animationDelay: '0.2s' }} />
                <circle cx="91" cy="15" r="1.5" fill="#fff" className="eco-punto" style={{ animationDelay: '0.4s' }} />
              </g>
            )}
          </g>
          <circle cx="50" cy="50" r="49" fill="none" stroke={stato === 'ferma' ? 'rgba(255,255,255,.25)' : C.foglia} strokeWidth="2" />
        </svg>
      </div>
      {nome && (
        <div className="leading-tight min-w-0">
          <div className="font-heading font-semibold">EcoTyna</div>
          <div className="text-xs text-muted-foreground">
            {parla ? 'sta parlando…' : stato === 'ascolta' ? 'ti ascolto…' : stato === 'pensa' ? 'sto pensando…' : 'assistente della commessa'}
          </div>
        </div>
      )}
    </div>
  );
}

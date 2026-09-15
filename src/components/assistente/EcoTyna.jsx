import React from 'react';

// EcoTyna, il volto dell'Assistente: un disegno vettoriale leggero, senza immagini
// da scaricare. Cambia espressione con quello che sta facendo: ferma, in ascolto,
// mentre pensa e mentre parla, con la bocca che segue la voce.
//
// stato: 'ferma' | 'ascolta' | 'pensa' | 'parla'   intensita: 0-1 (apertura bocca)

const COLORI = {
  fondo1: '#0f4c5c', fondo2: '#1a7f8e', pelle: '#f4d2b6', pelleOmbra: '#e3b993',
  capelli: '#3b2a24', capelliLuce: '#54392f', occhi: '#2b3a42', bocca: '#a34a52',
  maglia: '#0f766e', foglia: '#7cc576',
};

export default function EcoTyna({ stato = 'ferma', intensita = 0, dimensione = 96, nome = true }) {
  const parla = stato === 'parla';
  const bocca = parla ? 2.2 + intensita * 6.5 : stato === 'ascolta' ? 2.4 : 1.6;
  const larghezzaBocca = parla ? 9 - intensita * 1.6 : 9.5;

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: dimensione, height: dimensione }}>
        {stato === 'ascolta' && (
          <span className="absolute inset-0 rounded-full border-2 border-emerald-400/70 eco-onda" aria-hidden="true" />
        )}
        <svg viewBox="0 0 100 100" width={dimensione} height={dimensione} role="img" aria-label="EcoTyna, assistente vocale">
          <defs>
            <radialGradient id="ecotyna-fondo" cx="50%" cy="35%" r="75%">
              <stop offset="0%" stopColor={COLORI.fondo2} />
              <stop offset="100%" stopColor={COLORI.fondo1} />
            </radialGradient>
            <clipPath id="ecotyna-cerchio"><circle cx="50" cy="50" r="50" /></clipPath>
          </defs>

          <g clipPath="url(#ecotyna-cerchio)">
            <circle cx="50" cy="50" r="50" fill="url(#ecotyna-fondo)" />

            <g className={parla ? '' : 'eco-respiro'} style={{ transformOrigin: '50px 60px' }}>
              {/* spalle e maglia */}
              <path d="M18 100c2-16 14-24 32-24s30 8 32 24z" fill={COLORI.maglia} />
              <path d="M44 78c2 4 10 4 12 0l-6 6z" fill="#0b5c55" />
              {/* collo */}
              <path d="M43 62h14v12c0 4-14 4-14 0z" fill={COLORI.pelleOmbra} />
              {/* capelli dietro */}
              <path d="M24 52c0-20 10-32 26-32s26 12 26 32c0 12-2 22-6 28 2-14 0-24-4-30-6 4-20 6-32 2-4 6-6 16-4 28-4-6-6-16-6-28z" fill={COLORI.capelli} />
              {/* viso */}
              <ellipse cx="50" cy="47" rx="19" ry="22" fill={COLORI.pelle} />
              {/* frangia */}
              <path d="M31 44c0-14 8-22 19-22s19 8 19 22c-3-8-9-12-19-12s-16 4-19 12z" fill={COLORI.capelliLuce} />
              {/* sopracciglia */}
              <path d="M39 40q5-3 9 0" stroke={COLORI.capelli} strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <path d="M52 40q4-3 9 0" stroke={COLORI.capelli} strokeWidth="1.6" fill="none" strokeLinecap="round" />
              {/* occhi */}
              <g className="eco-occhi" style={{ transformOrigin: '50px 47px' }}>
                <ellipse cx="43.5" cy="47" rx="3.4" ry="3.6" fill="#fff" />
                <ellipse cx="56.5" cy="47" rx="3.4" ry="3.6" fill="#fff" />
                <circle cx="43.8" cy="47.4" r="1.8" fill={COLORI.occhi} />
                <circle cx="56.8" cy="47.4" r="1.8" fill={COLORI.occhi} />
                <circle cx="44.6" cy="46.5" r="0.6" fill="#fff" />
                <circle cx="57.6" cy="46.5" r="0.6" fill="#fff" />
              </g>
              {/* naso e bocca */}
              <path d="M50 51v4l2 1" stroke={COLORI.pelleOmbra} strokeWidth="1.2" fill="none" strokeLinecap="round" />
              {parla ? (
                <ellipse cx="50" cy="60" rx={larghezzaBocca / 2} ry={bocca} fill={COLORI.bocca} />
              ) : (
                <path d={`M${50 - larghezzaBocca / 2} 59q${larghezzaBocca / 2} ${bocca + 2.5} ${larghezzaBocca} 0`} stroke={COLORI.bocca} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              )}
              {/* guance */}
              <ellipse cx="38" cy="54" rx="3" ry="2" fill="#e9a89a" opacity="0.5" />
              <ellipse cx="62" cy="54" rx="3" ry="2" fill="#e9a89a" opacity="0.5" />
              {/* orecchino a foglia */}
              <path d="M31 54c2 0 3 2 3 4-2 0-3-2-3-4z" fill={COLORI.foglia} />
              <path d="M69 54c-2 0-3 2-3 4 2 0 3-2 3-4z" fill={COLORI.foglia} />
            </g>

            {stato === 'pensa' && (
              <g>
                <circle cx="76" cy="26" r="2.6" fill="#fff" className="eco-punto" />
                <circle cx="84" cy="22" r="2" fill="#fff" className="eco-punto" style={{ animationDelay: '0.2s' }} />
                <circle cx="90" cy="17" r="1.5" fill="#fff" className="eco-punto" style={{ animationDelay: '0.4s' }} />
              </g>
            )}
          </g>
          <circle cx="50" cy="50" r="49" fill="none" stroke={stato === 'ferma' ? 'rgba(255,255,255,.25)' : COLORI.foglia} strokeWidth="2" />
        </svg>
      </div>
      {nome && (
        <div className="leading-tight">
          <div className="font-heading font-semibold">EcoTyna</div>
          <div className="text-xs text-muted-foreground">
            {stato === 'parla' ? 'sta parlando…' : stato === 'ascolta' ? 'ti ascolto…' : stato === 'pensa' ? 'sto pensando…' : 'assistente della commessa'}
          </div>
        </div>
      )}
    </div>
  );
}

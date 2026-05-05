import '../../styles/hero.css'
import '../../styles/scene.css'

export function SceneBackground() {
  return (
    <div className="scene-wrap" aria-hidden="true">
      <div className="hero-sky" />

      <div className="hero-stars" />
      <div className="hero-moon" />

      <div className="hero-cloud-layer">
        <div className="hero-cloud c1" />
        <div className="hero-cloud c2" />
        <div className="hero-cloud c3" />
      </div>

      <svg className="hero-coast" viewBox="0 0 1600 60" preserveAspectRatio="none">
        <path d="M0,55 L40,40 L90,48 L160,30 L220,42 L300,28 L360,36 L440,22 L520,32 L600,18 L680,30 L760,20 L860,34 L940,24 L1040,38 L1140,28 L1240,40 L1340,30 L1440,42 L1540,36 L1600,40 L1600,60 L0,60 Z" fill="#0a1d33"/>
        <path d="M0,55 L60,50 L140,53 L240,46 L340,52 L460,44 L560,52 L680,46 L800,54 L920,48 L1040,53 L1180,46 L1300,54 L1440,50 L1600,53 L1600,60 L0,60 Z" fill="#06121f"/>
      </svg>

      <div className="hero-gull g1">
        <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 6 Q 5 1, 11 5 Q 17 1, 21 6"/>
        </svg>
      </div>
      <div className="hero-gull g2">
        <svg width="18" height="8" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 6 Q 5 1, 11 5 Q 17 1, 21 6"/>
        </svg>
      </div>
      <div className="hero-gull g3">
        <svg width="14" height="6" viewBox="0 0 22 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 6 Q 5 1, 11 5 Q 17 1, 21 6"/>
        </svg>
      </div>

      <div className="hero-sea">
        <svg className="hero-wave hero-wave-1" viewBox="0 0 2400 80" preserveAspectRatio="none">
          <path d="M0,40 C200,10 400,70 600,40 C800,10 1000,70 1200,40 C1400,10 1600,70 1800,40 C2000,10 2200,70 2400,40 L2400,80 L0,80 Z" fill="#1a3a5e"/>
        </svg>
        <svg className="hero-wave hero-wave-2" viewBox="0 0 2400 100" preserveAspectRatio="none">
          <path d="M0,50 C200,20 400,80 600,50 C800,20 1000,80 1200,50 C1400,20 1600,80 1800,50 C2000,20 2200,80 2400,50 L2400,100 L0,100 Z" fill="#0f2a47"/>
        </svg>
        <svg className="hero-wave hero-wave-3" viewBox="0 0 2400 120" preserveAspectRatio="none">
          <path d="M0,60 C200,30 400,90 600,60 C800,30 1000,90 1200,60 C1400,30 1600,90 1800,60 C2000,30 2200,90 2400,60 L2400,120 L0,120 Z" fill="#0a1d33"/>
        </svg>
        <svg className="hero-wave hero-wave-4" viewBox="0 0 2400 140" preserveAspectRatio="none">
          <defs>
            <linearGradient id="scene-front-wave" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#06121f"/>
              <stop offset="100%" stopColor="#020609"/>
            </linearGradient>
          </defs>
          <path d="M0,70 C150,40 300,100 480,70 C640,40 800,100 980,70 C1140,40 1300,100 1480,70 C1640,40 1800,100 1980,70 C2140,40 2300,100 2400,70 L2400,140 L0,140 Z" fill="url(#scene-front-wave)"/>
        </svg>
      </div>

      <div className="hero-ship-wrap">
        <svg viewBox="0 0 540 360" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="scene-hull" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3a2614"/>
              <stop offset="60%" stopColor="#1f140a"/>
              <stop offset="100%" stopColor="#0a0604"/>
            </linearGradient>
            <linearGradient id="scene-sail" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f3ead0"/>
              <stop offset="100%" stopColor="#a89868"/>
            </linearGradient>
            <linearGradient id="scene-sail-shade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,0,0,0)"/>
              <stop offset="100%" stopColor="rgba(0,0,0,.45)"/>
            </linearGradient>
          </defs>
          <line x1="160" y1="280" x2="160" y2="40"  stroke="#1a0e06" strokeWidth="5"/>
          <line x1="280" y1="290" x2="280" y2="20"  stroke="#1a0e06" strokeWidth="6"/>
          <line x1="400" y1="280" x2="400" y2="50"  stroke="#1a0e06" strokeWidth="5"/>
          <line x1="120" y1="80"  x2="200" y2="80"  stroke="#1a0e06" strokeWidth="3"/>
          <line x1="220" y1="60"  x2="340" y2="60"  stroke="#1a0e06" strokeWidth="3"/>
          <line x1="360" y1="90"  x2="440" y2="90"  stroke="#1a0e06" strokeWidth="3"/>
          <path d="M125 82 Q 160 130, 125 200 Q 160 192, 200 200 Q 165 130, 200 82 Q 162 90, 125 82 Z" fill="url(#scene-sail)" stroke="#5a4a2a" strokeWidth="1"/>
          <path d="M125 82 Q 160 130, 125 200 Q 160 192, 200 200 Q 165 130, 200 82 Q 162 90, 125 82 Z" fill="url(#scene-sail-shade)" opacity=".6"/>
          <path d="M222 62 Q 280 140, 222 250 Q 280 240, 340 250 Q 282 140, 340 62 Q 282 72, 222 62 Z" fill="url(#scene-sail)" stroke="#5a4a2a" strokeWidth="1"/>
          <path d="M222 62 Q 280 140, 222 250 Q 280 240, 340 250 Q 282 140, 340 62 Q 282 72, 222 62 Z" fill="url(#scene-sail-shade)" opacity=".55"/>
          <g transform="translate(280,150)" opacity=".75">
            <circle r="22" fill="#1a0e06"/>
            <ellipse cx="-7" cy="-3" rx="4" ry="5" fill="#f3ead0"/>
            <ellipse cx="7"  cy="-3" rx="4" ry="5" fill="#f3ead0"/>
            <path d="M-3 7 L0 11 L3 7" stroke="#f3ead0" strokeWidth="1.5" fill="none"/>
          </g>
          <path d="M362 92 Q 400 150, 362 220 Q 400 212, 440 220 Q 402 150, 440 92 Q 402 100, 362 92 Z" fill="url(#scene-sail)" stroke="#5a4a2a" strokeWidth="1"/>
          <path d="M362 92 Q 400 150, 362 220 Q 400 212, 440 220 Q 402 150, 440 92 Q 402 100, 362 92 Z" fill="url(#scene-sail-shade)" opacity=".6"/>
          <path d="M70 270 L470 270 L430 320 L110 320 Z" fill="url(#scene-hull)" stroke="#0a0604" strokeWidth="1"/>
          <line x1="80"  y1="285" x2="460" y2="285" stroke="#5a3818" strokeWidth="2"/>
          <line x1="84"  y1="298" x2="456" y2="298" stroke="#3a2614" strokeWidth="1.5"/>
          <circle cx="78" cy="260" r="4" fill="#f4c542" opacity=".9"/>
          <circle cx="78" cy="260" r="9" fill="#f4c542" opacity=".25"/>
        </svg>
      </div>
      <div className="hero-wake" />

      <div className="hero-vignette" />
    </div>
  )
}

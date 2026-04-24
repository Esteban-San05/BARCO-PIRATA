import React, { useState, useRef, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataPoint {
  label: string
  value: number
  sublabel?: string
}

interface DonutSlice {
  label: string
  value: number
  color: string
}

interface LineChartProps {
  data: DataPoint[]
  valueFormatter?: (v: number) => string
  height?: number
}

interface BarChartProps {
  data: DataPoint[]
  valueFormatter?: (v: number) => string
  height?: number
}

interface DonutChartProps {
  data: DonutSlice[]
  centerValue: string
  centerLabel: string
  valueFormatter?: (v: number) => string
}

// ─── useContainerWidth ────────────────────────────────────────────────────────

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>, fallback = 600): number {
  const [w, setW] = useState(fallback)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width))
    ro.observe(ref.current)
    setW(ref.current.getBoundingClientRect().width || fallback)
    return () => ro.disconnect()
  }, [])
  return w
}

// ─── Smooth bezier path ───────────────────────────────────────────────────────

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i]
    const cpx = (p.x + c.x) / 2
    d += ` C ${cpx} ${p.y}, ${cpx} ${c.y}, ${c.x} ${c.y}`
  }
  return d
}

// ─── LineChart ────────────────────────────────────────────────────────────────

export function LineChart({ data, valueFormatter, height = 260 }: LineChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const W   = useContainerWidth(ref)
  const [hov, setHov] = useState<number | null>(null)

  const padL = 8, padR = 8, padT = 20, padB = 32
  const cW = Math.max(W - padL - padR, 1)
  const cH = height - padT - padB
  const max = Math.max(...data.map(d => d.value)) * 1.1 || 1

  const pts = data.map((d, i) => ({
    x: padL + (data.length > 1 ? (i / (data.length - 1)) * cW : cW / 2),
    y: padT + (1 - d.value / max) * cH,
    d, i,
  }))

  const line  = smoothPath(pts)
  const area  = line ? line + ` L ${pts[pts.length - 1].x} ${padT + cH} L ${pts[0].x} ${padT + cH} Z` : ''
  const step  = Math.max(1, Math.floor(data.length / 6))
  const xLbls = pts.filter((_, i) => i % step === 0 || i === pts.length - 1)

  const hpt   = hov !== null ? pts[hov] : null
  const ttLbl = hpt ? (valueFormatter ? valueFormatter(hpt.d.value) : String(hpt.d.value)) : ''
  const ttW   = Math.max(ttLbl.length * 7.5 + 16, 72)
  const ttX   = hpt ? Math.min(Math.max(hpt.x - ttW / 2, 4), W - ttW - 4) : 0

  if (!data.length) return null

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={W} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="lgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F0B429" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F0B429" stopOpacity="0"    />
          </linearGradient>
          <clipPath id="lgClip">
            <rect x={padL} y={padT} width={cW} height={cH} />
          </clipPath>
        </defs>

        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i}
            x1={padL} y1={padT + (1 - f) * cH}
            x2={padL + cW} y2={padT + (1 - f) * cH}
            stroke="var(--border, #D9E5F2)" strokeWidth="0.8" strokeDasharray="3,3"
          />
        ))}

        {/* Area + line */}
        {area && <path d={area} fill="url(#lgGrad)" clipPath="url(#lgClip)" />}
        {line && (
          <path d={line} fill="none" stroke="#F0B429" strokeWidth="2.5"
            strokeLinecap="round" clipPath="url(#lgClip)" />
        )}

        {/* Dots + hover zones */}
        {pts.map((pt, i) => {
          const prevX = i === 0 ? pt.x - 8 : (pts[i - 1].x + pt.x) / 2
          const nextX = i === pts.length - 1 ? pt.x + 8 : (pt.x + pts[i + 1].x) / 2
          const zoneW = nextX - prevX
          return (
            <g key={i}>
              <rect x={prevX} y={padT} width={zoneW} height={cH}
                fill="transparent" style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
              />
              <circle cx={pt.x} cy={pt.y} r={hov === i ? 5 : 3}
                fill={hov === i ? '#fff' : '#F0B429'}
                stroke="#F0B429" strokeWidth="2"
                style={{ transition: 'r 0.12s, fill 0.12s', pointerEvents: 'none' }}
              />
              {hov === i && (
                <line x1={pt.x} y1={padT} x2={pt.x} y2={padT + cH}
                  stroke="#F0B429" strokeWidth="1" strokeDasharray="4,4" opacity="0.7"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
          )
        })}

        {/* X labels */}
        {xLbls.map((pt, i) => (
          <text key={i} x={pt.x} y={padT + cH + 22}
            textAnchor="middle" fontSize="11"
            fill="var(--text-muted, #6B85A6)" fontFamily="Inter, sans-serif">
            {pt.d.label}
          </text>
        ))}
      </svg>

      {/* Tooltip flotante */}
      {hpt && (
        <div style={{
          position: 'absolute', top: hpt.y - 42, left: ttX,
          background: '#0D2040', color: '#F0B429', borderRadius: 6,
          padding: '5px 12px', fontSize: 13, fontWeight: 700,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          fontFamily: 'Inter, sans-serif',
          border: '1px solid rgba(240,180,41,0.3)',
          zIndex: 10,
        }}>
          {ttLbl}
          <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>
            {hpt.d.label}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

export function BarChart({ data, valueFormatter, height = 220 }: BarChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const W   = useContainerWidth(ref)
  const [hov, setHov] = useState<number | null>(null)

  const padL = 8, padR = 8, padT = 28, padB = 36
  const cW = Math.max(W - padL - padR, 1)
  const cH = height - padT - padB
  const max = Math.max(...data.map(d => d.value)) * 1.1 || 1

  const barTotal = cW / (data.length || 1)
  const barW     = barTotal * 0.55
  const barGap   = (barTotal - barW) / 2

  if (!data.length) return null

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={W} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F7C948" />
            <stop offset="100%" stopColor="#DE911D" />
          </linearGradient>
        </defs>

        {data.map((d, i) => {
          const bh = (d.value / max) * cH
          const bx = padL + i * barTotal + barGap
          const by = padT + cH - bh
          const cx = bx + barW / 2
          return (
            <g key={i}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              style={{ cursor: 'pointer' }}>
              {/* Track */}
              <rect x={bx} y={padT} width={barW} height={cH}
                fill="rgba(255,255,255,0.06)" rx="4" />
              {/* Bar */}
              <rect x={bx} y={by} width={barW} height={bh}
                fill={hov === i ? '#F7C948' : 'url(#bgGrad)'} rx="4"
                style={{ transition: 'fill 0.15s' }}
              />
              {/* X label */}
              <text x={cx} y={padT + cH + 20}
                textAnchor="middle" fontSize="11"
                fill="var(--text-muted, #6B85A6)" fontFamily="Inter, sans-serif">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip flotante */}
      {hov !== null && (() => {
        const d   = data[hov]
        const bx  = padL + hov * barTotal + barGap
        const bh  = (d.value / max) * cH
        const by  = padT + cH - bh
        const cx  = bx + barW / 2
        const lbl = valueFormatter ? valueFormatter(d.value) : String(d.value)
        const tw  = Math.max(lbl.length * 7.5 + 24, 80)
        return (
          <div style={{
            position: 'absolute',
            top:  by - 38,
            left: Math.min(Math.max(cx - tw / 2, 4), W - tw - 4),
            background: '#0D2040', color: '#F0B429', borderRadius: 6,
            padding: '5px 12px', fontSize: 13, fontWeight: 700,
            whiteSpace: 'nowrap', pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            fontFamily: 'Inter, sans-serif',
            border: '1px solid rgba(240,180,41,0.3)',
            zIndex: 10,
          }}>
            {lbl}
          </div>
        )
      })()}
    </div>
  )
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

export function DonutChart({ data, centerValue, centerLabel, valueFormatter }: DonutChartProps) {
  const [hov, setHov] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const cx = 80, cy = 80, R = 64, r = 42

  let angle = -Math.PI / 2
  const slices = data.map((d) => {
    const sweep = (d.value / total) * Math.PI * 2
    const s = angle, e = angle + sweep
    angle += sweep
    const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s)
    const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e)
    const xi1 = cx + r * Math.cos(s), yi1 = cy + r * Math.sin(s)
    const xi2 = cx + r * Math.cos(e), yi2 = cy + r * Math.sin(e)
    const lg = sweep > Math.PI ? 1 : 0
    const path = `M ${xi1} ${yi1} L ${x1} ${y1} A ${R} ${R} 0 ${lg} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${r} ${r} 0 ${lg} 0 ${xi1} ${yi1} Z`
    return { ...d, path }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 160 160" width="160" height="160" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color}
            opacity={hov === null || hov === i ? 1 : 0.35}
            style={{
              transition: 'opacity 0.18s, transform 0.18s',
              transformOrigin: `${cx}px ${cy}px`,
              transform: hov === i ? 'scale(1.06)' : 'scale(1)',
              cursor: 'pointer',
              filter: hov === i ? `drop-shadow(0 0 6px ${s.color}88)` : 'none',
            }}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle"
          fontSize="17" fontWeight="800"
          fill="var(--text-title, #0D2040)" fontFamily="Inter, sans-serif">
          {hov !== null ? (valueFormatter ? valueFormatter(slices[hov].value) : String(slices[hov].value)) : centerValue}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle"
          fontSize="10" fill="var(--text-muted, #6B85A6)" fontFamily="Inter, sans-serif">
          {hov !== null ? slices[hov].label : centerLabel}
        </text>
      </svg>

      {/* Leyenda */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '10px 1fr auto',
        alignItems: 'center',
        columnGap: 8, rowGap: 10,
        flex: 1, minWidth: 120,
      }}>
        {slices.map((s, i) => (
          <React.Fragment key={i}>
            <span
              style={{
                width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0,
                opacity: hov === null || hov === i ? 1 : 0.35,
                transition: 'opacity 0.18s', cursor: 'pointer',
              }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            />
            <span
              style={{
                fontSize: 13, color: 'var(--text-body, #2A4066)', cursor: 'pointer',
                opacity: hov === null || hov === i ? 1 : 0.35,
                transition: 'opacity 0.18s', lineHeight: 1.3,
              }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              {s.label}
            </span>
            <span
              style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-title, #0D2040)',
                whiteSpace: 'nowrap', cursor: 'pointer',
                opacity: hov === null || hov === i ? 1 : 0.35,
                transition: 'opacity 0.18s',
              }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              {valueFormatter ? valueFormatter(s.value) : s.value}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ─── Re-exports for backwards compat ─────────────────────────────────────────
export type { LineChartProps, BarChartProps, DonutChartProps }

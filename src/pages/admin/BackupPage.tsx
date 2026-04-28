import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Download,
  Upload,
  DatabaseBackup,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileJson,
  Loader2,
} from 'lucide-react'
import { supabase } from '@lib/supabase'
import { Button } from '@components/ui/Button'

/* ─── Tipos ────────────────────────────────────────────────────────────── */

interface BackupFile {
  version: string
  exported_at: string
  tables: {
    reservations: unknown[]
    business_settings: unknown[]
    audit_log: unknown[]
  }
}

type Status = { type: 'idle' } | { type: 'loading' } | { type: 'ok'; msg: string } | { type: 'error'; msg: string }

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function isValidBackup(obj: unknown): obj is BackupFile {
  if (!obj || typeof obj !== 'object') return false
  const b = obj as Record<string, unknown>
  return (
    typeof b.version === 'string' &&
    typeof b.exported_at === 'string' &&
    b.tables !== null &&
    typeof b.tables === 'object' &&
    Array.isArray((b.tables as Record<string, unknown>).reservations) &&
    Array.isArray((b.tables as Record<string, unknown>).business_settings)
  )
}

/* ─── Componente principal ─────────────────────────────────────────────── */

export default function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [exportStatus, setExportStatus]   = useState<Status>({ type: 'idle' })
  const [restoreStatus, setRestoreStatus] = useState<Status>({ type: 'idle' })
  const [previewFile, setPreviewFile]     = useState<BackupFile | null>(null)
  const [fileName, setFileName]           = useState<string>('')

  /* ── EXPORTAR ─────────────────────────────────────────────────────────── */

  const handleExport = async () => {
    setExportStatus({ type: 'loading' })
    try {
      const [r1, r2, r3] = await Promise.all([
        supabase.from('reservations').select('*').order('created_at', { ascending: true }),
        supabase.from('business_settings').select('*'),
        supabase.from('audit_log').select('*').order('created_at', { ascending: true }),
      ])

      if (r1.error) throw new Error(r1.error.message)
      if (r2.error) throw new Error(r2.error.message)
      // audit_log puede estar vacía, no lanzamos error

      const backup: BackupFile = {
        version:     '1.0',
        exported_at: new Date().toISOString(),
        tables: {
          reservations:      r1.data ?? [],
          business_settings: r2.data ?? [],
          audit_log:         r3.data ?? [],
        },
      }

      const dateStr  = format(new Date(), 'yyyy-MM-dd_HH-mm')
      const filename = `barco-pirata-backup-${dateStr}.json`
      downloadJson(backup, filename)

      setExportStatus({
        type: 'ok',
        msg:  `Respaldo creado: ${(r1.data?.length ?? 0)} reservaciones, ${(r2.data?.length ?? 0)} configuración, ${(r3.data?.length ?? 0)} entradas de bitácora.`,
      })
    } catch (err) {
      setExportStatus({
        type: 'error',
        msg:  err instanceof Error ? err.message : 'Error al exportar',
      })
    }
  }

  /* ── LEER ARCHIVO ─────────────────────────────────────────────────────── */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPreviewFile(null)
    setRestoreStatus({ type: 'idle' })

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!isValidBackup(parsed)) {
          setRestoreStatus({ type: 'error', msg: 'El archivo no es un respaldo válido de Barco Pirata.' })
          return
        }
        setPreviewFile(parsed)
      } catch {
        setRestoreStatus({ type: 'error', msg: 'No se pudo leer el archivo JSON.' })
      }
    }
    reader.readAsText(file)
  }

  /* ── RESTAURAR ────────────────────────────────────────────────────────── */

  const handleRestore = async () => {
    if (!previewFile) return
    setRestoreStatus({ type: 'loading' })

    try {
      const { reservations, business_settings } = previewFile.tables

      // Upsert reservaciones (respeta el id existente)
      if (reservations.length > 0) {
        const { error } = await supabase
          .from('reservations')
          .upsert(reservations as Parameters<typeof supabase.from>[0][], { onConflict: 'id' })
        if (error) throw new Error(`Reservaciones: ${error.message}`)
      }

      // Upsert configuración
      if (business_settings.length > 0) {
        const { error } = await supabase
          .from('business_settings')
          .upsert(business_settings as Parameters<typeof supabase.from>[0][], { onConflict: 'id' })
        if (error) throw new Error(`Configuración: ${error.message}`)
      }

      setRestoreStatus({
        type: 'ok',
        msg:  `Restauración completada: ${reservations.length} reservaciones y ${business_settings.length} configuración restauradas.`,
      })
      setPreviewFile(null)
      setFileName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setRestoreStatus({
        type: 'error',
        msg:  err instanceof Error ? err.message : 'Error al restaurar',
      })
    }
  }

  /* ── RENDER ───────────────────────────────────────────────────────────── */

  return (
    <div className="p-6 lg:p-8 max-w-3xl space-y-6">

      {/* ── Exportar ──────────────────────────────────────────────────── */}
      <section
        className="rounded-2xl border p-6 space-y-4"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base" style={{ color: 'var(--text-title)' }}>
              Exportar Respaldo
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Descarga un archivo JSON con todas las reservaciones, configuración y bitácora.
            </p>
          </div>
        </div>

        <div
          className="flex flex-wrap gap-4 text-xs rounded-lg p-3"
          style={{ background: 'var(--bg-app)', color: 'var(--text-muted)' }}
        >
          {['Reservaciones', 'Configuración del negocio', 'Bitácora de accesos'].map((t) => (
            <span key={t} className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {t}
            </span>
          ))}
        </div>

        {/* Aviso de datos sensibles */}
        <div className="flex items-start gap-2 rounded-lg p-3 bg-amber-900/20 border border-amber-500/30 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            El archivo de respaldo contiene <strong>datos personales</strong> (nombres, teléfonos y correos de clientes).
            Guárdalo en un lugar seguro y no lo compartas.
          </span>
        </div>

        <StatusAlert status={exportStatus} />

        <Button
          onClick={handleExport}
          isLoading={exportStatus.type === 'loading'}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Crear respaldo ahora
        </Button>
      </section>

      {/* ── Restaurar ─────────────────────────────────────────────────── */}
      <section
        className="rounded-2xl border p-6 space-y-4"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy-900 flex items-center justify-center shrink-0">
            <Upload className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base" style={{ color: 'var(--text-title)' }}>
              Restaurar Respaldo
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Sube un archivo de respaldo JSON para recuperar los datos del sistema.
            </p>
          </div>
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-2 rounded-lg p-3 bg-amber-900/20 border border-amber-500/30 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Esta acción hace un <strong>upsert</strong> de los datos: actualiza registros existentes
            e inserta los faltantes. No elimina datos que no estén en el respaldo.
          </span>
        </div>

        {/* Selector de archivo */}
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            id="backup-file"
          />
          <label
            htmlFor="backup-file"
            className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed p-4 transition-colors hover:border-gold-400"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <FileJson className="w-8 h-8 text-gold-500 shrink-0" />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-title)' }}>
                {fileName || 'Seleccionar archivo de respaldo'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {fileName ? 'Haz clic para cambiar el archivo' : 'Formato: barco-pirata-backup-YYYY-MM-DD.json'}
              </p>
            </div>
          </label>
        </div>

        {/* Vista previa del archivo */}
        {previewFile && (
          <div
            className="rounded-xl p-4 space-y-2 text-sm border"
            style={{ background: 'var(--bg-app)', borderColor: 'var(--border)' }}
          >
            <p className="font-semibold" style={{ color: 'var(--text-title)' }}>
              Vista previa del respaldo
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Exportado el:</span>
              <span className="font-mono">
                {format(new Date(previewFile.exported_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
              </span>
              <span>Reservaciones:</span>
              <span className="font-bold" style={{ color: 'var(--text-title)' }}>
                {previewFile.tables.reservations.length}
              </span>
              <span>Configuración:</span>
              <span className="font-bold" style={{ color: 'var(--text-title)' }}>
                {previewFile.tables.business_settings.length} registro(s)
              </span>
              <span>Bitácora:</span>
              <span className="font-bold" style={{ color: 'var(--text-title)' }}>
                {previewFile.tables.audit_log.length} entradas (no se restaura)
              </span>
            </div>
          </div>
        )}

        <StatusAlert status={restoreStatus} />

        <Button
          onClick={handleRestore}
          disabled={!previewFile || restoreStatus.type === 'loading'}
          isLoading={restoreStatus.type === 'loading'}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <DatabaseBackup className="w-4 h-4" />
          Restaurar datos
        </Button>
      </section>

      {/* ── Respaldo automático Supabase ───────────────────────────────── */}
      <section
        className="rounded-2xl border p-6 space-y-3"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-900/40 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base" style={{ color: 'var(--text-title)' }}>
              Respaldo automático de Supabase
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Supabase realiza respaldos automáticos de la base de datos de forma independiente.
            </p>
          </div>
        </div>

        <ul className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {[
            { label: 'Frecuencia', value: 'Diaria (automática)' },
            { label: 'Retención',  value: '7 días' },
            { label: 'Tipo',       value: 'Snapshot completo de PostgreSQL' },
            { label: 'Restauración', value: 'Desde el Dashboard de Supabase → Settings → Backups' },
          ].map(({ label, value }) => (
            <li key={label} className="flex gap-2">
              <span className="w-24 font-semibold shrink-0" style={{ color: 'var(--text-title)' }}>
                {label}:
              </span>
              <span>{value}</span>
            </li>
          ))}
        </ul>

        <a
          href="https://supabase.com/dashboard/project/foaimrzqvsgiffmvyebr/settings/backups"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs font-medium text-gold-400 hover:text-gold-300 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Ir al Dashboard de Supabase → Backups
        </a>
      </section>
    </div>
  )
}

/* ─── Sub-componente: alerta de estado ─────────────────────────────────── */

function StatusAlert({ status }: { status: Status }) {
  if (status.type === 'idle') return null

  if (status.type === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Loader2 className="w-4 h-4 animate-spin" />
        Procesando…
      </div>
    )
  }

  if (status.type === 'ok') {
    return (
      <div className="flex items-start gap-2 rounded-lg p-3 bg-green-900/20 border border-green-500/30 text-green-300 text-xs">
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
        {status.msg}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 rounded-lg p-3 bg-red-900/20 border border-red-500/30 text-red-300 text-xs">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      {status.msg}
    </div>
  )
}

import { supabase } from '@lib/supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTableFn from 'jspdf-autotable'
import type { UserOptions } from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'

// Rolldown a veces no resuelve el default export correctamente; jspdf-autotable
// también se registra como método en el prototipo de jsPDF (doc.autoTable).
// Este helper elige la forma disponible en runtime.
function autoTable(doc: jsPDF, options: UserOptions): void {
  if (typeof autoTableFn === 'function') {
    autoTableFn(doc, options)
    return
  }
  const asMethod = (doc as unknown as { autoTable?: (o: UserOptions) => void }).autoTable
  if (typeof asMethod === 'function') {
    asMethod.call(doc, options)
    return
  }
  throw new Error('jspdf-autotable no se cargó correctamente (ni default export ni método en jsPDF).')
}
import { es } from 'date-fns/locale'
import type { DailyReport, Reservation } from '@app-types/index'
import type { PackageId } from '@constants/index'
import { formatDate, formatCurrency } from '@utils/formatters'

// ════════════════════════════════════════════════════════════════════════
//   Tipos extendidos para reportes por rango
// ════════════════════════════════════════════════════════════════════════

export type Granularity = 'day' | 'month' | 'year'

export interface RangeReport {
  /** ISO 'YYYY-MM-DD' — extremo inferior del rango (inclusive) */
  startDate: string
  /** ISO 'YYYY-MM-DD' — extremo superior del rango (inclusive) */
  endDate: string
  granularity: Granularity
  totalReservations: number
  totalCancelled: number
  totalPeople: number
  totalRevenue: number
  byPackage: Record<PackageId, { count: number; revenue: number }>
  byPaymentMethod: Record<string, { count: number; revenue: number }>
  /** Serie temporal agrupada según `granularity` — cada punto listo para graficar */
  series: Array<{
    /** Clave legible del punto (ej. "17 Abr", "Abr 2026", "2026") */
    label: string
    /** Clave ISO (ej. "2026-04-17", "2026-04", "2026") */
    key: string
    reservations: number
    people: number
    revenue: number
  }>
  reservations: Reservation[]
  cancelledReservations: Reservation[]
}

// ════════════════════════════════════════════════════════════════════════
//   Helpers
// ════════════════════════════════════════════════════════════════════════
function rowToReservation(r: Record<string, unknown>): Reservation {
  return {
    id: r.id as string,
    contactName: r.contact_name as string,
    contactPhone: r.contact_phone as string,
    contactEmail: (r.contact_email as string | null) ?? null,
    date: r.date as string,
    time: r.time as string,
    numberOfPeople: r.number_of_people as number,
    packageId: r.package_id as Reservation['packageId'],
    serviceType: r.service_type as Reservation['serviceType'],
    subtotal: r.subtotal as number,
    discount: r.discount as number,
    total: r.total as number,
    status: r.status as Reservation['status'],
    paymentMethod: r.payment_method as Reservation['paymentMethod'],
    paymentId: r.payment_id as Reservation['paymentId'],
    notes: r.notes as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

/** Devuelve la "clave" y el "label" legible según la granularidad. */
function bucket(dateIso: string, gran: Granularity): { key: string; label: string } {
  const d = parseISO(dateIso)
  if (gran === 'day') {
    return {
      key:   format(d, 'yyyy-MM-dd'),
      label: format(d, 'd MMM', { locale: es }),
    }
  }
  if (gran === 'month') {
    return {
      key:   format(d, 'yyyy-MM'),
      label: format(d, 'MMM yyyy', { locale: es }),
    }
  }
  return {
    key:   format(d, 'yyyy'),
    label: format(d, 'yyyy'),
  }
}

// ════════════════════════════════════════════════════════════════════════
//   Servicio
// ════════════════════════════════════════════════════════════════════════
export const reportService = {
  /** Reporte de un único día (compat con vista anterior). */
  async getDailyReport(date: string): Promise<DailyReport> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('date', date)
      .neq('status', 'cancelada')
      .order('time', { ascending: true })

    if (error) throw new Error(error.message)

    const reservations = ((data ?? []) as Record<string, unknown>[]).map(rowToReservation)

    const report: DailyReport = {
      date,
      totalReservations: reservations.length,
      totalPeople: reservations.reduce((s, r) => s + r.numberOfPeople, 0),
      totalRevenue: reservations.reduce((s, r) => s + r.total, 0),
      byPackage: {
        CON_COMIDA:   { count: 0, revenue: 0 },
        SOLO_BEBIDAS: { count: 0, revenue: 0 },
        SOLO_PASEO:   { count: 0, revenue: 0 },
      },
      byPaymentMethod: {},
      reservations,
    }

    for (const r of reservations) {
      const method = r.paymentMethod ?? 'sin_pago'
      if (r.packageId in report.byPackage) {
        report.byPackage[r.packageId].count++
        report.byPackage[r.packageId].revenue += r.total
      }
      if (!report.byPaymentMethod[method]) report.byPaymentMethod[method] = { count: 0, revenue: 0 }
      report.byPaymentMethod[method].count++
      report.byPaymentMethod[method].revenue += r.total
    }

    return report
  },

  /** Reporte por rango arbitrario, agrupado por día/mes/año. */
  async getRangeReport(
    startDate: string,
    endDate: string,
    granularity: Granularity,
  ): Promise<RangeReport> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true })

    if (error) throw new Error(error.message)

    const all = ((data ?? []) as Record<string, unknown>[]).map(rowToReservation)

    // Separar canceladas de activas para que no afecten métricas de ingreso
    const cancelledReservations = all.filter((r) => r.status === 'cancelada')
    const reservations          = all.filter((r) => r.status !== 'cancelada')

    const byPackage: RangeReport['byPackage'] = {
      CON_COMIDA:   { count: 0, revenue: 0 },
      SOLO_BEBIDAS: { count: 0, revenue: 0 },
      SOLO_PASEO:   { count: 0, revenue: 0 },
    }
    const byPaymentMethod: RangeReport['byPaymentMethod'] = {}
    const bucketsMap = new Map<string, RangeReport['series'][number]>()

    for (const r of reservations) {
      const method = r.paymentMethod ?? 'sin_pago'

      if (r.packageId in byPackage) {
        byPackage[r.packageId].count++
        byPackage[r.packageId].revenue += r.total
      }
      if (!byPaymentMethod[method]) byPaymentMethod[method] = { count: 0, revenue: 0 }
      byPaymentMethod[method].count++
      byPaymentMethod[method].revenue += r.total

      const { key, label } = bucket(r.date, granularity)
      const existing = bucketsMap.get(key)
      if (existing) {
        existing.reservations++
        existing.people  += r.numberOfPeople
        existing.revenue += r.total
      } else {
        bucketsMap.set(key, {
          key, label,
          reservations: 1,
          people:  r.numberOfPeople,
          revenue: r.total,
        })
      }
    }

    const series = Array.from(bucketsMap.values()).sort((a, b) => a.key.localeCompare(b.key))

    return {
      startDate, endDate, granularity,
      totalReservations: reservations.length,
      totalCancelled:    cancelledReservations.length,
      totalPeople:  reservations.reduce((s, r) => s + r.numberOfPeople, 0),
      totalRevenue: reservations.reduce((s, r) => s + r.total, 0),
      byPackage,
      byPaymentMethod,
      series,
      reservations,
      cancelledReservations,
    }
  },

  // ════════════════════════════════════════════════════════════════════
  //   Exports — Excel
  // ════════════════════════════════════════════════════════════════════
  exportToExcel(report: DailyReport): void {
    const rows = report.reservations.map((r) => ({
      'Nombre': r.contactName,
      'Teléfono': r.contactPhone,
      'Hora': r.time,
      'Personas': r.numberOfPeople,
      'Paquete': r.packageId.replace(/_/g, ' '),
      'Tipo': r.serviceType,
      'Subtotal': r.subtotal,
      'Descuento': r.discount,
      'Total': r.total,
      'Estado': r.status,
      'Método de Pago': r.paymentMethod ?? '–',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Reservaciones')
    XLSX.writeFile(wb, `reservaciones_${report.date}.xlsx`)
  },

  /** Excel de rango — 2 hojas (detalle + serie temporal). */
  exportRangeToExcel(report: RangeReport): void {
    const wb = XLSX.utils.book_new()

    const detail = report.reservations.map((r) => ({
      'Fecha': r.date,
      'Hora': r.time,
      'Nombre': r.contactName,
      'Teléfono': r.contactPhone,
      'Personas': r.numberOfPeople,
      'Paquete': r.packageId.replace(/_/g, ' '),
      'Tipo': r.serviceType,
      'Subtotal': r.subtotal,
      'Descuento': r.discount,
      'Total': r.total,
      'Estado': r.status,
      'Pago': r.paymentMethod ?? '–',
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Detalle')

    const series = report.series.map((p) => ({
      'Período':       p.label,
      'Reservaciones': p.reservations,
      'Personas':      p.people,
      'Ingresos':      p.revenue,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(series), 'Serie')

    XLSX.writeFile(wb, `reporte_${report.startDate}_a_${report.endDate}.xlsx`)
  },

  // ════════════════════════════════════════════════════════════════════
  //   Exports — PDF
  // ════════════════════════════════════════════════════════════════════
  exportToPDF(report: DailyReport): void {
    try {
      const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
      const W        = 215.9
      const ML       = 15
      const MR       = 15
      const FOOTER_Y = 271

      const C_INK   = [30,  41,  59]  as [number,number,number]
      const C_LABEL = [100, 116, 139] as [number,number,number]
      const C_BOX   = [245, 247, 250] as [number,number,number]
      const C_LINE  = [203, 213, 225] as [number,number,number]
      const C_TH    = [71,  85,  105] as [number,number,number]
      const C_ALT   = [248, 250, 252] as [number,number,number]

      // Franja superior gris
      doc.setFillColor(...C_TH)
      doc.rect(0, 0, W, 3, 'F')

      // Empresa + subtítulo
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(...C_INK)
      doc.text('Barco Pirata', ML, 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...C_LABEL)
      doc.text('Reporte Diario de Operaciones', ML, 23)

      // Fecha / generación — derecha
      doc.setFontSize(9)
      doc.text(`Fecha: ${formatDate(report.date)}`, W - MR, 16, { align: 'right' })
      doc.text(
        `Generado: ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`,
        W - MR, 23, { align: 'right' },
      )

      doc.setDrawColor(...C_LINE)
      doc.setLineWidth(0.3)
      doc.line(ML, 27, W - MR, 27)

      // KPIs
      const kpis: Array<[string, string]> = [
        ['Reservaciones',    String(report.totalReservations)],
        ['Personas totales', String(report.totalPeople)],
        ['Ingresos totales', formatCurrency(report.totalRevenue)],
      ]
      const kpiW = (W - ML - MR - 8) / 3
      kpis.forEach(([label, value], i) => {
        const kx = ML + i * (kpiW + 4)
        doc.setFillColor(...C_BOX)
        doc.roundedRect(kx, 32, kpiW, 18, 2, 2, 'F')
        doc.setFontSize(7)
        doc.setTextColor(...C_LABEL)
        doc.setFont('helvetica', 'normal')
        doc.text(label.toUpperCase(), kx + 4, 38)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...C_INK)
        doc.text(value, kx + 4, 46)
        doc.setFont('helvetica', 'normal')
      })

      autoTable(doc, {
        startY: 56,
        head: [['Hora', 'Cliente', 'Pers.', 'Paquete', 'Total', 'Estado', 'Pago']],
        body: report.reservations.map((r) => [
          r.time,
          r.contactName,
          String(r.numberOfPeople),
          r.packageId.replace(/_/g, ' '),
          formatCurrency(r.total),
          r.status,
          r.paymentMethod ?? '—',
        ]),
        styles:              { fontSize: 9, cellPadding: 3, textColor: C_INK, lineColor: C_LINE, lineWidth: 0.15 },
        headStyles:          { fillColor: C_TH, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles:  { fillColor: C_ALT },
        margin:              { left: ML, right: MR },
      })

      const total = doc.getNumberOfPages()
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setDrawColor(...C_LINE)
        doc.setLineWidth(0.3)
        doc.line(ML, FOOTER_Y - 3, W - MR, FOOTER_Y - 3)
        doc.setFontSize(7.5)
        doc.setTextColor(...C_LABEL)
        doc.setFont('helvetica', 'normal')
        doc.text('Barco Pirata — Puerto Peñasco, Sonora', ML, FOOTER_Y + 2)
        doc.text(`Página ${i} de ${total}`, W - MR, FOOTER_Y + 2, { align: 'right' })
      }

      doc.save(`reporte_${report.date}.pdf`)
    } catch (err) {
      console.error('[reportService.exportToPDF]', err)
      alert(`No se pudo generar el PDF.\n\nError: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  /** PDF de rango — tamaño carta vertical, colores corporativos. */
  exportRangeToPDF(report: RangeReport): void {
    try {
      const doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
      const W        = 215.9
      const ML       = 15
      const MR       = 15
      const FOOTER_Y = 271

      const C_INK   = [30,  41,  59]  as [number,number,number]
      const C_LABEL = [100, 116, 139] as [number,number,number]
      const C_BOX   = [245, 247, 250] as [number,number,number]
      const C_LINE  = [203, 213, 225] as [number,number,number]
      const C_TH    = [71,  85,  105] as [number,number,number]
      const C_ALT   = [248, 250, 252] as [number,number,number]

      const granLabel = report.granularity === 'day' ? 'Diario'
        : report.granularity === 'month' ? 'Mensual' : 'Anual'
      const avgTicket = report.totalReservations
        ? report.totalRevenue / report.totalReservations : 0

      // Franja + encabezado
      doc.setFillColor(...C_TH)
      doc.rect(0, 0, W, 3, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(...C_INK)
      doc.text('Barco Pirata', ML, 16)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...C_LABEL)
      doc.text(`Reporte por Período — ${granLabel}`, ML, 23)

      doc.setFontSize(9)
      doc.text(`${formatDate(report.startDate)} al ${formatDate(report.endDate)}`, W - MR, 16, { align: 'right' })
      doc.text(
        `Generado: ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`,
        W - MR, 23, { align: 'right' },
      )

      doc.setDrawColor(...C_LINE)
      doc.setLineWidth(0.3)
      doc.line(ML, 27, W - MR, 27)

      // KPIs (4 cajas)
      const kpis: Array<[string, string]> = [
        ['Reservaciones',    String(report.totalReservations)],
        ['Personas totales', String(report.totalPeople)],
        ['Ingresos totales', formatCurrency(report.totalRevenue)],
        ['Ticket promedio',  formatCurrency(avgTicket)],
      ]
      const kpiW = (W - ML - MR - 12) / 4
      kpis.forEach(([label, value], i) => {
        const kx = ML + i * (kpiW + 4)
        doc.setFillColor(...C_BOX)
        doc.roundedRect(kx, 32, kpiW, 18, 2, 2, 'F')
        doc.setFontSize(7)
        doc.setTextColor(...C_LABEL)
        doc.setFont('helvetica', 'normal')
        doc.text(label.toUpperCase(), kx + 3, 38)
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...C_INK)
        doc.text(value, kx + 3, 46)
        doc.setFont('helvetica', 'normal')
      })

      // Sección 1: Serie temporal
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C_INK)
      doc.text('Resumen por período', ML, 58)
      doc.setFont('helvetica', 'normal')

      autoTable(doc, {
        startY: 62,
        head: [['Período', 'Reservaciones', 'Personas', 'Ingresos']],
        body: report.series.map((p) => [
          p.label, String(p.reservations), String(p.people), formatCurrency(p.revenue),
        ]),
        styles:             { fontSize: 9, cellPadding: 3, textColor: C_INK, lineColor: C_LINE, lineWidth: 0.15 },
        headStyles:         { fillColor: C_TH, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: C_ALT },
        columnStyles:       { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin:             { left: ML, right: MR },
      })

      // Sección 2: Desglose por paquete
      const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 62
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C_INK)
      doc.text('Desglose por paquete', ML, y1 + 10)
      doc.setFont('helvetica', 'normal')

      autoTable(doc, {
        startY: y1 + 14,
        head: [['Paquete', 'Reservaciones', 'Ingresos', '% del total']],
        body: (Object.keys(report.byPackage) as Array<keyof typeof report.byPackage>).map((k) => {
          const s   = report.byPackage[k]
          const pct = report.totalReservations
            ? ((s.count / report.totalReservations) * 100).toFixed(1) : '0.0'
          return [k.replace(/_/g, ' '), String(s.count), formatCurrency(s.revenue), `${pct}%`]
        }),
        styles:             { fontSize: 9, cellPadding: 3, textColor: C_INK, lineColor: C_LINE, lineWidth: 0.15 },
        headStyles:         { fillColor: C_TH, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: C_ALT },
        columnStyles:       { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
        margin:             { left: ML, right: MR },
      })

      // Sección 3: Detalle de reservaciones
      const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? y1
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...C_INK)
      doc.text('Detalle de reservaciones', ML, y2 + 10)
      doc.setFont('helvetica', 'normal')

      autoTable(doc, {
        startY: y2 + 14,
        head: [['Fecha', 'Hora', 'Cliente', 'Pers.', 'Paquete', 'Total', 'Estado']],
        body: report.reservations.map((r) => [
          formatDate(r.date), r.time, r.contactName,
          String(r.numberOfPeople), r.packageId.replace(/_/g, ' '),
          formatCurrency(r.total), r.status,
        ]),
        styles:             { fontSize: 8.5, cellPadding: 2.5, textColor: C_INK, lineColor: C_LINE, lineWidth: 0.15 },
        headStyles:         { fillColor: C_TH, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: C_ALT },
        columnStyles:       { 3: { halign: 'right' }, 5: { halign: 'right' } },
        margin:             { left: ML, right: MR },
      })

      // Footer en todas las páginas
      const total = doc.getNumberOfPages()
      for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        doc.setDrawColor(...C_LINE)
        doc.setLineWidth(0.3)
        doc.line(ML, FOOTER_Y - 3, W - MR, FOOTER_Y - 3)
        doc.setFontSize(7.5)
        doc.setTextColor(...C_LABEL)
        doc.setFont('helvetica', 'normal')
        doc.text('Barco Pirata — Puerto Peñasco, Sonora', ML, FOOTER_Y + 2)
        doc.text(`Página ${i} de ${total}`, W - MR, FOOTER_Y + 2, { align: 'right' })
      }

      doc.save(`reporte_${report.startDate}_a_${report.endDate}.pdf`)
    } catch (err) {
      console.error('[reportService.exportRangeToPDF]', err)
      alert(`No se pudo generar el PDF.\n\nError: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}

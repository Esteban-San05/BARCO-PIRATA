import { supabase } from '@lib/supabase'
import type { BusinessSettings } from '@app-types/index'
import { TIME_SLOTS } from '@constants/index'

const COLS = 'closed_weekdays, active_time_slots, boat_capacity, closed_dates, package_overrides, promotions'

const mapRow = (row: Record<string, unknown>): BusinessSettings => ({
  closedWeekdays:   (row.closed_weekdays   as number[] | null) ?? [1],
  activeTimeSlots:  (row.active_time_slots as string[] | null) ?? TIME_SLOTS.map(s => s.time),
  boatCapacity:     row.boat_capacity      as number,
  closedDates:      (row.closed_dates      as string[] | null) ?? [],
  packageOverrides: (row.package_overrides as BusinessSettings['packageOverrides'] | null) ?? {},
  promotions:       (row.promotions        as BusinessSettings['promotions']       | null) ?? [],
})

export const settingsService = {
  async get(): Promise<BusinessSettings> {
    const { data, error } = await supabase
      .from('business_settings')
      .select(COLS)
      .eq('id', 1)
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },

  async update(settings: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (settings.closedWeekdays   !== undefined) patch.closed_weekdays   = settings.closedWeekdays
    if (settings.activeTimeSlots  !== undefined) patch.active_time_slots = settings.activeTimeSlots
    if (settings.boatCapacity     !== undefined) patch.boat_capacity     = settings.boatCapacity
    if (settings.closedDates      !== undefined) patch.closed_dates      = settings.closedDates
    if (settings.packageOverrides !== undefined) patch.package_overrides = settings.packageOverrides
    if (settings.promotions       !== undefined) patch.promotions        = settings.promotions

    const { data, error } = await supabase
      .from('business_settings')
      .update(patch)
      .eq('id', 1)
      .select(COLS)
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },
}

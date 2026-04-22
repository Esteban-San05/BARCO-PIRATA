import { supabase } from '@lib/supabase'
import type { BusinessSettings } from '@app-types/index'

const mapRow = (row: Record<string, unknown>): BusinessSettings => ({
  closedWeekday:  row.closed_weekday  as number,
  activeTimeSlots: row.active_time_slots as string[],
  boatCapacity:   row.boat_capacity   as number,
})

export const settingsService = {
  async get(): Promise<BusinessSettings> {
    const { data, error } = await supabase
      .from('business_settings')
      .select('closed_weekday, active_time_slots, boat_capacity')
      .eq('id', 1)
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },

  async update(settings: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (settings.closedWeekday   !== undefined) patch.closed_weekday    = settings.closedWeekday
    if (settings.activeTimeSlots !== undefined) patch.active_time_slots = settings.activeTimeSlots
    if (settings.boatCapacity    !== undefined) patch.boat_capacity     = settings.boatCapacity

    const { data, error } = await supabase
      .from('business_settings')
      .update(patch)
      .eq('id', 1)
      .select('closed_weekday, active_time_slots, boat_capacity')
      .single()

    if (error) throw new Error(error.message)
    return mapRow(data as Record<string, unknown>)
  },
}

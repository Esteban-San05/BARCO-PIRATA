import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsService } from '../services/settingsService'
import type { BusinessSettings } from '@app-types/index'
import { TIME_SLOTS, BOAT_CAPACITY } from '@constants/index'

const QUERY_KEY = ['business-settings'] as const

const FALLBACK: BusinessSettings = {
  closedWeekdays:    [1],
  activeTimeSlots:   TIME_SLOTS.map(s => s.time),
  boatCapacity:      BOAT_CAPACITY,
  closedDates:       [],
  packageOverrides:  {},
  promotions:        [],
  portClosed:        false,
  capacityFullSlots: [],
}

export function useBusinessSettings() {
  return useQuery({
    queryKey:        QUERY_KEY,
    queryFn:         settingsService.get,
    staleTime:       5 * 60 * 1000, // 5 min — cambia poco
    placeholderData: FALLBACK,
    retry:           1,
  })
}

export function useUpdateBusinessSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settingsService.update,
    onSuccess:  (updated) => {
      qc.setQueryData(QUERY_KEY, updated)
    },
  })
}

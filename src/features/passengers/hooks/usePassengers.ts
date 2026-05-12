import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { passengerService } from '../services/passengerService'
import type { PassengerInput } from '@app-types/index'

export const passengerKeys = {
  all:        ['passengers']                            as const,
  byRes:      (id: string)   => ['passengers', id]     as const,
  statusById: (id: string)   => ['manifest', id]       as const,
  statusByDate: (date: string) => ['manifest', 'date', date] as const,
  listByDate: (date: string) => ['passengers', 'date', date] as const,
}

/** Pasajeros de una reservación. */
export function usePassengers(reservationId: string) {
  return useQuery({
    queryKey: passengerKeys.byRes(reservationId),
    queryFn:  () => passengerService.listByReservation(reservationId),
    enabled:  !!reservationId,
  })
}

/** Guarda (reemplaza) la lista completa de pasajeros de una reservación. */
export function useSavePassengers(reservationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (rows: PassengerInput[]) =>
      passengerService.bulkUpsert(reservationId, rows),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: passengerKeys.byRes(reservationId) })
      queryClient.invalidateQueries({ queryKey: passengerKeys.statusById(reservationId) })
    },
  })
}

/** Estado del manifiesto de una reservación (completo / parcial). */
export function useManifestStatus(reservationId: string) {
  return useQuery({
    queryKey: passengerKeys.statusById(reservationId),
    queryFn:  () => passengerService.getManifestStatus(reservationId),
    enabled:  !!reservationId,
  })
}

/** Estado del manifiesto de todas las reservaciones de una fecha (para DashboardPage / ReservationsPage). */
export function useManifestStatusByDate(date: string) {
  return useQuery({
    queryKey: passengerKeys.statusByDate(date),
    queryFn:  () => passengerService.getManifestStatusByDate(date),
    enabled:  !!date,
  })
}

/** Lista plana de pasajeros por fecha (para ManifiestosPage). */
export function usePassengersByDate(date: string) {
  return useQuery({
    queryKey: passengerKeys.listByDate(date),
    queryFn:  () => passengerService.listByDate(date),
    enabled:  !!date,
  })
}

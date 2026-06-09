import { useMutation } from '@tanstack/react-query'
import { supabase } from '@lib/supabase'

export interface PortClosureContact {
  id: string
  name: string
  phone: string      // normalizado con lada 52
  rawPhone: string
  time: string
  waLink: string
  valid: boolean
}

export interface PortClosurePrepareResult {
  success: boolean
  date: string
  totalFound: number
  valid: number
  invalid: number
  contacts: PortClosureContact[]
}

async function preparePortClosureLinks(): Promise<PortClosurePrepareResult> {
  const { data, error } = await supabase.functions.invoke<PortClosurePrepareResult>(
    'notify-port-closure',
    { body: {} },
  )
  if (error) throw new Error(error.message ?? 'No se pudo preparar la lista de contactos')
  if (!data) throw new Error('Respuesta vacía del servidor')
  return data
}

export function usePortClosureNotify() {
  return useMutation({ mutationFn: preparePortClosureLinks })
}

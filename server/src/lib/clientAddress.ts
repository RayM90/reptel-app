// Compone una dirección legible a partir de los campos estructurados de
// Client, para el frontend mobile que hoy solo consume un string plano
// (`user.address`). Cuando los formularios de mobile/admin-web se
// actualicen para capturar cada campo por separado, este helper deja de
// ser necesario.
export interface StructuredAddress {
  addressStreet?: string | null
  addressBuilding?: string | null
  addressNeighborhood?: string | null
  addressCity?: string | null
  addressState?: string | null
}

export const formatClientAddress = (client: StructuredAddress | null | undefined): string | null => {
  if (!client) return null
  const parts = [
    client.addressStreet,
    client.addressBuilding,
    client.addressNeighborhood,
    client.addressCity,
    client.addressState,
  ].filter((part): part is string => !!part && part.trim().length > 0)

  return parts.length > 0 ? parts.join(', ') : null
}

interface ClientAddressRow extends StructuredAddress {
  id: string
  label: string
  isPrimary: boolean
}

export const getPrimaryAddress = (addresses: ClientAddressRow[] | null | undefined): ClientAddressRow | null => {
  if (!addresses || addresses.length === 0) return null
  return addresses.find((a) => a.isPrimary) ?? addresses[0]
}

export const getSecondaryAddress = (addresses: ClientAddressRow[] | null | undefined): ClientAddressRow | null => {
  if (!addresses) return null
  return addresses.find((a) => !a.isPrimary) ?? null
}

// Aplana la dirección primaria de `addresses[]` al nivel superior del objeto
// cliente, para que la API siga devolviendo el mismo shape que consumía
// admin-web antes de que la dirección se moviera a ClientAddress. `client`
// es lo que devuelve Prisma con `include: { addresses: true }` — se tipa
// laxo a propósito porque este archivo no define un tipo de dominio propio
// para Client (ver clients.service.ts).
export const flattenClientAddresses = (client: Record<string, any>) => {
  const { addresses, ...rest } = client
  const primary = getPrimaryAddress(addresses)
  const secondary = getSecondaryAddress(addresses)
  return {
    ...rest,
    addressState: primary?.addressState ?? null,
    addressCity: primary?.addressCity ?? null,
    addressNeighborhood: primary?.addressNeighborhood ?? null,
    addressStreet: primary?.addressStreet ?? null,
    addressBuilding: primary?.addressBuilding ?? null,
    secondaryAddress: secondary,
  }
}

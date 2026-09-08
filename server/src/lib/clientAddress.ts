// Compone una dirección legible a partir de los campos estructurados de
// Client, para el frontend mobile que hoy solo consume un string plano
// (`user.address`). Cuando los formularios de mobile/admin-web se
// actualicen para capturar cada campo por separado, este helper deja de
// ser necesario.
interface StructuredAddress {
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

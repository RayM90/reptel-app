// Nombre completo de un cliente — evita un espacio colgante cuando el
// cliente es una empresa/gobierno (J-/G-) y no tiene apellido.
export const formatFullName = (name: string, lastName?: string | null): string =>
  lastName ? `${name} ${lastName}` : name

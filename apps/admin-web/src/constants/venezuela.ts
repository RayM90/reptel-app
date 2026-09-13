// Catálogos venezolanos usados en los formularios de intake (self-service y
// mostrador) y en cualquier campo de teléfono/banco de la app. Hardcodeados a
// propósito — no hay tabla en BD para esto, ver docs/superpowers/specs/2026-09-08-f-*.

// 04XX (4 dígitos) + 7 dígitos del número = 11 dígitos totales.
export const PHONE_PREFIXES = ['0412', '0414', '0416', '0424', '0426'] as const

export const PHONE_DIGITS_LENGTH = 7

// Cédula de personal (empleados RepTel): siempre persona natural, nunca V/G — a diferencia
// del cliente (ver IdNumberInput sin `prefixes` = V/E/J/G, usado en Registro.tsx).
export const STAFF_ID_PREFIXES = ['V', 'E'] as const
export const STAFF_ID_MIN_DIGITS = 7
export const STAFF_ID_MAX_DIGITS = 8

export interface Bank {
  code: string
  name: string
}

export const VENEZUELAN_BANKS: Bank[] = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Banco Venezolano de Crédito' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0108', name: 'Banco Provincial' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Banco Sofitasa' },
  { code: '0151', name: 'Banco Fondo Común' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Banco Bicentenario del Pueblo' },
  { code: '0177', name: 'BANFANB' },
  { code: '0191', name: 'Banco Nacional de Crédito' },
]

export const DEVICE_COLORS = [
  'Negro', 'Gris', 'Plateado', 'Blanco', 'Azul', 'Rojo', 'Dorado', 'Rosado',
]

// Marca → modelos comunes en el mercado venezolano. "Otro" se maneja aparte en
// el componente (no vive en estos arrays) para poder mostrar el input de texto libre.
export const DEVICE_BRANDS = ['HP', 'Lenovo', 'Dell', 'Asus', 'Acer', 'Toshiba', 'Samsung', 'Apple'] as const

export const BRAND_MODELS: Record<(typeof DEVICE_BRANDS)[number], string[]> = {
  HP: ['Pavilion', 'EliteBook', 'ProBook', 'Envy', 'Omen', '15-series', '14-series'],
  Lenovo: ['ThinkPad', 'IdeaPad', 'Legion', 'V-series', 'Yoga'],
  Dell: ['Inspiron', 'Latitude', 'Vostro', 'XPS', 'G-series'],
  Asus: ['VivoBook', 'ZenBook', 'ROG', 'TUF Gaming', 'X-series'],
  Acer: ['Aspire', 'Nitro', 'Swift', 'Predator', 'TravelMate'],
  Toshiba: ['Satellite', 'Portege', 'Tecra'],
  Samsung: ['Galaxy Book', 'Notebook 9', 'Notebook Odyssey'],
  Apple: ['MacBook Air', 'MacBook Pro'],
}

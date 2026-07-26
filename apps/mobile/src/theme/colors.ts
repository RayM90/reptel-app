// Fuente única de los tokens de color de RepTel (Paleta "Grafito & Cobre").
// Las pantallas existentes todavia usan hex literales — se migran en el
// plan de pulido de mobile, no en este.

export const colors = {
  primary: '#23262F',
  primaryDark: '#17171D',
  secondary: '#4B3E96',
  accent: '#B5502D',
  success: '#1E7A3D',
  successBg: '#E3F3E9',
  danger: '#B3261E',
  dangerBg: '#FBE9E7',
  background: '#F6F3EE',
  backgroundAlt: '#EFEAE2',
  surface: '#FFFFFF',
  onPrimary: '#FFFFFF',
  border: '#E4DFD6',
  text: '#21212B',
  textMuted: '#6B6B75',
} as const

export type ColorToken = keyof typeof colors

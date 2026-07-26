import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces'
import {
  PublicSans_400Regular,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
} from '@expo-google-fonts/public-sans'

// Pasar este objeto a useFonts() en app/_layout.tsx.
export const fontsToLoad = {
  'Fraunces-Medium': Fraunces_500Medium,
  'Fraunces-SemiBold': Fraunces_600SemiBold,
  'Fraunces-Bold': Fraunces_700Bold,
  'PublicSans-Regular': PublicSans_400Regular,
  'PublicSans-SemiBold': PublicSans_600SemiBold,
  'PublicSans-Bold': PublicSans_700Bold,
}

// Nombres a usar en fontFamily dentro de StyleSheet.create(...).
export const fonts = {
  headingMedium: 'Fraunces-Medium',
  headingSemiBold: 'Fraunces-SemiBold',
  headingBold: 'Fraunces-Bold',
  bodyRegular: 'PublicSans-Regular',
  bodySemiBold: 'PublicSans-SemiBold',
  bodyBold: 'PublicSans-Bold',
} as const

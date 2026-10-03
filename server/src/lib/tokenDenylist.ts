// ID tokens cerrados con "Cerrar sesión" antes de vencer. Cognito no permite
// invalidar un ID token ya emitido, así que el servidor lo rechaza por su jti
// hasta su vencimiento. Vive en memoria: tras un reinicio, el refresh token ya
// está revocado en Cognito y el ID token vence solo.
const revoked = new Map<string, number>() // jti → vencimiento (ms)

export function revokeToken(jti: string, expSeconds: number): void {
  revoked.set(jti, expSeconds * 1000)
  const now = Date.now()
  for (const [key, exp] of revoked) if (exp < now) revoked.delete(key)
}

export const isTokenRevoked = (jti: string | undefined): boolean => !!jti && revoked.has(jti)

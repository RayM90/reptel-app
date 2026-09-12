export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Carga .env ANTES de cualquier test file — app.ts hace dotenv.config()
  // después de sus propios imports (que ya inicializan CognitoJwtVerifier a
  // nivel de módulo), así que un test que hace `import app from '../app'`
  // sin este setupFiles falla siempre con Cognito indefinido, .env exista o no.
  setupFiles: ['dotenv/config'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  testTimeout: 30000,
}
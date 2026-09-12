// Set minimal environment variables to allow tests to load
process.env.COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_aBc123DeF'
process.env.COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '1a2b3c4d5e6f7g8h9i0j'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/reptel_test'
process.env.NODE_ENV = 'test'

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
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
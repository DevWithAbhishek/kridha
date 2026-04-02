import type { Config } from 'jest';

const config: Config = {
  testEnvironment:  'node',
  transform:        { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { paths: { '@/*': ['./src/*'] } } }] },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch:        ['**/__tests__/**/*.test.ts'],
  projects: [
    {
      displayName:     'unit',
      testMatch:       ['**/__tests__/unit/**/*.test.ts'],
      testEnvironment: 'node',
    },
    {
      displayName:     'integration',
      testMatch:       ['**/__tests__/integration/**/*.test.ts'],
      testEnvironment: 'node',
      testTimeout:     30_000,
    },
  ],
};

export default config;

// package.json scripts to add:
// "test":             "jest",
// "test:unit":        "jest --testPathPattern=unit",
// "test:integration": "jest --testPathPattern=integration",
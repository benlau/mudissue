process.env.TZ = "UTC";

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setupTest.ts'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude'],
  modulePathIgnorePatterns: ['<rootDir>/.claude'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
    '^(\\.{1,2}/.*)\\.tsx$': '$1',
    '^node:fs/promises$': '<rootDir>/tests/__mocks__/fs-promises.cjs',
    '^fs/promises$': '<rootDir>/tests/__mocks__/fs-promises.cjs',
  },
  transform: {
    '^.+\\.md$': '<rootDir>/jest-raw-loader.cjs',
    '^.+\\.conf$': '<rootDir>/jest-raw-loader.cjs',
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
};

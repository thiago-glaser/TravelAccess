/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.m?js$': ['babel-jest', { configFile: './babel.config.cjs' }],
    },
    moduleNameMapper: {
        // Resolve @/ path alias used throughout the codebase
        '^@/(.*)$': '<rootDir>/$1',
        // Stub geographiclib-geodesic (uses flat-earth approx in tests)
        '^geographiclib-geodesic$': '<rootDir>/__mocks__/geographiclib-geodesic.js',
        // Stub heavy Oracle driver
        '^oracledb$': '<rootDir>/__mocks__/oracledb.js',
    },
    testMatch: ['**/__tests__/**/*.test.js'],
    collectCoverageFrom: [
        'lib/**/*.js',
        '!lib/db.js',
        '!lib/jobs/**',
    ],
    coverageReporters: ['text', 'lcov'],
};

export default config;


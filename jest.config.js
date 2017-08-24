module.exports = {
  "collectCoverageFrom": [
    "src/**/*",
    "!**/__tests__/**"
  ],
  "coverageReporters": ['text', 'text-summary'],
  "coverageThreshold": {
    "global": { lines: 30 }
  },
  "moduleFileExtensions": ["ts", "tsx", "js"],
  "transform": { ".(ts|tsx)": "<rootDir>/node_modules/ts-jest/preprocessor.js" },
  "testRegex": "(\\.(test|spec))\\.(ts|tsx|js)$",
  "testPathIgnorePatterns": [
    "dist",
    "/node_modules/"
  ],
  "verbose": false,
}

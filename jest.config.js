module.exports = {
  "verbose": false,
  "transform": { ".(ts|tsx)": "<rootDir>/node_modules/ts-jest/preprocessor.js" },
  "testRegex": "(\\.(test|spec))\\.(ts|tsx|js)$",
  "moduleFileExtensions": [ "ts", "tsx", "js" ],
  "testPathIgnorePatterns": [
    "dist",
    "/node_modules/"
  ]
}

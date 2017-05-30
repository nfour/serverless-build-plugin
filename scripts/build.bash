#!/bin/bash

# Clean
rm -rf dist
mkdir dist

# Copy latent files into ./dist
cp * dist 2>/dev/null || :
cp .* dist 2>/dev/null || :

# Build typescript
yarn tsc

# Copy latent files from source, recursively
cd src
find . -name "*.json" -type f -exec cp --parents {} ../dist/ \;
find . -name "*.feature" -type f -exec cp --parents {} ../dist/ \;
cd ..

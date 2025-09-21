#!/bin/bash

# Clear previous builds
rm -rf ./dist
mkdir ./dist

# Targets to build against
targets=(
    "win32-x64" # DuckDB appears to not have ia32 nor arm64 builds for Windows
    "linux-x64"
    "linux-arm64"
    "darwin-x64"
    "darwin-arm64"
)

cp -rf ./node_modules/zeromq/build ./

for p in ${targets[@]}; do
    platform=$(echo $p | cut -d "-" -f 1)
    arch=$(echo $p | cut -d "-" -f 2)
 
    # # Package extension
    npx vsce package --no-dependencies --target $platform-$arch --out ./dist --baseContentUrl https://raw.githubusercontent.com/ducklake-hq/ducklab/refs/heads/main/vs-extension/ --baseImagesUrl https://raw.githubusercontent.com/ducklake-hq/ducklab/refs/heads/main/vs-extension/
    files=(dist/*.vsix)

    unzip "${files[0]}" -d dist/extracted/
    mkdir -p dist/extracted/extension/node_modules/@duckdb/node-bindings-$platform-$arch
    cp -rL node_modules/@duckdb/node-bindings-$platform-$arch dist/extracted/extension/node_modules/@duckdb/
    # rm ${files[0]}
    cd dist/extracted/
    zip -r "../../${files[0]}" ./
    cd ../../
    # zip -ur "${files[0]}" extension/ node_modules/@duckdb/node-bindings/
    rm -r dist/extracted/

done

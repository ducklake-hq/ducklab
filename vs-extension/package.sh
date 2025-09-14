#!/bin/bash

# Clear previous builds
# rm -rf ./dist
# mkdir ./dist

# Targets to build against
targets=(
    "win32-x64" # DuckDB appears to not have ia32 nor arm64 builds for Windows
    # "linux-x64"
    # "linux-arm64"
    # "darwin-x64"
    # "darwin-arm64"
)

cp -rf ./node_modules/zeromq/build ./
# mkdir -p ./@duckdb

for p in ${targets[@]}; do
    platform=$(echo $p | cut -d "-" -f 1)
    arch=$(echo $p | cut -d "-" -f 2)

    # rm -rf ./@duckdb/node-bindings-*
    # cp -rf ./node_modules/@duckdb/node-bindings-$platform-$arch/ ./@duckdb/

    # fail if exit code not zero
    # if [ $? -ne 0 ]; then
    #     echo "npm pack failed for @duckdb/node-bindings-$platform-$arch"
    #     exit 1
    # fi

    # mkdir -p ./@duckdb/node-bindings-$platform-$arch/
    # tgz_files=(duckdb-node-bindings-$platform-$arch*.tgz)
    # echo "${tgz_files[0]}"
    # tar -xzf "${tgz_files[0]}" -C ./@duckdb/node-bindings-$platform-$arch/ --strip-components=1
    
    # # Package extension
    # npx vsce package --no-dependencies --target $platform-$arch --out ./dist --baseContentUrl https://raw.githubusercontent.com/ducklake-hq/ducklab/refs/heads/main/vs-extension/ --baseImagesUrl https://raw.githubusercontent.com/ducklake-hq/ducklab/refs/heads/main/vs-extension/
    files=(dist/*.vsix)

    unzip "${files[0]}" -d dist/extracted/
    mkdir -p dist/extracted/extension/node_modules/@duckdb/node-bindings-$platform-$arch
    cp -rL node_modules/@duckdb/node-bindings-$platform-$arch dist/extracted/extension/node_modules/@duckdb/
    # rm ${files[0]}
    cd dist/extracted/
    zip -r "../../${files[0]}" ./
    cd ../../
    # zip -ur "${files[0]}" extension/ node_modules/@duckdb/node-bindings/
    # rm -r dist/extracted/

done

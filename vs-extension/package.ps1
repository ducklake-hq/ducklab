$ErrorActionPreference = "Stop"

# Clear previous builds

Remove-Item -Recurse -Force ./dist
mkdir dist

Copy-Item -Force -Recurse ./node_modules/zeromq/build ./

# Targets to build against
$targets = @(
    "win32-x64"
    # "linux-x64",
    # "linux-arm64",
    # "darwin-x64",
    # "darwin-arm64"
)

try {
    foreach ($p in $targets) {
        $platform = ($p -split "-")[0]
        $arch = ($p -split "-")[1]
    
        pnpm install @duckdb/node-bindings-$platform-$arch

        if ($LASTEXITCODE -ne 0) {
            throw "pnpm install failed for @duckdb/node-bindings-$platform-$arch"
        }

        # Download the right DuckDB binary for this target
        # npx node-pre-gyp install --directory ./node_modules/duckdb --target_platform=$platform --target_arch=$arch --update-binary

        # New-Item -Force -ItemType Directory ./lib/binding
        # Copy-Item -Force -Recurse ./node_modules/duckdb/lib/binding/duckdb.node ./lib/binding/
        # Package extension
        npx vsce package --no-dependencies --target $platform-$arch --out ./dist --baseContentUrl https://raw.githubusercontent.com/ducklake-hq/ducklab/refs/heads/main/vs-extension/ --baseImagesUrl https://raw.githubusercontent.com/ducklake-hq/ducklab/refs/heads/main/vs-extension/
    }
}
catch {
    Write-Error $Error[0]
    exit 1
}

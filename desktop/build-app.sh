#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/release/Bot Mind Map.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

cp "$ROOT_DIR/desktop/Info.plist" "$CONTENTS_DIR/Info.plist"
cp "$ROOT_DIR/dist-mcp/index.html" "$RESOURCES_DIR/index.html"

swiftc \
  -O \
  -module-cache-path /tmp/swift-module-cache \
  -framework Cocoa \
  -framework WebKit \
  "$ROOT_DIR/desktop/main.swift" \
  -o "$MACOS_DIR/BotMindMap"

codesign --force --deep --sign - "$APP_DIR" >/dev/null 2>&1 || true

echo "Built standalone macOS app: $APP_DIR"
du -sh "$APP_DIR"

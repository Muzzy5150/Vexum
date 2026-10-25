#!/usr/bin/env sh
set -eu
VEXUM_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET_DIR="${VEXUM_BIN_DIR:-$HOME/.local/bin}"
TARGET="$TARGET_DIR/vexum"
SOURCE="$VEXUM_ROOT/vexum"
if [ ! -f "$VEXUM_ROOT/dist/vexum.js" ]; then
  echo 'Build first: npm ci --ignore-scripts && npm run build' >&2
  exit 1
fi
mkdir -p "$TARGET_DIR"
if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  if [ "$(readlink "$TARGET" 2>/dev/null || true)" != "$SOURCE" ]; then
    echo "A different vexum command already exists at $TARGET" >&2
    exit 1
  fi
fi
chmod +x "$SOURCE"
ln -sf "$SOURCE" "$TARGET"
echo "Installed $TARGET -> $SOURCE"
echo "Add $TARGET_DIR to PATH if it is not already present."

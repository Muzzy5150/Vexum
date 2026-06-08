#!/usr/bin/env sh

set -eu

VEXUM_ROOT="/Users/muzzy5150/Downloads/VEXUM"
TARGET_DIR="$HOME/.local/bin"
TARGET="$TARGET_DIR/vexum"
SOURCE="$VEXUM_ROOT/vexum"

mkdir -p "$TARGET_DIR"

if [ -e "$TARGET" ] && [ "$(readlink "$TARGET" 2>/dev/null || true)" != "$SOURCE" ]; then
  echo "A different vexum command already exists at $TARGET" >&2
  echo "Remove it first if you want this project to own that command." >&2
  exit 1
fi

ln -sf "$SOURCE" "$TARGET"

echo "Installed vexum command:"
echo "  $TARGET -> $SOURCE"
echo ""
echo "Open a new terminal, then run:"
echo "  vexum"

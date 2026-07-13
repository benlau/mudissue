#!/bin/sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
DEVCONTAINER_DIR=$(dirname "$SCRIPT_DIR")
OUT="$DEVCONTAINER_DIR/.env"
ROOT="${1:-.}"

mkdir -p "$DEVCONTAINER_DIR"

if ! cd "$ROOT" 2>/dev/null; then
  printf 'PRIMARY_WORKTREE=%s\n' "$ROOT" > "$OUT"
  exit 0
fi

ABS=$(pwd)

if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'PRIMARY_WORKTREE=%s\n' "$ABS" > "$OUT"
  exit 0
fi

COMMON=$(git rev-parse --git-common-dir)
case "$COMMON" in
/*) ;;
*) COMMON="$ABS/$COMMON" ;;
esac

PRIMARY=$(dirname "$COMMON")
printf 'PRIMARY_WORKTREE=%s\n' "$PRIMARY" > "$OUT"

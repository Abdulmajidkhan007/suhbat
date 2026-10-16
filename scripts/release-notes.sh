#!/usr/bin/env bash
# CHANGELOG.md dagi `## vX.Y.Z` bo'limini chiqaradi (release matni). Bo'lim yo'q yoki bo'sh
# bo'lsa xato bilan tugaydi — release matnsiz chiqmasin (v0.2.0 da shunday bo'lgan).
#   scripts/release-notes.sh v0.2.0 [CHANGELOG.md]
set -euo pipefail

tag="${1-}"
file="${2:-CHANGELOG.md}"
[ -n "$tag" ] || { echo "::error::Teg berilmagan"; exit 1; }
[ -f "$file" ] || { echo "::error::$file topilmadi"; exit 1; }

# Bo'lim sarlavhasi `## v0.2.0` yoki `## v0.2.0 (2026-10-14)`; keyingi `## ` gacha.
notes="$(awk -v tag="$tag" '/^## / { on = ($2 == tag); next } on' "$file")"
if [ -z "$(printf '%s' "$notes" | tr -d '[:space:]')" ]; then
  echo "::error::$file da '## $tag' bo'limi yo'q yoki bo'sh — release matni shu yerdan olinadi."
  exit 1
fi
printf '%s\n' "$notes"

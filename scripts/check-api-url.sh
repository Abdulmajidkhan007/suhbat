#!/usr/bin/env bash
# API manzilini release build'dan oldin tekshiradi (release.yml). Ilovalar shu manzilni
# build vaqtida qotiradi, shuning uchun xato qiymat ("api.example.uz", https:// siz)
# telefonda "Tarmoq xatosi" bo'lib chiqadi — undan ko'ra build aniq xato bilan yiqilsin.
#   scripts/check-api-url.sh "<qiymat>" [o'zgaruvchi nomi] [https-only]
# `https-only` — Android release uchun: u yerda cleartext HTTP o'chiq, http:// ishlamaydi.
set -euo pipefail

value="${1-}"
name="${2:-SUHBAT_API_URL}"
mode="${3-}"

fail() {
  echo "::error::$name: $1"
  exit 1
}

[ -n "$value" ] || fail "repo o'zgaruvchisi o'rnatilmagan (Settings → Secrets and variables → Actions → Variables). Ilova API manzilisiz ishlamaydi."
[ "$value" = "$(printf '%s' "$value" | tr -d '[:space:]')" ] || fail "qiymatda bo'sh joy yoki yangi qator bor: '$value'"
[[ "$value" =~ ^https?:// ]] || fail "'$value' — https:// bilan boshlanishi kerak (masalan https://$value)"
[[ "$value" =~ ^https?://[^/?#]+ ]] || fail "'$value' — https:// dan keyin host yo'q"
if ! [[ "$value" =~ ^https:// ]]; then
  [ "$mode" != "https-only" ] || fail "'$value' — https:// bilan boshlanishi kerak (Android release'da shifrlanmagan http:// taqiqlangan)"
  echo "::warning::$name http:// (shifrlanmagan) — https:// ishlating."
fi
echo "$name = $value"

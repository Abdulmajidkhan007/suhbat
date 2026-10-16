#!/usr/bin/env bash
# Release tegidan (v0.2.0) ilovalar versiyasini o'rnatadi (release.yml). Aks holda desktop
# fayl nomi va "Suhbat v…" yozuvi package.json dagi eski qiymatda qolardi (v0.2.0 da 0.1.0 chiqqan).
#   scripts/release-version.sh v0.2.0
set -euo pipefail

tag="${1-}"
[[ "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?)$ ]] || {
  echo "::error::Teg nomi noto'g'ri: '$tag' (kutilgan ko'rinish: v0.2.0)"
  exit 1
}
version="${BASH_REMATCH[1]}"
# `npm pkg set` bo'sh `dependencies: {}` ni o'chirib yuboradi — faqat `version` ni o'zgartiramiz.
for dir in apps/web apps/desktop apps/mobile; do
  node -e '
    const fs = require("fs");
    const [file, version] = process.argv.slice(1);
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.version = version;
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  ' "$dir/package.json" "$version"
done
echo "Versiya: $version (web, desktop, mobile)"

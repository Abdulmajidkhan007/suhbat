#!/usr/bin/env bash
# Release APK'ni tekshiradi (mobile.yml, release.yml):
# - JS bundle ichida; - brend ikonkasi (adaptive + eski) APK'da; - cleartext HTTP o'chiq.
#   scripts/verify-apk.sh <apk>
set -euo pipefail

apk="$1"
test -f "$apk"
build_tools="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)"
aapt2="${build_tools}aapt2"

unzip -l "$apk" | grep assets/index.android.bundle >/dev/null || { echo "::error::$apk: JS bundle yo'q"; exit 1; }

"$aapt2" dump badging "$apk" | grep -E "^(package|application):|application-icon" || true

# Shablondagi yashil robotda adaptive qatlamlar yo'q edi: brend ikonkasi shu resurslar bilan keladi.
resources="$("$aapt2" dump resources "$apk")"
resource_block() { echo "$resources" | awk -v r="mipmap/$1" '$1 == "resource" { on = ($3 == r) } on'; }
for name in ic_launcher ic_launcher_round; do
  resource_block "$name" | grep "anydpi-v26" >/dev/null || { echo "::error::$apk: mipmap/$name adaptive (anydpi-v26) emas"; exit 1; }
done
for name in ic_launcher_foreground ic_launcher_background; do
  resource_block "$name" | grep "xxxhdpi" >/dev/null || { echo "::error::$apk: mipmap/$name yo'q"; exit 1; }
done
resource_block ic_launcher

manifest="$("$aapt2" dump xmltree --file AndroidManifest.xml "$apk")"
echo "$manifest" | grep usesCleartextTraffic || true
echo "$manifest" | grep -E "usesCleartextTraffic.*=(false|\(type 0x12\)0x0)" >/dev/null \
  || { echo "::error::$apk: release'da usesCleartextTraffic=false bo'lishi kerak"; exit 1; }

echo "APK tekshiruvi o'tdi: $apk"

#!/usr/bin/env python3
"""Mobil ikonkalar (apps/mobile/src/components/icon/icons.ts) — Ionicons (MIT) SVG'laridan.

Ishlatish (ionicons paketini vaqtinchalik papkaga oching, repoga qo'shilmaydi):
    cd "$(mktemp -d)" && npm pack ionicons@8 && tar xzf ionicons-*.tgz
    python3 scripts/gen-mobile-icons.py "$PWD/package/dist/svg"
Yangi ikonka kerak bo'lsa NAMES ga qo'shing va qayta ishga tushiring.
"""
import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

NAMES = """
add alert-circle arrow-undo-outline call call-outline camera-reverse-outline chatbubbles chatbubbles-outline
checkmark checkmark-circle checkmark-done chevron-back chevron-forward close cloud-offline-outline
color-palette-outline copy-outline create-outline document-outline ellipse-outline exit-outline
globe-outline image-outline information-circle-outline lock-closed-outline log-out-outline megaphone-outline
mic-off-outline mic-outline moon-outline notifications-outline pencil people-outline person-add-outline
person-outline phone-portrait-outline remove-circle-outline search send settings settings-outline
shield-checkmark-outline star sunny-outline time-outline trash-outline videocam videocam-off-outline
videocam-outline
""".split()

NUMERIC = {"cx", "cy", "r", "x", "y", "width", "height", "rx", "ry", "strokeWidth"}
OUT = pathlib.Path(__file__).resolve().parent.parent / "apps/mobile/src/components/icon/icons.ts"


def camel(key: str) -> str:
    return re.sub(r"-(\w)", lambda m: m.group(1).upper(), key)


def elements(svg: pathlib.Path) -> list:
    result = []
    for el in ET.parse(svg).getroot().iter():
        tag = el.tag.split("}")[1]
        if tag == "svg":
            continue
        if tag not in ("path", "circle", "rect"):
            sys.exit(f"{svg.name}: qo'llab-quvvatlanmagan element <{tag}>")
        attrs = {}
        for key, value in el.attrib.items():
            if key == "class":
                continue
            key = camel(key)
            if key in NUMERIC:
                value = float(value.replace("px", ""))
                value = int(value) if value.is_integer() else value
            elif value == "currentColor":
                value = "c"
            attrs[key] = value
        result.append([tag, attrs])
    return result


def main() -> None:
    src = pathlib.Path(sys.argv[1])
    lines = [
        "// Avtomatik yaratilgan (scripts/gen-mobile-icons.py) — Ionicons 8 SVG'laridan,",
        "// MIT litsenziyasi, (c) Ionic, https://ionic.io/ionicons. Qo'lda tahrirlamang.",
        "// `fill`/`stroke` = 'c' — joriy rang (currentColor). viewBox: 0 0 512 512.",
        "",
        "interface Paint { fill?: string; stroke?: string; strokeWidth?: number; strokeLinecap?: string; strokeLinejoin?: string; strokeMiterlimit?: string }",
        "export type IconElement =",
        "  | readonly ['path', Paint & { d: string }]",
        "  | readonly ['circle', Paint & { cx: number; cy: number; r: number }]",
        "  | readonly ['rect', Paint & { x: number; y: number; width: number; height: number; rx?: number; ry?: number }];",
        "",
        "export const ICONS = {",
    ]
    for name in NAMES:
        data = json.dumps(elements(src / f"{name}.svg"), separators=(",", ":"), ensure_ascii=False)
        lines.append(f"  '{name}': {data},")
    lines += [
        "} as const satisfies Record<string, readonly IconElement[]>;",
        "",
        "export type IconName = keyof typeof ICONS;",
        "",
    ]
    OUT.write_text("\n".join(lines))
    print(f"{OUT}: {len(NAMES)} ta ikonka")


if __name__ == "__main__":
    main()

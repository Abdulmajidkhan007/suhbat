import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ICONS } from './icons';
import type { IconElement, IconName } from './icons';

export type { IconName } from './icons';

interface Props {
  name:   IconName;
  size?:  number;
  color:  string;
}

const paint = (value: string | undefined, color: string) => (value === 'c' ? color : value);

const renderElement = ([tag, attrs]: IconElement, color: string, key: number) => {
  const common = {
    fill:   paint(attrs.fill, color) ?? color,
    stroke: paint(attrs.stroke, color),
    strokeWidth:    attrs.strokeWidth,
    strokeLinecap:  attrs.strokeLinecap as 'round' | 'butt' | 'square' | undefined,
    strokeLinejoin: attrs.strokeLinejoin as 'round' | 'miter' | 'bevel' | undefined,
    strokeMiterlimit: attrs.strokeMiterlimit ? Number(attrs.strokeMiterlimit) : undefined,
  };
  switch (tag) {
    case 'path':   return <Path key={key} {...common} d={attrs.d} />;
    case 'circle': return <Circle key={key} {...common} cx={attrs.cx} cy={attrs.cy} r={attrs.r} />;
    case 'rect':   return <Rect key={key} {...common} x={attrs.x} y={attrs.y} width={attrs.width} height={attrs.height} rx={attrs.rx} ry={attrs.ry} />;
  }
};

/** Vektor ikonka (Ionicons yo'llari, `react-native-svg`). Dekorativ — matnli label tugmada beriladi. */
export const Icon = memo(({ name, size = 24, color }: Props) => (
  <Svg width={size} height={size} viewBox="0 0 512 512" accessible={false} importantForAccessibility="no-hide-descendants">
    {(ICONS[name] as readonly IconElement[]).map((el, i) => renderElement(el, color, i))}
  </Svg>
));

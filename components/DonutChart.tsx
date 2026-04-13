import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

export interface DonutSegment {
  value: number;
  color: string;
}

interface Props {
  data: DonutSegment[];
  size: number;
  innerRadius?: number;        // 0 = full pie, >0 = donut ring
  centerLabel?: string;
  centerSubLabel?: string;
  centerLabelColor?: string;
  centerSubLabelColor?: string;
  emptyColor?: string;
  backgroundColor?: string;    // matches card bg — fills the inner hole
  gap?: number;                // degrees of gap between segments
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  start: number, end: number
): string {
  const delta = end - start;
  const large = delta > 180 ? 1 : 0;
  const os = polar(cx, cy, outerR, start);
  const oe = polar(cx, cy, outerR, end);

  if (innerR <= 0) {
    // Pie slice from center
    return `M${cx},${cy} L${os.x},${os.y} A${outerR},${outerR},0,${large},1,${oe.x},${oe.y} Z`;
  }

  // Donut segment
  const ie = polar(cx, cy, innerR, end);
  const is_ = polar(cx, cy, innerR, start);
  return (
    `M${os.x},${os.y}` +
    ` A${outerR},${outerR},0,${large},1,${oe.x},${oe.y}` +
    ` L${ie.x},${ie.y}` +
    ` A${innerR},${innerR},0,${large},0,${is_.x},${is_.y}` +
    ` Z`
  );
}

export default function DonutChart({
  data,
  size,
  innerRadius = 0,
  centerLabel,
  centerSubLabel,
  centerLabelColor = '#FFFFFF',
  centerSubLabelColor = '#888888',
  emptyColor = '#2A2A2A',
  backgroundColor = '#1C1C1C',
  gap = 2,
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - 4) / 2;
  const innerR = innerRadius;

  const total = data.reduce((s, d) => s + d.value, 0);
  const active = data.filter((d) => d.value > 0);

  let chartContent: React.ReactNode;

  if (total === 0 || active.length === 0) {
    chartContent = (
      <>
        <Circle cx={cx} cy={cy} r={outerR} fill={emptyColor} />
        {innerR > 0 && <Circle cx={cx} cy={cy} r={innerR} fill={backgroundColor} />}
      </>
    );
  } else if (active.length === 1) {
    chartContent = (
      <>
        <Circle cx={cx} cy={cy} r={outerR} fill={active[0].color} />
        {innerR > 0 && <Circle cx={cx} cy={cy} r={innerR} fill={backgroundColor} />}
      </>
    );
  } else {
    const gapDeg = gap;
    const paths: React.ReactNode[] = [];
    let currentAngle = 0;

    data.forEach((seg, i) => {
      if (seg.value <= 0) return;
      const angle = (seg.value / total) * 360;
      const start = currentAngle + gapDeg / 2;
      const end = currentAngle + angle - gapDeg / 2;
      if (end > start + 0.1) {
        paths.push(
          <Path key={i} d={arcPath(cx, cy, outerR, innerR, start, end)} fill={seg.color} />
        );
      }
      currentAngle += angle;
    });
    chartContent = <>{paths}</>;
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {chartContent}
      </Svg>
      {(centerLabel || centerSubLabel) && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          {centerLabel && (
            <Text
              style={{
                fontSize: Math.round(size * 0.18),
                fontWeight: 'bold',
                color: centerLabelColor,
                textAlign: 'center',
              }}
            >
              {centerLabel}
            </Text>
          )}
          {centerSubLabel && (
            <Text
              style={{
                fontSize: Math.round(size * 0.1),
                color: centerSubLabelColor,
                textAlign: 'center',
                marginTop: 2,
              }}
            >
              {centerSubLabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

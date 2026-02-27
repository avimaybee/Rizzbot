import React from 'react';
import { UserStyleProfile } from '../types';

interface StyleRadarProps {
  profile: UserStyleProfile;
  className?: string;
  size?: number;
}

export const StyleRadar: React.FC<StyleRadarProps> = ({ profile, className, size = 300 }) => {
  const axes = [
    { label: 'SLANG', key: 'slangLevel', map: { 'formal': 0, 'casual': 50, 'heavy-slang': 100 } },
    { label: 'EMOJI', key: 'emojiUsage', map: { 'none': 0, 'minimal': 33, 'moderate': 66, 'heavy': 100 } },
    { label: 'WARMTH', key: 'preferredTone', map: { 'direct': 0, 'chill': 33, 'sweet': 66, 'playful': 100 } },
    { label: 'PUNCT', key: 'punctuation', map: { 'none': 0, 'minimal': 50, 'full': 100 } },
    { label: 'VOLUME', key: 'averageLength', map: { 'short': 20, 'medium': 60, 'long': 100 } },
  ];

  const center = 100;
  const radius = 80;
  
  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const points = axes.map((axis, i) => {
    // @ts-ignore
    const val = profile[axis.key as keyof UserStyleProfile];
    // @ts-ignore
    const value = axis.map[val as string] ?? 50;
    const { x, y } = getCoordinates(i, value);
    return `${x},${y}`;
  }).join(' ');

  const gridLevels = [25, 50, 75, 100];

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="-20 -20 240 240" className="w-full h-full overflow-visible">
        {/* Background Grid */}
        {gridLevels.map((level) => {
          const gridPoints = axes.map((_, i) => {
            const { x, y } = getCoordinates(i, level);
            return `${x},${y}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={gridPoints}
              fill="none"
              stroke="#27272a"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Axis Lines */}
        {axes.map((_, i) => {
          const { x, y } = getCoordinates(i, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#27272a"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Data Polygon */}
        <polygon
          points={points}
          fill="rgba(251, 191, 36, 0.15)"
          stroke="#fbbf24"
          strokeWidth="1.5"
          className="transition-all duration-700 ease-out"
        />

        {/* Data Points */}
        {axes.map((axis, i) => {
          // @ts-ignore
          const val = profile[axis.key as keyof UserStyleProfile];
          // @ts-ignore
          const value = axis.map[val as string] ?? 50;
          const { x, y } = getCoordinates(i, value);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="2"
              fill="#fbbf24"
              className="transition-all duration-700 ease-out"
            />
          );
        })}

        {/* Labels */}
        {axes.map((axis, i) => {
          const { x, y } = getCoordinates(i, 115);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              fill="#71717a"
              fontSize="8"
              fontFamily="monospace"
              className="uppercase tracking-tighter select-none"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

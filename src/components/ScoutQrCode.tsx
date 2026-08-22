import React, { useMemo } from 'react';
import { createQrMatrix } from '../utils/qrCode';

interface ScoutQrCodeProps {
  value: string;
  label?: string;
  size?: number;
}

export const ScoutQrCode: React.FC<ScoutQrCodeProps> = ({ value, label = 'IXMetrics profile QR code', size = 232 }) => {
  const matrix = useMemo(() => createQrMatrix(value), [value]);
  const quietZone = 4;
  const viewSize = matrix.length + quietZone * 2;
  const path = useMemo(() => {
    const commands: string[] = [];
    matrix.forEach((row, y) => row.forEach((dark, x) => {
      if (dark) commands.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
    }));
    return commands.join('');
  }, [matrix]);

  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${viewSize} ${viewSize}`} shapeRendering="crispEdges" className="block rounded-2xl bg-white">
      <rect width={viewSize} height={viewSize} fill="#fff" />
      <path d={path} fill="#07101f" />
    </svg>
  );
};


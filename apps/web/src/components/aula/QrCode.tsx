import qrcode from 'qrcode-generator';
import type { JSX } from 'react';

/** Light modules around the code, as the QR standard asks for the phone camera to find it. */
const QUIET_ZONE = 4;

/** `text` as a QR code, dark on white in every theme so any phone camera can read it. */
export function QrCode({ text, label }: { text: string; label: string }): JSX.Element {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row += 1)
    for (let col = 0; col < count; col += 1)
      if (qr.isDark(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
  const size = count + 2 * QUIET_ZONE;
  return (
    <svg
      role="img"
      aria-label={label}
      data-testid="aula-qr"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="aspect-square w-full max-w-64 rounded-md bg-white"
    >
      <path d={path} className="fill-black" />
    </svg>
  );
}

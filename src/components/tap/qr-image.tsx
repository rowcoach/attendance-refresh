import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 200 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: "#111111", light: "#ffffff" } })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) return <div className="rounded-lg bg-muted" style={{ width: size, height: size }} />;
  return <img src={src} width={size} height={size} alt="QR code" className="rounded-lg" />;
}
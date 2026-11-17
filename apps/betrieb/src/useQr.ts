import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR code as a data URL for the given address (null while it is being made, error text if it fails). */
export function useQr(url: string | null) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    QRCode.toDataURL(url, { width: 900, margin: 1, errorCorrectionLevel: "M" }).then(
      (d) => alive && setQr(d),
      () => alive && setQrError("Der QR Code konnte nicht erstellt werden.")
    );
    return () => {
      alive = false;
    };
  }, [url]);
  return { qr, qrError };
}

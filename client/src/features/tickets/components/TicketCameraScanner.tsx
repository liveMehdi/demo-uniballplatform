import { useRef } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";

type Props = {
  onDetected: (token: string) => void;
  onFailure: (message: string) => void;
};

export default function TicketCameraScanner({ onDetected, onFailure }: Props) {
  const handled = useRef(false);

  return (
    <div className="my-4 max-w-[440px]">
      <Scanner
        formats={["qr_code"]}
        constraints={{
          facingMode: { ideal: "environment" },
        }}
        sound={false}
        onScan={(codes) => {
          if (handled.current || codes.length === 0) return;

          handled.current = true;

          if (codes.length !== 1) {
            onFailure("Show only one ticket QR code at a time.");
            return;
          }

          const value = codes[0]?.rawValue.trim();

          if (!value || !/^[a-f0-9]{64}$/.test(value)) {
            onFailure("This QR code is not a valid ticket code.");
            return;
          }

          onDetected(value);
        }}
        onError={() => {
          if (handled.current) return;

          handled.current = true;

          onFailure(
            "Could not use the camera. Check camera permission and whether another app is using it, or enter the ticket code manually.",
          );
        }}
      />
    </div>
  );
}

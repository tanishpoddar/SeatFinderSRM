import { QrScanner } from "@/components/qr-scanner";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: 'QR Scanner',
  description: 'Scan QR codes to check in and check out of your library seat bookings. Quick and contactless seat verification.',
  keywords: ['QR scanner', 'check-in', 'check-out', 'seat verification'],
});

export default function ScannerPage() {
  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in-50 duration-500">
      <QrScanner />
    </div>
  );
}

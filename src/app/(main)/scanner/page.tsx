import { QrScanner } from "@/components/qr-scanner";

export default function ScannerPage() {
  return (
    <div className="container mx-auto animate-in fade-in-50 duration-500">
      <h1 className="text-3xl font-bold mb-6 font-headline">QR Code Scanner</h1>
      <QrScanner />
    </div>
  );
}

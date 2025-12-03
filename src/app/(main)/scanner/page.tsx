import { QrScanner } from "@/components/qr-scanner";

export default function ScannerPage() {
  return (
    <div className="w-full max-w-4xl mx-auto animate-in fade-in-50 duration-500">
      <QrScanner />
    </div>
  );
}

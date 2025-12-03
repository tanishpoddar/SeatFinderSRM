"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { ref, update, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LogIn, LogOut, Camera, CameraOff, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScanMode = 'entry' | 'exit';

export function QrScanner() {
  const [mode, setMode] = useState<ScanMode>('entry');
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScan, setLastScan] = useState<string>('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processQRCode = useCallback(async (decodedText: string) => {
    // Prevent duplicate scans
    if (decodedText === lastScan || isProcessing) {
      return;
    }

    setLastScan(decodedText);
    setIsProcessing(true);

    try {
      const { bookingId, userId, seatId } = JSON.parse(decodedText);

      if (!bookingId || !userId || !seatId) {
        throw new Error("Invalid QR Code");
      }
      
      const floor = seatId.charAt(0).toLowerCase() === 'g' ? 'ground' : 
                    seatId.charAt(0).toLowerCase() === 'f' ? 'first' : 
                    seatId.charAt(0).toLowerCase() === 's' ? 'second' : 'third';
      const seatRefPath = `seats/${floor}/${seatId}`;
      const bookingRefPath = `bookings/${userId}/${bookingId}`;

      const updates: { [key: string]: any } = {};
      const now = new Date();

      if (mode === 'entry') {
        const bookingRef = ref(db, bookingRefPath);
        const bookingSnapshot = await get(bookingRef);
        
        if (!bookingSnapshot.exists()) {
          throw new Error("Booking not found.");
        }
        
        const bookingData = bookingSnapshot.val();

        if (bookingData.status !== 'booked') {
          throw new Error(`Cannot check in. Booking is ${bookingData.status}.`);
        }

        const duration = bookingData.duration;
        if (!duration) {
          throw new Error("Invalid booking duration.");
        }
        
        const expiryTimestamp = now.getTime() + duration * 60 * 1000;

        updates[`${seatRefPath}/status`] = 'occupied';
        updates[`${seatRefPath}/occupiedUntil`] = expiryTimestamp;
        updates[`${bookingRefPath}/status`] = 'occupied';
        updates[`${bookingRefPath}/entryTime`] = now.toISOString();

        await update(ref(db), updates);

        toast({ 
          title: '✅ Check-in Successful', 
          description: `Seat ${seatId} occupied until ${new Date(expiryTimestamp).toLocaleTimeString()}.`,
          duration: 3000,
        });

      } else {
        updates[`${seatRefPath}/status`] = 'available';
        updates[`${seatRefPath}/bookedBy`] = null;
        updates[`${seatRefPath}/bookedAt`] = null;
        updates[`${seatRefPath}/bookingId`] = null;
        updates[`${seatRefPath}/occupiedUntil`] = null;
        updates[`${bookingRefPath}/status`] = 'completed';
        updates[`${bookingRefPath}/exitTime`] = now.toISOString();

        await update(ref(db), updates);

        toast({ 
          title: '✅ Check-out Successful', 
          description: `Seat ${seatId} is now available.`,
          duration: 3000,
        });
      }

      // Clear last scan after 3 seconds to allow re-scanning
      setTimeout(() => setLastScan(''), 3000);

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: error.message || 'Failed to process QR code.',
        duration: 4000,
      });
      setLastScan('');
    } finally {
      setIsProcessing(false);
    }
  }, [mode, toast, lastScan, isProcessing]);

  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          processQRCode(decodedText);
        },
        () => {
          // Ignore scan failures (too noisy)
        }
      );

      setIsScanning(true);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Camera Error',
        description: 'Failed to start camera. Please check permissions.',
      });
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
        setLastScan('');
      } catch (error) {
        console.error("Failed to stop scanner:", error);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const scanner = new Html5Qrcode('qr-file-reader');
      const decodedText = await scanner.scanFile(file, true);
      await processQRCode(decodedText);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: 'Could not read QR code from image. Please try again.',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">QR Scanner</CardTitle>
            <CardDescription>
              Scan student QR codes for library access
            </CardDescription>
          </div>
          <Badge variant={mode === 'entry' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
            {mode === 'entry' ? 'Entry Mode' : 'Exit Mode'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={mode === 'entry' ? 'default' : 'outline'}
            onClick={() => setMode('entry')}
            disabled={isScanning}
            className="h-12"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Entry
          </Button>
          <Button
            variant={mode === 'exit' ? 'default' : 'outline'}
            onClick={() => setMode('exit')}
            disabled={isScanning}
            className="h-12"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Exit
          </Button>
        </div>

        {/* Scanner Area */}
        <div className={cn(
          "relative rounded-lg border-2 border-dashed overflow-hidden",
          isScanning ? "border-primary bg-black" : "border-muted-foreground/25"
        )}>
          <div 
            id="qr-reader" 
            className={cn(
              "w-full",
              !isScanning && "hidden"
            )}
            style={{
              border: 'none',
            }}
          ></div>
          
          {!isScanning && (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-muted/30">
              <Camera className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground text-center mb-4">
                Click the button below to start scanning
              </p>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Processing...</p>
              </div>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={isScanning ? stopScanning : startScanning}
            variant={isScanning ? 'destructive' : 'default'}
            size="lg"
            className="w-full"
            disabled={isProcessing}
          >
            {isScanning ? (
              <>
                <CameraOff className="mr-2 h-5 w-5" />
                Stop Camera
              </>
            ) : (
              <>
                <Camera className="mr-2 h-5 w-5" />
                Start Camera
              </>
            )}
          </Button>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="lg"
            className="w-full"
            disabled={isProcessing || isScanning}
          >
            <Upload className="mr-2 h-5 w-5" />
            Upload Image
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        
        {/* Hidden div for file scanning */}
        <div id="qr-file-reader" className="hidden"></div>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Select Entry or Exit mode</li>
            <li>Use camera to scan live OR upload QR image</li>
            <li>Wait for automatic processing</li>
            <li>Check the notification for status</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

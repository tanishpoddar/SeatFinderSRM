
"use client";

import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, LogIn, LogOut } from 'lucide-react';

type ScanMode = 'entry' | 'exit';

export function QrScanner() {
  const [mode, setMode] = useState<ScanMode>('entry');
  const { toast } = useToast();

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    const onScanSuccess = async (decodedText: string) => {
      try {
        const { bookingId, userId, seatId } = JSON.parse(decodedText);

        if (!bookingId || !userId || !seatId) {
          throw new Error("Invalid QR Code");
        }
        
        const floor = seatId.charAt(0).toLowerCase() === 'g' ? 'ground' : seatId.charAt(0).toLowerCase() === 'f' ? 'first' : seatId.charAt(0).toLowerCase() === 's' ? 'second' : 'third';
        const seatRefPath = `seats/${floor}/${seatId}`;
        const bookingRefPath = `bookings/${userId}/${bookingId}`;

        const updates: { [key: string]: any } = {};
        const now = new Date();

        if (mode === 'entry') {
          // Fetch booking to get duration and check status
          const bookingRef = ref(db, bookingRefPath);
          const bookingSnapshot = await get(bookingRef);
          if (!bookingSnapshot.exists()) {
              throw new Error("Booking not found.");
          }
          const bookingData = bookingSnapshot.val();

          if (bookingData.status !== 'booked') {
              throw new Error(`Cannot check in. Booking status is '${bookingData.status}'.`);
          }

          const duration = bookingData.duration; // in minutes
          if (!duration) {
              throw new Error("Booking duration not set. Cannot calculate expiry.");
          }
          const expiryTimestamp = now.getTime() + duration * 60 * 1000;

          updates[`${seatRefPath}/status`] = 'occupied';
          updates[`${seatRefPath}/occupiedUntil`] = expiryTimestamp; // Set expiry time for occupation

          updates[`${bookingRefPath}/status`] = 'occupied';
          updates[`${bookingRefPath}/entryTime`] = now.toISOString();

          toast({ title: 'Check-in successful', description: `Seat ${seatId} marked as occupied until ${new Date(expiryTimestamp).toLocaleTimeString()}.` });

        } else { // mode === 'exit'
          updates[`${seatRefPath}/status`] = 'available';
          updates[`${seatRefPath}/bookedBy`] = null;
          updates[`${seatRefPath}/bookedAt`] = null;
          updates[`${seatRefPath}/bookingId`] = null;
          updates[`${seatRefPath}/occupiedUntil`] = null; // Clear expiry time

          updates[`${bookingRefPath}/status`] = 'completed';
          updates[`${bookingRefPath}/exitTime`] = now.toISOString();
          toast({ title: 'Check-out successful', description: `Seat ${seatId} is now available.` });
        }

        await update(ref(db), updates);

        if (scanner) {
          scanner.pause(true);
          setTimeout(() => scanner?.resume(), 3000);
        }

      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Scan Error',
          description: error.message || 'Failed to process QR code.',
        });
      }
    };

    const onScanFailure = (error: any) => {
      // console.warn(`QR error = ${error}`);
    };

    scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
       if (scanner) {
         scanner.clear().catch(error => {
            console.error("Failed to clear html5QrcodeScanner.", error);
        });
       }
    };
  }, [mode, toast]);


  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Library Access Scanner</CardTitle>
        <CardDescription>
          Select the mode (Entry or Exit) and scan the user's QR code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="entry" onValueChange={(value) => setMode(value as ScanMode)} className="w-full mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entry">
              <LogIn className="mr-2 h-4 w-4" /> Entry Scan
            </TabsTrigger>
            <TabsTrigger value="exit">
              <LogOut className="mr-2 h-4 w-4" /> Exit Scan
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div id="qr-reader" className="w-full"></div>
      </CardContent>
    </Card>
  );
}

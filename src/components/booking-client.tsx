
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ref, onValue, update, serverTimestamp, push, off } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import type { Seat, Booking } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Armchair, ArrowLeft, Clock, Info, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function BookingClient({ seatId, activeBooking }: { seatId: string, activeBooking: Booking | null }) {
  const { user } = useAuth();
  const [seat, setSeat] = useState<Seat | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(activeBooking);
  const [countdown, setCountdown] = useState<number>(0);
  const [duration, setDuration] = useState<string>("60");
  const router = useRouter();
  const { toast } = useToast();
  
  const floor = useMemo(() => seatId.charAt(0).toLowerCase() === 'g' ? 'ground' : seatId.charAt(0).toLowerCase() === 'f' ? 'first' : seatId.charAt(0).toLowerCase() === 's' ? 'second' : 'third', [seatId]);
  const seatRef = useMemo(() => ref(db, `seats/${floor}/${seatId}`), [floor, seatId]);

  useEffect(() => {
    // When the active booking from props changes, update our internal state.
    setBooking(activeBooking);
  }, [activeBooking]);

  useEffect(() => {
    // This effect is only responsible for listening to changes for this specific seat.
    const listener = onValue(seatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSeat({id: snapshot.key, ...data});
      }
      setLoading(false);
    });

    return () => off(seatRef, 'value', listener);
  }, [seatRef]);


  // This useEffect now only handles the visual countdown timer.
  // The actual expiry logic is now centralized in MainLayout.
  useEffect(() => {
    if (!booking || booking.status !== 'booked') {
        setCountdown(0);
        return;
    };

    const calculateRemaining = () => {
        const bookingTime = new Date(booking.bookingTime).getTime();
        const now = Date.now();
        const elapsed = (now - bookingTime) / 1000;
        return Math.max(0, 150 - elapsed);
    }
    
    setCountdown(calculateRemaining());

    const timer = setInterval(() => {
        const remaining = calculateRemaining();
        setCountdown(remaining);

        if (remaining <= 0) {
            clearInterval(timer);
        }
    }, 1000);

    return () => clearInterval(timer);

  }, [booking]);


  const handleBooking = async () => {
    if (!user || !seat || seat.status !== 'available') return;
    
    if (activeBooking) {
        toast({ variant: 'destructive', title: 'Active Booking Exists', description: `You already have an active booking for seat ${activeBooking.seatId}.` });
        return;
    }

    setLoading(true);
    
    try {
      const newBookingRef = push(ref(db, `bookings/${user.uid}`));
      const newBookingData: Omit<Booking, 'id'> = {
          seatId: seatId,
          userId: user.uid,
          bookingTime: new Date().toISOString(),
          status: 'booked',
          duration: parseInt(duration)
      }

      const updates: {[key: string]: any} = {};
      updates[`/seats/${floor}/${seatId}/status`] = 'booked';
      updates[`/seats/${floor}/${seatId}/bookedBy`] = user.uid;
      updates[`/seats/${floor}/${seatId}/bookedAt`] = serverTimestamp();
      updates[`/seats/${floor}/${seatId}/bookingId`] = newBookingRef.key;
      updates[`/bookings/${user.uid}/${newBookingRef.key}`] = newBookingData;
      
      await update(ref(db), updates);

      // The activeBooking prop will update from the parent, which will trigger the state update.
      // We don't need to call setBooking here directly.
      
      toast({ title: "Seat Booked!", description: `You have 2.5 minutes to scan the QR code.` });

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Booking failed', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    const svg = document.getElementById("QRCode");
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const pngFile = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.download = `SeatFinderSRM-QR-${seatId}.png`;
          downloadLink.href = pngFile;
          downloadLink.click();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svgData);
      }
    }
  };


  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!seat) {
    return (
        <div className="container mx-auto p-4 max-w-lg text-center">
             <Button variant="ghost" onClick={() => router.push('/seats')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Seat Map
            </Button>
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">Seat Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>The seat you are looking for does not exist.</p>
                </CardContent>
            </Card>
        </div>
    );
  }
   
  if (seat.status !== 'available' && (!booking || booking.seatId !== seat.id)) {
     return (
        <div className="container mx-auto p-4 max-w-lg text-center">
            <Button variant="ghost" onClick={() => router.push('/seats')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Seat Map
            </Button>
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">Seat Unavailable</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This seat is currently {seat.status}. Please select another seat.</p>
                </CardContent>
            </Card>
        </div>
    );
  }


  return (
    <div className="container mx-auto p-4 max-w-2xl">
       <Button variant="ghost" onClick={() => router.push('/seats')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Seat Map
      </Button>
      <Card className="overflow-hidden shadow-lg border">
        <CardHeader className="p-6 bg-muted/50 border-b">
          <CardTitle className="font-headline text-3xl">
            {booking ? "Your Booking is Confirmed" : `Book Seat ${seatId}`}
          </CardTitle>
          <CardDescription>
            {booking ? "Scan this QR code at the library entrance to check in." : "Confirm your selection and booking duration to reserve this seat."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {booking && booking.status === 'booked' ? (
            <div className="text-center flex flex-col items-center gap-6">
                <div className="bg-white p-4 rounded-xl shadow-md border">
                    <QRCode id="QRCode" value={JSON.stringify({bookingId: booking.id, userId: user?.uid, seatId: seatId})} size={256} />
                </div>
                <div className="font-bold text-3xl text-destructive font-mono tracking-tighter">
                    {Math.floor(countdown / 60)}:{(Math.round(countdown) % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-muted-foreground -mt-4">Time left to check-in</p>
                 <Button onClick={downloadQRCode} size="lg" className="w-full">
                    <Download className="mr-2 h-4 w-4" /> Download QR Code
                </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                <Armchair className="h-16 w-16 text-primary" />
                <div>
                  <h3 className="font-bold text-2xl font-headline">Seat {seatId}</h3>
                  <p className="text-muted-foreground">Status: <span className="text-green-500 font-semibold capitalize">{seat.status}</span></p>
                </div>
              </div>

               <div className="space-y-2">
                 <label htmlFor="duration" className="font-medium text-sm">Booking Duration</label>
                 <Select onValueChange={setDuration} defaultValue={duration}>
                    <SelectTrigger id="duration" className="w-full text-base py-6">
                        <SelectValue placeholder="Select a duration" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="60">1 Hour</SelectItem>
                        <SelectItem value="120">2 Hours</SelectItem>
                        <SelectItem value="240">4 Hours</SelectItem>
                        <SelectItem value="480">8 Hours</SelectItem>
                    </SelectContent>
                 </Select>
               </div>
              
              <Alert variant="default" className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Heads up!</AlertTitle>
                <AlertDescription>
                  This seat will be reserved for <span className="font-bold">2.5 minutes</span> upon confirmation.
                  You must scan the QR code at the library entrance within this time, or the booking will be automatically cancelled.
                </AlertDescription>
              </Alert>

              <Button onClick={handleBooking} disabled={loading} size="lg" className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                Confirm Booking
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

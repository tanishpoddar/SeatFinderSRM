
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
  const [endTime, setEndTime] = useState<string>("");
  const router = useRouter();
  const { toast } = useToast();
  
  const floor = useMemo(() => seatId.charAt(0).toLowerCase() === 'g' ? 'ground' : seatId.charAt(0).toLowerCase() === 'f' ? 'first' : seatId.charAt(0).toLowerCase() === 's' ? 'second' : 'third', [seatId]);
  const seatRef = useMemo(() => ref(db, `seats/${floor}/${seatId}`), [floor, seatId]);

  // Generate time options (current time to 11:59 PM in 30-minute intervals)
  const generateTimeOptions = () => {
    const options: string[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Round up to next 30-minute interval
    let startMinute = currentMinute < 30 ? 30 : 0;
    let startHour = currentMinute < 30 ? currentHour : currentHour + 1;
    
    for (let hour = startHour; hour < 24; hour++) {
      const minute = hour === startHour ? startMinute : 0;
      
      if (minute === 0 || minute === 30) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const time12hr = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        const time24hr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(`${time12hr}|${time24hr}`);
      }
      
      if (hour === startHour && minute === 0) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const time12hr = `${displayHour}:30 ${period}`;
        const time24hr = `${hour.toString().padStart(2, '0')}:30`;
        options.push(`${time12hr}|${time24hr}`);
      }
    }
    
    return options;
  };

  const timeOptions = useMemo(() => generateTimeOptions(), []);

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

    if (!endTime) {
        toast({ variant: 'destructive', title: 'Select End Time', description: 'Please select when you want to end your session.' });
        return;
    }

    setLoading(true);
    
    try {
      // Calculate duration in minutes from now to selected end time
      const now = new Date();
      const [time12hr, time24hr] = endTime.split('|');
      const [hours, minutes] = time24hr.split(':').map(Number);
      
      const endDateTime = new Date();
      endDateTime.setHours(hours, minutes, 0, 0);
      
      // If end time is before current time, it means next day
      if (endDateTime < now) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }
      
      const durationMinutes = Math.round((endDateTime.getTime() - now.getTime()) / (1000 * 60));
      
      if (durationMinutes < 30) {
        toast({ variant: 'destructive', title: 'Invalid Duration', description: 'Please select an end time at least 30 minutes from now.' });
        setLoading(false);
        return;
      }

      const newBookingRef = push(ref(db, `bookings/${user.uid}`));
      const newBookingData: Omit<Booking, 'id'> = {
          seatId: seatId,
          userId: user.uid,
          bookingTime: new Date().toISOString(),
          status: 'booked',
          duration: durationMinutes
      }

      const updates: {[key: string]: any} = {};
      updates[`/seats/${floor}/${seatId}/status`] = 'booked';
      updates[`/seats/${floor}/${seatId}/bookedBy`] = user.uid;
      updates[`/seats/${floor}/${seatId}/bookedAt`] = serverTimestamp();
      updates[`/seats/${floor}/${seatId}/bookingId`] = newBookingRef.key;
      updates[`/bookings/${user.uid}/${newBookingRef.key}`] = newBookingData;
      
      await update(ref(db), updates);
      
      toast({ 
        title: "Seat Booked!", 
        description: `Booked until ${time12hr}. Scan QR within 2.5 minutes.` 
      });

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
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Button variant="ghost" onClick={() => router.push('/seats')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Seats
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Seat Not Found</CardTitle>
            <CardDescription>This seat doesn't exist in our system.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
   
  if (seat.status !== 'available' && (!booking || booking.seatId !== seat.id)) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <Button variant="ghost" onClick={() => router.push('/seats')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Seats
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Seat Unavailable</CardTitle>
            <CardDescription>
              This seat is currently {seat.status}. Please select another seat.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }


  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 px-4 sm:px-0">
      <Button variant="ghost" onClick={() => router.push('/seats')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Seats
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">
            {booking ? "Booking Confirmed" : `Book Seat ${seatId}`}
          </CardTitle>
          <CardDescription>
            {booking ? "Scan this QR code at the library entrance within the time limit." : "Select when you want to end your session."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {booking && booking.status === 'booked' ? (
            <div className="text-center flex flex-col items-center gap-6">
                <div className="bg-white p-4 rounded-xl shadow-md border w-full max-w-xs mx-auto">
                    <QRCode 
                      id="QRCode" 
                      value={JSON.stringify({bookingId: booking.id, userId: user?.uid, seatId: seatId})} 
                      size={256}
                      className="w-full h-auto"
                    />
                </div>
                <div className="font-bold text-3xl sm:text-4xl text-destructive font-mono tracking-tighter">
                    {Math.floor(countdown / 60)}:{(Math.round(countdown) % 60).toString().padStart(2, '0')}
                </div>
                <p className="text-muted-foreground -mt-4 text-sm sm:text-base">Time left to check-in</p>
                 <Button onClick={downloadQRCode} size="lg" className="w-full">
                    <Download className="mr-2 h-4 w-4" /> Download QR Code
                </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                <Armchair className="h-12 w-12 sm:h-16 sm:w-16 text-primary flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-xl sm:text-2xl font-headline">Seat {seatId}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Status: <span className="text-green-500 font-semibold capitalize">{seat.status}</span>
                  </p>
                </div>
              </div>

               <div className="space-y-2">
                 <label htmlFor="endTime" className="font-medium text-sm sm:text-base">End Time (12-hour format)</label>
                 <Select onValueChange={setEndTime} value={endTime}>
                    <SelectTrigger id="endTime" className="w-full text-base py-6">
                        <SelectValue placeholder="Select end time" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                        {timeOptions.map((option) => {
                          const [time12hr] = option.split('|');
                          return (
                            <SelectItem key={option} value={option}>
                              {time12hr}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                 </Select>
                 {endTime && (
                   <p className="text-xs sm:text-sm text-muted-foreground">
                     You'll have the seat until {endTime.split('|')[0]}
                   </p>
                 )}
               </div>
              
              <Alert variant="default" className="bg-primary/5 border-primary/20">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">Important!</AlertTitle>
                <AlertDescription className="text-xs sm:text-sm">
                  After booking, you have <span className="font-bold">2.5 minutes</span> to scan the QR code at the library entrance. 
                  The booking will be automatically cancelled if not scanned in time.
                </AlertDescription>
              </Alert>

              <Button onClick={handleBooking} disabled={loading || !endTime} size="lg" className="w-full">
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

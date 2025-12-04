
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
import QRCodeLib from 'qrcode';

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
    if (!booking || (booking.status !== 'pending' && booking.status !== 'active')) {
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


  const handleCancelBooking = async () => {
    if (!user || !booking || !seat) return;
    
    // Only allow canceling if it's the user's own booking and status is 'booked'
    if (booking.userId !== user.uid) {
      toast({ variant: 'destructive', title: 'Unauthorized', description: 'You can only cancel your own bookings.' });
      return;
    }

    if (booking.status !== 'pending' && booking.status !== 'active') {
      toast({ variant: 'destructive', title: 'Cannot Cancel', description: 'Only pending or active bookings can be cancelled.' });
      return;
    }

    setLoading(true);
    
    try {
      const updates: {[key: string]: any} = {};
      updates[`/seats/${floor}/${seatId}/status`] = 'available';
      updates[`/seats/${floor}/${seatId}/bookedBy`] = null;
      updates[`/seats/${floor}/${seatId}/bookedAt`] = null;
      updates[`/seats/${floor}/${seatId}/bookingId`] = null;
      updates[`/bookings/${user.uid}/${booking.id}/status`] = 'expired';
      
      await update(ref(db), updates);
      
      toast({ 
        title: "Booking Cancelled", 
        description: `Seat ${seatId} is now available again.` 
      });
      
      router.push('/seats');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Cancellation failed', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!user || !seat || seat.status !== 'available') return;
    
    if (activeBooking) {
        toast({ 
          variant: 'destructive', 
          title: 'Active Booking Exists', 
          description: `You already have an active booking for seat ${activeBooking.seatId}. Please cancel it first.` 
        });
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
      const nowISO = new Date().toISOString();
      const endTimeISO = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      
      const newBookingData: Omit<Booking, 'id'> = {
          seatId: seatId,
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0] || 'User',
          userEmail: user.email || '',
          bookingTime: nowISO,
          startTime: nowISO,
          endTime: endTimeISO,
          status: 'pending',
          duration: durationMinutes,
          createdAt: nowISO,
          updatedAt: nowISO,
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

  const downloadQRCode = async () => {
    if (!booking || !user) return;

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size for high quality
      canvas.width = 800;
      canvas.height = 1000;

      // Background - dark like library seats page
      ctx.fillStyle = '#1e293b'; // Dark slate background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load and draw logo
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = '/images/logo.png';
      
      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve; // Continue even if logo fails
      });

      // Draw logo at top
      if (logo.complete && logo.width > 0) {
        const logoSize = 80;
        ctx.drawImage(logo, (canvas.width - logoSize) / 2, 40, logoSize, logoSize);
      }

      // Site name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SeatFinderSRM', canvas.width / 2, 160);

      // Subtitle
      ctx.font = '20px Arial';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Library Seat Booking', canvas.width / 2, 190);

      // White card background for QR and details
      ctx.fillStyle = '#ffffff';
      ctx.roundRect(50, 230, canvas.width - 100, 680, 20);
      ctx.fill();

      // Black placeholder box for QR code with padding
      const qrBoxSize = 360;
      const qrBoxX = (canvas.width - qrBoxSize) / 2;
      ctx.fillStyle = '#000000';
      ctx.roundRect(qrBoxX, 250, qrBoxSize, qrBoxSize, 10);
      ctx.fill();

      // Booking details FIRST (so QR draws on top)
      const bookingTime = new Date(booking.bookingTime);
      const duration = booking.duration || 60;
      const endDateTime = new Date(bookingTime.getTime() + duration * 60000);
      
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Seat ${seatId}`, canvas.width / 2, 620);

    // Details box
    ctx.fillStyle = '#f1f5f9';
    ctx.roundRect(80, 650, canvas.width - 160, 230, 15);
    ctx.fill();

    // Detail items
    const details = [
      { label: 'Booked By', value: user.email?.split('@')[0] || 'Student' },
      { label: 'Booking Time', value: bookingTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
      { label: 'Duration', value: `${duration} minutes` },
      { label: 'End Time', value: endDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
    ];

    ctx.textAlign = 'left';
    let yPos = 690;
    details.forEach((detail) => {
      ctx.fillStyle = '#64748b';
      ctx.font = '16px Arial';
      ctx.fillText(detail.label, 110, yPos);
      
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 18px Arial';
      ctx.fillText(detail.value, 110, yPos + 25);
      
      yPos += 55;
    });

      // Footer
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Scan this QR code at the library entrance', canvas.width / 2, 950);

      // NOW draw QR code LAST so it's on top
      // White background for QR with padding
      const qrWhiteBg = 320;
      const qrWhiteBgX = (canvas.width - qrWhiteBg) / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrWhiteBgX, 270, qrWhiteBg, qrWhiteBg);

      // Generate QR code directly using qrcode library
      const qrData = JSON.stringify({bookingId: booking.id, userId: user?.uid, seatId: seatId});
      
      const qrDataUrl = await QRCodeLib.toDataURL(qrData, {
        width: 300,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      // Load and draw QR code
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = (e) => {
          console.error('QR Image load error:', e);
          reject(new Error('Failed to load QR'));
        };
        qrImg.src = qrDataUrl;
      });

      // Draw QR code on white background - LAST so it's on top
      const qrSize = 300;
      const qrX = (canvas.width - qrSize) / 2;
      ctx.drawImage(qrImg, qrX, 280, qrSize, qrSize);

      // Download
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `SeatFinderSRM-${seatId}-${bookingTime.toISOString().split('T')[0]}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    } catch (error) {
      console.error('QR Download error:', error);
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not generate QR code image.' });
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
          {booking && (booking.status === 'pending' || booking.status === 'active') && booking.seatId === seatId ? (
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
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button onClick={downloadQRCode} size="lg" className="flex-1">
                      <Download className="mr-2 h-4 w-4" /> Download QR Code
                  </Button>
                  <Button onClick={handleCancelBooking} variant="destructive" size="lg" className="flex-1" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Cancel Booking
                  </Button>
                </div>
            </div>
          ) : booking && (booking.status === 'pending' || booking.status === 'active') && (seat.status === 'reserved' || seat.status === 'occupied') && seat.bookedBy === user?.uid ? (
            // User clicked on their already-booked seat - show cancel option
            <div className="space-y-6">
              <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/30">
                <Info className="h-4 w-4 text-yellow-500" />
                <AlertTitle className="text-yellow-600 dark:text-yellow-500">Your Booked Seat</AlertTitle>
                <AlertDescription className="text-sm">
                  You have already booked this seat. You can cancel this booking if you want to book a different seat.
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                <Armchair className="h-12 w-12 sm:h-16 sm:w-16 text-yellow-500 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-xl sm:text-2xl font-headline">Seat {seatId}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Status: <span className="text-yellow-500 font-semibold capitalize">Booked by you</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Time remaining: {Math.floor(countdown / 60)}:{(Math.round(countdown) % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>

              <Button onClick={handleCancelBooking} variant="destructive" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Cancel This Booking
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

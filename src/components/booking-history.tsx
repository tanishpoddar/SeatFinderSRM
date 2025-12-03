
"use client";

import React, { useState, useEffect } from 'react';
import { ref, onValue, off, query, orderByChild } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/providers/auth-provider';
import type { Booking } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import QRCode from 'react-qr-code';
import { Button } from './ui/button';
import { Download, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

function ActiveBookingCard({ booking }: { booking: Booking }) {
    const { user } = useAuth();
    const [countdown, setCountdown] = useState(0);

    // This useEffect now only handles the visual countdown timer.
    // The actual expiry logic is now centralized in MainLayout.
    useEffect(() => {
        if (booking.status !== 'booked') return;

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


    const downloadQRCode = () => {
        const svg = document.getElementById("DashboardQRCode");
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
              downloadLink.download = `SeatFinderSRM-QR-${booking.seatId}.png`;
              downloadLink.href = pngFile;
              downloadLink.click();
            };
            img.src = "data:image/svg+xml;base64," + btoa(svgData);
          }
        }
      };
    
    if (booking.status === 'occupied') {
        return (
             <Alert variant="default" className="mb-6 bg-green-500/10 border-green-500/30">
                <Info className="h-4 w-4 text-green-500" />
                <AlertTitle className="text-green-500">You're Checked In!</AlertTitle>
                <AlertDescription>
                 You are currently occupying seat <span className='font-bold'>{booking.seatId}</span>. Enjoy your study session!
                </AlertDescription>
              </Alert>
        )
    }

    return (
        <Card className="mb-6 bg-secondary shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Your Active Booking</CardTitle>
                <CardDescription>Scan this QR code at the library entrance to check in.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center gap-6">
                <div className="bg-white p-4 rounded-lg shadow-md border">
                    <QRCode id="DashboardQRCode" value={JSON.stringify({bookingId: booking.id, userId: user?.uid, seatId: booking.seatId})} size={180} />
                </div>
                <div className="flex-1 text-center md:text-left space-y-2">
                    <h3 className="text-3xl font-bold font-headline">Seat {booking.seatId}</h3>
                    <div className="text-destructive font-bold text-2xl font-mono tracking-tight">
                        {Math.floor(countdown / 60)}:{(Math.round(countdown) % 60).toString().padStart(2, '0')}
                    </div>
                     <p className="text-muted-foreground -mt-1">Booked for {booking.duration} minutes.</p>
                     <Button onClick={downloadQRCode} className="mt-4 w-full md:w-auto">
                        <Download className="mr-2 h-4 w-4" /> Download QR Code
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

export function BookingHistory() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const bookingsRef = ref(db, `bookings/${user.uid}`);
    
    const listener = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const bookingsList = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...(value as Omit<Booking, 'id'>)
        }));
        // Sort by booking time, newest first
        bookingsList.sort((a, b) => {
          const timeA = new Date(a.bookingTime).getTime();
          const timeB = new Date(b.bookingTime).getTime();
          return timeB - timeA;
        });
        setBookings(bookingsList);
      } else {
        setBookings([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Failed to fetch bookings:", error);
      setBookings([]);
      setLoading(false);
    });

    return () => off(bookingsRef, 'value', listener);
  }, [user]);
  
  const getBadgeVariant = (status: Booking['status']) => {
    switch (status) {
      case 'occupied':
        return 'default';
      case 'booked':
        return 'secondary';
      case 'expired':
        return 'destructive';
      case 'completed':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const activeBooking = bookings.find(b => b.status === 'booked' || b.status === 'occupied');

  return (
    <div className="space-y-6">
      {activeBooking && <ActiveBookingCard booking={activeBooking} />}
      
      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
          <CardDescription>Your past and current seat bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Seat ID</TableHead>
                  <TableHead>Booking Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Entry Time</TableHead>
                  <TableHead>Exit Time</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-6 w-24 rounded-full ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : bookings.length > 0 ? (
                  bookings.map((booking) => {
                    const bookingDate = new Date(booking.bookingTime);
                    const entryDate = booking.entryTime ? new Date(booking.entryTime) : null;
                    const exitDate = booking.exitTime ? new Date(booking.exitTime) : null;
                    
                    return (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.seatId}</TableCell>
                      <TableCell>{!isNaN(bookingDate.getTime()) ? format(bookingDate, "PPp") : '—'}</TableCell>
                      <TableCell>{booking.duration ? `${booking.duration} mins` : 'N/A'}</TableCell>
                      <TableCell>{entryDate && !isNaN(entryDate.getTime()) ? format(entryDate, "p") : '—'}</TableCell>
                      <TableCell>{exitDate && !isNaN(exitDate.getTime()) ? format(exitDate, "p") : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={getBadgeVariant(booking.status)}
                          className={cn('capitalize', {
                            'bg-green-500/80 text-green-950 dark:text-green-50': booking.status === 'occupied',
                            'bg-yellow-400/80 text-yellow-950 dark:text-yellow-50': booking.status === 'booked',
                          })}
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No bookings found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

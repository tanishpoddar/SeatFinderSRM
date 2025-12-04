'use client';

import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, XCircle, LogIn, LogOut } from 'lucide-react';
import type { Booking } from '@/types';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  const [actionReason, setActionReason] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // Fetch users first to get names
      const usersRef = ref(db, 'users');
      const usersSnapshot = await get(usersRef);
      const usersMap: Record<string, any> = {};
      
      if (usersSnapshot.exists()) {
        usersSnapshot.forEach((userSnapshot) => {
          const userData = userSnapshot.val();
          usersMap[userSnapshot.key!] = userData;
        });
      }
      
      // Fetch bookings
      const bookingsRef = ref(db, 'bookings');
      const snapshot = await get(bookingsRef);

      const allBookings: Booking[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((userSnapshot) => {
          const userId = userSnapshot.key!;
          userSnapshot.forEach((bookingSnapshot) => {
            const bookingData = bookingSnapshot.val() as Booking;
            
            // Get user info from users map
            const userInfo = usersMap[userId];
            const userName = bookingData.userName || 
                           userInfo?.displayName || 
                           userInfo?.email?.split('@')[0] || 
                           bookingData.userEmail?.split('@')[0] || 
                           'Unknown User';

            allBookings.push({
              ...bookingData,
              id: bookingData.id ?? bookingSnapshot.key ?? `${bookingData.userEmail}-${bookingData.seatId}-${bookingData.bookingTime}`,
              userName,
            });
          });
        });
      }

      // Sort by booking time, most recent first
      allBookings.sort(
        (a, b) =>
          new Date(b.bookingTime).getTime() - new Date(a.bookingTime).getTime()
      );

      console.log('Fetched bookings:', allBookings.length, allBookings);
      setBookings(allBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await fetch('/api/admin/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: actionReason }),
      });
      fetchBookings();
      setActionReason('');
    } catch (error) {
      console.error('Error cancelling booking:', error);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      await fetch('/api/admin/bookings/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: actionReason }),
      });
      fetchBookings();
      setActionReason('');
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      await fetch('/api/admin/bookings/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: actionReason }),
      });
      fetchBookings();
      setActionReason('');
    } catch (error) {
      console.error('Error checking out:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      pending: 'secondary',
      completed: 'outline',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const filteredBookings = bookings.filter(
    (booking) =>
      booking.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.seatId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Booking Management</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user name or seat..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Button onClick={fetchBookings} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Seat</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No bookings found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBookings.map((booking) => {
                    const startTime = booking.entryTime || booking.startTime || booking.bookingTime;
                    const endTime = booking.exitTime || booking.endTime;
                    const userName =
                      booking.userName ||
                      booking.userEmail?.split('@')[0] ||
                      'Unknown User';

                    const rowKey =
                      booking.id ??
                      `${booking.userEmail}-${booking.seatId}-${booking.bookingTime}`;

                    return (
                      <TableRow key={rowKey}>
                        <TableCell>{userName}</TableCell>
                        <TableCell className="font-mono">
                          {booking.seatId}
                        </TableCell>
                        <TableCell className="text-sm">
                          {startTime
                            ? new Date(startTime).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {endTime
                            ? new Date(endTime).toLocaleString(
                                'en-US',
                                {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                >
                                  <LogIn className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Manual Check-In</DialogTitle>
                                  <DialogDescription>
                                    Manually check in this booking
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Reason</Label>
                                    <Textarea
                                      value={actionReason}
                                      onChange={(e) =>
                                        setActionReason(e.target.value)
                                      }
                                      placeholder="Enter reason for manual check-in..."
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => handleCheckIn(booking.id)}
                                  >
                                    Confirm
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                >
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Manual Check-Out</DialogTitle>
                                  <DialogDescription>
                                    Manually check out this booking
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Reason</Label>
                                    <Textarea
                                      value={actionReason}
                                      onChange={(e) =>
                                        setActionReason(e.target.value)
                                      }
                                      placeholder="Enter reason for manual check-out..."
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={() => handleCheckOut(booking.id)}
                                  >
                                    Confirm
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Cancel Booking</DialogTitle>
                                  <DialogDescription>
                                    This action cannot be undone
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Reason</Label>
                                    <Textarea
                                      value={actionReason}
                                      onChange={(e) =>
                                        setActionReason(e.target.value)
                                      }
                                      placeholder="Enter reason for cancellation..."
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="destructive"
                                    onClick={() =>
                                      handleCancelBooking(booking.id)
                                    }
                                  >
                                    Cancel Booking
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
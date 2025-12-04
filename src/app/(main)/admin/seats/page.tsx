'use client';

import { useState, useEffect } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Seat } from '@/types';

export default function SeatsPage() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [expectedRestoration, setExpectedRestoration] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchSeats();
  }, []);

  const fetchSeats = async () => {
    setLoading(true);
    try {
      const seatsRef = ref(db, 'seats');
      const snapshot = await get(seatsRef);
      
      const seatsList: Seat[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((floorSnapshot) => {
          floorSnapshot.forEach((seatSnapshot) => {
            seatsList.push(seatSnapshot.val() as Seat);
          });
        });
      }
      
      console.log('Fetched seats:', seatsList.length);
      setSeats(seatsList);
    } catch (error) {
      console.error('Error fetching seats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkMaintenance = async (seatId: string, action: string) => {
    try {
      // Find the seat in Firebase - seats are stored as seats/{floor}/{seatId}
      const seatsRef = ref(db, 'seats');
      const snapshot = await get(seatsRef);
      
      let seatPath: string | null = null;
      
      if (snapshot.exists()) {
        snapshot.forEach((floorSnapshot) => {
          floorSnapshot.forEach((seatSnapshot) => {
            const seat = seatSnapshot.val();
            if (seat.id === seatId) {
              seatPath = `seats/${floorSnapshot.key}/${seatSnapshot.key}`;
            }
          });
        });
      }
      
      if (!seatPath) {
        console.error(`Seat ${seatId} not found`);
        return;
      }
      
      const seatRef = ref(db, seatPath);
      const { update } = await import('firebase/database');
      
      switch (action) {
        case 'maintenance':
          await update(seatRef, {
            status: 'maintenance',
            maintenanceInfo: {
              reason: maintenanceReason,
              reportedBy: 'admin',
              expectedRestoration,
              startedAt: new Date().toISOString(),
            }
          });
          console.log('Seat marked for maintenance');
          break;
          
        case 'out-of-service':
          await update(seatRef, {
            status: 'out-of-service',
            maintenanceInfo: {
              reason: maintenanceReason,
              reportedBy: 'admin',
              expectedRestoration,
              startedAt: new Date().toISOString(),
            }
          });
          console.log('Seat marked out of service');
          break;
          
        case 'restore':
          await update(seatRef, {
            status: 'available',
            maintenanceInfo: null
          });
          console.log('Seat restored to service');
          break;
          
        default:
          console.error('Invalid action');
          return;
      }
      
      // Refresh seats list
      await fetchSeats();
      
      // Close dialog and reset form
      setDialogOpen(false);
      setMaintenanceReason('');
      setExpectedRestoration('');
      setSelectedSeat(null);
    } catch (error) {
      console.error('Error updating seat:', error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Seat Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>Seat Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {seats.length === 0 ? (
              <p className="col-span-4 text-center text-muted-foreground">No seats available</p>
            ) : (
              seats.map((seat) => {
                const statusColors: Record<string, string> = {
                  available: 'border-green-500 hover:bg-green-50 dark:hover:bg-green-950',
                  reserved: 'border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950',
                  occupied: 'border-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950',
                  maintenance: 'border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950',
                  'out-of-service': 'border-red-500 hover:bg-red-50 dark:hover:bg-red-950',
                };
                
                return (
                <Dialog key={seat.id} open={dialogOpen && selectedSeat?.id === seat.id} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) {
                    setSelectedSeat(null);
                    setMaintenanceReason('');
                    setExpectedRestoration('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className={`h-20 ${statusColors[seat.status] || ''}`}
                      onClick={() => {
                        setSelectedSeat(seat);
                        setDialogOpen(true);
                      }}
                    >
                      <div className="text-center">
                        <div className="font-bold">{seat.id}</div>
                        <div className="text-xs text-muted-foreground capitalize">{seat.status}</div>
                        {seat.floor && <div className="text-xs text-muted-foreground">Floor: {seat.floor}</div>}
                      </div>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Seat {seat.number}</DialogTitle>
                      <DialogDescription>Manage seat maintenance</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea
                          id="reason"
                          value={maintenanceReason}
                          onChange={(e) => setMaintenanceReason(e.target.value)}
                          placeholder="Enter maintenance reason..."
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="restoration">Expected Restoration Date & Time</Label>
                        <Input
                          id="restoration"
                          type="datetime-local"
                          value={expectedRestoration}
                          onChange={(e) => setExpectedRestoration(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                    <DialogFooter className="flex gap-2">
                      <Button onClick={() => handleMarkMaintenance(seat.id, 'maintenance')}>
                        Mark Maintenance
                      </Button>
                      <Button variant="destructive" onClick={() => handleMarkMaintenance(seat.id, 'out-of-service')}>
                        Out of Service
                      </Button>
                      <Button variant="outline" onClick={() => handleMarkMaintenance(seat.id, 'restore')}>
                        Restore
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

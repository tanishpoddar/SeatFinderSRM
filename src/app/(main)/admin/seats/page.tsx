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

      {seats.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No seats available</p>
          </CardContent>
        </Card>
      ) : (
        // Group seats by floor based on seat ID prefix (G=Ground, F=First, S=Second, T=Third)
        (() => {
          const seatsByFloor = seats.reduce((acc, seat) => {
            // Get floor from seat ID prefix
            const prefix = seat.id.charAt(0).toUpperCase();
            let floorKey = '';
            
            switch (prefix) {
              case 'G': floorKey = 'ground'; break;
              case 'F': floorKey = 'first'; break;
              case 'S': floorKey = 'second'; break;
              case 'T': floorKey = 'third'; break;
              default: floorKey = 'unknown'; break;
            }
            
            if (!acc[floorKey]) acc[floorKey] = [];
            acc[floorKey].push(seat);
            return acc;
          }, {} as Record<string, Seat[]>);

          const floorOrder = ['ground', 'first', 'second', 'third'];
          const floorLabels: Record<string, string> = {
            ground: 'Ground Floor',
            first: 'First Floor',
            second: 'Second Floor',
            third: 'Third Floor',
          };

          return floorOrder
            .filter(floor => seatsByFloor[floor] && seatsByFloor[floor].length > 0)
            .map((floor) => (
              <Card key={floor}>
                <CardHeader>
                  <CardTitle>{floorLabels[floor]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    {seatsByFloor[floor]
                      .sort((a, b) => a.id.localeCompare(b.id))
                      .map((seat) => {
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
                              </div>
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Seat {seat.number}</DialogTitle>
                              <DialogDescription>Manage seat maintenance status</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-5 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="reason" className="text-sm font-medium">
                                  Maintenance Reason
                                </Label>
                                <Textarea
                                  id="reason"
                                  value={maintenanceReason}
                                  onChange={(e) => setMaintenanceReason(e.target.value)}
                                  placeholder="Describe the issue or reason for maintenance..."
                                  className="min-h-[80px] resize-none"
                                  rows={3}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="restoration-date" className="text-sm font-medium">
                                  Expected Restoration Date
                                </Label>
                                <Input
                                  id="restoration-date"
                                  type="date"
                                  value={expectedRestoration.split('T')[0] || ''}
                                  onChange={(e) => {
                                    const time = expectedRestoration.split('T')[1] || '09:00';
                                    setExpectedRestoration(`${e.target.value}T${time}`);
                                  }}
                                  min={new Date().toISOString().split('T')[0]}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="restoration-time" className="text-sm font-medium">
                                  Expected Restoration Time
                                </Label>
                                <Input
                                  id="restoration-time"
                                  type="time"
                                  value={expectedRestoration.split('T')[1] || '09:00'}
                                  onChange={(e) => {
                                    const date = expectedRestoration.split('T')[0] || new Date().toISOString().split('T')[0];
                                    setExpectedRestoration(`${date}T${e.target.value}`);
                                  }}
                                />
                              </div>
                            </div>
                            <DialogFooter className="flex flex-col sm:flex-row gap-2">
                              <Button 
                                onClick={() => handleMarkMaintenance(seat.id, 'maintenance')}
                                className="w-full sm:w-auto"
                                disabled={!maintenanceReason || !expectedRestoration}
                              >
                                Mark Maintenance
                              </Button>
                              <Button 
                                variant="destructive" 
                                onClick={() => handleMarkMaintenance(seat.id, 'out-of-service')}
                                className="w-full sm:w-auto"
                                disabled={!maintenanceReason || !expectedRestoration}
                              >
                                Out of Service
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => handleMarkMaintenance(seat.id, 'restore')}
                                className="w-full sm:w-auto"
                              >
                                Restore to Service
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ));
        })()
      )}
    </div>
  );
}

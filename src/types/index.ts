
export type SeatStatus = 'available' | 'booked' | 'occupied';

export interface Seat {
  id: string;
  status: SeatStatus;
  bookedBy: string | null;
  bookedAt: number | null;
  bookingId: string | null;
  occupiedUntil?: number | null;
}

export interface Booking {
  id: string;
  seatId: string;
  userId: string;
  bookingTime: string;
  entryTime?: string;
  exitTime?: string;
  status: 'booked' | 'occupied' | 'completed' | 'expired';
  duration?: number; // Duration in minutes
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  currentBookingId?: string;
}

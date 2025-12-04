import { NextRequest, NextResponse } from 'next/server';
import { ref, update, get } from 'firebase/database';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seatId, action, maintenanceInfo } = body;
    
    if (!seatId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: seatId, action' },
        { status: 400 }
      );
    }
    
    // Find the seat in Firebase - seats are stored as seats/{floor}/{seatId}
    const seatsRef = ref(db, 'seats');
    const snapshot = await get(seatsRef);
    
    let seatPath: string | null = null;
    let seatData: any = null;
    
    if (snapshot.exists()) {
      snapshot.forEach((floorSnapshot) => {
        floorSnapshot.forEach((seatSnapshot) => {
          const seat = seatSnapshot.val();
          if (seat.id === seatId) {
            seatPath = `seats/${floorSnapshot.key}/${seatSnapshot.key}`;
            seatData = seat;
          }
        });
      });
    }
    
    if (!seatPath) {
      return NextResponse.json(
        { error: `Seat ${seatId} not found` },
        { status: 404 }
      );
    }
    
    let result;
    const seatRef = ref(db, seatPath);
    
    switch (action) {
      case 'maintenance':
        if (!maintenanceInfo) {
          return NextResponse.json(
            { error: 'maintenanceInfo required for maintenance action' },
            { status: 400 }
          );
        }
        await update(seatRef, {
          status: 'maintenance',
          maintenanceInfo: maintenanceInfo
        });
        result = { message: 'Seat marked for maintenance' };
        break;
        
      case 'out-of-service':
        if (!maintenanceInfo) {
          return NextResponse.json(
            { error: 'maintenanceInfo required for out-of-service action' },
            { status: 400 }
          );
        }
        await update(seatRef, {
          status: 'out-of-service',
          maintenanceInfo: maintenanceInfo
        });
        result = { message: 'Seat marked out of service' };
        break;
        
      case 'restore':
        await update(seatRef, {
          status: 'available',
          maintenanceInfo: null
        });
        result = { message: 'Seat restored to service' };
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: maintenance, out-of-service, or restore' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error managing seat maintenance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

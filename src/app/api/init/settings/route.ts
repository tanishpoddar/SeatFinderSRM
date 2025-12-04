import { NextResponse } from 'next/server';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';

/**
 * Initialize library settings in Firebase
 * Visit: http://localhost:3000/api/init/settings
 */
export async function GET() {
  try {
    const settingsRef = ref(db, 'settings/library');
    
    const defaultSettings = {
      operatingHours: {
        monday: { open: '08:00', close: '22:00', isClosed: false },
        tuesday: { open: '08:00', close: '22:00', isClosed: false },
        wednesday: { open: '08:00', close: '22:00', isClosed: false },
        thursday: { open: '08:00', close: '22:00', isClosed: false },
        friday: { open: '08:00', close: '22:00', isClosed: false },
        saturday: { open: '09:00', close: '18:00', isClosed: false },
        sunday: { open: '09:00', close: '18:00', isClosed: false },
      },
      holidays: [
        {
          date: '2024-12-25',
          name: 'Christmas Day',
        },
        {
          date: '2024-01-01',
          name: 'New Year\'s Day',
        },
      ],
      bookingRules: {
        maxDailyDuration: 480, // 8 hours
        maxAdvanceBookingDays: 7,
        minBookingDuration: 30,
        maxBookingDuration: 240, // 4 hours
        extensionIncrement: 30,
      },
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
    };

    await set(settingsRef, defaultSettings);

    return NextResponse.json({
      success: true,
      message: 'Library settings initialized successfully!',
      data: defaultSettings,
    });
  } catch (error: any) {
    console.error('Error initializing settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize settings',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

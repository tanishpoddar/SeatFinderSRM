import { NextResponse } from 'next/server';
import { ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';

/**
 * Initialize users bucket in Firebase
 * Visit: http://localhost:3000/api/init/users
 */
export async function GET() {
  try {
    const usersRef = ref(db, 'users');
    
    // Create sample user profile
    const sampleUsers = {
      'sample_user_001': {
        uid: 'sample_user_001',
        email: 'sample@example.com',
        displayName: 'Sample User',
        role: 'user',
        restrictions: {
          isFlagged: false,
        },
        stats: {
          totalBookings: 0,
          noShowCount: 0,
          overstayCount: 0,
          totalHoursBooked: 0,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    };

    await set(usersRef, sampleUsers);

    return NextResponse.json({
      success: true,
      message: 'Users bucket initialized successfully!',
      data: sampleUsers,
    });
  } catch (error: any) {
    console.error('Error initializing users:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize users bucket',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

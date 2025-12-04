import { NextRequest, NextResponse } from 'next/server';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    
    // Fetch users from Realtime Database
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    
    const users: any[] = [];
    if (snapshot.exists()) {
      snapshot.forEach((userSnapshot) => {
        const userData = userSnapshot.val();
        users.push({
          uid: userSnapshot.key,
          email: userData.email || '',
          displayName: userData.displayName || userData.email?.split('@')[0] || '',
          stats: userData.stats || { totalBookings: 0 },
          restrictions: userData.restrictions || { isFlagged: false }
        });
      });
    }
    
    // Filter by query if provided
    const filteredUsers = query 
      ? users.filter(u => 
          u.email?.toLowerCase().includes(query.toLowerCase()) ||
          u.displayName?.toLowerCase().includes(query.toLowerCase())
        )
      : users;
    
    return NextResponse.json({ users: filteredUsers });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

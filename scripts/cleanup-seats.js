// One-time cleanup script for orphaned seats
// Run this with: node scripts/cleanup-seats.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You need to download this from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://seatfinder-srm-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

async function cleanupOrphanedSeats() {
  console.log('Starting cleanup...');
  
  try {
    // Get all seats
    const seatsSnapshot = await db.ref('seats').once('value');
    const seatsData = seatsSnapshot.val();
    
    if (!seatsData) {
      console.log('No seats found');
      return;
    }

    // Get all bookings
    const bookingsSnapshot = await db.ref('bookings').once('value');
    const allBookings = bookingsSnapshot.val() || {};
    
    // Create set of valid booking IDs
    const validBookingIds = new Set();
    Object.values(allBookings).forEach(userBookings => {
      if (userBookings && typeof userBookings === 'object') {
        Object.keys(userBookings).forEach(bookingId => {
          validBookingIds.add(bookingId);
        });
      }
    });

    console.log(`Found ${validBookingIds.size} valid bookings`);

    // Find orphaned seats
    const updates = {};
    let orphanedCount = 0;

    Object.entries(seatsData).forEach(([floor, seatsOnFloor]) => {
      Object.entries(seatsOnFloor).forEach(([seatId, seatData]) => {
        const seatPath = `seats/${floor}/${seatId}`;
        
        // Check if seat is booked/occupied but booking doesn't exist
        if ((seatData.status === 'booked' || seatData.status === 'occupied') && seatData.bookingId) {
          if (!validBookingIds.has(seatData.bookingId)) {
            console.log(`Found orphaned seat: ${seatId} (${seatData.status})`);
            updates[`${seatPath}/status`] = 'available';
            updates[`${seatPath}/bookedBy`] = null;
            updates[`${seatPath}/bookedAt`] = null;
            updates[`${seatPath}/bookingId`] = null;
            updates[`${seatPath}/occupiedUntil`] = null;
            orphanedCount++;
          }
        }
      });
    });

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
      console.log(`✅ Cleaned up ${orphanedCount} orphaned seats`);
    } else {
      console.log('✅ No orphaned seats found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupOrphanedSeats();

import * as fc from 'fast-check';
import {
  getLibrarySettings,
  updateOperatingHours,
  addHoliday,
  isWithinOperatingHours,
  isHoliday,
  validateBookingTime,
  getAvailableTimeSlots,
  __test__,
} from './library-settings';
import { LibrarySettings, OperatingHours, Holiday, Booking } from '@/types';

// Arbitraries for generating test data
const timeArb = fc.record({
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
}).map(({ hour, minute }) => 
  `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
);

const operatingHoursArb: fc.Arbitrary<OperatingHours> = fc.constant({
  monday: { open: '09:00', close: '18:00', isClosed: false },
  tuesday: { open: '09:00', close: '18:00', isClosed: false },
  wednesday: { open: '09:00', close: '18:00', isClosed: false },
  thursday: { open: '09:00', close: '18:00', isClosed: false },
  friday: { open: '09:00', close: '18:00', isClosed: false },
  saturday: { open: '10:00', close: '16:00', isClosed: false },
  sunday: { open: '00:00', close: '00:00', isClosed: true },
});

const holidayArb = fc.record({
  date: fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2025-12-31').getTime() })
    .map(ts => new Date(ts).toISOString().split('T')[0]),
  name: fc.constantFrom('New Year', 'Independence Day', 'Christmas', 'Thanksgiving'),
});

const settingsArb: fc.Arbitrary<LibrarySettings> = fc.record({
  operatingHours: operatingHoursArb,
  holidays: fc.array(holidayArb, { minLength: 0, maxLength: 10 }),
  bookingRules: fc.record({
    maxDailyDuration: fc.integer({ min: 240, max: 480 }),
    maxAdvanceBookingDays: fc.integer({ min: 7, max: 30 }),
    minBookingDuration: fc.integer({ min: 30, max: 60 }),
    maxBookingDuration: fc.integer({ min: 180, max: 360 }),
    extensionIncrement: fc.integer({ min: 15, max: 60 }),
  }),
  updatedBy: fc.uuid(),
  updatedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
}) as fc.Arbitrary<LibrarySettings>;

const bookingArb = fc.record({
  id: fc.uuid(),
  seatId: fc.uuid(),
  userId: fc.uuid(),
  userName: fc.string({ minLength: 3, maxLength: 20 }),
  userEmail: fc.emailAddress(),
  bookingTime: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  startTime: fc.integer({ min: Date.now(), max: Date.now() + 7 * 86400000 }).map(ts => new Date(ts).toISOString()),
  endTime: fc.integer({ min: Date.now() + 3600000, max: Date.now() + 8 * 86400000 }).map(ts => new Date(ts).toISOString()),
  status: fc.constantFrom('pending', 'active'),
  duration: fc.integer({ min: 60, max: 240 }),
  createdAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  updatedAt: fc.integer({ min: Date.now() - 86400000, max: Date.now() }).map(ts => new Date(ts).toISOString()),
});

describe('Library Settings Service - Property-Based Tests', () => {
  beforeEach(() => {
    __test__.clear();
  });

  // Feature: admin-dashboard-analytics, Property 40: Operating hours enforcement
  test('Property 40: For any booking attempt outside configured operating hours, booking is rejected', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArb,
        fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }),
        fc.integer({ min: 0, max: 23 }),
        async (settings, timestamp, hour) => {
          const date = new Date(timestamp);
          __test__.setSettings(settings);
          
          // Create a booking time
          const bookingTime = new Date(date);
          bookingTime.setHours(hour, 0, 0, 0);
          
          const dayOfWeek = bookingTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const hours = settings.operatingHours[dayOfWeek];
          
          const isWithin = await isWithinOperatingHours(bookingTime);
          
          if (!hours || hours.isClosed) {
            // Should be rejected if closed
            expect(isWithin).toBe(false);
          } else {
            // Check if time is within operating hours
            const bookingTimeStr = `${hour.toString().padStart(2, '0')}:00`;
            const shouldBeWithin = bookingTimeStr >= hours.open && bookingTimeStr < hours.close;
            
            expect(isWithin).toBe(shouldBeWithin);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 41: Schedule change notifications
  test('Property 41: For any operating hours update affecting existing bookings, affected users are identified', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArb,
        fc.array(bookingArb, { minLength: 1, maxLength: 10 }),
        fc.uuid(),
        async (settings, bookings, adminId) => {
          __test__.setSettings(settings);
          __test__.setBookings(bookings);
          
          // Create new operating hours that close earlier
          const newHours: OperatingHours = {
            monday: { open: '09:00', close: '12:00', isClosed: false },
            tuesday: { open: '09:00', close: '12:00', isClosed: false },
            wednesday: { open: '09:00', close: '12:00', isClosed: false },
            thursday: { open: '09:00', close: '12:00', isClosed: false },
            friday: { open: '09:00', close: '12:00', isClosed: false },
            saturday: { open: '00:00', close: '00:00', isClosed: true },
            sunday: { open: '00:00', close: '00:00', isClosed: true },
          };
          
          const result = await updateOperatingHours(newHours, adminId);
          
          // Should return list of affected bookings
          expect(Array.isArray(result.affectedBookings)).toBe(true);
          
          // Verify affected bookings are actually outside new hours
          result.affectedBookings.forEach(bookingId => {
            const booking = bookings.find(b => b.id === bookingId);
            if (booking) {
              const startTime = new Date(booking.startTime);
              const dayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
              const dayHours = newHours[dayOfWeek];
              
              if (dayHours && !dayHours.isClosed) {
                const hour = startTime.getHours();
                const minute = startTime.getMinutes();
                const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                
                // Should be outside new hours
                const isOutside = timeStr < dayHours.open || timeStr >= dayHours.close;
                expect(isOutside).toBe(true);
              }
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 42: Time slot filtering
  test('Property 42: For any display of available time slots, only times within configured operating hours are shown', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArb,
        fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }),
        fc.integer({ min: 30, max: 120 }),
        async (settings, timestamp, slotDuration) => {
          const date = new Date(timestamp);
          __test__.setSettings(settings);
          
          const slots = await getAvailableTimeSlots(date, slotDuration);
          
          const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const hours = settings.operatingHours[dayOfWeek];
          
          if (!hours || hours.isClosed) {
            // Should have no slots if closed
            expect(slots.length).toBe(0);
          } else {
            // All slots should be within operating hours
            slots.forEach(slot => {
              expect(slot.start >= hours.open).toBe(true);
              expect(slot.end <= hours.close).toBe(true);
            });
            
            // Slots should be contiguous and cover the operating period
            if (slots.length > 0) {
              expect(slots[0].start).toBe(hours.open);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: admin-dashboard-analytics, Property 43: Holiday booking prevention
  test('Property 43: For any date configured as a holiday closure, all booking attempts are blocked', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArb,
        holidayArb,
        async (settings, holiday) => {
          // Add the holiday to settings
          const settingsWithHoliday = {
            ...settings,
            holidays: [...settings.holidays, holiday],
          };
          
          __test__.setSettings(settingsWithHoliday);
          
          // Try to book on the holiday
          const holidayDate = new Date(holiday.date + 'T12:00:00');
          const isHolidayDate = await isHoliday(holidayDate);
          
          // Should be identified as a holiday
          expect(isHolidayDate).toBe(true);
          
          // Booking validation should fail
          const endTime = new Date(holidayDate.getTime() + 3600000);
          const validation = await validateBookingTime(holidayDate, endTime);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toContain('holiday');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Non-holiday dates allow bookings
  test('Non-holiday dates within operating hours allow bookings', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArb,
        fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }),
        async (settings, timestamp) => {
          __test__.setSettings(settings);
          
          // Set time to within operating hours (10 AM)
          const bookingTime = new Date(timestamp);
          bookingTime.setHours(10, 0, 0, 0);
          
          const endTime = new Date(bookingTime.getTime() + 3600000);
          
          const isHolidayDate = await isHoliday(bookingTime);
          
          if (!isHolidayDate) {
            const dayOfWeek = bookingTime.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const hours = settings.operatingHours[dayOfWeek];
            
            if (hours && !hours.isClosed && '10:00' >= hours.open && '10:00' < hours.close) {
              const validation = await validateBookingTime(bookingTime, endTime);
              
              // Should be valid if within hours and not a holiday
              if ('11:00' <= hours.close) {
                expect(validation.valid).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Additional test: Time slots are contiguous
  test('Available time slots are contiguous and non-overlapping', async () => {
    await fc.assert(
      fc.asyncProperty(
        settingsArb,
        fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2024-12-31').getTime() }),
        fc.integer({ min: 30, max: 60 }),
        async (settings, timestamp, slotDuration) => {
          const date = new Date(timestamp);
          __test__.setSettings(settings);
          
          const slots = await getAvailableTimeSlots(date, slotDuration);
          
          // Check that slots are contiguous
          for (let i = 1; i < slots.length; i++) {
            expect(slots[i].start).toBe(slots[i - 1].end);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

import type { Booking } from "@shared/schema";

// Unconfirmed bookings stop showing up in admin notifications once this many
// days have passed since the booked date (tanggal), so old ones don't pile up.
export const UNCONFIRMED_NOTIFICATION_DAYS = 7;

// Today's date as YYYY-MM-DD in WIB, regardless of the browser's timezone.
function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Pending bookings that should still appear in the "belum dikonfirmasi"
// notification. A booking for 27/10 is shown up to and including 03/11 (WIB)
// and hidden from 04/11 onwards. The bookings themselves are not touched.
export function getNotifiableUnconfirmedBookings(bookings: Booking[]): Booking[] {
  const today = todayInJakarta();
  return bookings.filter((b) => {
    if (b.status !== "pending") return false;
    if (!b.tanggal) return true;
    return today <= addDays(b.tanggal, UNCONFIRMED_NOTIFICATION_DAYS);
  });
}


export const IST_OFFSET_MS = 5 * 60 * 60_000 + 30 * 60_000; // 330 min in ms

/**
 * Converts a stored "HH:MM" pickup-window time (always IST) into a UTC Date
 * on the given calendar date. Defaults to today if no date is provided.
 *
 * Why onDate: the cart validates against "now", but order.service needs to
 * store a pickupDeadline on an arbitrary future date (e.g. next Thursday).
 *
 * Algorithm:
 *   1. Shift onDate forward by IST_OFFSET to get its IST calendar date in UTC terms.
 *   2. Construct Date.UTC at (IST-year, IST-month, IST-day, h, m).
 *   3. Subtract IST_OFFSET to get the true UTC instant.
 *
 * Example: endTime="20:00", onDate=2025-05-25T00:00:00Z
 *   base  = 2025-05-25T05:30:00Z → getUTCDate=25
 *   UTC   = Date.UTC(2025,4,25,20,0) = 2025-05-25T20:00:00Z
 *   result= 2025-05-25T14:30:00Z   ← 20:00 IST expressed as UTC  ✓
 */
export function istTimeToUTCDate(hhMm: string, onDate: Date = new Date()): Date {
    const [h, m] = hhMm.split(":").map(Number);
    const baseIST = new Date(onDate.getTime() + IST_OFFSET_MS); // shift to IST

    return new Date(
        Date.UTC(
            baseIST.getUTCFullYear(),
            baseIST.getUTCMonth(),
            baseIST.getUTCDate(),
        ) - IST_OFFSET_MS, // back to UTC
    )
}


/**
 * Today's IST midnight expressed as a UTC Date.
 *
 * Why not new Date() + setHours(0,0,0,0):
 *   setHours uses server local time (UTC on Vercel). "Today" for a buyer in
 *   India is IST midnight, which is 18:30 UTC the previous day. Using UTC
 *   midnight as the cutoff would accept pickupDates that are yesterday in IST.
 */
export function todayMidnightIST(): Date {
    const nowIST_ms = Date.now() + IST_OFFSET_MS;
    const midNightIST = Math.floor(nowIST_ms / 86_400_000) * 86_400_000;
    return new Date(midNightIST - IST_OFFSET_MS); // UTC equivalent of IST midnight
}


/**
 * Returns true if `date` represents today in IST, regardless of the timezone
 * embedded in the original ISO string.
 *
 * Why this is needed (Bug 6):
 *   new Date("2025-05-23T00:00:00+05:30") → 2025-05-22T18:30:00Z
 *   getUTCDate() → 22, not 23. IST-midnight strings appear as yesterday in UTC.
 *   Shifting both sides by IST_OFFSET before comparing getUTCDate() neutralises
 *   the offset regardless of what timezone the client serialised into.
 */
export function isTodayInIST(date: Date): boolean {
    const toIST = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS);
    const a = toIST(date);
    const b = toIST(new Date());
    return (
        a.getUTCFullYear() === b.getUTCFullYear() &&
        a.getUTCMonth() === b.getUTCMonth() &&
        a.getUTCDate() === b.getUTCDate()
    );
}

/**
 * Day-of-week (Mon=1 … Sun=7) for a Date interpreted in IST.
 *
 * Why not pickupDate.getDay():
 *   getDay() returns local (UTC on server). An IST-midnight string parsed as
 *   UTC lands at 18:30 the *previous* UTC day — wrong weekday, wrong daysActive
 *   check, wrong seller window.
 */
export function istDayOfWeek(date: Date): number{
    const dow = new Date(date.getTime() + IST_OFFSET_MS).getUTCDay(); // 0 = Sun
    return dow === 0 ? 7 : dow; // convert to Mon=1 … Sun=7 matching daysActive
}
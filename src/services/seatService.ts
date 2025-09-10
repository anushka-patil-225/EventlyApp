import redis from "../config/redis";

/**
 * SeatService manages per-event seat availability using a Redis bitmap.
 * Key design:
 *   - Bitmap key: seatmap:{eventId}
 *   - Bit value: 0 = free, 1 = taken
 *   - Seat numbers are 1-based externally; internally we store bit at index seat-1
 *   - Atomicity via SETBIT return value comparison and Lua scripts for multi-seat ops if needed
 */
export default class SeatService {
  private key(eventId: number) {
    return `seatmap:${eventId}`;
  }

  async isSeatTaken(eventId: number, seatNumber: number): Promise<boolean> {
    if (seatNumber <= 0) throw new Error("seatNumber must be >= 1");
    const bit = await redis.getbit(this.key(eventId), seatNumber - 1);
    return bit === 1;
  }

  /**
   * Try to acquire a seat atomically. Returns true if acquired, false if already taken.
   */
  async tryAcquireSeat(eventId: number, seatNumber: number): Promise<boolean> {
    if (seatNumber <= 0) throw new Error("seatNumber must be >= 1");
    // SETBIT returns the previous bit value; if 0 -> we successfully acquired
    const prev = await redis.setbit(this.key(eventId), seatNumber - 1, 1);
    return prev === 0;
  }

  /**
   * Release a seat (idempotent)
   */
  async releaseSeat(eventId: number, seatNumber: number): Promise<void> {
    if (seatNumber <= 0) throw new Error("seatNumber must be >= 1");
    await redis.setbit(this.key(eventId), seatNumber - 1, 0);
  }

  /**
   * Get availability map up to capacity. Returns an array of booleans length = capacity
   */
  async getAvailability(eventId: number, capacity: number): Promise<boolean[]> {
    if (capacity <= 0) return [];
    const key = this.key(eventId);
    const result: boolean[] = new Array(capacity);
  
    const chunkSize = 63; // Redis supports up to u63
  
    for (let start = 0; start < capacity; start += chunkSize) {
      const remaining = capacity - start;
      const size = Math.min(chunkSize, remaining);
  
      const val = (await redis.bitfield(
        key,
        "GET",
        `u${size}`,
        start
      )) as number[];
  
      const raw = BigInt(val?.[0] ?? 0);
  
      // Redis makes bit at 'start' be the MSB of this field
      for (let i = 0; i < size; i++) {
        // map seat (start + i) to bit (size - 1 - i)
        result[start + i] = ((raw >> BigInt(size - 1 - i)) & 1n) === 1n;
      }
    }
  
    return result; // true = taken, false = free
  }
}  



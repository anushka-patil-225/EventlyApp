import redis from "../config/redis";

/**
 * SeatService manages per-event seat availability using a Redis bitmap.
 * Key design:
 *   - Bitmap key: seatmap:{eventId}
 *   - Bit value: 0 = free, 1 = taken
 *   - Seat numbers are 1-based externally; internally we store bit at index seat-1
 *   - Atomicity via SETBIT return value comparison and Lua scripts for multi-seat ops if needed
 *   - Optimizations: use BITCOUNT for stats, Lua for atomic multi-seat booking,
 *     and TTL cleanup for finished events
 */
export default class SeatService {
  private key(eventId: number) {
    return `seatmap:${eventId}`;
  }

  /**
   * Check if a seat is taken
   */
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

    const chunkSize = 63; // Redis supports up to u63 per BITFIELD call

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
        result[start + i] =
          ((raw >> BigInt(size - 1 - i)) & 1n) === 1n;
      }
    }

    return result; // true = taken, false = free
  }

  /**
   * Count how many seats are taken (O(1) in Redis)
   */
  async countTakenSeats(eventId: number): Promise<number> {
    return redis.bitcount(this.key(eventId));
  }

  /**
   * Count free seats given capacity
   */
  async countFreeSeats(eventId: number, capacity: number): Promise<number> {
    const taken = await this.countTakenSeats(eventId);
    return Math.max(capacity - taken, 0);
  }

  /**
   * Atomically try to acquire multiple seats.
   * Returns list of acquired seatNumbers, or [] if failed.
   */
  async tryAcquireMultipleSeats(
    eventId: number,
    seatNumbers: number[]
  ): Promise<number[]> {
    if (seatNumbers.some((s) => s <= 0)) {
      throw new Error("seatNumbers must all be >= 1");
    }

    // Lua script for atomic multi-seat acquisition
    const luaScript = `
      local key = KEYS[1]
      for i=1,#ARGV do
        local seat = tonumber(ARGV[i]) - 1
        if redis.call("GETBIT", key, seat) == 1 then
          return {} -- fail if any seat already taken
        end
      end
      local acquired = {}
      for i=1,#ARGV do
        local seat = tonumber(ARGV[i]) - 1
        redis.call("SETBIT", key, seat, 1)
        acquired[i] = tonumber(ARGV[i])
      end
      return acquired
    `;
    const result = (await redis.eval(luaScript, 1, this.key(eventId), ...seatNumbers)) as number[];
    return result || [];
  }

  /**
   * Cleanup seatmap after event is finished (free up Redis memory)
   */
  async cleanupEvent(eventId: number): Promise<void> {
    await redis.del(this.key(eventId));
  }
}

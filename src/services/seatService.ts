import redis from "../config/redis";

export default class SeatService {
  private key(eventId: number) {
    return `seatmap:${eventId}`;
  }

  // Check if seat is already taken
  async isSeatTaken(eventId: number, seatNumber: number): Promise<boolean> {
    if (seatNumber <= 0) throw new Error("seatNumber must be >= 1");
    const bit = await redis.getbit(this.key(eventId), seatNumber - 1);
    return bit === 1;
  }

  // Try acquiring a seat atomically (true if success)
  async tryAcquireSeat(eventId: number, seatNumber: number): Promise<boolean> {
    if (seatNumber <= 0) throw new Error("seatNumber must be >= 1");
    const prev = await redis.setbit(this.key(eventId), seatNumber - 1, 1);
    return prev === 0;
  }

  // Release seat (safe to call multiple times)
  async releaseSeat(eventId: number, seatNumber: number): Promise<void> {
    if (seatNumber <= 0) throw new Error("seatNumber must be >= 1");
    await redis.setbit(this.key(eventId), seatNumber - 1, 0);
  }

  // Get availability map up to capacity
  async getAvailability(eventId: number, capacity: number): Promise<boolean[]> {
    if (capacity <= 0) return [];
    const key = this.key(eventId);
    const result: boolean[] = new Array(capacity);
    const chunkSize = 63; // max bits Redis can fetch in one go

    for (let start = 0; start < capacity; start += chunkSize) {
      const size = Math.min(chunkSize, capacity - start);
      const val = (await redis.bitfield(key, "GET", `u${size}`, start)) as number[];
      const raw = BigInt(val?.[0] ?? 0);

      for (let i = 0; i < size; i++) {
        result[start + i] = ((raw >> BigInt(size - 1 - i)) & 1n) === 1n;
      }
    }
    return result;
  }

  // Count how many seats are taken
  async countTakenSeats(eventId: number): Promise<number> {
    return redis.bitcount(this.key(eventId));
  }

  // Count free seats based on capacity
  async countFreeSeats(eventId: number, capacity: number): Promise<number> {
    const taken = await this.countTakenSeats(eventId);
    return Math.max(capacity - taken, 0);
  }

  // Try acquiring multiple seats atomically
  async tryAcquireMultipleSeats(eventId: number, seatNumbers: number[]): Promise<number[]> {
    if (seatNumbers.some((s) => s <= 0)) throw new Error("seatNumbers must all be >= 1");

    const luaScript = `
      local key = KEYS[1]
      for i=1,#ARGV do
        local seat = tonumber(ARGV[i]) - 1
        if redis.call("GETBIT", key, seat) == 1 then
          return {}
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

  // Cleanup seatmap after event
  async cleanupEvent(eventId: number): Promise<void> {
    await redis.del(this.key(eventId));
  }
}

import { AppDataSource } from "../config/data-source";
import { Event } from "../entities/Event";
import { Booking } from "../entities/Booking";
import { FindOptionsWhere } from "typeorm";

export type ListEventsParams = {
  search?: string;
  upcomingOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "time" | "name";
  order?: "ASC" | "DESC";
};

export class EventService {
  private eventRepo = AppDataSource.getRepository(Event);
  private bookingRepo = AppDataSource.getRepository(Booking);

  async createEvent(data: Partial<Event>): Promise<Event> {
    if (!data.name || !data.venue || !data.time || data.capacity == null) {
      throw new Error("name, venue, time, capacity are required");
    }
    if (Number(data.capacity) < 0) throw new Error("capacity must be >= 0");
    const event = this.eventRepo.create({
      name: data.name,
      venue: data.venue,
      time: new Date(String(data.time)),
      capacity: Number(data.capacity),
      bookedSeats: 0,
    } as Event);
    return this.eventRepo.save(event);
  }

  /**
   * Get event by id. By default only selects basic fields; relations (bookings) are
   * loaded only when explicitly requested to avoid heavy fetches.
   */
  async getEventById(id: number, withBookings = false): Promise<Event | null> {
    if (withBookings) {
      // when admin wants bookings we return full entity with bookings relation
      return this.eventRepo.findOne({
        where: { id },
        relations: ["bookings", "bookings.user"],
      });
    }

    // minimal select for regular requests
    return this.eventRepo.findOne({
      where: { id },
      select: ["id", "name", "venue", "time", "capacity", "bookedSeats", "version"],
    });
  }

  /**
   * List events with pagination and search.
   * Uses lower() + paramized LIKE for case-insensitive search and relies on DB indexes.
   */
  async listEvents(params: ListEventsParams = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));

    const qb = this.eventRepo
      .createQueryBuilder("event")
      .select([
        "event.id",
        "event.name",
        "event.venue",
        "event.time",
        "event.capacity",
        "event.bookedSeats",
      ]);

    if (params.search) {
      // use lower() to match how we expect the index to be used in simple cases
      qb.andWhere("(LOWER(event.name) LIKE :q OR LOWER(event.venue) LIKE :q)", {
        q: `%${params.search.toLowerCase()}%`,
      });
    }

    if (params.upcomingOnly) {
      qb.andWhere("event.time >= NOW()");
    }

    const sortBy = params.sortBy ?? "time";
    const order = params.order ?? "ASC";
    qb.orderBy(`event.${sortBy}`, order)
      .skip((page - 1) * pageSize)
      .take(pageSize);

    // getManyAndCount executes 2 SQLs but keeps logic concise and consistent with filters
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async updateEvent(id: number, updates: Partial<Event>): Promise<Event | null> {
    const event = await this.eventRepo.findOneBy({ id });
    if (!event) return null;

    const { bookedSeats, capacity, ...rest } = updates as any;
    Object.assign(event, rest);
    if (capacity != null) {
      const newCapacity = Number(capacity);
      if (newCapacity < 0) throw new Error("capacity must be >= 0");
      if (newCapacity < event.bookedSeats) {
        throw new Error("capacity cannot be less than already booked seats");
      }
      event.capacity = newCapacity;
    }
    // bookedSeats is managed via reservation helpers, not directly

    return this.eventRepo.save(event);
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await this.eventRepo.delete(id);
    return result.affected !== 0;
  }

  /**
   * Reserve seats atomically using a single UPDATE statement.
   *
   * Rationale:
   * - This approach performs the check and increment inside the DB atomically:
   *   UPDATE event SET bookedSeats = bookedSeats + :seats
   *   WHERE id = :id AND bookedSeats + :seats <= capacity
   *   RETURNING *
   *
   * - This avoids race conditions and pessimistic locking while being highly concurrent-safe.
   * - We also retry a few times in case of transient conflicts.
   */
  async reserveSeats(eventId: number, seats: number, maxRetries = 3): Promise<Event> {
    if (seats <= 0) throw new Error("seats must be > 0");

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Use a single atomic update. This avoids fetching -> modifying -> saving cycles that race.
      const res = await this.eventRepo
        .createQueryBuilder()
        .update(Event)
        .set({ bookedSeats: () => `bookedSeats + ${seats}` })
        .where("id = :id AND bookedSeats + :seats <= capacity", { id: eventId, seats })
        .returning(["id", "name", "venue", "time", "capacity", "bookedSeats", "version"])
        .execute();

      // When rowCount is 0, either event missing or not enough capacity (or concurrent change).
      if (res.raw && res.raw.length > 0) {
        // TypeORM returns raw DB row(s) in res.raw; map it to Event-like object
        const saved = res.raw[0] as Event;
        // Normalize types if needed (bookedSeats may be string depending on DB driver)
        saved.bookedSeats = Number((saved as any).bookedSeats);
        saved.capacity = Number((saved as any).capacity);
        return saved;
      }

      // If no rows returned, check if event exists or not enough seats
      const event = await this.eventRepo.findOne({
        where: { id: eventId },
        select: ["id", "bookedSeats", "capacity"],
      });
      if (!event) throw new Error("Event not found");

      if (event.bookedSeats + seats > event.capacity) {
        throw new Error("Not enough seats available");
      }

      // if the code reached here, it means there was a concurrent update that prevented the update
      // retry after small backoff
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
        continue;
      }

      throw new Error("Failed to reserve seats due to concurrent updates");
    }

    throw new Error("Failed to reserve seats after retries");
  }

  /**
   * Release seats: simple, safe decrement (never negative).
   * We use a single UPDATE to avoid racey fetch->save patterns.
   */
  async releaseSeats(eventId: number, seats: number): Promise<Event> {
    if (seats <= 0) throw new Error("seats must be > 0");

    // perform atomic update: set bookedSeats = GREATEST(bookedSeats - seats, 0)
    const res = await this.eventRepo
      .createQueryBuilder()
      .update(Event)
      .set({ bookedSeats: () => `GREATEST(bookedSeats - ${seats}, 0)` })
      .where("id = :id", { id: eventId })
      .returning(["id", "name", "venue", "time", "capacity", "bookedSeats", "version"])
      .execute();

    if (!res.raw || res.raw.length === 0) throw new Error("Event not found");
    const updated = res.raw[0] as Event;
    updated.bookedSeats = Number((updated as any).bookedSeats);
    updated.capacity = Number((updated as any).capacity);
    return updated;
  }

  /** Basic analytics for admins (pushed to DB for aggregation) */
  async getAnalytics() {
    const totalEvents = await this.eventRepo.count();

    const mostPopular = await this.eventRepo
      .createQueryBuilder("event")
      .leftJoin("event.bookings", "booking")
      .select(["event.id AS id", "event.name AS name"])
      .addSelect("COUNT(booking.id)", "bookings")
      .groupBy("event.id")
      .orderBy("bookings", "DESC")
      .limit(10)
      .getRawMany();

    // Compute utilization in DB to avoid loading all event rows into memory when many events exist.
    const utilizationRaw = await this.eventRepo
      .createQueryBuilder("event")
      .select([
        "event.id AS id",
        "event.name AS name",
        "event.capacity AS capacity",
        "event.bookedSeats AS bookedSeats",
        "CASE WHEN event.capacity = 0 THEN 0 ELSE (event.bookedSeats::float / event.capacity::float) * 100 END AS utilization_pct",
      ])
      .orderBy("utilization_pct", "DESC")
      .getRawMany();

    const utilization = utilizationRaw.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      capacity: Number(r.capacity),
      bookedSeats: Number(r.bookedSeats),
      utilizationPct: Number(Number(r.utilization_pct).toFixed(2)),
    }));

    return {
      totalEvents,
      mostPopular: mostPopular.map((r) => ({ id: Number(r.id), name: r.name as string, bookings: Number(r.bookings) })),
      utilization,
    };
  }
}

export default EventService;

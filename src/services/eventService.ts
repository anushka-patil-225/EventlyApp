import { AppDataSource } from "../config/data-source";
import { Event } from "../entities/Event";
import { Booking } from "../entities/Booking";
import { parseDateAssumingIST } from "../utils/timezone";

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

  /** Create a new event */
  async createEvent(data: Partial<Event>): Promise<Event> {
    if (!data.name || !data.venue || !data.time || data.capacity == null) {
      throw new Error("name, venue, time, capacity are required");
    }
    if (Number(data.capacity) < 0) throw new Error("capacity must be >= 0");

    const event = this.eventRepo.create({
      name: data.name,
      venue: data.venue,
      time: parseDateAssumingIST(data.time),
      capacity: Number(data.capacity),
      bookedSeats: 0,
    } as Event);

    return this.eventRepo.save(event);
  }

  /** Get event by id (optionally with bookings) */
  async getEventById(id: number, withBookings = false): Promise<Event | null> {
    if (withBookings) {
      return this.eventRepo.findOne({
        where: { id },
        relations: ["bookings", "bookings.user"],
      });
    }

    return this.eventRepo.findOne({
      where: { id },
      select: [
        "id",
        "name",
        "venue",
        "time",
        "capacity",
        "bookedSeats",
        "version",
      ],
    });
  }

  /** List events with pagination, search & sorting */
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
      qb.andWhere("(LOWER(event.name) LIKE :q OR LOWER(event.venue) LIKE :q)", {
        q: `%${params.search.toLowerCase()}%`,
      });
    }

    if (params.upcomingOnly) {
      qb.andWhere("event.time >= NOW()");
    }

    qb.orderBy(`event.${params.sortBy ?? "time"}`, params.order ?? "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** Update event (capacity check included) */
  async updateEvent(id: number, updates: Partial<Event>): Promise<Event | null> {
    const event = await this.eventRepo.findOneBy({ id });
    if (!event) return null;

    const { bookedSeats, capacity, time, ...rest } = updates as any;
    Object.assign(event, rest);

    if (time != null) {
      event.time = parseDateAssumingIST(time);
    }

    if (capacity != null) {
      const newCapacity = Number(capacity);
      if (newCapacity < 0) throw new Error("capacity must be >= 0");
      if (newCapacity < event.bookedSeats) {
        throw new Error("capacity cannot be less than booked seats");
      }
      event.capacity = newCapacity;
    }

    return this.eventRepo.save(event);
  }

  /** Delete event */
  async deleteEvent(id: number): Promise<boolean> {
    const result = await this.eventRepo.delete(id);
    return result.affected !== 0;
  }

  /** Reserve seats atomically (safe against race conditions) */
  async reserveSeats(
    eventId: number,
    seats: number,
    maxRetries = 3
  ): Promise<Event> {
    if (seats <= 0) throw new Error("seats must be > 0");

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await this.eventRepo
        .createQueryBuilder()
        .update(Event)
        .set({ bookedSeats: () => `bookedSeats + ${seats}` })
        .where("id = :id AND bookedSeats + :seats <= capacity", {
          id: eventId,
          seats,
        })
        .returning([
          "id",
          "name",
          "venue",
          "time",
          "capacity",
          "bookedSeats",
          "version",
        ])
        .execute();

      if (res.raw && res.raw.length > 0) {
        const saved = res.raw[0] as Event;
        saved.bookedSeats = Number((saved as any).bookedSeats);
        saved.capacity = Number((saved as any).capacity);
        return saved;
      }

      const event = await this.eventRepo.findOne({
        where: { id: eventId },
        select: ["id", "bookedSeats", "capacity"],
      });
      if (!event) throw new Error("Event not found");
      if (event.bookedSeats + seats > event.capacity) {
        throw new Error("Not enough seats available");
      }

      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
        continue;
      }

      throw new Error("Failed to reserve seats due to concurrent updates");
    }

    throw new Error("Failed to reserve seats after retries");
  }

  /** Release seats (safe decrement) */
  async releaseSeats(eventId: number, seats: number): Promise<Event> {
    if (seats <= 0) throw new Error("seats must be > 0");

    const res = await this.eventRepo
      .createQueryBuilder()
      .update(Event)
      .set({ bookedSeats: () => `GREATEST(bookedSeats - ${seats}, 0)` })
      .where("id = :id", { id: eventId })
      .returning([
        "id",
        "name",
        "venue",
        "time",
        "capacity",
        "bookedSeats",
        "version",
      ])
      .execute();

    if (!res.raw || res.raw.length === 0) throw new Error("Event not found");
    const updated = res.raw[0] as Event;
    updated.bookedSeats = Number((updated as any).bookedSeats);
    updated.capacity = Number((updated as any).capacity);
    return updated;
  }

  /** Basic analytics for admins */
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

    const utilizationRaw = await this.eventRepo
      .createQueryBuilder("event")
      .select([
        "event.id AS id",
        "event.name AS name",
        "event.capacity AS capacity",
        `"event"."bookedSeats" AS "bookedSeats"`,
        `CASE WHEN event.capacity = 0 THEN 0 
              ELSE ("event"."bookedSeats"::float / event.capacity::float) * 100 
         END AS "utilization_pct"`,
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
      mostPopular: mostPopular.map((r) => ({
        id: Number(r.id),
        name: r.name as string,
        bookings: Number(r.bookings),
      })),
      utilization,
    };
  }
}

export default EventService;

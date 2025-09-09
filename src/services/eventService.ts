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

  async getEventById(id: number, withBookings = false): Promise<Event | null> {
    return this.eventRepo.findOne({
      where: { id },
      relations: withBookings ? ["bookings", "bookings.user"] : undefined,
    });
  }

  async listEvents(params: ListEventsParams = {}) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const where: FindOptionsWhere<Event> = {};

    if (params.upcomingOnly) {
      // handled in query builder below using >= NOW()
    }

    const qb = this.eventRepo
      .createQueryBuilder("event")
      .where("1=1");

    if (params.search) {
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
   * Reserve seats with optimistic retries to prevent overselling.
   */
  async reserveSeats(eventId: number, seats: number, maxRetries = 3): Promise<Event> {
    if (seats <= 0) throw new Error("seats must be > 0");

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const event = await this.eventRepo.findOneBy({ id: eventId });
      if (!event) throw new Error("Event not found");
      
      console.log(`Reserving ${seats} seats for event ${eventId}. Current bookedSeats: ${event.bookedSeats}, capacity: ${event.capacity}`);
      
      if (event.bookedSeats + seats > event.capacity) {
        throw new Error("Not enough seats available");
      }
      event.bookedSeats += seats;
      
      console.log(`After reservation - bookedSeats: ${event.bookedSeats}`);
      
      try {
        const savedEvent = await this.eventRepo.save(event); // will bump version; concurrent save will throw
        console.log(`Event saved successfully. Final bookedSeats: ${savedEvent.bookedSeats}`);
        return savedEvent;
      } catch (err) {
        console.error(`Save attempt ${attempt + 1} failed:`, err);
        if (attempt === maxRetries - 1) throw err as Error;
        // small backoff before retry
        await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
      }
    }
    throw new Error("Failed to reserve seats after retries");
  }

  async releaseSeats(eventId: number, seats: number): Promise<Event> {
    if (seats <= 0) throw new Error("seats must be > 0");
    const event = await this.eventRepo.findOneBy({ id: eventId });
    if (!event) throw new Error("Event not found");
    event.bookedSeats = Math.max(0, event.bookedSeats - seats);
    return this.eventRepo.save(event);
  }

  /** Basic analytics for admins */
  async getAnalytics() {
    const totalEvents = await this.eventRepo.count();

    const mostPopular = await this.eventRepo
      .createQueryBuilder("event")
      .leftJoin("event.bookings", "booking")
      .select(["event.id AS id", "event.name AS name"]).addSelect("COUNT(booking.id)", "bookings")
      .groupBy("event.id")
      .orderBy("bookings", "DESC")
      .limit(10)
      .getRawMany();

    // Get all events with their current bookedSeats values
    const events = await this.eventRepo.find();
    
    const utilization = events.map(event => ({
      id: event.id,
      name: event.name,
      capacity: event.capacity,
      bookedSeats: event.bookedSeats,
      utilizationPct: event.capacity === 0 ? 0 : Number(((event.bookedSeats / event.capacity) * 100).toFixed(2)),
    }));

    return {
      totalEvents,
      mostPopular: mostPopular.map(r => ({ id: Number(r.id), name: r.name as string, bookings: Number(r.bookings) })),
      utilization,
    };
  }
}

export default EventService;



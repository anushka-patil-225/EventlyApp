import { AppDataSource } from "../config/data-source";
import { Booking } from "../entities/Booking";
import { Event } from "../entities/Event";
import { User } from "../entities/User";
import EventService from "./eventService";
import SeatService from "./seatService";

export class BookingService {
  private bookingRepo = AppDataSource.getRepository(Booking);
  private userRepo = AppDataSource.getRepository(User);
  private eventRepo = AppDataSource.getRepository(Event);
  private eventService = new EventService();
  private seatService = new SeatService();

  /**
   * Create a booking for a user on an event.
   * If seatIds provided, confirms those seats; otherwise reserves any N seats.
   */
  async createBooking(userId: number, eventId: number, _seatIds?: string[], seatNumber?: number): Promise<Booking> {
    const [user, event] = await Promise.all([
      this.userRepo.findOneBy({ id: userId }),
      this.eventRepo.findOneBy({ id: eventId }),
    ]);

    if (!user) throw new Error("User not found");
    if (!event) throw new Error("Event not found");
    if (new Date(event.time) < new Date()) throw new Error("Cannot book past events");

    // Prevent duplicate active booking by the same user for the same event
    const existing = await this.bookingRepo.findOne({
      where: { user: { id: userId }, event: { id: eventId }, status: "booked" },
      relations: ["user", "event"],
    });
    if (existing) throw new Error("You already have an active booking for this event");

    // If seatNumber specified: use Redis bitmap to atomically acquire the seat
    if (seatNumber != null) {
      if (seatNumber < 1 || seatNumber > event.capacity) {
        throw new Error("Invalid seat number");
      }
      const acquired = await this.seatService.tryAcquireSeat(event.id, seatNumber);
      if (!acquired) {
        throw new Error("Seat already taken");
      }
      await this.eventService.reserveSeats(event.id, 1);
      const booking = this.bookingRepo.create({ user, event, status: "booked", seatNumber });
      try {
        return await this.bookingRepo.save(booking);
      } catch (err) {
        // If DB save fails (e.g., unique constraint) release the seat
        await this.seatService.releaseSeat(event.id, seatNumber);
        await this.eventService.releaseSeats(event.id, 1);
        throw err as Error;
      }
    }

    // Fallback: no seat selection — ensure capacity and create booking without seatNumber
    await this.eventService.reserveSeats(event.id, 1);
    const booking = this.bookingRepo.create({ user, event, status: "booked", seatNumber: null });
    return this.bookingRepo.save(booking);
  }

  /**
   * Cancel a booking. Only the booking owner or an admin can cancel.
   * Releases the reserved seat.
   */
  async cancelBooking(bookingId: number, requesterId: number, requesterIsAdmin = false): Promise<Booking> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ["user", "event"],
    });
    if (!booking) throw new Error("Booking not found");

    if (!requesterIsAdmin && booking.user.id !== requesterId) {
      throw new Error("Not authorized to cancel this booking");
    }

    if (booking.status === "cancelled") return booking;

    booking.status = "cancelled";
    const saved = await this.bookingRepo.save(booking);
    await this.eventService.releaseSeats(booking.event.id, 1);
    if (booking.seatNumber != null) {
      await this.seatService.releaseSeat(booking.event.id, booking.seatNumber);
    }
    return saved;
  }

  /**
   * Get booking history for a user (most recent first)
   */
  async getUserBookings(userId: number) {
    console.log("BookingService: Getting bookings for userId:", userId);
    try {
      const bookings = await this.bookingRepo.find({
        where: { user: { id: userId } },
        relations: ["event"],
        order: { createdAt: "DESC" },
      });
      console.log("BookingService: Found bookings:", bookings.length);
      return bookings;
    } catch (error) {
      console.error("BookingService: Error fetching user bookings:", error);
      throw error;
    }
  }

  /**
   * List bookings for an event (admin)
   */
  async getEventBookings(eventId: number) {
    return this.bookingRepo.find({
      where: { event: { id: eventId } },
      relations: ["user"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Basic analytics across bookings
   */
  async getAnalytics() {
    const qb = this.bookingRepo.createQueryBuilder("booking");
    const totalBookings = await qb.getCount();

    const cancelledCount = await this.bookingRepo.count({ where: { status: "cancelled" } });

    const mostBookedEvents = await this.bookingRepo
      .createQueryBuilder("b")
      .leftJoin("b.event", "event")
      .select(["event.id AS id", "event.name AS name"]) 
      .addSelect("COUNT(b.id)", "bookings")
      .where("b.status = :status", { status: "booked" })
      .groupBy("event.id")
      .orderBy("bookings", "DESC")
      .limit(10)
      .getRawMany();

    const dailyStats = await this.bookingRepo
      .createQueryBuilder("b")
      .select("DATE_TRUNC('day', b.createdAt)", "day")
      .addSelect("COUNT(*)", "bookings")
      .groupBy("day")
      .orderBy("day", "DESC")
      .limit(30)
      .getRawMany();

    return {
      totalBookings,
      cancelledCount,
      mostBookedEvents: mostBookedEvents.map(r => ({ id: Number(r.id), name: r.name as string, bookings: Number(r.bookings) })),
      daily: dailyStats.map(r => ({ day: String(r.day), bookings: Number(r.bookings) })),
    };
  }
}

export default BookingService;



import { AppDataSource } from "../config/data-source";
import { Booking } from "../entities/Booking";
import { Event } from "../entities/Event";
import { User } from "../entities/User";
import EventService from "./eventService";
import SeatService from "./seatService";
import { DataSource } from "typeorm";

export class BookingService {
  private bookingRepo = AppDataSource.getRepository(Booking);
  private userRepo = AppDataSource.getRepository(User);
  private eventRepo = AppDataSource.getRepository(Event);
  private eventService = new EventService();
  private seatService = new SeatService();

  /**
   * Create a booking (optimized with transactions & query shortcuts).
   */
  async createBooking(
    userId: number,
    eventId: number,
    _seatIds?: string[],
    seatNumbers?: number[] // <-- changed from seatNumber?: number
  ): Promise<Booking[]> {
    // <-- returns array
    return await AppDataSource.transaction(async (manager) => {
      // Check existence with SELECT 1 instead of fetching full entity
      const userExists = await manager
        .getRepository(User)
        .createQueryBuilder("u")
        .where("u.id = :userId", { userId })
        .select("1")
        .getRawOne();

      if (!userExists) throw new Error("User not found");

      const event = await manager.getRepository(Event).findOne({
        where: { id: eventId },
        select: ["id", "time", "capacity"],
      });
      if (!event) throw new Error("Event not found");
      if (new Date(event.time) < new Date())
        throw new Error("Cannot book past events");

      // Use EXISTS instead of fetching entire row
      // const existing = await manager
      //   .getRepository(Booking)
      //   .createQueryBuilder("b")
      //   .where("b.userId = :userId", { userId })
      //   .andWhere("b.eventId = :eventId", { eventId })
      //   .andWhere("b.status = 'booked'")
      //   .select("1")
      //   .getRawOne();

      // if (existing) throw new Error("You already have an active booking");

      // Multi-seat booking
      let seatCount = 1;
      let acquiredSeats: number[] = [];
      if (seatNumbers && seatNumbers.length > 0) {
        seatCount = seatNumbers.length;
        // Validate seat numbers
        if (seatNumbers.some((n) => n < 1 || n > event.capacity)) {
          throw new Error("Invalid seat number(s)");
        }
        // Try to acquire all seats atomically
        acquiredSeats = await this.seatService.tryAcquireMultipleSeats(
          event.id,
          seatNumbers
        );
        if (acquiredSeats.length !== seatNumbers.length) {
          // Release any acquired seats
          for (const n of acquiredSeats) {
            await this.seatService.releaseSeat(event.id, n);
          }
          throw new Error("One or more seats already taken");
        }
        await this.eventService.reserveSeats(event.id, seatCount);

        // Create a booking row for each seat
        const bookings = seatNumbers.map((seatNumber) =>
          manager.create(Booking, {
            user: { id: userId },
            event: { id: eventId },
            status: "booked",
            seatNumber,
          })
        );
        try {
          return await manager.save(bookings);
        } catch (err) {
          // Rollback: release seats and decrement bookedSeats
          for (const n of seatNumbers) {
            await this.seatService.releaseSeat(event.id, n);
          }
          await this.eventService.releaseSeats(event.id, seatCount);
          throw err;
        }
      }

      // General booking (no seatNumbers)
      await this.eventService.reserveSeats(event.id, 1);
      const booking = manager.create(Booking, {
        user: { id: userId },
        event: { id: eventId },
        status: "booked",
        seatNumber: null,
      });

      return [await manager.save(booking)];
    });
  }

  /**
   * Cancel booking (optimized with transaction & direct updates).
   */
  async cancelBooking(
    bookingId: number,
    requesterId: number,
    requesterIsAdmin = false
  ): Promise<Booking> {
    return await AppDataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id: bookingId },
        relations: ["user", "event"],
      });
      if (!booking) throw new Error("Booking not found");

      if (!requesterIsAdmin && booking.user.id !== requesterId) {
        throw new Error("Not authorized to cancel this booking");
      }
      if (booking.status === "cancelled") return booking;

      booking.status = "cancelled";
      const saved = await manager.save(booking);

      await this.eventService.releaseSeats(booking.event.id, 1);
      if (booking.seatNumber != null) {
        await this.seatService.releaseSeat(
          booking.event.id,
          booking.seatNumber
        );
      }

      return saved;
    });
  }

  /**
   * User booking history (fetch only required fields).
   */
  async getUserBookings(userId: number) {
    return this.bookingRepo.find({
      where: { user: { id: userId } },
      relations: ["event"],
      select: {
        id: true,
        status: true,
        createdAt: true,
        seatNumber: true,
        event: { id: true, name: true, time: true },
      },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Event bookings (admin view).
   */
  async getEventBookings(eventId: number) {
    return this.bookingRepo.find({
      where: { event: { id: eventId } },
      relations: ["user"],
      select: {
        id: true,
        status: true,
        seatNumber: true,
        createdAt: true,
        user: { id: true, email: true, name: true },
      },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Analytics optimized for DB-level aggregation.
   */
  async getAnalytics() {
    const totalBookings = await this.bookingRepo.count();
    const cancelledCount = await this.bookingRepo.count({
      where: { status: "cancelled" },
    });

    const mostBookedEvents = await this.bookingRepo
      .createQueryBuilder("b")
      .leftJoin("b.event", "event")
      .select("event.id", "id")
      .addSelect("event.name", "name")
      .addSelect("COUNT(b.id)", "bookings")
      .where("b.status = 'booked'")
      .groupBy("event.id")
      .orderBy("bookings", "DESC")
      .limit(10)
      .getRawMany();

    const dailyStats = await this.bookingRepo
      .createQueryBuilder("b")
      .select("DATE_TRUNC('day', b.createdAt)", "day")
      .addSelect("COUNT(b.id)", "bookings")
      .groupBy("day")
      .orderBy("day", "DESC")
      .limit(30)
      .getRawMany();

    return {
      totalBookings,
      cancelledCount,
      mostBookedEvents: mostBookedEvents.map((r) => ({
        id: Number(r.id),
        name: r.name,
        bookings: Number(r.bookings),
      })),
      daily: dailyStats.map((r) => ({
        day: String(r.day),
        bookings: Number(r.bookings),
      })),
    };
  }
}

export default BookingService;

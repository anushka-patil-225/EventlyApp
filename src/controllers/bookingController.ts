import { Request, Response } from "express";
import BookingService from "../services/bookingService";

const bookingService = new BookingService();

// Create booking (single or multiple seats)
export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as number;
    const { eventId, seatNumbers } = req.body as {
      eventId: number;
      seatNumbers?: number[];
    };
    if (!eventId) return res.status(400).json({ error: "eventId required" });

    const bookings = await bookingService.createBooking(
      Number(userId),
      Number(eventId),
      undefined,
      seatNumbers
    );

    res.status(201).json(bookings);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// Cancel booking (user or admin)
export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const bookingId = Number(req.params.id);
    const requesterId = (req as any).user?.id as number;
    const isAdmin = (req as any).user?.role === "admin";
    const booking = await bookingService.cancelBooking(
      bookingId,
      Number(requesterId),
      Boolean(isAdmin)
    );
    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// Get bookings of logged-in user
export const myBookings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as number;
    if (!userId) return res.status(401).json({ error: "User ID not found in token" });

    const bookings = await bookingService.getUserBookings(Number(userId));
    res.json(bookings);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// Get all bookings for an event
export const eventBookings = async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.eventId);
    const bookings = await bookingService.getEventBookings(eventId);
    res.json(bookings);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// Booking analytics
export const analytics = async (_req: Request, res: Response) => {
  try {
    const data = await bookingService.getAnalytics();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

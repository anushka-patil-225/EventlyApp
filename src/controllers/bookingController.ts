import { Request, Response } from "express";
import BookingService from "../services/bookingService";

const bookingService = new BookingService();

export const createBooking = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as number;
    const { eventId, seatNumber } = req.body as { eventId: number; seatNumber?: number };
    const booking = await bookingService.createBooking(Number(userId), Number(eventId), undefined, seatNumber);
    res.status(201).json(booking);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const bookingId = Number(req.params.id);
    const requesterId = (req as any).user?.id as number;
    const isAdmin = (req as any).user?.role === "admin";
    const booking = await bookingService.cancelBooking(bookingId, Number(requesterId), Boolean(isAdmin));
    res.json(booking);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const myBookings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id as number;
    console.log("Getting bookings for user ID:", userId);
    
    if (!userId) {
      return res.status(401).json({ error: "User ID not found in token" });
    }
    
    const bookings = await bookingService.getUserBookings(Number(userId));
    console.log("Found bookings:", bookings.length);
    res.json(bookings);
  } catch (err: any) {
    console.error("Error in myBookings:", err);
    res.status(400).json({ error: err.message });
  }
};

export const eventBookings = async (req: Request, res: Response) => {
  try {
    const eventId = Number(req.params.eventId);
    const bookings = await bookingService.getEventBookings(eventId);
    res.json(bookings);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const analytics = async (_req: Request, res: Response) => {
  try {
    const data = await bookingService.getAnalytics();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};



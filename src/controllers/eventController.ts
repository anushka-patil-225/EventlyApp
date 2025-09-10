import { Request, Response } from "express";
import EventService from "../services/eventService";
import SeatService from "../services/seatService";


const eventService = new EventService();
const seatService = new SeatService();

export const createEvent = async (req: Request, res: Response) => {
  try {
    const event = await eventService.createEvent(req.body);
    res.status(201).json(event);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const getEventById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const event = await eventService.getEventById(id, true);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getSeatAvailability = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const event = await eventService.getEventById(id, false);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const availability = await seatService.getAvailability(event.id, event.capacity);
    res.json({ eventId: event.id, capacity: event.capacity, taken: availability });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const listEvents = async (req: Request, res: Response) => {
  try {
    const { search, upcomingOnly, page, pageSize, sortBy, order } = req.query as any;
    const result = await eventService.listEvents({
      search,
      upcomingOnly: upcomingOnly === "true" || upcomingOnly === true,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      sortBy: sortBy as any,
      order: order as any,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updated = await eventService.updateEvent(id, req.body);
    if (!updated) return res.status(404).json({ error: "Event not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = await eventService.deleteEvent(id);
    if (!deleted) return res.status(404).json({ error: "Event not found" });
    res.json({ message: "Event deleted" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const analytics = async (_req: Request, res: Response) => {
  try {
    const data = await eventService.getAnalytics();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};




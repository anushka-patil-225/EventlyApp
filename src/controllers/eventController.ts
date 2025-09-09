import { Request, Response } from "express";
import EventService from "../services/eventService";
import { AppDataSource } from "../config/data-source";
import { Seat } from "../entities/Seat";

const eventService = new EventService();

export const createEvent = async (req: Request, res: Response) => {
  try {
    const event = await eventService.createEvent(req.body);
    // Optional auto-generate seats based on capacity
    if (req.body.generateSeats) {
      const rows = Number(req.body.rows ?? req.body.capacity ?? 1);
      const cols = Number(req.body.cols ?? 1);
      const seatRepo = AppDataSource.getRepository(Seat);
      const seats: Partial<Seat>[] = [];
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      for (let r = 0; r < rows; r++) {
        const label = alphabet[r] ?? `R${r+1}`;
        for (let c = 0; c < (cols || 1); c++) {
          const seatNumber = `${label}-${c+1}`;
          seats.push({
            eventId: event.id,
            seatNumber,
            status: "available" as any,
            rowIndex: r,
            colIndex: c,
            rowLabel: label,
          });
        }
      }
      await seatRepo.insert(seats);
    }
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

export const generateSeats = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { rows, cols } = req.body as { rows: number; cols: number };
    if (!rows || rows <= 0) return res.status(400).json({ error: "rows must be > 0" });
    if (!cols || cols <= 0) return res.status(400).json({ error: "cols must be > 0" });

    const seatRepo = AppDataSource.getRepository(Seat);
    const seats: Partial<Seat>[] = [];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < rows; r++) {
      const label = alphabet[r] ?? `R${r+1}`;
      for (let c = 0; c < cols; c++) {
        seats.push({
          eventId: id,
          seatNumber: `${label}-${c+1}`,
          status: "available" as any,
          rowIndex: r,
          colIndex: c,
          rowLabel: label,
        });
      }
    }
    await seatRepo.insert(seats);
    res.status(201).json({ created: seats.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};



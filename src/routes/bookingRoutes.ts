import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  createBooking,
  cancelBooking,
  myBookings,
  eventBookings,
  analytics,
} from "../controllers/bookingController";
import SeatService from "../services/seatService";

const router = Router();
const seatService = new SeatService();

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking APIs
 */

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Create a booking for current user
 *     tags: [Bookings]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId]
 *             properties:
 *               eventId: { type: integer }
 *     responses:
 *       201:
 *         description: Booking created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 status:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                 event:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     venue:
 *                       type: string
 *                     time:
 *                       type: string
 *                       format: date-time
 *                     capacity:
 *                       type: integer
 *                     bookedSeats:
 *                       type: integer
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/", authenticate, createBooking);

/**
 * @swagger
 * /bookings/{id}:
 *   delete:
 *     summary: Cancel a booking (owner or admin)
 *     tags: [Bookings]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Booking cancelled
 */
router.delete("/:id", authenticate, cancelBooking);

/**
 * @swagger
 * /bookings/me:
 *   get:
 *     summary: Get my booking history
 *     tags: [Bookings]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: List of user's bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   status:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   event:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       venue:
 *                         type: string
 *                       time:
 *                         type: string
 *                         format: date-time
 *                       capacity:
 *                         type: integer
 *                       bookedSeats:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Bad request
 */
router.get("/me", authenticate, myBookings);

/**
 * @swagger
 * /bookings/event/{eventId}:
 *   get:
 *     summary: List bookings for an event (admin)
 *     tags: [Bookings]
 *     security: [ { bearerAuth: [] } ]
 */
router.get("/event/:eventId", authenticate, authorizeRoles("admin"), eventBookings);

/**
 * @swagger
 * /bookings/analytics/summary:
 *   get:
 *     summary: Booking analytics (admin)
 *     tags: [Bookings]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Booking analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalBookings:
 *                   type: integer
 *                   description: Total number of bookings
 *                 cancelledCount:
 *                   type: integer
 *                   description: Number of cancelled bookings
 *                 mostBookedEvents:
 *                   type: array
 *                   description: Most booked events
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       bookings:
 *                         type: integer
 *                 daily:
 *                   type: array
 *                   description: Daily booking statistics
 *                   items:
 *                     type: object
 *                     properties:
 *                       day:
 *                         type: string
 *                         format: date
 *                       bookings:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       500:
 *         description: Server error
 */
router.get("/analytics/summary", authenticate, authorizeRoles("admin"), analytics);

/**
 * @swagger
 * /bookings/hold:
 *   post:
 *     summary: Hold seats temporarily for the current user
 *     tags: [Bookings]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, count]
 *             properties:
 *               eventId: { type: integer }
 *               count: { type: integer }
 *               ttlSeconds: { type: integer }
 *     responses:
 *       201:
 *         description: Seats held
 */
router.post("/hold", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user?.id as number;
    const { eventId, count, ttlSeconds } = req.body as { eventId: number; count: number; ttlSeconds?: number };
    const seatIds = await seatService.holdSeats({ eventId: Number(eventId), count: Number(count), heldBy: String(userId), ttlSeconds });
    res.status(201).json({ seatIds, expiresInSeconds: ttlSeconds ?? 120 });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;



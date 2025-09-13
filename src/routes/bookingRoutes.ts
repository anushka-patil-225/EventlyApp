import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  createBooking,
  cancelBooking,
  myBookings,
  eventBookings,
  analytics,
} from "../controllers/bookingController";

const router = Router();

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
 *               seatNumbers:
 *                 type: array
 *                 items: { type: integer }
 *                 description: "Optional array of 1-based seat numbers"
 *     responses:
 *       201:
 *         description: Bookings created
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
 *                   user:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
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
router.get(
  "/event/:eventId",
  authenticate,
  authorizeRoles("admin"),
  eventBookings
);

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
router.get(
  "/analytics/summary",
  authenticate,
  authorizeRoles("admin"),
  analytics
);

// Seat hold endpoint removed as seat functionality has been deprecated (Swagger block deleted)

export default router;

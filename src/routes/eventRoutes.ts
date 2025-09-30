import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth";
import {
  createEvent,
  getEventById,
  listEvents,
  updateEvent,
  deleteEvent,
  analytics,
  getSeatAvailability,
} from "../controllers/eventController";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event management APIs
 */

/**
 * @swagger
 * /events:
 *   get:
 *     summary: List events
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: upcomingOnly
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paged list of events
 */
router.get("/", listEvents);

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event by id
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Event
 *       404:
 *         description: Not found
 */
router.get("/:id", getEventById);

/**
 * @swagger
 * /events/{id}/seats:
 *   get:
 *     summary: Get seat availability bitmap for an event (true=taken, false=free)
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Seat availability
 */
router.get("/:id/seats", getSeatAvailability);

/**
 * @swagger
 * /events:
 *   post:
 *     summary: Create event (admin)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, venue, time, capacity]
 *             properties:
*               name: { type: string }
*               venue: { type: string }
*               time:
*                 type: string
*                 format: date-time
*                 description: |
*                   ISO timestamp. If you omit timezone (e.g. `2025-09-30T09:00:00`),
*                   the backend treats it as IST (Asia/Kolkata).
*                 example: "2025-09-30T09:00:00"
*               capacity: { type: integer }
 *
 *     responses:
 *       201:
 *         description: Created
 */
router.post("/", authenticate, authorizeRoles("admin"), createEvent);

/**
 * @swagger
 * /events/{id}:
 *   put:
 *     summary: Update event (admin)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Event Name"
 *               venue:
 *                 type: string
 *                 example: "Updated Venue"
*               time:
*                 type: string
*                 format: date-time
*                 description: |
*                   ISO timestamp. If timezone is omitted it is interpreted as IST.
*                 example: "2025-12-01T15:30:00"
 *               capacity:
 *                 type: integer
 *                 example: 500
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 venue:
 *                   type: string
*                 time:
*                   type: string
*                   format: date-time
*                   description: UTC timestamp stored by the backend
*                 timeIst:
*                   type: string
*                   description: Human-readable IST representation
 *                 capacity:
 *                   type: integer
 *                 bookedSeats:
 *                   type: integer
 *                 version:
 *                   type: integer
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Event not found
 */
router.put("/:id", authenticate, authorizeRoles("admin"), updateEvent);

/**
 * @swagger
 * /events/{id}:
 *   delete:
 *     summary: Delete event (admin)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Event deleted"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       404:
 *         description: Event not found
 */
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteEvent);

/**
 * @swagger
 * /events/analytics/summary:
 *   get:
 *     summary: Event analytics (admin)
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Event analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalEvents:
 *                   type: integer
 *                   description: Total number of events
 *                 mostPopular:
 *                   type: array
 *                   description: Most popular events by booking count
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       bookings:
 *                         type: integer
 *                 utilization:
 *                   type: array
 *                   description: Event capacity utilization data
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       capacity:
 *                         type: integer
 *                       bookedSeats:
 *                         type: integer
 *                       utilizationPct:
 *                         type: integer
 *                         description: Utilization percentage (0-100)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin only)
 *       500:
 *         description: Server error
 */
router.get("/analytics/summary", authenticate, authorizeRoles("admin"), analytics);

// Seat generation route removed (seat functionality deprecated) — Swagger block deleted

export default router;



// Booking entity: links users to events with seat assignments and status.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
  Index,
} from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

@Entity({ name: "booking", schema: "evently" })
@Index("IDX_booking_userId", ["user"]) // Fast lookups by user
@Index("IDX_booking_eventId", ["event"]) // Fast lookups by event
@Index("IDX_booking_status", ["status"]) // Queries by status (booked/cancelled)
@Index("IDX_booking_createdAt", ["createdAt"]) // Recent bookings
export class Booking {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number; // Primary key

  @Column({ type: "varchar", default: "booked", name: "status" })
  status!: string; // Booking status (booked/cancelled)

  @Column({ type: "integer", nullable: true, name: "seatNumber" })
  seatNumber!: number | null; // Seat number (nullable for general admission)

  @CreateDateColumn({ name: "createdAt" })
  createdAt!: Date; // Auto-set booking creation time

  @ManyToOne(() => User, (user) => user.bookings, { onDelete: "CASCADE" })
  user!: User; // Relation: booking belongs to a user

  @ManyToOne(() => Event, (event) => event.bookings, { onDelete: "CASCADE" })
  event!: Event; // Relation: booking belongs to an event
}

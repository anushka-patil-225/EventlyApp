import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, Unique, Index } from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

@Entity()
@Unique("UK_event_seat", ["event", "seatNumber"]) // Prevents duplicate seat for same event
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, user => user.bookings, { onDelete: "CASCADE" })
  @Index("IDX_booking_user") // Optimizes queries filtering by user
  user!: User;

  @ManyToOne(() => Event, event => event.bookings, { onDelete: "CASCADE" })
  @Index("IDX_booking_event") // Optimizes queries filtering by event
  event!: Event;

  @Column({ default: "booked" })
  @Index("IDX_booking_status") // Helps queries filtering by status
  status!: string;

  // 1-based seat number; null for legacy bookings without seat selection
  @Column({ type: "int", nullable: true })
  seatNumber!: number | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  @Index("IDX_booking_createdAt") // Speeds up analytics/daily stats queries
  createdAt!: Date;
}

// Composite index for duplicate prevention & fast lookups
@Index("IDX_booking_user_event_status", ["user", "event", "status"])
@Entity()
export class BookingIndexed extends Booking {}

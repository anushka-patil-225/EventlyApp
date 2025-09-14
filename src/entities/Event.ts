// Event entity: stores event details, capacity, and links to bookings.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  VersionColumn,
  Index,
} from "typeorm";
import { Booking } from "./Booking";

@Entity()
@Index("IDX_event_time", ["time"])          // Filter/sort upcoming events
@Index("IDX_event_name", ["name"])          // Search/sort by name
@Index("IDX_event_venue", ["venue"])        // Search by venue
@Index("IDX_event_capacity", ["capacity"])  // Analytics / filters by capacity
@Index("IDX_event_bookedSeats", ["bookedSeats"]) // Analytics / utilization
export class Event {
  @PrimaryGeneratedColumn()
  id!: number; // Primary key

  @Column()
  name!: string; // Event name

  @Column()
  venue!: string; // Venue name

  @Column({ type: "timestamp" })
  time!: Date; // Event date/time

  @Column()
  capacity!: number; // Total seats

  @Column({ name: "bookedSeats", default: 0 })
  bookedSeats!: number; // Currently booked seats

  @VersionColumn()
  version!: number; // For optimistic locking

  @OneToMany(() => Booking, (booking) => booking.event)
  bookings!: Booking[]; // Relation: event’s bookings
}

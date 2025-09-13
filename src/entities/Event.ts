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
@Index("IDX_event_time", ["time"]) // frequently filtered/sorted by time (upcoming)
@Index("IDX_event_name", ["name"]) // search / sort by name
@Index("IDX_event_venue", ["venue"]) // search by venue
@Index("IDX_event_capacity", ["capacity"]) // analytics / capacity filters
@Index("IDX_event_bookedSeats", ["bookedSeats"]) // analytics / utilization queries
export class Event {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  venue!: string;

  @Column({ type: "timestamp" })
  time!: Date;

  @Column()
  capacity!: number;

  @Column({ default: 0 })
  bookedSeats!: number;

  // Helps with optimistic locking (kept for compatibility, though we prefer atomic UPDATEs)
  @VersionColumn()
  version!: number;

  @OneToMany(() => Booking, (booking) => booking.event)
  bookings!: Booking[];
}

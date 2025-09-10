import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, Unique } from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

@Entity()
@Unique("UK_event_seat", ["event", "seatNumber"]) 
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, user => user.bookings, { onDelete: "CASCADE" })
  user!: User;

  @ManyToOne(() => Event, event => event.bookings, { onDelete: "CASCADE" })
  event!: Event;

  @Column({ default: "booked" })
  status!: string;

  // 1-based seat number; null for legacy bookings without seat selection
  @Column({ type: "int", nullable: true })
  seatNumber!: number | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}

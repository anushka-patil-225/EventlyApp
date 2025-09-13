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
@Unique("UQ_booking_event_seat", ["event", "seatNumber"]) // explicit unique constraint name
@Index("IDX_booking_userId", ["user"])
@Index("IDX_booking_eventId", ["event"])
@Index("IDX_booking_status", ["status"])
@Index("IDX_booking_createdAt", ["createdAt"])
export class Booking {
  @PrimaryGeneratedColumn({ name: "id" })
  id!: number;

  @Column({ type: "varchar", default: "booked", name: "status" })
  status!: string;

  @Column({ type: "integer", nullable: true, name: "seatNumber" })
  seatNumber!: number | null;

  @CreateDateColumn({ name: "createdAt" })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.bookings, { onDelete: "CASCADE" })
  user!: User;

  @ManyToOne(() => Event, (event) => event.bookings, { onDelete: "CASCADE" })
  event!: Event;
}

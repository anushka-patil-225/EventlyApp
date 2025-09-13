import { Entity, PrimaryGeneratedColumn, ManyToOne, Column, Unique, Index } from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

/** booking */
@Entity({ name: "booking", schema: "evently" })
@Unique(['event', 'seatNumber']) // auto-name OK
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, u => u.bookings, { onDelete: "CASCADE" })
  @Index()  // auto-name OK
  user!: User;

  @ManyToOne(() => Event, e => e.bookings, { onDelete: "CASCADE" })
  @Index()  // auto-name OK
  event!: Event;

  @Column({ default: "booked" })
  @Index()  // auto-name OK
  status!: string;

  @Column({ type: "int", nullable: true })
  seatNumber!: number | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  @Index()  // auto-name OK
  createdAt!: Date;
}

/** booking_indexed: separate entity, different physical table */
@Entity({ name: "booking_indexed", schema: "evently" })
@Unique(['event', 'seatNumber']) // auto-name; different from above
@Index(['user', 'event', 'status']) // auto-name; different from above
export class BookingIndexed {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, u => u.bookings, { onDelete: "CASCADE" })
  @Index()
  user!: User;

  @ManyToOne(() => Event, e => e.bookings, { onDelete: "CASCADE" })
  @Index()
  event!: Event;

  @Column({ default: "booked" })
  @Index()
  status!: string;

  @Column({ type: "int", nullable: true })
  seatNumber!: number | null;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  @Index()
  createdAt!: Date;
}

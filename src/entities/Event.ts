import { Entity, PrimaryGeneratedColumn, Column, OneToMany, VersionColumn } from "typeorm";
import { Booking } from "./Booking";
import { Seat } from "./Seat";

@Entity()
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

  // Helps with optimistic locking (prevents overselling)
  @VersionColumn()
  version!: number;

  @OneToMany(() => Booking, booking => booking.event)
  bookings!: Booking[];

  @OneToMany(() => Seat, seat => seat.event)
  seats!: Seat[];
}

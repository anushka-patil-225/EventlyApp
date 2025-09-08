import { Entity, PrimaryGeneratedColumn, ManyToOne, Column } from "typeorm";
import { User } from "./User";
import { Event } from "./Event";

@Entity()
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, user => user.bookings, { onDelete: "CASCADE" })
  user!: User;

  @ManyToOne(() => Event, event => event.bookings, { onDelete: "CASCADE" })
  event!: Event;

  @Column({ default: "booked" })
  status!: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}

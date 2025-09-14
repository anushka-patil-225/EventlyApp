import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { Booking } from "./Booking";

export type UserRole = "admin" | "user";

@Entity()
@Index("idx_user_role", ["role"])               // Index for filtering by role
@Index("idx_user_createdAt", ["createdAt"])     // Index for recent users
export class User {
  @PrimaryGeneratedColumn()
  id!: number; // Primary key

  @Column()
  name!: string; // User name

  @Column({ unique: true })
  @Index("idx_user_email", { unique: true })    // Unique + indexed for login lookups
  email!: string;

  @Column()
  password!: string; // Hashed password

  @Column({
    type: "enum",
    enum: ["admin", "user"],
    default: "user",
  })
  role!: UserRole; // User role

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings!: Booking[]; // Relation: user’s bookings

  @CreateDateColumn()
  createdAt!: Date; // Auto-set on creation

  @UpdateDateColumn()
  updatedAt!: Date; // Auto-set on update
}

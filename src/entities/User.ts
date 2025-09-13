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
@Index("idx_user_role", ["role"]) // 🔹 Index for role filtering
@Index("idx_user_createdAt", ["createdAt"]) // 🔹 Index for recent user queries
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  @Index("idx_user_email", { unique: true }) // 🔹 Enforce + speedup lookup
  email!: string;

  @Column()
  password!: string; // 🔑 hashed with bcrypt

  @Column({
    type: "enum",
    enum: ["admin", "user"], // ✅ lowercase, matches UserRole type
    default: "user",
  })
  role!: UserRole;

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings!: Booking[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

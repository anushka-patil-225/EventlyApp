import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Booking } from "./Booking";

export type UserRole = "admin" | "user";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string; // 🔑 hashed with bcrypt

  @Column({
    type: "enum",
    enum: ["admin", "user"],  // ✅ lowercase, matches UserRole type
    default: "user"
  })
  role!: UserRole;

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings!: Booking[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

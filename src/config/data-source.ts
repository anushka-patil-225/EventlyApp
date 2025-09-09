import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Booking } from "../entities/Booking";
import { Event } from "../entities/Event";
import { Seat } from "../entities/Seat"; // 👈 ADD THIS
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  schema: "evently",   
  synchronize: false,     // 👈 turn OFF when using migrations
  logging: true,
  entities: [User, Booking, Event, Seat], // 👈 Seat included
  migrations: ["src/migration/*.ts"],
  subscribers: [],
});

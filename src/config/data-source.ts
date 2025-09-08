import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Booking } from "../entities/Booking";
import { Event } from "../entities/Event";
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
  synchronize: true,   // Auto-create tables in dev (be careful in prod)
  logging: true,
  entities: [User, Booking, Event],
  migrations: [],
  subscribers: [],
});


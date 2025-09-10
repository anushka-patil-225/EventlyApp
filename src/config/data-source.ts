import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entities/User";
import { Booking } from "../entities/Booking";
import { Event } from "../entities/Event";

import dotenv from "dotenv";

dotenv.config();

// Validate required environment variables early to avoid cryptic DB errors
const requiredEnvVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME"] as const;
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key] || String(process.env[key]).trim() === "");
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
}

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: String(process.env.DB_PASS),
  database: process.env.DB_NAME,
  schema: process.env.DB_SCHEMA || "public",
  synchronize: true,     // Enable to auto-create tables; set to false once DB is seeded/migrated
  logging: true,
  entities: [User, Booking, Event], 
  migrations: ["src/migration/*.ts"],
  subscribers: [],
});

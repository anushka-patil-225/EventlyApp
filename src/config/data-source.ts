import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";

dotenv.config();

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,         // Postgres connection string
  schema: "evently",                     // Optional schema
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false,
  synchronize: true,                     // Auto-create tables (dev only!)
  logging: true,                         // Logs SQL queries
  entities: [__dirname + "/../entities/*.{ts,js}"],   // Entity files
  migrations: [__dirname + "/../migrations/*.{ts,js}"], // Migration files
});
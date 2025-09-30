import "reflect-metadata";           // Required for TypeORM decorators
import express from "express";       // Express framework
import { AppDataSource } from "./config/data-source"; // Database connection
import dotenv from "dotenv";         // Load environment variables
import userRoutes from "./routes/userRoutes";       // User APIs
import eventRoutes from "./routes/eventRoutes";     // Event APIs
import bookingRoutes from "./routes/bookingRoutes"; // Booking APIs
import { setupSwagger } from "./config/swagger";    // Swagger API docs
import { startEventCleanupScheduler } from "./jobs/eventCleanupScheduler"; // Seatmap cleanup job

dotenv.config(); // Load .env variables

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${PORT}`;

app.use(express.json()); // Parse JSON request bodies
setupSwagger(app);       // Initialize Swagger documentation

// Register route handlers
app.use("/users", userRoutes);
app.use("/events", eventRoutes);
app.use("/bookings", bookingRoutes);

// Simple test route
app.get("/", (_req, res) => {
  res.send("Hello! This is Evently");
});

// Initialize database and start server
AppDataSource.initialize()
  .then(() => {
    console.log("Database connected!");
    startEventCleanupScheduler();
    app.listen(PORT, () => {
      console.log(`Server running on ${BASE_URL}`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to DB:", err);
  });

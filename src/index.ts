import "reflect-metadata";           // Required for TypeORM decorators
import express from "express";       // Express framework
import { AppDataSource } from "./config/data-source"; // Database connection
import dotenv from "dotenv";         // Load environment variables
import userRoutes from "./routes/userRoutes";       // User APIs
import eventRoutes from "./routes/eventRoutes";     // Event APIs
import bookingRoutes from "./routes/bookingRoutes"; // Booking APIs
import { setupSwagger } from "./config/swagger";    // Swagger API docs

dotenv.config(); // Load .env variables

const app = express();
const PORT = process.env.PORT || 3000;

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
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to DB:", err);
  });

import "reflect-metadata";
import express from "express";
import { AppDataSource } from "./config/data-source";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes";
import { setupSwagger } from "./config/swagger";



dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
setupSwagger(app);

app.use("/users", userRoutes);



// Test route
app.get("/", (_req, res) => {
  res.send("Hello Evently 🚀");
});

AppDataSource.initialize()
  .then(() => {
    console.log("📦 Database connected!");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error connecting to DB:", err);
  });

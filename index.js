import express from "express";
import cors from "cors";
import { PORT } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import dbRoutes from "./routes/db.routes.js";
import storageRoutes from "./routes/storage.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Mount externalized routes (endpoints unchanged)
app.use(authRoutes);
app.use(dbRoutes);
app.use(storageRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the Supabase Demo API!");
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));



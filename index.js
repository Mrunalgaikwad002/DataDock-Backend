import express from "express";
import cors from "cors";
import { PORT } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import dbRoutes from "./routes/db.routes.js";
import storageRoutes from "./routes/storage.routes.js";
import foldersRoutes from "./routes/folders.routes.js";
import filesRoutes from "./routes/files.routes.js";
import shareRoutes from "./routes/share.routes.js";
import searchRoutes from "./routes/search.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

// Mount externalized routes (endpoints unchanged)
app.use(authRoutes);
app.use(dbRoutes);
app.use(storageRoutes);
app.use(foldersRoutes);
app.use(filesRoutes);
app.use(shareRoutes);
app.use(searchRoutes);

app.get("/", (req, res) => {
  res.send("Welcome to the Supabase Demo API!");
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));



import { createApp } from "./app";
import { getDb } from "./db";

// Initialize DB on startup
getDb();

const { httpServer } = createApp();

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

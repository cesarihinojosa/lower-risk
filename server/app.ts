import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import gamesRouter from "./routes/games";
import { registerSocketHandlers } from "./socket/handler";

export function createApp() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());
  app.use("/api/games", gamesRouter);

  registerSocketHandlers(io);

  return { app, httpServer, io };
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import authRoutes from "./routes/auth.routes";
import hallTicketRoutes, { verifyHallTicket } from "./routes/hallTicket.routes";
import examSessionRoutes from "./routes/examSession.routes";
import questionRoutes from "./routes/question.routes";
import securityRoutes from "./routes/security.routes";
import verificationRoutes from "./routes/verification.routes";
import studentRoutes from "./routes/student.routes";
import { setupWebSocket } from "./routes/websocket";
import { logger } from "./logger";

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── Mount route modules ───
  app.use("/api/auth", authRoutes);
  app.use("/api/hall-tickets", hallTicketRoutes);
  app.use("/api/exam-sessions", examSessionRoutes);
  app.use("/api/questions", questionRoutes);
  app.use("/api", securityRoutes);      // /api/security-incidents, /api/monitoring-logs, /api/exam-stats, /api/active-sessions
  app.use("/api", verificationRoutes);   // /api/verify-name, /api/verify-identity, /api/store-identity-document
  app.use("/api/student", studentRoutes); // /api/student/profile, /api/student/exam-history, /api/student/exam-result/:id

  // Hall ticket verification (student login flow)
  app.post("/api/auth/verify-hall-ticket", verifyHallTicket);

  logger.info("All route modules registered");

  // ─── HTTP + WebSocket Server ───
  const httpServer = createServer(app);
  setupWebSocket(httpServer);

  return httpServer;
}

import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAdmin, ensureAdminUser } from "./auth.routes";
import { insertSecurityIncidentSchema, insertMonitoringLogSchema } from "@shared/schema";
import { updateSecurityIncidentSchema, createMonitoringLogSchema } from "../middleware/validation";
import { apiLogger as logger } from "../logger";

const router = Router();

// ─── Security Incidents ───

// POST /api/security-incidents — Create incident (admin)
router.post("/incidents", requireAdmin, async (req: any, res: Response) => {
  try {
    const data = insertSecurityIncidentSchema.parse(req.body);
    const incident = await storage.createSecurityIncident(data);
    logger.warn({ incidentId: incident.id, type: data.incidentType }, "Security incident created");
    res.json(incident);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error creating security incident");
    res.status(500).json({ message: "Failed to create security incident" });
  }
});

// GET /api/security-incidents — List all incidents (admin)
router.get("/incidents", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const incidents = await storage.getSecurityIncidents();
    res.json(incidents);
  } catch (error) {
    logger.error({ error }, "Error fetching security incidents");
    res.status(500).json({ message: "Failed to fetch security incidents" });
  }
});

// PATCH /api/security-incidents/:id — Update incident (admin, validated)
router.patch("/incidents/:id", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const updates = updateSecurityIncidentSchema.parse(req.body);

    // Add server-side resolvedAt timestamp
    const updatesWithTimestamp: any = { ...updates };
    if (updates.isResolved) {
      updatesWithTimestamp.resolvedAt = new Date();
    }

    const updatedIncident = await storage.updateSecurityIncident(req.params.id, updatesWithTimestamp);
    res.json(updatedIncident);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error updating security incident");
    res.status(500).json({ message: "Failed to update security incident" });
  }
});

// ─── Monitoring Logs ───

// POST /api/monitoring-logs — Create monitoring log (validated)
router.post("/monitoring-logs", async (req: Request, res: Response) => {
  try {
    const validatedData = createMonitoringLogSchema.parse(req.body);
    const data = insertMonitoringLogSchema.parse(validatedData);
    const log = await storage.createMonitoringLog(data);
    res.json(log);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error creating monitoring log");
    res.status(500).json({ message: "Failed to create monitoring log" });
  }
});

// GET /api/monitoring-logs/:sessionId — Get logs for session (admin)
router.get("/monitoring-logs/:sessionId", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const logs = await storage.getMonitoringLogs(req.params.sessionId);
    res.json(logs);
  } catch (error) {
    logger.error({ error }, "Error fetching monitoring logs");
    res.status(500).json({ message: "Failed to fetch monitoring logs" });
  }
});

// ─── Stats ───

// GET /api/exam-stats — Get exam statistics (admin)
router.get("/exam-stats", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const stats = await storage.getExamStats();
    res.json(stats);
  } catch (error) {
    logger.error({ error }, "Error fetching exam stats");
    res.status(500).json({ message: "Failed to fetch exam stats" });
  }
});

// GET /api/active-sessions — Get active exam sessions (admin)
router.get("/active-sessions", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const sessions = await storage.getActiveExamSessions();
    res.json(sessions);
  } catch (error) {
    logger.error({ error }, "Error fetching active sessions");
    res.status(500).json({ message: "Failed to fetch active sessions" });
  }
});

export default router;

import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import type { Server } from "http";
import { storage } from "../storage";
import { getJWTSecret } from "./auth.routes";
import { wsLogger as logger } from "../logger";

export interface WebSocketClient extends WebSocket {
  sessionId?: string;
  userId?: string;
  type?: "admin" | "student";
}

export function setupWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade with JWT authentication
  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") {
      socket.destroy();
      return;
    }

    // Parse cookies
    const cookies: Record<string, string> = {};
    if (request.headers.cookie) {
      request.headers.cookie.split(";").forEach((cookie) => {
        const [key, value] = cookie.split("=").map((c) => c.trim());
        if (key && value) {
          cookies[key] = value;
        }
      });
    }

    // Validate JWT for admin connections
    let isAdmin = false;
    const adminToken = cookies["admin_token"];

    if (adminToken) {
      try {
        const secret = getJWTSecret();
        const decoded = jwt.verify(adminToken, secret) as { email: string; role: string };
        if (decoded.role === "admin") {
          isAdmin = true;
        }
      } catch (error) {
        logger.warn({ error }, "WebSocket admin JWT validation failed");
      }
    }

    // Validate JWT for student connections
    let isStudent = false;
    let studentPayload: any = null;
    const studentToken = cookies["student_token"];

    if (studentToken) {
      try {
        const secret = getJWTSecret();
        const decoded = jwt.verify(studentToken, secret) as any;
        if (decoded.role === "student") {
          isStudent = true;
          studentPayload = decoded;
        }
      } catch (error) {
        logger.warn({ error }, "WebSocket student JWT validation failed");
      }
    }

    // Strict Connection Rejection
    if (!isAdmin && !isStudent) {
      logger.warn("WebSocket connection rejected: unauthorized handshake");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocketClient) => {
      if (isAdmin) {
        ws.type = "admin";
      } else if (isStudent && studentPayload) {
        ws.type = "student";
        ws.userId = studentPayload.studentId;
        // Initially set the socket's sessionId to the student's verified hallTicketId.
        // During the auth message, we'll verify if the exam session belongs to this hallTicketId.
        ws.sessionId = studentPayload.hallTicketId;
      }
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws: WebSocketClient) => {
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "auth") {
          if (ws.type === "student") {
            // Verify that the requested data.sessionId belongs to the student's verified hallTicketId (which is currently stored in ws.sessionId)
            const examSession = await storage.getExamSession(data.sessionId);
            if (!examSession || examSession.hallTicketId !== ws.sessionId) {
              logger.warn(
                { dataSessionId: data.sessionId, tokenHallTicketId: ws.sessionId },
                "Student tried to bind WebSocket to a different exam session"
              );
              ws.close(4003, "Forbidden");
              return;
            }
            // Transition socket's sessionId to the actual examSession.id now that we verified ownership
            ws.sessionId = data.sessionId;
            ws.userId = data.userId || ws.userId;
            logger.info({ studentId: ws.userId, sessionId: ws.sessionId }, "Student WebSocket authenticated successfully");
          } else if (ws.type === "admin") {
            ws.userId = data.userId || ws.userId;
            ws.sessionId = data.sessionId;
            logger.info({ adminId: ws.userId }, "Admin WebSocket authenticated successfully");
          }
        }

        // Below student/admin operations check socket types strictly
        if (data.type === "student_status_update") {
          if (ws.type !== "student") {
            logger.warn("Unauthorized: non-student status update");
            return;
          }
          broadcastToAdmins(wss, { type: "student_status", data: data.payload });
        }

        if (data.type === "face_detection_update") {
          if (ws.type !== "student") {
            logger.warn("Unauthorized: non-student face detection update");
            return;
          }
          if (data.sessionId && data.sessionId === ws.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.sessionId,
              eventType: "face_detected",
              eventData: data.payload,
            });
          }
        }

        if (data.type === "video_snapshot") {
          if (ws.type !== "student") {
            logger.warn("Unauthorized: non-student video snapshot upload");
            return;
          }
          if (data.data.sessionId !== ws.sessionId) {
            logger.warn("Unauthorized: session mismatch on video snapshot");
            return;
          }

          broadcastToAdmins(wss, {
            type: "video_feed",
            data: {
              sessionId: data.data.sessionId,
              studentId: data.data.studentId,
              studentName: data.data.studentName,
              rollNumber: data.data.rollNumber,
              snapshot: data.data.snapshot,
              timestamp: data.data.timestamp,
            },
          });

          if (data.data.sessionId) {
            await storage.createMonitoringLog({
              sessionId: data.data.sessionId,
              eventType: "video_snapshot",
              eventData: { studentId: data.data.studentId, timestamp: data.data.timestamp },
            });
          }
        }

        if (data.type === "security_violation" || data.type === "face_violation") {
          if (data.data?.sessionId !== ws.sessionId) {
            logger.warn("Unauthorized: session mismatch on security violation");
            return;
          }
          await handleSecurityViolation(wss, ws, data);
        }

        if (data.type === "student_status") {
          if (ws.type !== "student") return;
          broadcastToAdmins(wss, { type: "student_monitoring", data: data.data });
        }

        if (data.type === "policy_update") {
          // Policy update is broadcast to admins
          if (ws.type !== "student") return;
          if (!data.data.sessionId || data.data.sessionId !== ws.sessionId || !data.data.action) {
            logger.warn("Invalid or unauthorized policy update");
            return;
          }
          broadcastToAdmins(wss, { type: "policy_update", data: data.data });
          logger.info({ action: data.data.action, sessionId: data.data.sessionId }, "Policy update");
        }

        if (data.type === "admin_action") {
          await handleAdminAction(wss, ws, data);
        }
      } catch (error) {
        logger.error({ error }, "WebSocket message error");
      }
    });

    ws.on("close", () => {
      logger.debug("WebSocket connection closed");
    });
  });

  return wss;
}

function broadcastToAdmins(wss: WebSocketServer, message: any) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client: WebSocketClient) => {
    if (client.readyState === WebSocket.OPEN && client.type === "admin") {
      client.send(payload);
    }
  });
}

function broadcastToAll(wss: WebSocketServer, message: any) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client: WebSocketClient) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

async function handleSecurityViolation(wss: WebSocketServer, ws: WebSocketClient, data: any) {
  try {
    if (!data.data.sessionId || !data.data.incidentType || !data.data.severity || !data.data.description) {
      logger.warn("Invalid violation data: missing required fields");
      return;
    }

    if (ws.type !== "student") {
      logger.warn("Unauthorized: Only students can report violations");
      return;
    }

    const session = await storage.getExamSession(data.data.sessionId);
    if (!session) {
      logger.warn({ sessionId: data.data.sessionId }, "Session not found for violation");
      return;
    }

    // Rate limiting: max 3 of the same type per minute
    const recentIncidents = await storage.getSecurityIncidents(data.data.sessionId);
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentSameType = recentIncidents.filter(
      (incident) =>
        incident.incidentType === data.data.incidentType &&
        incident.createdAt &&
        new Date(incident.createdAt) > oneMinuteAgo
    );

    if (recentSameType.length >= 3) {
      logger.debug({ type: data.data.incidentType, sessionId: data.data.sessionId }, "Rate limited");
      return;
    }

    const incident = await storage.createSecurityIncident({
      sessionId: data.data.sessionId,
      incidentType: data.data.incidentType,
      severity: data.data.severity,
      description: data.data.description,
      metadata: data.data.metadata || {},
    });

    broadcastToAdmins(wss, {
      type: "security_incident",
      data: {
        ...incident,
        studentName: data.data.studentName,
        rollNumber: data.data.rollNumber,
        violationType: data.data.incidentType,
      },
    });

    logger.warn({ type: data.data.incidentType, sessionId: data.data.sessionId }, "Security incident created");
  } catch (error) {
    logger.error({ error }, "Error creating security incident");
  }
}

async function handleAdminAction(wss: WebSocketServer, ws: WebSocketClient, data: any) {
  try {
    if (ws.type !== "admin") {
      logger.warn("Unauthorized: Only admins can send admin actions");
      return;
    }

    if (!data.data.sessionId || !data.data.action) {
      logger.warn("Invalid admin action: missing sessionId or action");
      return;
    }

    wss.clients.forEach((client: WebSocketClient) => {
      if (
        client.readyState === WebSocket.OPEN &&
        client.type === "student" &&
        client.sessionId === data.data.sessionId
      ) {
        client.send(
          JSON.stringify({
            type: "admin_action",
            data: {
              action: data.data.action,
              message: data.data.message,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }
    });

    logger.info({ action: data.data.action, sessionId: data.data.sessionId }, "Admin action sent");
  } catch (error) {
    logger.error({ error }, "Error handling admin action");
  }
}

// Export for use in flag/resolve routes that need to broadcast
export function getWSS(httpServer: Server): WebSocketServer | undefined {
  return undefined;
}

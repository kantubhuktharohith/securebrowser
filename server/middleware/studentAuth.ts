import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { logger } from "../logger";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-for-local-development-only";

/**
 * Generates a short-lived student session token after hall ticket verification.
 * This token is scoped to a specific exam session — students cannot access
 * other sessions or admin endpoints with it.
 */
export function generateStudentToken(sessionId: string, studentId: string, hallTicketId: string): string {
  return jwt.sign(
    { sessionId, studentId, hallTicketId, role: "student" },
    JWT_SECRET,
    { expiresIn: "12h" } // generous window for exam duration
  );
}

/**
 * Middleware: requires a valid student session token.
 * Attaches `req.studentSession` with { sessionId, studentId, hallTicketId }.
 */
export function requireStudentSession(req: Request, res: Response, next: NextFunction) {
  try {
    // Accept token from cookie or Authorization header
    const token =
      req.cookies?.student_token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) {
      return res.status(401).json({ message: "Student session required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      sessionId: string;
      studentId: string;
      hallTicketId: string;
      role: string;
    };

    if (decoded.role !== "student") {
      return res.status(403).json({ message: "Invalid student token" });
    }

    (req as any).studentSession = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Session expired" });
    }
    logger.warn({ error }, "Student auth failed");
    return res.status(401).json({ message: "Invalid session" });
  }
}

/**
 * Middleware: ensures the student can only access their own exam session.
 * Must be used after requireStudentSession. Checks that the requested exam session
 * corresponds to the hallTicketId in the student's token.
 */
export async function requireOwnSession(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).studentSession;
  const requestedId = req.params.id;

  if (!session) {
    return res.status(401).json({ message: "Student session required" });
  }

  if (requestedId) {
    try {
      const examSession = await storage.getExamSession(requestedId);
      if (!examSession) {
        return res.status(404).json({ message: "Exam session not found" });
      }

      if (examSession.hallTicketId !== session.hallTicketId) {
        logger.warn(
          { requestedId, tokenHallTicketId: session.hallTicketId, sessionHallTicketId: examSession.hallTicketId },
          "Student tried to access another student's exam session"
        );
        return res.status(403).json({ message: "Access denied: wrong session" });
      }
    } catch (error) {
      logger.error({ error, requestedId }, "Error verifying exam session ownership");
      return res.status(500).json({ message: "Authentication check failed" });
    }
  }

  next();
}

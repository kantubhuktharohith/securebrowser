import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireStudentSession } from "../middleware/studentAuth";
import { apiLogger as logger } from "../logger";

const router = Router();

// GET /api/student/profile — Get student profile
router.get("/profile", requireStudentSession, async (req: Request, res: Response) => {
  try {
    const sessionToken = (req as any).studentSession;
    const hallTicket = await storage.getHallTicketById(sessionToken.hallTicketId);
    
    if (!hallTicket) {
      return res.status(404).json({ message: "Student profile not found" });
    }

    const user = await storage.getUserByEmail(hallTicket.studentEmail);

    res.json({
      name: hallTicket.studentName,
      email: hallTicket.studentEmail,
      rollNumber: hallTicket.rollNumber,
      userId: user?.id,
      createdAt: user?.createdAt,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching student profile");
    res.status(500).json({ message: "Failed to fetch student profile" });
  }
});

// GET /api/student/exam-history — Get student's past exam sessions with scores
router.get("/exam-history", requireStudentSession, async (req: Request, res: Response) => {
  try {
    const sessionToken = (req as any).studentSession;
    const hallTicket = await storage.getHallTicketById(sessionToken.hallTicketId);
    
    if (!hallTicket) {
      return res.status(404).json({ message: "Student not found" });
    }

    const user = await storage.getUserByEmail(hallTicket.studentEmail);
    if (!user) {
      return res.json([]);
    }

    // Get all sessions for this student
    const allSessions = await storage.getAllExamSessions();
    const studentSessions = allSessions
      .filter((s) => s.studentId === user.id)
      .map((s) => ({
        id: s.id,
        examName: s.examName,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        score: s.score,
        totalMarks: s.totalMarks,
        percentage: s.totalMarks && s.score !== null
          ? Math.round((s.score / s.totalMarks) * 100)
          : null,
        rollNumber: s.rollNumber,
        hallTicketNumber: s.hallTicketNumber,
      }));

    res.json(studentSessions);
  } catch (error) {
    logger.error({ error }, "Error fetching exam history");
    res.status(500).json({ message: "Failed to fetch exam history" });
  }
});

// GET /api/student/exam-result/:sessionId — Get detailed result for a specific exam
router.get("/exam-result/:sessionId", requireStudentSession, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await storage.getExamSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Exam session not found" });
    }

    if (session.status !== "completed" && session.status !== "submitted") {
      return res.status(400).json({ message: "Exam not yet completed" });
    }

    const answers = (session.answers as Record<string, any>) || {};
    const grading = answers.__grading || null;

    res.json({
      sessionId: session.id,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      score: grading?.score ?? session.score,
      totalMarks: grading?.totalMarks ?? session.totalMarks,
      percentage: grading?.totalMarks > 0
        ? Math.round((grading.score / grading.totalMarks) * 100)
        : null,
      breakdown: grading?.breakdown || {},
    });
  } catch (error) {
    logger.error({ error }, "Error fetching exam result");
    res.status(500).json({ message: "Failed to fetch exam result" });
  }
});

export default router;

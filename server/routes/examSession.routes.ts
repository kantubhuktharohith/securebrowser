import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { requireAdmin, ensureAdminUser } from "./auth.routes";
import { requireStudentSession, requireOwnSession } from "../middleware/studentAuth";
import { updateExamSessionSchema, submitExamSchema } from "../middleware/validation";
import { insertExamSessionSchema } from "@shared/schema";
import { apiLogger as logger } from "../logger";

const router = Router();

// ─── Helper: Server-side time enforcement ───
function calculateServerTimeRemaining(session: any): number {
  if (!session.startTime) return session.timeRemaining || 0;

  const hallTicketDurationMs = (session.duration || 60) * 60 * 1000; // from hall ticket
  const elapsed = Date.now() - new Date(session.startTime).getTime();
  const remaining = Math.max(0, Math.floor((hallTicketDurationMs - elapsed) / 1000));
  return remaining;
}

// ─── Helper: Calculate similarity between two strings (Levenshtein-based) ───
function stringSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;

  const matrix: number[][] = Array(shorter.length + 1)
    .fill(null)
    .map(() => Array(longer.length + 1).fill(null));

  for (let i = 0; i <= longer.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= shorter.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= shorter.length; j++) {
    for (let i = 1; i <= longer.length; i++) {
      const ind = longer[i - 1] === shorter[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + ind
      );
    }
  }

  return (longer.length - matrix[shorter.length][longer.length]) / longer.length;
}

// ─── Helper: Grade subjective answer using keyword matching + fuzzy scoring ───
function gradeSubjectiveAnswer(
  studentAnswer: string,
  correctAnswer: string,
  gradingCriteria: string | null,
  maxMarks: number
): number {
  if (!studentAnswer || studentAnswer.trim().length === 0) return 0;

  const answer = studentAnswer.toLowerCase().trim();
  let score = 0;

  // 1. Keyword matching from grading criteria (50% weight)
  if (gradingCriteria) {
    const keywords = gradingCriteria
      .toLowerCase()
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    if (keywords.length > 0) {
      const matchedKeywords = keywords.filter((kw) => answer.includes(kw));
      const keywordScore = (matchedKeywords.length / keywords.length) * maxMarks * 0.5;
      score += keywordScore;
    }
  }

  // 2. Similarity to sample/correct answer (30% weight)
  if (correctAnswer) {
    const similarity = stringSimilarity(answer, correctAnswer.toLowerCase().trim());
    score += similarity * maxMarks * 0.3;
  }

  // 3. Length/effort heuristic (20% weight) - reward substantial answers
  const wordCount = answer.split(/\s+/).length;
  const lengthScore = Math.min(1, wordCount / 50) * maxMarks * 0.2; // 50+ words = full credit for this portion
  score += lengthScore;

  return Math.round(Math.min(maxMarks, score) * 10) / 10; // Cap at maxMarks, round to 1 decimal
}

// ─── Helper: Grade coding answer based on test case results ───
function gradeCodingAnswer(
  studentAnswer: string,
  testCases: any[] | null,
  maxMarks: number
): number {
  // For coding questions, the student answer contains JSON with test results from client-side execution
  if (!studentAnswer || !testCases || testCases.length === 0) return 0;

  try {
    const results = JSON.parse(studentAnswer);
    if (results && results.testResults && Array.isArray(results.testResults)) {
      const total = results.testResults.length;
      const passed = results.testResults.filter((r: any) => r.passed).length;
      return Math.round((passed / total) * maxMarks * 10) / 10;
    }
  } catch {
    // If parsing fails, check if it's just code (no test results) - give partial credit
    if (studentAnswer.trim().length > 10) {
      return Math.round(maxMarks * 0.2 * 10) / 10; // 20% for effort
    }
  }

  return 0;
}

// ─── Helper: Auto-grade answers (MCQ, subjective, coding) ───
async function gradeExamAnswers(
  answers: Record<string, any>,
  questionIds: string[]
): Promise<{ score: number; totalMarks: number; breakdown: Record<string, any> }> {
  const allQuestions = await storage.getAllQuestions();
  const questionsMap = new Map(allQuestions.map((q) => [q.id, q]));

  let score = 0;
  let totalMarks = 0;
  const breakdown: Record<string, any> = {};

  for (const qId of questionIds) {
    const question = questionsMap.get(qId);
    if (!question) continue;

    totalMarks += question.marks;
    const studentAnswer = answers[qId];

    if (studentAnswer !== undefined && studentAnswer !== null) {
      const qType = question.questionType || "multiple_choice";

      if (qType === "subjective" || qType === "essay") {
        // Subjective grading via keyword matching
        const earnedMarks = gradeSubjectiveAnswer(
          String(studentAnswer),
          question.correctAnswer,
          (question as any).gradingCriteria || null,
          question.marks
        );
        breakdown[qId] = { type: "subjective", earned: earnedMarks, max: question.marks, needsReview: true };
        score += earnedMarks;
      } else if (qType === "coding") {
        // Coding grading via test case results
        const earnedMarks = gradeCodingAnswer(
          String(studentAnswer),
          (question as any).testCases as any[] | null,
          question.marks
        );
        breakdown[qId] = { type: "coding", earned: earnedMarks, max: question.marks };
        score += earnedMarks;
      } else {
        // MCQ, true/false, short_answer - exact match
        const isCorrect =
          String(studentAnswer).trim().toLowerCase() ===
          String(question.correctAnswer).trim().toLowerCase();

        breakdown[qId] = isCorrect;
        if (isCorrect) {
          score += question.marks;
        }
      }
    } else {
      breakdown[qId] = false;
    }
  }

  return { score: Math.round(score * 10) / 10, totalMarks, breakdown };
}


// POST /api/exam-sessions — Create exam session (student, after hall ticket verification)
router.post("/", requireStudentSession, async (req: Request, res: Response) => {
  try {
    const sessionToken = (req as any).studentSession;
    if (req.body.hallTicketId !== sessionToken.hallTicketId) {
      logger.warn({ bodyHallTicketId: req.body.hallTicketId, tokenHallTicketId: sessionToken.hallTicketId }, "Hall ticket ID mismatch on session creation");
      return res.status(403).json({ message: "Access denied: wrong hall ticket" });
    }

    const hallTicket = await storage.getHallTicketById(req.body.hallTicketId);
    if (!hallTicket || !hallTicket.isActive) {
      return res.status(400).json({ message: "Invalid or inactive hall ticket" });
    }

    let studentUser = await storage.getUserByEmail(hallTicket.studentEmail);
    if (!studentUser) {
      const studentId = `student_${hallTicket.rollNumber}`;
      studentUser = await storage.upsertUser({
        id: studentId,
        email: hallTicket.studentEmail,
        firstName: hallTicket.studentName.split(" ")[0],
        lastName: hallTicket.studentName.split(" ").slice(1).join(" ") || "",
        role: "student",
      });
    }

    const studentId = studentUser.id;

    const sessionData = {
      ...req.body,
      studentId,
      startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(),
    };

    const data = insertExamSessionSchema.parse(sessionData);

    // Check if session already exists
    const existingSession = await storage.getExamSessionByStudent(studentId, data.hallTicketId);
    if (existingSession) {
      await storage.updateHallTicket(hallTicket.id, { isActive: false });
      return res.json(existingSession);
    }

    // Get randomized questions
    let examQuestions = await storage.getRandomQuestions(hallTicket.examName, hallTicket.totalQuestions);

    if (!examQuestions || examQuestions.length === 0) {
      logger.info({ examName: hallTicket.examName }, "No questions found, trying fallback");
      const allQuestions = await storage.getAllQuestions();

      if (allQuestions.length === 0) {
        return res.status(400).json({
          message: "No questions available. Contact the administrator.",
          error: "NO_QUESTIONS_IN_SYSTEM",
        });
      }

      const shuffled = allQuestions.sort(() => 0.5 - Math.random());
      const limit = Math.min(hallTicket.totalQuestions || 20, allQuestions.length);
      examQuestions = shuffled.slice(0, limit);
    }

    const questionIds = examQuestions.map((q) => q.id);

    const examSession = await storage.createExamSession({
      ...data,
      questionIds,
    });

    await storage.updateHallTicket(hallTicket.id, { isActive: false });

    logger.info({ sessionId: examSession.id, studentId }, "Exam session created");
    res.json(examSession);
  } catch (error) {
    logger.error({ error }, "Error creating exam session");
    res.status(500).json({ message: "Failed to create exam session" });
  }
});

// GET /api/exam-sessions — List all sessions (admin)
router.get("/", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const sessions = await storage.getAllExamSessions();
    res.json(sessions);
  } catch (error) {
    logger.error({ error }, "Error fetching exam sessions");
    res.status(500).json({ message: "Failed to fetch exam sessions" });
  }
});

// GET /api/exam-sessions/:id — Get single session (admin)
router.get("/:id", requireAdmin, async (req: any, res: Response) => {
  try {
    const session = await storage.getExamSession(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Exam session not found" });
    }
    res.json(session);
  } catch (error) {
    logger.error({ error }, "Error fetching exam session");
    res.status(500).json({ message: "Failed to fetch exam session" });
  }
});

// PATCH /api/exam-sessions/:id — Update session (admin, validated)
router.patch("/:id", requireAdmin, async (req: any, res: Response) => {
  try {
    const updates = updateExamSessionSchema.parse(req.body);
    const session = await storage.updateExamSession(req.params.id, updates as any);
    res.json(session);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error updating exam session");
    res.status(500).json({ message: "Failed to update exam session" });
  }
});

// GET /api/exam-sessions/:id/questions — Get questions for session (student)
router.get("/:id/questions", requireStudentSession, requireOwnSession, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let session = await storage.getExamSession(id);

    if (!session) {
      return res.status(404).json({ message: "Exam session not found" });
    }

    // ─── Server-side timer check (Upgrade #10) ───
    if (session.startTime && session.status === "in_progress") {
      const hallTicket = await storage.getHallTicketById(session.hallTicketId);
      if (hallTicket) {
        const durationMs = (hallTicket.duration || 60) * 60 * 1000;
        const elapsed = Date.now() - new Date(session.startTime).getTime();
        if (elapsed >= durationMs) {
          // Auto-submit: time's up on the server
          logger.info({ sessionId: id }, "Server-side timer expired — auto-submitting");
          const answers = (session.answers as Record<string, any>) || {};
          const questionIds = (session.questionIds as string[]) || [];
          const grading = await gradeExamAnswers(answers, questionIds);

          session = await storage.updateExamSession(id, {
            status: "completed",
            endTime: new Date(),
            answers: { ...answers, __grading: grading },
          });

          return res.status(410).json({
            message: "Exam time has expired. Your exam has been auto-submitted.",
            error: "EXAM_TIME_EXPIRED",
          });
        }
      }
    }

    let questionIds = session.questionIds as string[];

    // Assign questions if none exist (handles old sessions)
    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      const hallTicket = await storage.getHallTicketById(session.hallTicketId);
      if (!hallTicket) {
        return res.status(400).json({ message: "Hall ticket not found", error: "HALL_TICKET_NOT_FOUND" });
      }

      let examQuestions = await storage.getRandomQuestions(hallTicket.examName, hallTicket.totalQuestions);

      if (!examQuestions || examQuestions.length === 0) {
        const allQuestions = await storage.getAllQuestions();
        if (allQuestions.length === 0) {
          return res.status(400).json({
            message: "No questions available.",
            error: "NO_QUESTIONS_IN_SYSTEM",
          });
        }
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        examQuestions = shuffled.slice(0, Math.min(hallTicket.totalQuestions || 20, allQuestions.length));
      }

      questionIds = examQuestions.map((q) => q.id);
      session = await storage.updateExamSession(id, { questionIds });
      logger.info({ sessionId: id, count: questionIds.length }, "Assigned questions to session");
    }

    // Return questions WITHOUT correct answers
    const allQuestions = await storage.getAllQuestions();
    const sessionQuestions = allQuestions
      .filter((q) => questionIds.includes(q.id))
      .map((q) => {
        const base: any = {
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          questionType: q.questionType,
          marks: q.marks,
          // Exclude correctAnswer for security
        };
        // Include coding-specific fields
        if (q.questionType === "coding") {
          base.codeTemplate = (q as any).codeTemplate || "";
          base.programmingLanguage = (q as any).programmingLanguage || "javascript";
          // Only include visible test cases (hide hidden ones)
          const allTestCases = ((q as any).testCases as any[]) || [];
          base.testCases = allTestCases.map((tc: any) =>
            tc.isHidden ? { input: "Hidden", expectedOutput: "Hidden", isHidden: true } : tc
          );
        }
        return base;
      });

    res.json(sessionQuestions);
  } catch (error) {
    logger.error({ error }, "Error fetching session questions");
    res.status(500).json({ message: "Failed to fetch session questions" });
  }
});

// GET /api/exam-sessions/:id/time — Server-side time remaining (anti-cheat)
router.get("/:id/time", requireStudentSession, requireOwnSession, async (req: Request, res: Response) => {
  try {
    const session = await storage.getExamSession(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Exam session not found" });
    }

    const hallTicket = await storage.getHallTicketById(session.hallTicketId);
    if (!hallTicket) {
      return res.status(400).json({ message: "Hall ticket not found" });
    }

    if (!session.startTime) {
      return res.json({ timeRemaining: hallTicket.duration * 60, started: false });
    }

    const durationMs = hallTicket.duration * 60 * 1000;
    const elapsed = Date.now() - new Date(session.startTime).getTime();
    const remaining = Math.max(0, Math.floor((durationMs - elapsed) / 1000));

    if (remaining === 0 && session.status === "in_progress") {
      // Auto-submit
      const answers = (session.answers as Record<string, any>) || {};
      const questionIds = (session.questionIds as string[]) || [];
      const grading = await gradeExamAnswers(answers, questionIds);

      await storage.updateExamSession(req.params.id, {
        status: "completed",
        endTime: new Date(),
        answers: { ...answers, __grading: grading },
      });

      return res.json({ timeRemaining: 0, started: true, expired: true });
    }

    res.json({ timeRemaining: remaining, started: true, expired: false });
  } catch (error) {
    logger.error({ error }, "Error checking exam time");
    res.status(500).json({ message: "Failed to check exam time" });
  }
});

// POST /api/exam-sessions/:id/submit — Submit exam (with auto-grading)
router.post("/:id/submit", requireStudentSession, requireOwnSession, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { answers } = submitExamSchema.parse(req.body);

    const session = await storage.getExamSession(id);
    if (!session) {
      return res.status(404).json({ message: "Exam session not found" });
    }

    if (session.status === "completed" || session.status === "submitted") {
      return res.status(400).json({ message: "Exam already submitted" });
    }

    // ─── Auto-grading (Upgrade #9) ───
    const questionIds = (session.questionIds as string[]) || [];
    const grading = await gradeExamAnswers(answers, questionIds);

    const updatedSession = await storage.updateExamSession(id, {
      answers: { ...answers, __grading: grading },
      status: "completed",
      endTime: new Date(),
    });

    logger.info(
      { sessionId: id, score: grading.score, totalMarks: grading.totalMarks },
      "Exam submitted and graded"
    );

    res.json({
      success: true,
      message: "Exam submitted successfully",
      session: updatedSession,
      grading: {
        score: grading.score,
        totalMarks: grading.totalMarks,
        percentage: grading.totalMarks > 0 ? Math.round((grading.score / grading.totalMarks) * 100) : 0,
      },
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid submission data", errors: error.errors });
    }
    logger.error({ error }, "Error submitting exam");
    res.status(500).json({ message: "Failed to submit exam" });
  }
});

// POST /api/exam-sessions/:id/flag — Flag student (admin)
router.post("/:id/flag", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const { id } = req.params;
    const { reason } = req.body;

    const session = await storage.getExamSession(id);
    if (!session) {
      return res.status(404).json({ message: "Exam session not found" });
    }

    const updatedSession = await storage.updateExamSession(id, {
      status: "completed",
      endTime: new Date(),
    });

    const incident = await storage.createSecurityIncident({
      sessionId: id,
      incidentType: "admin_flagged",
      severity: "critical",
      description: reason || "Manually flagged by administrator",
      metadata: {
        flaggedBy: req.admin.email,
        flaggedAt: new Date().toISOString(),
        autoSubmitted: true,
      },
    });

    logger.warn({ sessionId: id, reason }, "Student flagged by admin");
    res.json({
      success: true,
      message: "Student flagged and exam submitted",
      session: updatedSession,
      incident,
    });
  } catch (error) {
    logger.error({ error }, "Error flagging student");
    res.status(500).json({ message: "Failed to flag student" });
  }
});

// POST /api/exam-sessions/:id/resolve — Resolve flagged student (admin)
router.post("/:id/resolve", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const { id } = req.params;

    const session = await storage.getExamSession(id);
    if (!session) {
      return res.status(404).json({ message: "Exam session not found" });
    }

    if (session.status === "completed" || session.status === "submitted") {
      return res.status(400).json({
        message: "Cannot resolve a completed exam",
        error: "EXAM_ALREADY_COMPLETED",
      });
    }

    const updatedSession = await storage.updateExamSession(id, { status: "in_progress" });

    const incident = await storage.createSecurityIncident({
      sessionId: id,
      incidentType: "admin_resolved",
      severity: "low",
      description: "Student allowed to continue exam after admin review",
      metadata: {
        resolvedBy: req.admin.email,
        resolvedAt: new Date().toISOString(),
      },
    });

    logger.info({ sessionId: id }, "Student resolved by admin");
    res.json({
      success: true,
      message: "Student resolved and allowed to continue",
      session: updatedSession,
      incident,
    });
  } catch (error) {
    logger.error({ error }, "Error resolving student");
    res.status(500).json({ message: "Failed to resolve student" });
  }
});

export { gradeExamAnswers };
export default router;

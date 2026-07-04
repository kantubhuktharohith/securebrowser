import { Router, type Response } from "express";
import { storage } from "../storage";
import { requireAdmin, ensureAdminUser } from "./auth.routes";
import { insertQuestionSchema } from "@shared/schema";
import { apiLogger as logger } from "../logger";

const router = Router();

// POST /api/questions — Create question
router.post("/", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const data = insertQuestionSchema.parse(req.body);
    const question = await storage.createQuestion(data);
    logger.info({ questionId: question.id }, "Question created");
    res.json(question);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error creating question");
    res.status(500).json({ message: "Failed to create question" });
  }
});

// GET /api/questions — List all questions
router.get("/", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const questions = await storage.getAllQuestions();
    res.json(questions);
  } catch (error) {
    logger.error({ error }, "Error fetching questions");
    res.status(500).json({ message: "Failed to fetch questions" });
  }
});

// PUT /api/questions/:id — Update question
router.put("/:id", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const data = insertQuestionSchema.parse(req.body);
    const question = await storage.updateQuestion(req.params.id, data);
    res.json(question);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error updating question");
    res.status(500).json({ message: "Failed to update question" });
  }
});

// DELETE /api/questions/:id — Delete question
router.delete("/:id", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    await storage.deleteQuestion(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error deleting question");
    res.status(500).json({ message: "Failed to delete question" });
  }
});

export default router;

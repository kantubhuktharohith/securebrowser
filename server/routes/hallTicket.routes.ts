import { Router, type Request, type Response } from "express";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { storage } from "../storage";
import { requireAdmin, ensureAdminUser } from "./auth.routes";
import { clientHallTicketSchema } from "@shared/schema";
import { updateHallTicketSchema } from "../middleware/validation";
import { generateStudentToken } from "../middleware/studentAuth";
import { apiLogger as logger } from "../logger";

const router = Router();

// POST /api/hall-tickets — Create single hall ticket
router.post("/", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const userId = req.admin.email;

    const clientData = clientHallTicketSchema.parse(req.body);
    const hallTicketId = `HT${new Date().getFullYear()}${nanoid(8).toUpperCase()}`;

    const qrData = JSON.stringify({
      hallTicketId,
      rollNumber: clientData.rollNumber,
      examName: clientData.examName,
      timestamp: new Date().getTime(),
    });

    const hallTicket = await storage.createHallTicket({
      hallTicketId,
      examName: clientData.examName,
      examDate: new Date(clientData.examDate),
      duration: clientData.duration,
      totalQuestions: clientData.totalQuestions,
      rollNumber: clientData.rollNumber,
      studentName: clientData.studentName,
      studentEmail: clientData.studentEmail,
      studentIdBarcode: clientData.studentIdBarcode,
      idCardImageUrl: clientData.idCardImageUrl,
      qrCodeData: qrData,
      isActive: true,
      createdBy: userId,
    });

    logger.info({ hallTicketId }, "Hall ticket created");
    res.json(hallTicket);
  } catch (error) {
    logger.error({ error }, "Error creating hall ticket");
    res.status(500).json({ message: "Failed to create hall ticket" });
  }
});

// POST /api/hall-tickets/bulk — Bulk create hall tickets
router.post("/bulk", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const userId = req.admin.email;
    const { hallTickets } = req.body;

    if (!Array.isArray(hallTickets) || hallTickets.length === 0) {
      return res.status(400).json({ message: "Invalid data: hallTickets array required" });
    }

    const validatedTickets = [];
    const validationErrors: string[] = [];

    for (let i = 0; i < hallTickets.length; i++) {
      try {
        const clientData = clientHallTicketSchema.parse(hallTickets[i]);
        validatedTickets.push(clientData);
      } catch (error: any) {
        validationErrors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors.slice(0, 5),
      });
    }

    const createdTickets = [];
    for (const clientData of validatedTickets) {
      const hallTicketId = `HT${new Date().getFullYear()}${nanoid(8).toUpperCase()}`;
      const qrData = JSON.stringify({
        hallTicketId,
        rollNumber: clientData.rollNumber,
        examName: clientData.examName,
        timestamp: new Date().getTime(),
      });

      const hallTicket = await storage.createHallTicket({
        hallTicketId,
        examName: clientData.examName,
        examDate: new Date(clientData.examDate),
        duration: clientData.duration,
        totalQuestions: clientData.totalQuestions,
        rollNumber: clientData.rollNumber,
        studentName: clientData.studentName,
        studentEmail: clientData.studentEmail,
        studentIdBarcode: clientData.studentIdBarcode || "",
        idCardImageUrl: clientData.idCardImageUrl || "",
        qrCodeData: qrData,
        isActive: true,
        createdBy: userId,
      });
      createdTickets.push(hallTicket);
    }

    logger.info({ count: createdTickets.length }, "Bulk hall tickets created");
    res.json({ success: true, count: createdTickets.length, hallTickets: createdTickets });
  } catch (error) {
    logger.error({ error }, "Error creating bulk hall tickets");
    res.status(500).json({ message: "Failed to create hall tickets" });
  }
});

// GET /api/hall-tickets — List all hall tickets by creator
router.get("/", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const hallTickets = await storage.getHallTicketsByCreator(req.admin.email);
    res.json(hallTickets);
  } catch (error) {
    logger.error({ error }, "Error fetching hall tickets");
    res.status(500).json({ message: "Failed to fetch hall tickets" });
  }
});

// GET /api/hall-tickets/:id/qr — Generate QR code for a hall ticket
router.get("/:id/qr", requireAdmin, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const hallTicket = await storage.getHallTicketById(id);

    if (!hallTicket) {
      return res.status(404).json({ message: "Hall ticket not found" });
    }

    const qrCodeUrl = await QRCode.toDataURL(hallTicket.qrCodeData, {
      width: 300,
      margin: 2,
    });

    res.json({ qrCodeUrl });
  } catch (error) {
    logger.error({ error }, "Error generating QR code");
    res.status(500).json({ message: "Failed to generate QR code" });
  }
});

// PATCH /api/hall-tickets/:id — Update hall ticket (validated)
router.patch("/:id", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const { id } = req.params;
    const updates = updateHallTicketSchema.parse(req.body); // ← Validated!
    const updatedTicket = await storage.updateHallTicket(id, updates as any);
    res.json(updatedTicket);
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Validation error", errors: error.errors });
    }
    logger.error({ error }, "Error updating hall ticket");
    res.status(500).json({ message: "Failed to update hall ticket" });
  }
});

// DELETE /api/hall-tickets/:id — Delete hall ticket
router.delete("/:id", requireAdmin, async (req: any, res: Response) => {
  try {
    await ensureAdminUser(storage, req.admin.email);
    const { id } = req.params;
    await storage.deleteHallTicket(id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error deleting hall ticket");
    res.status(500).json({ message: "Failed to delete hall ticket" });
  }
});

// POST /api/auth/verify-hall-ticket — Verify hall ticket for student login
// (Mounted at /api/auth/verify-hall-ticket by the main routes file)
export async function verifyHallTicket(req: Request, res: Response) {
  try {
    const { qrData, rollNumber, hallTicketId } = req.body;

    let hallTicket;

    if (hallTicketId) {
      hallTicket = await storage.getHallTicketByIdAndRoll(hallTicketId, rollNumber);
      if (!hallTicket) {
        return res.status(400).json({ message: "Invalid details" });
      }
    } else if (qrData) {
      hallTicket = await storage.getHallTicketByQR(qrData);
      if (!hallTicket) {
        return res.status(404).json({ message: "Invalid hall ticket" });
      }
      if (hallTicket.rollNumber !== rollNumber) {
        return res.status(400).json({ message: "Roll number mismatch" });
      }
    } else {
      return res.status(400).json({ message: "Either QR data or hall ticket ID is required" });
    }

    // Generate a student session token for subsequent authenticated requests
    const studentToken = generateStudentToken(
      hallTicket.id,
      `student_${hallTicket.rollNumber}`,
      hallTicket.id
    );

    // Set student token as a cookie
    res.cookie("student_token", studentToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 12 * 60 * 60 * 1000, // 12 hours
    });

    res.json({
      valid: true,
      studentToken, // also return in body for clients that prefer headers
      hallTicket: {
        id: hallTicket.id,
        hallTicketId: hallTicket.hallTicketId,
        examName: hallTicket.examName,
        studentName: hallTicket.studentName,
        rollNumber: hallTicket.rollNumber,
        examDate: hallTicket.examDate,
        duration: hallTicket.duration,
        studentIdBarcode: hallTicket.studentIdBarcode,
        idCardImageUrl: hallTicket.idCardImageUrl,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error verifying hall ticket");
    res.status(500).json({ message: "Failed to verify hall ticket" });
  }
}

export default router;

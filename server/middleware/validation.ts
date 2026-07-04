import { z } from "zod";

/**
 * Validation schemas for all PATCH/update endpoints.
 * Prevents arbitrary field injection and ensures type safety.
 */

// Hall ticket update schema — only fields admins should be able to change
export const updateHallTicketSchema = z.object({
  examName: z.string().min(1).optional(),
  examDate: z.string().transform(val => new Date(val)).optional(), // transforms to Date
  duration: z.number().min(1).optional(),
  totalQuestions: z.number().min(1).optional(),
  rollNumber: z.string().min(1).optional(),
  studentName: z.string().min(1).optional(),
  studentEmail: z.string().email().optional(),
  studentIdBarcode: z.string().optional(),
  idCardImageUrl: z.string().optional(),
  isActive: z.boolean().optional(),
}).strict(); // .strict() rejects unknown fields

// Exam session update schema — restricted fields for admin updates
export const updateExamSessionSchema = z.object({
  status: z.enum(["not_started", "in_progress", "paused", "completed", "submitted"]).optional(),
  currentQuestion: z.number().min(1).optional(),
  answers: z.record(z.string(), z.any()).optional(),
  questionIds: z.array(z.string()).optional(),
  timeRemaining: z.number().min(0).optional(),
  isVerified: z.boolean().optional(),
  verificationData: z.any().optional(),
  endTime: z.string().datetime().transform(val => new Date(val)).optional(),
}).strict();

// Exam session submit schema — what students send on submission
export const submitExamSchema = z.object({
  answers: z.record(z.string(), z.any()),
});

// Security incident update schema
export const updateSecurityIncidentSchema = z.object({
  isResolved: z.boolean().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().datetime().transform(val => new Date(val)).optional(),
  description: z.string().optional(),
}).strict();

// Monitoring log creation schema
export const createMonitoringLogSchema = z.object({
  sessionId: z.string().uuid(),
  eventType: z.string().min(1),
  eventData: z.any().optional(),
});

// Identity verification request schemas
export const verifyNameSchema = z.object({
  idCardImage: z.string().min(1, "ID card image is required"),
  expectedName: z.string().min(1, "Expected name is required"),
});

export const verifyIdentitySchema = z.object({
  idCardImage: z.string().min(1, "ID card image is required"),
  selfieImage: z.string().min(1, "Selfie image is required"),
  expectedName: z.string().min(1, "Expected name is required"),
  expectedIdNumber: z.string().optional(),
  hallTicketId: z.string().optional(),
});

export const storeIdentityDocumentSchema = z.object({
  hallTicketId: z.string().min(1, "Hall ticket ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  rollNumber: z.string().optional(),
  documentImage: z.string().refine(
    (val) => val.startsWith("data:image/"),
    { message: "Invalid document image format" }
  ),
  selfieImage: z.string().optional(),
});

import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import type { Express } from "express";
import { logger } from "../logger";

/**
 * Configure all security middleware for the Express app.
 * Covers: rate limiting, security headers, CORS.
 */
export function setupSecurity(app: Express) {
  // ─── Helmet: Security Headers ───
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // needed for Vite dev
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:", "https://api.openai.com"],
          mediaSrc: ["'self'", "blob:"],
          workerSrc: ["'self'", "blob:"],
        },
      },
      crossOriginEmbedderPolicy: false, // needed for webcam access
    })
  );

  // ─── CORS ───
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://127.0.0.1:3010", "http://localhost:3010", "http://127.0.0.1:3000", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:5173"];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ─── Rate Limiters ───

  // General API rate limit: 100 requests per 15 minutes
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
    handler: (req, res, next, options) => {
      logger.warn({ ip: req.ip, path: req.path }, "Rate limit exceeded (general)");
      res.status(options.statusCode).json(options.message);
    },
  });

  // Strict rate limit for auth endpoints: 5 attempts per 15 minutes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login attempts, please try again in 15 minutes." },
    handler: (req, res, next, options) => {
      logger.warn({ ip: req.ip, email: req.body?.email }, "Rate limit exceeded (auth)");
      res.status(options.statusCode).json(options.message);
    },
  });

  // AI verification rate limit: 10 per 15 minutes (expensive API calls)
  const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many verification attempts, please try again later." },
    handler: (req, res, next, options) => {
      logger.warn({ ip: req.ip }, "Rate limit exceeded (verification)");
      res.status(options.statusCode).json(options.message);
    },
  });

  // Apply limiters
  app.use("/api/", generalLimiter);
  app.use("/api/auth/login", authLimiter);
  app.use("/api/verify-identity", verificationLimiter);
  app.use("/api/verify-name", verificationLimiter);

  logger.info("Security middleware configured (helmet, CORS, rate limiting)");
}

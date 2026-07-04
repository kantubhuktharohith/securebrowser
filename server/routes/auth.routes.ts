import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { authLogger as logger } from "../logger";

interface AdminCredentials {
  email: string;
  passwordHash: string;
}

interface AdminUser {
  email: string;
  role: "admin";
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminUser;
    }
  }
}

let adminCredentials: AdminCredentials | null = null;
let jwtSecret: string | null = null;

function loadAdminCredentials(): AdminCredentials {
  if (adminCredentials) return adminCredentials;

  const envEmail = process.env.ADMIN_EMAIL;
  const envPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (envEmail && envPasswordHash) {
    logger.info("Admin credentials loaded from environment variables");
    adminCredentials = { email: envEmail, passwordHash: envPasswordHash };
    return adminCredentials;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PRODUCTION SECURITY: ADMIN_EMAIL and ADMIN_PASSWORD_HASH environment variables are required in production."
    );
  }

  const credentialsPath = join(process.cwd(), "server", "admin-credentials.json");
  if (existsSync(credentialsPath)) {
    try {
      const fileContent = readFileSync(credentialsPath, "utf-8");
      const data = JSON.parse(fileContent);
      if (!data.email || !data.passwordHash) {
        throw new Error("Invalid credentials file format");
      }
      logger.warn("Admin credentials loaded from file (DEVELOPMENT ONLY)");
      adminCredentials = { email: data.email, passwordHash: data.passwordHash };
      return adminCredentials;
    } catch (error) {
      logger.error({ error }, "Error reading admin credentials file");
      throw new Error("Failed to load admin credentials from file");
    }
  }

  throw new Error(
    "Admin credentials not found. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH environment variables."
  );
}

export function getJWTSecret(): string {
  if (jwtSecret) return jwtSecret;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      logger.warn("Using default JWT_SECRET for development");
      jwtSecret = "dev-secret-for-local-development-only";
      return jwtSecret;
    }
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  jwtSecret = secret;
  return jwtSecret;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.admin_token;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, getJWTSecret()) as AdminUser;
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    logger.error({ error }, "Auth error");
    res.status(500).json({ message: "Authentication failed" });
  }
}

export async function ensureAdminUser(storage: any, adminEmail: string) {
  let adminUser = await storage.getUser(adminEmail);
  if (!adminUser) {
    adminUser = await storage.upsertUser({
      id: adminEmail,
      email: adminEmail,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });
    logger.info({ email: adminEmail }, "Admin user created in database");
  }
  return adminUser;
}

const router = Router();

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const credentials = loadAdminCredentials();

    if (email.toLowerCase() !== credentials.email.toLowerCase()) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, credentials.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { email: credentials.email, role: "admin" },
      getJWTSecret(),
      { expiresIn: "7d" }
    );

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info({ email: credentials.email }, "Admin login successful");
    res.json({
      message: "Login successful",
      user: { email: credentials.email, role: "admin" },
    });
  } catch (error) {
    logger.error({ error }, "Login error");
    res.status(500).json({ message: "Login failed" });
  }
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("admin_token");
  res.json({ message: "Logged out successfully" });
});

// GET /api/auth/user
router.get("/user", requireAdmin, (req: Request, res: Response) => {
  if (!req.admin) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.json({ email: req.admin.email, role: req.admin.role });
});

export default router;

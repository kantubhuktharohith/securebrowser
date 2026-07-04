import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { setupSecurity } from "./middleware/security";
import { logger, apiLogger } from "./logger";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ─── Security middleware (Upgrade #2) ───
setupSecurity(app);

// ─── Body parsing — allow larger payloads (up to 50mb for images) ───
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());

// ─── Request logging (Upgrade #15 — structured logging) ───
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      apiLogger.info(
        {
          method: req.method,
          path,
          status: res.statusCode,
          duration: `${duration}ms`,
        },
        `${req.method} ${path} ${res.statusCode} in ${duration}ms`
      );
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // ─── Global error handler ───
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({ err, status }, `Unhandled error: ${message}`);
    res.status(status).json({ message });
  });

  // ─── Vite dev server (development) or static files (production) ───
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const basePort = parseInt(process.env.PORT || "5000", 10);
  const defaultHost = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
  const host = process.env.HOST || defaultHost;

  function startServer(port: number) {
    const srv = server.listen(port, host, () => {
      logger.info(`Server running at http://${host}:${port}`);
    });

    srv.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        logger.warn(`Port ${port} is in use, trying port ${port + 1}...`);
        startServer(port + 1);
      } else {
        logger.error({ err }, "Server failed to start");
        process.exit(1);
      }
    });
  }

  startServer(basePort);
})();

import { Router } from "express";
import type { HealthResponse } from "@ebook/shared";
import { prisma } from "../../lib/db";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let databaseUp = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseUp = false;
  }

  const body: HealthResponse = {
    status: databaseUp ? "ok" : "degraded",
    database: databaseUp ? "up" : "down",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  res.status(databaseUp ? 200 : 503).json(body);
});

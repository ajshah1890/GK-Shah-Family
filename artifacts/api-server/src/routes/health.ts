import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Friendly alias used by the frontend diagnostics
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env["NODE_ENV"] ?? "development",
  });
});

// 405 for any other method on health endpoints
router.all("/health", (_req, res) => {
  res.setHeader("Allow", "GET");
  res.status(405).json({ error: "Method not allowed" });
});
router.all("/healthz", (_req, res) => {
  res.setHeader("Allow", "GET");
  res.status(405).json({ error: "Method not allowed" });
});

export default router;

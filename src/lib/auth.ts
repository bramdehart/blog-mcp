import type { RequestHandler } from "express";
import { config } from "./config.js";

export function requireApiKey(): RequestHandler {
  return (req, res, next) => {
    if (!config.apiKey) {
      next();
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "Missing Authorization header" });
      return;
    }
    const [type, token] = authHeader.split(" ");
    if (type.toLowerCase() !== "bearer" || token !== config.apiKey) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    next();
  };
}
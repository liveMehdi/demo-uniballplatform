import type { ErrorRequestHandler } from "express";
import { EventWriteError } from "../lib/eventWriteGuard.js";
import { SocietyAccessError } from "../modules/societies/societies.service.js";

const parserErrors = new Map<string, { status: number; message: string }>([
  [
    "entity.parse.failed",
    { status: 400, message: "Request body must be valid JSON." },
  ],
  ["entity.too.large", { status: 413, message: "Request body is too large." }],
  [
    "encoding.unsupported",
    { status: 415, message: "Unsupported request encoding." },
  ],
  [
    "charset.unsupported",
    { status: 415, message: "Unsupported request charset." },
  ],
  ["request.aborted", { status: 400, message: "Request was interrupted." }],
  ["request.size.invalid", { status: 400, message: "Invalid request size." }],
]);

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof EventWriteError || error instanceof SocietyAccessError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  const parserError =
    typeof error?.type === "string" ? parserErrors.get(error.type) : undefined;
  if (parserError) {
    res.status(parserError.status).json({ error: parserError.message });
    return;
  }

  console.error("Unhandled API error", { status: 500 });
  res.status(500).json({ error: "Something went wrong" });
};

import express from "express";
import { statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function frontendRouter(
  directory = fileURLToPath(new URL("../../../client/dist/", import.meta.url)),
) {
  const index = join(directory, "index.html");
  if (!statSync(index, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(
      "Frontend build missing. Run npm run build in client before enabling SERVE_CLIENT.",
    );
  }

  const router = express.Router();
  router.use((req, res, next) => {
    let path: string;
    try {
      path = decodeURIComponent(req.path);
    } catch {
      res.status(400).send("Invalid path.");
      return;
    }
    if (
      path.split("/").some((part) => part.startsWith(".")) ||
      /^\/api(?:\/|$)/i.test(path)
    ) {
      res.sendStatus(404);
      return;
    }
    next();
  });

  
  router.use(
    express.static(directory, {
      index: false,
      redirect: false,
      setHeaders(res, path) {
        if (extname(path) === ".html")
          res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  router.get("/{*path}", (req, res, next) => {
    const path = decodeURIComponent(req.path);

    if (
      extname(path) ||
      /^\/assets(?:\/|$)/i.test(path) ||
      !req.accepts("html")
    ) {
      next();
      return;
    }
    res.sendFile(
      index,
      { headers: { "Cache-Control": "no-cache" } },
      (error) => {
        if (error) next(error);
      },
    );
  });
  return router;
}

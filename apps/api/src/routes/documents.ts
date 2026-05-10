import { Router } from "express";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { requireAuth } from "../middleware/requireAuth";
import { resolveTenant } from "../middleware/tenantResolver";
import { AppError } from "../middleware/errorHandler";

export const documentsRouter = Router();
documentsRouter.use(requireAuth, resolveTenant);

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

// GET /api/documents?entityType=lead&entityId=xxx
documentsRouter.get("/", async (req, res, next) => {
  try {
    const { entityType, entityId } = z.object({
      entityType: z.string().min(1),
      entityId:   z.string().min(1),
    }).parse(req.query);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdb = req.tenantDb as any;
    if (!tdb?.document) { res.json({ documents: [] }); return; }

    const documents = await tdb.document.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, originalName: true,
        mimeType: true, size: true, uploadedBy: true, createdAt: true,
      },
    });
    res.json({ documents });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, "entityType and entityId are required"));
    else next(err);
  }
});

// POST /api/documents — multipart/form-data upload
// We use raw body parsing to handle the upload without multer
documentsRouter.post("/", async (req, res, next) => {
  try {
    const { entityType, entityId } = z.object({
      entityType: z.string().min(1),
      entityId:   z.string().min(1),
    }).parse(req.query);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdb = req.tenantDb as any;
    if (!tdb?.document) {
      res.status(503).json({ error: "Run database migration to enable Documents." });
      return;
    }

    const contentType = req.headers["content-type"] ?? "";
    const contentLength = parseInt(req.headers["content-length"] ?? "0");

    if (!contentType.startsWith("application/octet-stream") && !contentType.startsWith("multipart/")) {
      throw new AppError(400, "Upload must be sent as application/octet-stream with X-File-Name header");
    }

    if (contentLength > MAX_FILE_SIZE) {
      throw new AppError(413, "File too large — maximum 10 MB");
    }

    const originalName = decodeURIComponent(req.headers["x-file-name"] as string ?? "upload");
    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageName = `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
    const storagePath = path.join(UPLOAD_DIR, storageName);

    await ensureUploadDir();

    let size = 0;
    const writeStream = createWriteStream(storagePath);
    try {
      await pipeline(
        req,
        async function* (source) {
          for await (const chunk of source) {
            size += (chunk as Buffer).length;
            if (size > MAX_FILE_SIZE) throw new AppError(413, "File too large — maximum 10 MB");
            yield chunk;
          }
        },
        writeStream,
      );
    } catch (err) {
      await fs.unlink(storagePath).catch(() => {});
      throw err;
    }

    const document = await tdb.document.create({
      data: {
        entityType,
        entityId,
        name:         safeName,
        originalName: originalName,
        mimeType:     req.headers["content-type"]?.split(";")[0] ?? "application/octet-stream",
        size,
        storagePath:  storageName,
        uploadedBy:   req.user!.userId,
      },
      select: {
        id: true, name: true, originalName: true,
        mimeType: true, size: true, uploadedBy: true, createdAt: true,
      },
    });

    res.status(201).json({ document });
  } catch (err) { next(err); }
});

// GET /api/documents/:id/download
documentsRouter.get("/:id/download", async (req, res, next) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdb = req.tenantDb as any;
    if (!tdb?.document) throw new AppError(404, "Document not found");

    const doc = await tdb.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw new AppError(404, "Document not found");

    const filePath = path.join(UPLOAD_DIR, doc.storagePath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
    res.setHeader("Content-Type", doc.mimeType);
    res.sendFile(filePath);
  } catch (err) { next(err); }
});

// DELETE /api/documents/:id
documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tdb = req.tenantDb as any;
    if (!tdb?.document) throw new AppError(404, "Document not found");

    const doc = await tdb.document.findUnique({ where: { id: req.params.id } });
    if (!doc) throw new AppError(404, "Document not found");

    const filePath = path.join(UPLOAD_DIR, doc.storagePath);
    await fs.unlink(filePath).catch(() => {}); // best-effort file deletion
    await tdb.document.delete({ where: { id: req.params.id } });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

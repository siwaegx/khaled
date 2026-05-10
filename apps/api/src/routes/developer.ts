import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const developerRouter = Router();
developerRouter.use(requireAuth);

const profileSchema = z.object({
  displayName: z.string().min(2).max(80),
  website: z.string().url().optional().or(z.literal("")).transform((v) => v || null),
  bio: z.string().max(500).optional(),
});

const submissionSchema = z.object({
  name: z.string().min(2).max(80),
  key: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "Key must be lowercase letters, numbers, and hyphens only"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must follow MAJOR.MINOR.PATCH format"),
  category: z.enum(["core", "integration", "industry", "community", "premium"]),
  description: z.string().min(10).max(1000),
  repoUrl: z.string().url(),
  contactEmail: z.string().email(),
});

// POST /api/developer/profile — register as a developer
developerRouter.post("/profile", async (req, res, next) => {
  try {
    const data = profileSchema.parse(req.body);

    const existing = await prisma.developerProfile.findUnique({
      where: { userId: req.user!.userId },
    });
    if (existing) throw new AppError(409, "Developer profile already exists");

    const profile = await prisma.developerProfile.create({
      data: { userId: req.user!.userId, ...data },
    });
    res.status(201).json({ profile });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// GET /api/developer/profile — get my profile + submissions
developerRouter.get("/profile", async (req, res, next) => {
  try {
    const profile = await prisma.developerProfile.findUnique({
      where: { userId: req.user!.userId },
      include: {
        submissions: {
          include: { module: true },
          orderBy: { submittedAt: "desc" },
        },
      },
    });
    if (!profile) throw new AppError(404, "No developer profile found");
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/developer/profile — update profile
developerRouter.patch("/profile", async (req, res, next) => {
  try {
    const data = profileSchema.partial().parse(req.body);

    const profile = await prisma.developerProfile.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!profile) throw new AppError(404, "No developer profile found");

    const updated = await prisma.developerProfile.update({
      where: { id: profile.id },
      data,
    });
    res.json({ profile: updated });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// POST /api/developer/submissions — submit a module for review
developerRouter.post("/submissions", async (req, res, next) => {
  try {
    const data = submissionSchema.parse(req.body);

    const profile = await prisma.developerProfile.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!profile) throw new AppError(403, "Create a developer profile first");

    // Key must not already be pending or approved
    const keyTaken = await prisma.moduleSubmission.findFirst({
      where: { key: data.key, status: { not: "rejected" } },
    });
    if (keyTaken) throw new AppError(409, `Module key "${data.key}" is already in use`);

    const submission = await prisma.moduleSubmission.create({
      data: { developerId: profile.id, ...data },
    });
    res.status(201).json({ submission });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// GET /api/developer/submissions — list my submissions
developerRouter.get("/submissions", async (req, res, next) => {
  try {
    const profile = await prisma.developerProfile.findUnique({
      where: { userId: req.user!.userId },
    });
    if (!profile) throw new AppError(404, "No developer profile found");

    const submissions = await prisma.moduleSubmission.findMany({
      where: { developerId: profile.id },
      include: { module: true },
      orderBy: { submittedAt: "desc" },
    });
    res.json({ submissions });
  } catch (err) {
    next(err);
  }
});

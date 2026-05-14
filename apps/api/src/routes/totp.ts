import { Router } from "express";
import { z } from "zod";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const totpRouter = Router();
totpRouter.use(requireAuth);

// POST /api/auth/totp/setup — generate secret + QR code URI (does NOT enable yet)
totpRouter.post("/setup", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { email: true, totpEnabled: true },
    });
    if (!user) throw new AppError(404, "User not found");
    if (user.totpEnabled) throw new AppError(409, "TOTP is already enabled");

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, "Business360", secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Store the pending secret (not yet enabled — user must verify first)
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { totpSecret: secret },
    });

    res.json({ secret, qrDataUrl });
  } catch (err) { next(err); }
});

// POST /api/auth/totp/verify — confirm OTP token to activate TOTP
totpRouter.post("/verify", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!user) throw new AppError(404, "User not found");
    if (user.totpEnabled) throw new AppError(409, "TOTP is already enabled");
    if (!user.totpSecret) throw new AppError(400, "No pending TOTP setup — call /setup first");

    const valid = authenticator.verify({ token, secret: user.totpSecret });
    if (!valid) throw new AppError(400, "Invalid TOTP code");

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { totpEnabled: true },
    });

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.issues[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// POST /api/auth/totp/disable — turn off TOTP (requires valid OTP)
totpRouter.post("/disable", async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { totpSecret: true, totpEnabled: true },
    });
    if (!user) throw new AppError(404, "User not found");
    if (!user.totpEnabled) throw new AppError(400, "TOTP is not enabled");

    const valid = authenticator.verify({ token, secret: user.totpSecret! });
    if (!valid) throw new AppError(400, "Invalid TOTP code");

    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { totpEnabled: false, totpSecret: null },
    });

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.issues[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// GET /api/auth/totp/status — is TOTP enabled for current user?
totpRouter.get("/status", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { totpEnabled: true },
    });
    res.json({ totpEnabled: user?.totpEnabled ?? false });
  } catch (err) { next(err); }
});

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
if (!resend) console.warn("[emailService] RESEND_API_KEY not set — emails will only be logged to console");
const FROM = process.env.RESEND_FROM ?? "Business360 <noreply@business360.app>";
const APP_NAME = "Business360";

async function send(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[Email → ${to}] ${subject}\n${html.replace(/<[^>]+>/g, "")}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

export async function sendWelcomeEmail(to: string, name: string) {
  await send(
    to,
    `Welcome to ${APP_NAME}!`,
    `<p>Hi ${name},</p>
     <p>Welcome to <strong>${APP_NAME}</strong> — your all-in-one business platform.</p>
     <p>Get started by creating your organization and installing modules.</p>
     <p>The ${APP_NAME} Team</p>`,
  );
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  await send(
    to,
    `Reset your ${APP_NAME} password`,
    `<p>Hi ${name},</p>
     <p>We received a request to reset your password. Click the link below to set a new one:</p>
     <p><a href="${resetUrl}" style="color:#0D9488;font-weight:bold;">Reset Password</a></p>
     <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
     <p>The ${APP_NAME} Team</p>`,
  );
}

export async function sendLeaveDecisionEmail(
  to: string,
  name: string,
  type: string,
  status: "approved" | "rejected",
  startDate: Date,
  endDate: Date,
  days: number,
) {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const approved = status === "approved";
  await send(
    to,
    `Your ${type} leave request has been ${status}`,
    `<p>Hi ${name},</p>
     <p>Your <strong>${type}</strong> leave request for <strong>${days} day${days !== 1 ? "s" : ""}</strong>
     (${fmt(startDate)} – ${fmt(endDate)}) has been <strong style="color:${approved ? "#059669" : "#DC2626"}">${status}</strong>.</p>
     ${approved ? "<p>Enjoy your time off!</p>" : "<p>Please speak with your manager if you have questions.</p>"}
     <p>The ${APP_NAME} Team</p>`,
  );
}

export async function sendOrgInviteEmail(
  to: string,
  inviterName: string,
  orgName: string,
  role: string,
  acceptUrl: string,
) {
  await send(
    to,
    `You've been invited to join ${orgName} on ${APP_NAME}`,
    `<p>Hi,</p>
     <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as a
     <strong>${role}</strong> on ${APP_NAME}.</p>
     <p><a href="${acceptUrl}" style="color:#0D9488;font-weight:bold;font-size:16px;">Accept Invitation →</a></p>
     <p style="color:#6B7280;font-size:13px;">This link expires in 7 days. If you don't have an account yet,
     you'll be prompted to create one.</p>
     <p>The ${APP_NAME} Team</p>`,
  );
}

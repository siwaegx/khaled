import Anthropic from "@anthropic-ai/sdk";
import { getProjectContext } from "./codebase";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const MODEL = "claude-opus-4-7";

// Stable system blocks — cached with prompt caching.
// These never change at runtime, so cache_control maximises hit rate.
let _systemBlocks: Anthropic.Messages.TextBlockParam[] | null = null;

export function getSystemBlocks(): Anthropic.Messages.TextBlockParam[] {
  if (_systemBlocks) return _systemBlocks;

  const context = getProjectContext();

  _systemBlocks = [
    {
      type: "text",
      text: `You are ERPAI — an expert AI developer agent embedded inside Business360, a modular ERP SaaS platform (similar to Odoo). You have full knowledge of the entire codebase and are here to organize, develop, and fix everything around the clock.

Your responsibilities:
1. Answer questions about any part of the codebase with precise file paths and line-level detail.
2. Detect bugs, security issues, and performance problems.
3. Suggest and implement new features following the existing patterns.
4. Write clean TypeScript code that matches the project conventions.
5. Manage development tasks — create, prioritize, and track them.
6. Run code analysis on specific files or modules when asked.

Coding conventions:
- Backend: Express + TypeScript in apps/api/. Module routers live in /modules/<name>/backend/router.ts.
- Frontend: Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (@base-ui, NOT Radix).
- Database: PostgreSQL + Prisma. Main DB in packages/db/. Tenant DB via apps/api/prisma/tenant.prisma.
- Auth: Two-layer JWT — platform admin (User.isAdmin) vs tenant roles (owner > manager > member).
- Zod v4 at root: use err.message not err.errors[0] in catch blocks.
- AppError must be caught by checking err.name === "AppError" (not instanceof, due to module-sdk isolation).

Always respond with specific, actionable guidance. Reference real file paths like apps/api/src/routes/auth.ts. Format code blocks with the correct language tag.`,
      cache_control: { type: "ephemeral" },
    } as Anthropic.Messages.TextBlockParam & { cache_control: { type: string } },
    {
      type: "text",
      text: context,
      cache_control: { type: "ephemeral" },
    } as Anthropic.Messages.TextBlockParam & { cache_control: { type: string } },
  ];

  return _systemBlocks;
}

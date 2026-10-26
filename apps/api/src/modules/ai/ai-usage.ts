import type { AiUsage } from "@ebook/shared";
import type { AiKind } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { env } from "../../lib/env";
import { AppError } from "../../lib/errors";
import type { LlmUsage } from "../../lib/llm";

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getUsageToday(userId: string): Promise<AiUsage> {
  const { _sum } = await prisma.aiUsage.aggregate({
    where: { userId, createdAt: { gte: startOfUtcDay() } },
    _sum: { inputTokens: true, outputTokens: true },
  });
  return {
    usedToday: (_sum.inputTokens ?? 0) + (_sum.outputTokens ?? 0),
    dailyLimit: env.AI_DAILY_TOKEN_LIMIT,
  };
}

/** Rejects the request before calling the model if the user has spent today's allowance. */
export async function assertWithinQuota(userId: string): Promise<void> {
  const { usedToday, dailyLimit } = await getUsageToday(userId);
  if (usedToday >= dailyLimit) {
    throw new AppError(
      429,
      "AI_QUOTA_EXCEEDED",
      "You've used today's AI allowance. It resets at midnight UTC.",
    );
  }
}

export async function recordUsage(userId: string, kind: AiKind, usage: LlmUsage): Promise<void> {
  await prisma.aiUsage.create({
    data: { userId, kind, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
  });
}

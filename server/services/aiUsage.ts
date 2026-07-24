import { readUsers, updateUser } from "@directus/sdk";
import { getServiceDirectusClient } from "../lib/directus.js";
import { TIER_LIMITS } from "../../shared/limits.js";
import type { UserGroup } from "../../shared/enums.js";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface AiUsageCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

async function readCurrentUsage(userId: string, userGroup: UserGroup): Promise<{ used: number; limit: number }> {
  const client = getServiceDirectusClient();
  const limit = TIER_LIMITS[userGroup].aiSuggestionsPerDay;

  const rows = await client.request(
    readUsers({
      filter: { id: { _eq: userId } },
      fields: ["ai_suggestions_used_today", "ai_suggestions_reset_at"],
      limit: 1,
    }),
  );
  const row = rows[0] as
    | { ai_suggestions_used_today: number | null; ai_suggestions_reset_at: string | null }
    | undefined;

  const today = todayUTC();
  const used = row?.ai_suggestions_reset_at === today ? (row.ai_suggestions_used_today ?? 0) : 0;
  return { used, limit };
}

/** Read-only lookup of today's usage, for showing "X of Y used today" before the user tries to generate anything. */
export async function getAiUsageToday(userId: string, userGroup: UserGroup): Promise<AiUsageCheck> {
  const { used, limit } = await readCurrentUsage(userId, userGroup);
  return { allowed: used < limit, used, limit };
}

/**
 * Checks and — if allowed — immediately increments a user's daily
 * AI-suggestion usage, tiered by userGroup. Counts against the quota on
 * every attempt (not just successful generations), so a call that fails
 * downstream (a bad Anthropic response, say) still consumes a slot; this
 * trades a small amount of user-unfriendliness for not needing a
 * reserve/release scheme. Read-then-write, not a single atomic DB
 * operation — acceptable for a soft usage cap where a rare double-click
 * race letting one extra call through isn't a real problem.
 */
export async function checkAndIncrementAiUsage(userId: string, userGroup: UserGroup): Promise<AiUsageCheck> {
  const client = getServiceDirectusClient();
  const { used: currentUsed, limit } = await readCurrentUsage(userId, userGroup);

  if (currentUsed >= limit) {
    return { allowed: false, used: currentUsed, limit };
  }

  await client.request(
    updateUser(
      userId,
      { ai_suggestions_used_today: currentUsed + 1, ai_suggestions_reset_at: todayUTC() },
      { fields: ["id"] },
    ),
  );

  return { allowed: true, used: currentUsed + 1, limit };
}

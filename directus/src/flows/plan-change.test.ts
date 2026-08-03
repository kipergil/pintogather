import { describe, it, expect } from "vitest";
import { validatePayload } from "@directus/utils";
import { PAID_PLAN_CHANGE_FILTER, PLAN_CHANGE_KEY, PLAN_CHANGE_SCRIPT } from "./plan-change";

/**
 * These run the gate the way Directus does: the Run Script's own source is
 * evaluated, and its output is checked with `validatePayload` — the same
 * function Directus's condition operation uses. Asserting against a
 * hand-rolled stand-in would prove nothing here, because the bug being fixed
 * *is* a filter-semantics surprise (Directus passes a filter whose field is
 * absent from the data).
 */

type FlowData = { $trigger?: { payload?: Record<string, unknown>; keys?: string[] } };

/** Evaluates PLAN_CHANGE_SCRIPT the way Directus's Run Script operation does. */
async function runScript(data: FlowData): Promise<Record<string, unknown>> {
  const module = { exports: {} as (data: FlowData) => Promise<Record<string, unknown>> };
  new Function("module", PLAN_CHANGE_SCRIPT)(module);
  return module.exports(data);
}

/** True when the flow would go on to send the email. */
async function wouldNotifyAdmins(payload: Record<string, unknown>): Promise<boolean> {
  const result = await runScript({ $trigger: { payload, keys: ["user-1"] } });
  return validatePayload(PAID_PLAN_CHANGE_FILTER, { [PLAN_CHANGE_KEY]: result }).length === 0;
}

describe("paid-plan change gate", () => {
  it.each(["basic", "premium"])("notifies when the write moves someone onto %s", async (tier) => {
    expect(await wouldNotifyAdmins({ user_group: tier })).toBe(true);
  });

  it("stays quiet when the write drops someone to freemium", async () => {
    expect(await wouldNotifyAdmins({ user_group: "freemium" })).toBe(false);
  });

  it.each([
    ["a profile edit", { bio: "Collector of bakeries", username: "kip" }],
    ["an avatar upload", { avatar_url: "https://example.com/a.png" }],
    ["a Stripe customer id being stored", { stripe_customer_id: "cus_123" }],
    ["a status-only subscription write", { stripe_subscription_status: "past_due" }],
    ["an empty write", {}],
  ])("stays quiet for %s by someone already on a paid plan", async (_label, payload) => {
    // The original gate read the *current* user_group off the row, so every
    // one of these sent "New basic subscription" to the admins again.
    expect(await wouldNotifyAdmins(payload)).toBe(false);
  });

  it("stays quiet when user_group is written as null or empty", async () => {
    expect(await wouldNotifyAdmins({ user_group: null })).toBe(false);
    expect(await wouldNotifyAdmins({ user_group: "" })).toBe(false);
  });

  it("survives a trigger with no payload at all", async () => {
    const result = await runScript({});
    expect(validatePayload(PAID_PLAN_CHANGE_FILTER, { [PLAN_CHANGE_KEY]: result })).not.toHaveLength(0);
  });

  it("always reports the field, so the condition has something to reject", async () => {
    // A filter whose field is missing from the data passes in Directus — the
    // reason this gate needs a script in front of it at all. Guard the
    // property that makes the condition meaningful.
    for (const payload of [{}, { bio: "x" }, { user_group: "basic" }]) {
      expect(await runScript({ $trigger: { payload } })).toHaveProperty("to");
    }
  });

  it("would be defeated by a bare filter on the trigger payload", async () => {
    // Documents the trap rather than the fix: this is the condition that
    // looks right and silently lets every profile edit through.
    const naive = { $trigger: { payload: { user_group: { _in: ["basic", "premium"] } } } };
    expect(validatePayload(naive, { $trigger: { payload: { bio: "x" } } })).toHaveLength(0);
  });
});

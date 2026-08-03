/**
 * The gate that decides whether a directus_users update was a plan change.
 *
 * Kept in its own file, importing nothing, so it can be unit-tested directly
 * — the flow it belongs to sends email to admins, and the naive version of
 * this gate is silently wrong in a way that only shows up in production.
 *
 * The trap: a Directus condition of `{ $trigger: { payload: { user_group:
 * { _in: ["basic", "premium"] } } } }` reads like "only when the write set a
 * paid tier", but Directus filters treat an *absent* field as nothing to
 * violate — so an update carrying only `bio` passes it. Every profile edit
 * by a paying customer would send another "New basic subscription" email.
 *
 * So the script below runs first and turns "was user_group in this write?"
 * into a value that is always present: the new tier, or an empty string. The
 * condition then has something concrete to reject.
 */

/** Key the Run Script publishes its result under, and the field within it. */
export const PLAN_CHANGE_KEY = "plan_change";
const PLAN_CHANGE_FIELD = "to";

/** Body of the Run Script operation, as Directus stores it (a `module.exports` string). */
export const PLAN_CHANGE_SCRIPT = `module.exports = async function(data) {
  const payload = (data.$trigger && data.$trigger.payload) || {};
  const touched = Object.prototype.hasOwnProperty.call(payload, 'user_group');
  return { ${PLAN_CHANGE_FIELD}: touched && payload.user_group ? payload.user_group : '' };
};`;

/** Condition filter that lets only a move onto a paid tier through. */
export const PAID_PLAN_CHANGE_FILTER = {
  [PLAN_CHANGE_KEY]: { [PLAN_CHANGE_FIELD]: { _in: ["basic", "premium"] } },
};

/**
 * Declarative Directus Flows for transactional/notification email.
 *
 * Why Directus Flows instead of the app server sending these directly: the
 * SMTP relay this instance sends through (Elestio-provisioned) is only
 * reachable at a Docker-internal address (172.17.0.1) from containers on
 * that same host — Directus itself can reach it, but the Express server
 * (deployed separately, e.g. on Vercel) cannot. Directus's own "Send Email"
 * flow operation uses Directus's core mail transport, already configured
 * for this instance's own transactional email, so routing through Flows
 * sidesteps the network problem entirely — the app server just writes the
 * row that triggers each flow, same as any other write.
 *
 * Flow `name` fields below are fixed literal strings, not built from
 * APP_NAME (unlike the email copy they send), because apply.ts matches
 * existing flows by exact name to stay idempotent. Renaming one therefore
 * orphans the flow already provisioned — so if you must, move the old
 * string into that flow's `legacyNames` in the same edit, which is what
 * lets apply.ts adopt and rename it rather than creating a duplicate
 * alongside it. These are internal admin-panel labels, never seen by end
 * users; there's rarely a reason to touch them.
 */
import { env } from "../lib/env.js";
import { PAID_PLAN_CHANGE_FILTER, PLAN_CHANGE_KEY, PLAN_CHANGE_SCRIPT } from "./plan-change.js";

/** The app's actual public origin — read from APP_BASE_URL (directus/.env), not hardcoded, since links in these emails need to point somewhere real. */
export const APP_BASE_URL = env.APP_BASE_URL;

/** A single node in a Flow's operation chain, in execution order. `resolve` linking to the next operation is wired up by apply.ts. */
export interface OperationSpec {
  key: string;
  name: string;
  type: string;
  options: Record<string, unknown>;
}

export interface FlowSpec {
  name: string;
  /**
   * Names this flow has gone by before. apply.ts falls back to these when
   * `name` finds nothing, so an already-provisioned flow gets adopted and
   * renamed instead of a duplicate being created beside it — which is what
   * would otherwise happen after a rename, and would double every email.
   */
  legacyNames?: string[];
  icon: string;
  trigger: { scope: string[]; collections: string[] };
  operations: OperationSpec[];
}

/** The app was called PinTogather before it was PinGather; flows provisioned back then still carry the old prefix. */
const legacyNameOf = (name: string) => name.replace(/^PinGather: /, "PinTogather: ");

/**
 * Every admin-notification flow needs the same "who do I email" step: look
 * up everyone with is_admin=true (rather than hardcoding an address here,
 * duplicating the app's own ADMIN_EMAILS-driven is_admin flag) and join
 * their emails into a single comma-separated string a mail operation's `to`
 * field accepts. Shared as a function so each flow gets its own operation
 * instances (operations belong to exactly one flow) built from the same
 * two-step recipe: read the admins, then join them in a Run Script.
 */
function adminRecipientOperations(): OperationSpec[] {
  return [
    {
      key: "read_admins",
      name: "Read admins",
      type: "item-read",
      options: {
        collection: "directus_users",
        query: { filter: { is_admin: { _eq: true } }, fields: ["email"] },
      },
    },
    {
      key: "admin_emails",
      name: "Join admin emails",
      type: "exec",
      options: {
        code: "module.exports = async function(data) {\n  const admins = data.read_admins || [];\n  return { list: admins.map((u) => u.email).filter(Boolean).join(',') };\n};",
      },
    },
  ];
}

/** Gate on a script-produced field being non-empty, e.g. skip sending if there are somehow no admins. `path` is dotted, e.g. "admin_emails.list" — built into the nested filter object Directus's condition operation expects. */
function nonEmptyCondition(key: string, name: string, path: string): OperationSpec {
  const [operationKey, field] = path.split(".");
  return {
    key,
    name,
    type: "condition",
    options: { filter: { [operationKey]: { [field]: { _nnull: true, _neq: "" } } } },
  };
}

// --- Flow 1: map invitation created -> email the invitee -------------------

const MAP_INVITATION_MAIL_BODY = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="font-size: 18px; margin-bottom: 4px;">You've been invited to collaborate</h2>
    <p style="color: #555; line-height: 1.5;">
      <strong>{{read_inviter.first_name}} {{read_inviter.last_name}}</strong> invited you to collaborate on
      <strong>"{{read_map.name}}"</strong> on ${env.APP_NAME}.
    </p>
    <p style="margin: 24px 0;">
      <a href="${APP_BASE_URL}/invitations/{{$trigger.payload.token}}"
         style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
        Accept invitation
      </a>
    </p>
    <p style="color: #888; font-size: 13px; line-height: 1.5;">
      If the button doesn't work, copy this link:<br />
      <a href="${APP_BASE_URL}/invitations/{{$trigger.payload.token}}">${APP_BASE_URL}/invitations/{{$trigger.payload.token}}</a>
    </p>
  </div>
`;

export const mapInvitationFlow: FlowSpec = {
  name: "PinGather: Send map invitation email",
  legacyNames: [legacyNameOf("PinGather: Send map invitation email")],
  icon: "mail",
  trigger: { scope: ["items.create"], collections: ["map_invitations"] },
  operations: [
    {
      key: "read_map",
      name: "Read map",
      type: "item-read",
      options: { collection: "map_collections", key: "{{$trigger.payload.map}}", query: { fields: ["name"] } },
    },
    {
      key: "read_inviter",
      name: "Read inviter",
      type: "item-read",
      options: {
        collection: "directus_users",
        key: "{{$trigger.payload.invited_by}}",
        query: { fields: ["first_name", "last_name", "email"] },
      },
    },
    {
      key: "send_email",
      name: "Send invitation email",
      type: "mail",
      options: {
        to: ["{{$trigger.payload.email}}"],
        subject: `{{read_inviter.first_name}} invited you to collaborate on "{{read_map.name}}" on ${env.APP_NAME}`,
        type: "wysiwyg",
        body: MAP_INVITATION_MAIL_BODY,
      },
    },
  ],
};

// --- Flow 2: new user signup -> notify admins -------------------------------

const NEW_USER_MAIL_BODY = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="font-size: 18px; margin-bottom: 4px;">New signup</h2>
    <p style="color: #555; line-height: 1.5;">
      <strong>{{$trigger.payload.full_name}}</strong> ({{$trigger.payload.email}}) just signed up for ${env.APP_NAME}.
    </p>
  </div>
`;

export const newUserFlow: FlowSpec = {
  name: "PinGather: Notify admins of new signup",
  legacyNames: [legacyNameOf("PinGather: Notify admins of new signup")],
  icon: "person_add",
  trigger: { scope: ["items.create"], collections: ["directus_users"] },
  operations: [
    ...adminRecipientOperations(),
    nonEmptyCondition("has_admins", "Skip if no admins", "admin_emails.list"),
    {
      key: "send_email",
      name: "Notify admins",
      type: "mail",
      options: {
        to: "{{admin_emails.list}}",
        subject: `New ${env.APP_NAME} signup: {{$trigger.payload.full_name}}`,
        type: "wysiwyg",
        body: NEW_USER_MAIL_BODY,
      },
    },
  ],
};

// --- Flow 3: user upgrades to a paid tier -> notify admins ------------------

/**
 * Fires when a user's plan actually moves onto a paid tier.
 *
 * Two things have to be true for that to mean what it says, because the
 * trigger is "any update to any directus_users row":
 *
 *  1. The write has to have carried user_group at all. Reading the row and
 *     checking its *current* tier isn't enough — that matches every profile
 *     edit, username change, and avatar upload by anyone already paying,
 *     which is what made this email arrive constantly. Nor can a plain
 *     condition on `$trigger.payload.user_group` do the job: Directus
 *     filters treat an absent field as "nothing to violate", so a payload
 *     without user_group passes. Hence the Run Script below, which turns
 *     "field present?" into a definite value the condition can reject.
 *  2. The write has to be a real change. That half lives in the app:
 *     server/lib/subscription-sync.ts diffs against what's stored and skips
 *     the PATCH entirely when a Stripe renewal restates the same tier, so
 *     no user_group write reaches Directus in the first place.
 */
const NEW_PURCHASE_MAIL_BODY = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="font-size: 18px; margin-bottom: 4px;">Subscription update</h2>
    <p style="color: #555; line-height: 1.5;">
      <strong>{{read_user.first_name}} {{read_user.last_name}}</strong> ({{read_user.email}}) is now on the
      <strong>{{read_user.user_group}}</strong> plan.
    </p>
  </div>
`;

export const newPurchaseFlow: FlowSpec = {
  name: "PinGather: Notify admins of paid subscription",
  legacyNames: [legacyNameOf("PinGather: Notify admins of paid subscription")],
  icon: "payments",
  trigger: { scope: ["items.update"], collections: ["directus_users"] },
  operations: [
    {
      key: PLAN_CHANGE_KEY,
      name: "Read the plan out of the write itself",
      type: "exec",
      options: { code: PLAN_CHANGE_SCRIPT },
    },
    {
      key: "is_paid",
      name: "Only continue if this write moved them onto a paid plan",
      type: "condition",
      options: { filter: PAID_PLAN_CHANGE_FILTER },
    },
    {
      key: "read_user",
      name: "Read updated user",
      type: "item-read",
      options: {
        collection: "directus_users",
        key: "{{$trigger.keys[0]}}",
        query: { fields: ["email", "first_name", "last_name", "user_group"] },
      },
    },
    ...adminRecipientOperations(),
    nonEmptyCondition("has_admins", "Skip if no admins", "admin_emails.list"),
    {
      key: "send_email",
      name: "Notify admins",
      type: "mail",
      options: {
        to: "{{admin_emails.list}}",
        subject: "New {{read_user.user_group}} subscription: {{read_user.email}}",
        type: "wysiwyg",
        body: NEW_PURCHASE_MAIL_BODY,
      },
    },
  ],
};

// --- Flow 4: invitation accepted -> notify the inviter ----------------------

const INVITATION_ACCEPTED_MAIL_BODY = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="font-size: 18px; margin-bottom: 4px;">Your invitation was accepted</h2>
    <p style="color: #555; line-height: 1.5;">
      The invitation you sent to <strong>{{read_invitation.email}}</strong> for
      <strong>"{{read_map.name}}"</strong> has been accepted.
    </p>
    <p style="margin: 24px 0;">
      <a href="${APP_BASE_URL}/map/{{read_map.share_url}}"
         style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
        Open map
      </a>
    </p>
  </div>
`;

export const invitationAcceptedFlow: FlowSpec = {
  name: "PinGather: Notify inviter of accepted invitation",
  legacyNames: [legacyNameOf("PinGather: Notify inviter of accepted invitation")],
  icon: "how_to_reg",
  trigger: { scope: ["items.update"], collections: ["map_invitations"] },
  operations: [
    {
      key: "read_invitation",
      name: "Read invitation",
      type: "item-read",
      options: {
        collection: "map_invitations",
        key: "{{$trigger.keys[0]}}",
        query: { fields: ["email", "permission", "map", "invited_by", "status"] },
      },
    },
    {
      key: "is_accepted",
      name: "Only continue if accepted",
      type: "condition",
      options: { filter: { read_invitation: { status: { _eq: "accepted" } } } },
    },
    {
      key: "read_inviter",
      name: "Read inviter",
      type: "item-read",
      options: {
        collection: "directus_users",
        key: "{{read_invitation.invited_by}}",
        query: { fields: ["email", "first_name"] },
      },
    },
    {
      key: "read_map",
      name: "Read map",
      type: "item-read",
      options: { collection: "map_collections", key: "{{read_invitation.map}}", query: { fields: ["name", "share_url"] } },
    },
    {
      key: "send_email",
      name: "Notify inviter",
      type: "mail",
      options: {
        to: ["{{read_inviter.email}}"],
        subject: '{{read_invitation.email}} accepted your invitation to "{{read_map.name}}"',
        type: "wysiwyg",
        body: INVITATION_ACCEPTED_MAIL_BODY,
      },
    },
  ],
};

export const allFlows: FlowSpec[] = [mapInvitationFlow, newUserFlow, newPurchaseFlow, invitationAcceptedFlow];

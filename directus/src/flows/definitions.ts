/**
 * Declarative Directus Flow that emails a map invitation's recipient.
 *
 * Why a Directus Flow instead of the app server sending the email directly:
 * the SMTP relay this instance sends through (Elestio-provisioned) is only
 * reachable at a Docker-internal address (172.17.0.1) from containers on
 * that same host — Directus itself can reach it, but the Express server
 * (deployed separately, e.g. on Vercel) cannot. Directus's own "Send Email"
 * flow operation uses Directus's core mail transport, which is already
 * configured for this instance's own transactional email (password resets,
 * user invites), so routing through a Flow sidesteps the network problem
 * entirely — the app server just creates the `map_invitations` row as
 * normal, and this Flow (triggered on that row's creation) does the rest.
 */

/** Update if the app's production domain changes. */
export const APP_BASE_URL = "https://pintogather.vercel.app";

export const MAP_INVITATION_FLOW_NAME = "PinTogather: Send map invitation email";

export const MAP_INVITATION_MAIL_SUBJECT =
  '{{read_inviter.first_name}} invited you to collaborate on "{{read_map.name}}" on PinTogather';

export const MAP_INVITATION_MAIL_BODY = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
    <h2 style="font-size: 18px; margin-bottom: 4px;">You've been invited to collaborate</h2>
    <p style="color: #555; line-height: 1.5;">
      <strong>{{read_inviter.first_name}} {{read_inviter.last_name}}</strong> invited you to collaborate on
      <strong>"{{read_map.name}}"</strong> on PinTogather.
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

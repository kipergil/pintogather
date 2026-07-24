import { sendEmail } from "../lib/email.js";
import type { MapInvitation } from "../../shared/schema.js";

interface SendInvitationEmailInput {
  invitation: MapInvitation;
  mapName: string;
  inviterName: string;
  baseUrl: string;
}

/** Best-effort — a failed send should never block invitation creation, so this never throws (see sendEmail). */
export async function sendMapInvitationEmail({
  invitation,
  mapName,
  inviterName,
  baseUrl,
}: SendInvitationEmailInput): Promise<boolean> {
  const acceptUrl = `${baseUrl}/invitations/${invitation.token}`;
  const roleLabel = invitation.permission === "editable" ? "add and edit pins" : "view pins";

  const subject = `${inviterName} invited you to collaborate on "${mapName}" on PinTogather`;

  const text = [
    `${inviterName} invited you to collaborate on "${mapName}" on PinTogather.`,
    `You'll be able to ${roleLabel} on this map.`,
    ``,
    `Accept the invitation: ${acceptUrl}`,
    ``,
    `This invitation expires on ${invitation.expiresAt.toDateString()}.`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="font-size: 18px; margin-bottom: 4px;">You've been invited to collaborate</h2>
      <p style="color: #555; line-height: 1.5;">
        <strong>${escapeHtml(inviterName)}</strong> invited you to collaborate on
        <strong>"${escapeHtml(mapName)}"</strong> on PinTogather. You'll be able to ${roleLabel} on this map.
      </p>
      <p style="margin: 24px 0;">
        <a href="${acceptUrl}"
           style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
          Accept invitation
        </a>
      </p>
      <p style="color: #888; font-size: 13px; line-height: 1.5;">
        This invitation expires on ${invitation.expiresAt.toDateString()}. If the button doesn't work, copy this link:<br />
        <a href="${acceptUrl}" style="color: #2563eb;">${acceptUrl}</a>
      </p>
    </div>
  `;

  return sendEmail({ to: invitation.email, subject, html, text });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

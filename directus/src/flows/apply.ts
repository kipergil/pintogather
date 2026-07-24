import { createFlow, createOperation, readFlows, updateFlow } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { MAP_INVITATION_FLOW_NAME, MAP_INVITATION_MAIL_BODY, MAP_INVITATION_MAIL_SUBJECT } from "./definitions.js";

async function ensureMapInvitationFlow(client: Awaited<ReturnType<typeof getSchemaClient>>) {
  const existing = await client.request(
    readFlows({ filter: { name: { _eq: MAP_INVITATION_FLOW_NAME } }, limit: 1 }),
  );
  if (existing.length > 0) {
    console.log(`= flow "${MAP_INVITATION_FLOW_NAME}" already exists (${existing[0].id}) — skipping`);
    return;
  }

  const flow = await client.request(
    createFlow({
      name: MAP_INVITATION_FLOW_NAME,
      icon: "mail",
      status: "active",
      trigger: "event",
      accountability: "all",
      options: {
        type: "action",
        scope: ["items.create"],
        collections: ["map_invitations"],
      },
    }),
  );
  console.log(`+ created flow "${MAP_INVITATION_FLOW_NAME}" (${flow.id})`);

  // Operations are created in reverse order so each can `resolve` into the
  // next operation's id, then the flow is pointed at the first one.
  const sendEmail = await client.request(
    createOperation({
      flow: flow.id,
      name: "Send invitation email",
      key: "send_email",
      type: "mail",
      position_x: 39,
      position_y: 1,
      options: {
        to: ["{{$trigger.payload.email}}"],
        subject: MAP_INVITATION_MAIL_SUBJECT,
        type: "wysiwyg",
        body: MAP_INVITATION_MAIL_BODY,
      },
    }),
  );
  console.log(`  + operation send_email (${sendEmail.id})`);

  const readInviter = await client.request(
    createOperation({
      flow: flow.id,
      name: "Read inviter",
      key: "read_inviter",
      type: "item-read",
      position_x: 27,
      position_y: 1,
      options: {
        collection: "directus_users",
        key: "{{$trigger.payload.invited_by}}",
        query: { fields: ["first_name", "last_name", "email"] },
      },
      resolve: sendEmail.id,
    }),
  );
  console.log(`  + operation read_inviter (${readInviter.id})`);

  const readMap = await client.request(
    createOperation({
      flow: flow.id,
      name: "Read map",
      key: "read_map",
      type: "item-read",
      position_x: 15,
      position_y: 1,
      options: {
        collection: "map_collections",
        key: "{{$trigger.payload.map}}",
        query: { fields: ["name"] },
      },
      resolve: readInviter.id,
    }),
  );
  console.log(`  + operation read_map (${readMap.id})`);

  await client.request(updateFlow(flow.id, { operation: readMap.id }));
  console.log(`  + linked flow.operation -> read_map`);
}

async function main() {
  console.log(`Applying PinTogather flows to ${process.env.DIRECTUS_URL ?? "http://localhost:8055"}...`);
  const client = await getSchemaClient();

  await ensureMapInvitationFlow(client);

  console.log("\nFlows apply complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });

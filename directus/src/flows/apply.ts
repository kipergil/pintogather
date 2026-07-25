import { createFlow, createOperation, readFlows, updateFlow } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { allFlows, type FlowSpec } from "./definitions.js";

async function ensureFlow(client: Awaited<ReturnType<typeof getSchemaClient>>, spec: FlowSpec) {
  const existing = await client.request(readFlows({ filter: { name: { _eq: spec.name } }, limit: 1 }));
  if (existing.length > 0) {
    console.log(`= flow "${spec.name}" already exists (${existing[0].id}) — skipping`);
    return;
  }

  const flow = await client.request(
    createFlow({
      name: spec.name,
      icon: spec.icon,
      status: "active",
      trigger: "event",
      accountability: "all",
      options: {
        type: "action",
        scope: spec.trigger.scope,
        collections: spec.trigger.collections,
      },
    }),
  );
  console.log(`+ created flow "${spec.name}" (${flow.id})`);

  // Operations are created in reverse order so each can `resolve` into the
  // next operation's id, then the flow is pointed at the first one.
  let nextId: string | null = null;
  const createdIds: string[] = [];
  for (const op of [...spec.operations].reverse()) {
    const created: { id: string } = await client.request(
      createOperation({
        flow: flow.id,
        name: op.name,
        key: op.key,
        type: op.type,
        position_x: 1,
        position_y: 1,
        options: op.options,
        resolve: nextId,
      }),
    );
    createdIds.unshift(created.id);
    nextId = created.id;
    console.log(`  + operation ${op.key} (${created.id})`);
  }

  await client.request(updateFlow(flow.id, { operation: createdIds[0] }));
  console.log(`  + linked flow.operation -> ${spec.operations[0].key}`);
}

async function main() {
  console.log(`Applying PinTogather flows to ${process.env.DIRECTUS_URL ?? "http://localhost:8055"}...`);
  const client = await getSchemaClient();

  for (const spec of allFlows) {
    await ensureFlow(client, spec);
  }

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

import {
  createFlow,
  createOperation,
  deleteOperations,
  readFlows,
  readOperations,
  updateFlow,
} from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { env } from "../lib/env.js";
import { allFlows, type FlowSpec } from "./definitions.js";

type Client = Awaited<ReturnType<typeof getSchemaClient>>;

/** The flow this spec describes, found under its current name or any name it used to have. */
async function findFlow(client: Client, spec: FlowSpec): Promise<{ id: string; name: string } | undefined> {
  for (const name of [spec.name, ...(spec.legacyNames ?? [])]) {
    const [found] = (await client.request(
      readFlows({ filter: { name: { _eq: name } }, fields: ["id", "name"], limit: 1 }),
    )) as unknown as Array<{ id: string; name: string }>;
    if (found) return found;
  }
  return undefined;
}

/**
 * Rebuilds a flow's operation chain from the spec and returns the head's id.
 *
 * Operations are created in reverse order so each can `resolve` into the next
 * one's id. The caller points flow.operation at the head *before* any old
 * operations are removed — a flow row referencing a deleted operation is a
 * broken flow, so the new chain has to be in place first.
 */
async function buildOperations(client: Client, flowId: string, spec: FlowSpec): Promise<string> {
  let nextId: string | null = null;
  const createdIds: string[] = [];
  for (const op of [...spec.operations].reverse()) {
    const created: { id: string } = await client.request(
      createOperation({
        flow: flowId,
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
  return createdIds[0];
}

async function ensureFlow(client: Client, spec: FlowSpec) {
  const existing = await findFlow(client, spec);

  if (!existing) {
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
    const head = await buildOperations(client, flow.id, spec);
    await client.request(updateFlow(flow.id, { operation: head }));
    console.log(`  + linked flow.operation -> ${spec.operations[0].key}`);
    return;
  }

  // Adopting an existing flow: the spec is the source of truth, so its
  // operation chain is rebuilt wholesale rather than diffed. Editing a chain
  // in place would mean reconciling inserts, removals, and re-links against
  // whatever's there — and getting that subtly wrong on a flow that sends
  // email is worse than a few extra writes.
  const label = existing.name === spec.name ? `"${spec.name}"` : `"${existing.name}" -> "${spec.name}"`;
  console.log(`~ updating flow ${label} (${existing.id})`);

  const stale = (await client.request(
    readOperations({ filter: { flow: { _eq: existing.id } }, fields: ["id"], limit: -1 }),
  )) as unknown as Array<{ id: string }>;

  const head = await buildOperations(client, existing.id, spec);
  await client.request(
    updateFlow(existing.id, {
      name: spec.name,
      icon: spec.icon,
      options: { type: "action", scope: spec.trigger.scope, collections: spec.trigger.collections },
      operation: head,
    }),
  );
  console.log(`  ~ linked flow.operation -> ${spec.operations[0].key}`);

  if (stale.length > 0) {
    await client.request(deleteOperations(stale.map((op) => op.id)));
    console.log(`  - removed ${stale.length} superseded operation(s)`);
  }
}

async function main() {
  console.log(`Applying ${env.APP_NAME} flows to ${env.DIRECTUS_URL}...`);
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

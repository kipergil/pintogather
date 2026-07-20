import { serverInfo, type RestClient } from "@directus/sdk";

const MIN_MAJOR_VERSION = 11;

/**
 * The SDK's typed `ServerInfoOutput` omits the version field; its location
 * in the real (authenticated) response also isn't stable across majors, so
 * check both the flat and nested shape.
 */
type ServerInfoWithVersion = { version?: string; directus?: { version?: string } };

/**
 * `permissions:apply` targets Directus 11's Policies/Access model
 * (`directus_policies` + `directus_access`), which doesn't exist on older
 * majors — pointed at one, it fails with a cryptic 404 instead of an
 * explanation. Check up front so that failure is legible.
 */
export async function assertMinimumDirectusVersion(client: {
  request: RestClient<never>["request"];
}): Promise<void> {
  const info = (await client.request(serverInfo())) as ServerInfoWithVersion;
  const version = info.version ?? info.directus?.version;
  const major = version ? Number.parseInt(version, 10) : NaN;

  if (Number.isNaN(major) || major < MIN_MAJOR_VERSION) {
    throw new Error(
      `This Directus instance reports version ${version ?? "unknown"}, but PinTogather's ` +
        `permissions layer requires Directus >= ${MIN_MAJOR_VERSION}. Upgrade the instance, then re-run.`,
    );
  }
}

// Keeps traffic that Claude steers (image downloads, the headless browser) off
// the user's machine and local network: only public addresses are reachable.
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export class BlockedHostError extends Error {}

const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) PRIVATE.addSubnet(net, bits, "ipv4"); // prettier-ignore
for (const [net, bits] of [["::", 127], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) PRIVATE.addSubnet(net, bits, "ipv6"); // prettier-ignore

/** Whether an address is loopback, private, link-local or otherwise not public. */
export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return PRIVATE.check(mapped, "ipv4");
  const family = isIP(address);
  if (family === 0) return true;
  return PRIVATE.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * Resolves `host` and returns one of its addresses, refusing the host when any
 * address is not public. Callers connect to the returned address, so a second
 * DNS answer cannot redirect them.
 */
export async function resolvePublic(host: string): Promise<string> {
  const bare = host.replace(/^\[|\]$/g, "");
  const addresses = isIP(bare)
    ? [bare]
    : (await lookup(bare, { all: true }).catch(() => [])).map((a) => a.address);
  const first = addresses[0];
  if (first === undefined) throw new BlockedHostError(`cannot resolve ${bare}`);
  if (addresses.some(isPrivateAddress)) throw new BlockedHostError(`${bare} is not a public host`);
  return first;
}

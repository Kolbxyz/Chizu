import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./netGuard.ts";

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local and mapped addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "nonsense",
    ])
      expect(isPrivateAddress(address), address).toBe(true);
  });

  it("allows public addresses", () => {
    for (const address of ["208.80.154.224", "2620:0:862:ed1a::1"])
      expect(isPrivateAddress(address), address).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { initialMigrationName } from "../src/db/migrations";
import { md5Hex } from "../src/lib/hash";

describe("scaffold", () => {
  it("tracks the initial D1 migration", () => {
    expect(initialMigrationName).toBe("0001_initial");
  });

  it("computes Pixmicat-compatible MD5 values", async () => {
    expect(await md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});

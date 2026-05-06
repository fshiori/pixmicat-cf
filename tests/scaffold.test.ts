import { describe, expect, it } from "vitest";
import { initialMigrationName } from "../src/db/migrations";

describe("scaffold", () => {
  it("tracks the initial D1 migration", () => {
    expect(initialMigrationName).toBe("0001_initial");
  });
});

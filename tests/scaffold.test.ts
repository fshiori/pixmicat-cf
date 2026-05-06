import { describe, expect, it } from "vitest";
import { initialMigrationName } from "../src/db/migrations";
import { md5Hex } from "../src/lib/hash";
import { verifyPhpCrypt } from "../src/lib/php-crypt";

describe("scaffold", () => {
  it("tracks the initial D1 migration", () => {
    expect(initialMigrationName).toBe("0001_initial");
  });

  it("computes Pixmicat-compatible MD5 values", async () => {
    expect(await md5Hex("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("verifies PHP crypt admin hashes", () => {
    expect(verifyPhpCrypt("password", "$1$saltstring$JSG0oWvIRw84BN.W3PyeG.")).toBe(true);
    expect(verifyPhpCrypt("password", "$apr1$saltstri$KbmdckUzuN1qd7Gpo8DEL.")).toBe(true);
    expect(verifyPhpCrypt("foob", "arlEKn0OzVJn.")).toBe(true);
    expect(verifyPhpCrypt("password", "$2a$10$abcdefghijklmnopqrstuu5Lo0g67CiD3M4RpN1BmBb4Crp5w7dbK")).toBe(true);
    expect(verifyPhpCrypt("password", "$5$saltstring$OH4IDuTlsuTYPdED1gsuiRMyTAwNlRWyA6Xr3I4/dQ5")).toBe(true);
    expect(verifyPhpCrypt("password", "$5$rounds=10000$saltstring$BXKRfHOWGOryjAm0GVQk8VRJRERBkg4gV1V0f0ddop.")).toBe(true);
    expect(
      verifyPhpCrypt(
        "password",
        "$6$saltsalt$qFmFH.bQmmtXzyBY0s9v7Oicd2z4XSIecDzlB5KiA2/jctKu9YterLp8wwnSq.qc.eoxqOmSuNp2xS0ktL3nh/"
      )
    ).toBe(true);
  });
});

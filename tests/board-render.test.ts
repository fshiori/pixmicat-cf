import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/templates/pte";

describe("Pixmicat template rendering", () => {
  it("renders conditional blocks and replacements", () => {
    const html = renderTemplate("A<!--&IF($VALUE,'{$VALUE}','N')-->B{$MISSING}", {
      "{$VALUE}": "Y"
    });

    expect(html).toBe("AYB");
  });

  it("drops false conditional content", () => {
    const html = renderTemplate("A<!--&IF($VALUE,'Y','N')-->B", {});

    expect(html).toBe("ANB");
  });
});

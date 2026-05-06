import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/templates/pte";
import { t } from "../src/lib/i18n";

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

  it("keeps PHP zh_TW labels used by the default theme", () => {
    expect(t("post_name")).toBe("名稱: ");
    expect(t("reply_btn")).toBe("回應");
    expect(t("del_head")).toBe("【刪除文章】");
  });
});

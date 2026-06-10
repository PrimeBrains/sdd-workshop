import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("package scaffolding", () => {
  it("src の実エクスポートを厳密値で検証できる", () => {
    expect(PACKAGE_NAME).toBe("sdd-core-server");
  });
});

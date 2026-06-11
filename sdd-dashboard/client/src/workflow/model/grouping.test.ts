/**
 * GroupingModel ユニットテスト（design.md「Model 層（純粋関数）」GroupingModel）。
 * groupByApp / summarizeSpecGroup / groupSkillsByOrigin の厳密値検証。
 * Requirements: 1.6, 1.7, 1.8, 6.4, 6.5, 7.4, 7.5
 */
import { describe, expect, it } from "vitest";
import type { SpecSummary } from "@contracts/spec";
import type { SkillSummary } from "@contracts/resources";
import {
  groupByApp,
  summarizeSpecGroup,
  groupSkillsByOrigin,
  type AppGroup,
  type OriginGroup,
} from "./grouping";

/** SpecSummary を最小限のフィールドで生成するヘルパー。 */
function spec(partial: Partial<SpecSummary> & { feature: string }): SpecSummary {
  return {
    feature: partial.feature,
    app: partial.app ?? null,
    phase: partial.phase ?? null,
    language: null,
    approvals: null,
    readyForImplementation: partial.readyForImplementation ?? null,
    createdAt: null,
    updatedAt: null,
    artifacts: {} as SpecSummary["artifacts"],
    diagnostics: [],
  };
}

/** SkillSummary を最小限のフィールドで生成するヘルパー。 */
function skill(name: string, origin: string | null): SkillSummary {
  return { name, origin } as SkillSummary;
}

describe("groupByApp", () => {
  it("app 名昇順にグループ化し、null グループを末尾に置く（入力順保持）", () => {
    // scrambled 入力順: 複数 app + null 混在、各 app 複数要素
    const items = [
      { app: "sdd-dashboard", id: "d1" },
      { app: null, id: "n1" },
      { app: "evm-studio", id: "e1" },
      { app: "sdd-dashboard", id: "d2" },
      { app: "evm-studio", id: "e2" },
      { app: null, id: "n2" },
    ];

    const result = groupByApp(items);

    const expected: AppGroup<{ app: string | null; id: string }>[] = [
      {
        app: "evm-studio",
        items: [
          { app: "evm-studio", id: "e1" },
          { app: "evm-studio", id: "e2" },
        ],
      },
      {
        app: "sdd-dashboard",
        items: [
          { app: "sdd-dashboard", id: "d1" },
          { app: "sdd-dashboard", id: "d2" },
        ],
      },
      {
        app: null,
        items: [
          { app: null, id: "n1" },
          { app: null, id: "n2" },
        ],
      },
    ];
    expect(result).toEqual(expected);
  });

  it("null 要素が存在しないときは null グループを生成しない", () => {
    const items = [
      { app: "beta", id: "b1" },
      { app: "alpha", id: "a1" },
    ];

    const result = groupByApp(items);

    expect(result).toEqual([
      { app: "alpha", items: [{ app: "alpha", id: "a1" }] },
      { app: "beta", items: [{ app: "beta", id: "b1" }] },
    ]);
    // null グループが含まれないこと
    expect(result.some((g) => g.app === null)).toBe(false);
  });

  it("SpecSummary 形状でも generic として機能する（app 昇順・null 末尾）", () => {
    const specs = [
      spec({ feature: "z-feat", app: "zeta" }),
      spec({ feature: "no-app", app: null }),
      spec({ feature: "a-feat", app: "alpha" }),
    ];

    const result = groupByApp(specs);

    expect(result.map((g) => g.app)).toEqual(["alpha", "zeta", null]);
    expect(result[0]!.items.map((s) => s.feature)).toEqual(["a-feat"]);
    expect(result[1]!.items.map((s) => s.feature)).toEqual(["z-feat"]);
    expect(result[2]!.items.map((s) => s.feature)).toEqual(["no-app"]);
  });

  it("Postcondition: 全グループ items を連結すると入力数と一致（省略・重複なし）", () => {
    const items = [
      { app: "b", id: "1" },
      { app: null, id: "2" },
      { app: "a", id: "3" },
      { app: "b", id: "4" },
    ];
    const result = groupByApp(items);
    const flattened = result.flatMap((g) => g.items);
    expect(flattened).toHaveLength(items.length);
    expect(flattened).toEqual(expect.arrayContaining(items));
  });

  it("空入力では空配列を返す", () => {
    expect(groupByApp([])).toEqual([]);
  });
});

describe("summarizeSpecGroup", () => {
  it("specCount / readyCount / implementationCompleteCount を厳密に集計する", () => {
    const specs = [
      spec({ feature: "a", readyForImplementation: true, phase: "implementation-complete" }),
      spec({ feature: "b", readyForImplementation: true, phase: "tasks" }),
      spec({ feature: "c", readyForImplementation: false, phase: "implementation-complete" }),
      spec({ feature: "d", readyForImplementation: null, phase: "design" }),
      spec({ feature: "e", readyForImplementation: true, phase: "implementation-complete" }),
    ];

    expect(summarizeSpecGroup(specs)).toEqual({
      specCount: 5,
      readyCount: 3, // a, b, e
      implementationCompleteCount: 3, // a, c, e
    });
  });

  it("readyForImplementation が null/false は READY に数えない（厳密 === true）", () => {
    const specs = [
      spec({ feature: "x", readyForImplementation: false }),
      spec({ feature: "y", readyForImplementation: null }),
    ];
    expect(summarizeSpecGroup(specs)).toEqual({
      specCount: 2,
      readyCount: 0,
      implementationCompleteCount: 0,
    });
  });

  it("空入力では全件 0", () => {
    expect(summarizeSpecGroup([])).toEqual({
      specCount: 0,
      readyCount: 0,
      implementationCompleteCount: 0,
    });
  });
});

describe("groupSkillsByOrigin", () => {
  it("cc-sdd → custom → null の固定順 3 グループに分割し件数を返す（入力順保持）", () => {
    const skills = [
      skill("custom-a", "custom"),
      skill("std-a", "cc-sdd"),
      skill("unk-a", null),
      skill("std-b", "cc-sdd"),
      skill("custom-b", "custom"),
    ];

    const result = groupSkillsByOrigin(skills);

    const expected: OriginGroup[] = [
      {
        origin: "cc-sdd",
        skills: [skill("std-a", "cc-sdd"), skill("std-b", "cc-sdd")],
        count: 2,
      },
      {
        origin: "custom",
        skills: [skill("custom-a", "custom"), skill("custom-b", "custom")],
        count: 2,
      },
      {
        origin: null,
        skills: [skill("unk-a", null)],
        count: 1,
      },
    ];
    expect(result).toEqual(expected);
  });

  it("あるグループが空でも 3 グループ固定順で count:0, skills:[] を返す", () => {
    const skills = [skill("std-only", "cc-sdd")];

    const result = groupSkillsByOrigin(skills);

    expect(result).toEqual([
      { origin: "cc-sdd", skills: [skill("std-only", "cc-sdd")], count: 1 },
      { origin: "custom", skills: [], count: 0 },
      { origin: null, skills: [], count: 0 },
    ]);
  });

  it("空入力でも 3 グループ固定順を返す", () => {
    const result = groupSkillsByOrigin([]);
    expect(result.map((g) => g.origin)).toEqual(["cc-sdd", "custom", null]);
    expect(result.every((g) => g.count === 0 && g.skills.length === 0)).toBe(true);
  });

  it("cc-sdd/custom 以外の origin 文字列は未分類(null)グループへ（省略しない）", () => {
    const skills = [skill("weird", "something-else")];
    const result = groupSkillsByOrigin(skills);
    expect(result[2]).toEqual({
      origin: null,
      skills: [skill("weird", "something-else")],
      count: 1,
    });
  });

  it("Postcondition: 全グループ skills を連結すると入力数と一致（省略・重複なし）", () => {
    const skills = [
      skill("a", "cc-sdd"),
      skill("b", "custom"),
      skill("c", null),
      skill("d", "cc-sdd"),
    ];
    const result = groupSkillsByOrigin(skills);
    const flattened = result.flatMap((g) => g.skills);
    expect(flattened).toHaveLength(skills.length);
    expect(flattened).toEqual(expect.arrayContaining(skills));
    expect(result).toHaveLength(3);
  });
});

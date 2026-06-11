/**
 * GroupingModel — 所属アプリ（app）・由来分類（origin）によるグルーピングと
 * app セクションサマリー集計の唯一の導出点
 * （design.md「Model 層（純粋関数）」GroupingModel / Requirements 1.6, 1.7, 1.8, 6.4, 6.5, 7.4, 7.5）。
 *
 * 純粋関数のみ。HTTP・DOM・FS アクセスを持たない。
 * グルーピングは安定（入力順保持）かつ決定論的で、要素の省略・重複を起こさない。
 */
import type { SpecSummary } from "@contracts/spec";
import type { SkillSummary } from "@contracts/resources";

/** app 別グループ。null = 未分類（board）/ リポジトリ横断（ADR）。 */
export interface AppGroup<T extends { app: string | null }> {
  app: string | null;
  items: T[];
}

/** app セクションのサマリー集計結果。 */
export interface SpecAppGroupSummary {
  specCount: number;
  /** readyForImplementation === true の数 */
  readyCount: number;
  /** phase === "implementation-complete" の数 */
  implementationCompleteCount: number;
}

/** origin 別グループ。固定順 cc-sdd → custom → null。 */
export interface OriginGroup {
  origin: "cc-sdd" | "custom" | null;
  skills: SkillSummary[];
  count: number;
}

/**
 * `app: string | null` を持つ要素列を app 名昇順のグループ列に分割する。
 * `app === null` のグループは（null 要素が存在する場合のみ）末尾に置く。
 * 各グループ内の要素は入力順を保持する（安定）。
 */
export function groupByApp<T extends { app: string | null }>(
  items: T[],
): AppGroup<T>[] {
  const byApp = new Map<string, T[]>();
  const nullItems: T[] = [];

  for (const item of items) {
    if (item.app === null) {
      nullItems.push(item);
      continue;
    }
    const bucket = byApp.get(item.app);
    if (bucket) {
      bucket.push(item);
    } else {
      byApp.set(item.app, [item]);
    }
  }

  // app 名昇順（ASCII / 既定文字列比較。localeCompare ではなく `<` ベースの sort）。
  const sortedApps = Array.from(byApp.keys()).sort();
  const groups: AppGroup<T>[] = sortedApps.map((app) => ({
    app,
    items: byApp.get(app)!,
  }));

  // null グループは要素が存在する場合のみ末尾に追加する。
  if (nullItems.length > 0) {
    groups.push({ app: null, items: nullItems });
  }

  return groups;
}

/**
 * app セクションのサマリーを集計する。
 * specCount = 件数、readyCount = readyForImplementation === true の数、
 * implementationCompleteCount = phase === "implementation-complete" の数。
 */
export function summarizeSpecGroup(specs: SpecSummary[]): SpecAppGroupSummary {
  let readyCount = 0;
  let implementationCompleteCount = 0;

  for (const s of specs) {
    if (s.readyForImplementation === true) {
      readyCount += 1;
    }
    if (s.phase === "implementation-complete") {
      implementationCompleteCount += 1;
    }
  }

  return {
    specCount: specs.length,
    readyCount,
    implementationCompleteCount,
  };
}

/**
 * skills を origin で「cc-sdd → custom → null（未分類）」の固定順 3 グループに分割する。
 * 常に 3 グループを固定順で返す（空グループも省略しない）。
 * cc-sdd / custom 以外の origin（null を含む）は未分類グループへ振り分け、要素を省略しない。
 * 各グループ内の要素は入力順を保持する（安定）。
 */
export function groupSkillsByOrigin(skills: SkillSummary[]): OriginGroup[] {
  const ccSdd: SkillSummary[] = [];
  const custom: SkillSummary[] = [];
  const unclassified: SkillSummary[] = [];

  for (const skill of skills) {
    if (skill.origin === "cc-sdd") {
      ccSdd.push(skill);
    } else if (skill.origin === "custom") {
      custom.push(skill);
    } else {
      // origin === null、および防御的に cc-sdd / custom 以外の文字列も未分類へ。
      unclassified.push(skill);
    }
  }

  return [
    { origin: "cc-sdd", skills: ccSdd, count: ccSdd.length },
    { origin: "custom", skills: custom, count: custom.length },
    { origin: null, skills: unclassified, count: unclassified.length },
  ];
}

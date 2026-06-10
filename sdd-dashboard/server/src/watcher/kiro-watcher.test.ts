/**
 * KiroWatcher の実 FS 統合テスト — mkdtemp ツリー + 実 chokidar 監視。
 * 完了条件（tasks.md 6.1）:
 * - 一時ファイル（`.tmp-*`）・dotfile・非 md/json ではイベントが発行されない（8.3）
 * - spec ファイル変更で category=spec / feature 付きイベントが発行される（8.1）
 */
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillsDir, type RepoContext } from "../config.js";
import type { ChangeEvent } from "../types/events.js";
import { createEventBus } from "./event-bus.js";
import { startKiroWatcher, type KiroWatcher } from "./kiro-watcher.js";

/** 監視テストは実 FS イベント待ちを含むためテスト毎に余裕を持たせる */
const TEST_TIMEOUT = 15_000;

const tempDirs: string[] = [];
const watchers: KiroWatcher[] = [];

/** 一時リポジトリ（.kiro/ + .claude/skills/ 付き）を作り RepoContext を返す */
function makeRepo(): RepoContext {
  const repoRoot = mkdtempSync(join(tmpdir(), "sdd-core-watcher-"));
  tempDirs.push(repoRoot);
  const kiroDir = join(repoRoot, ".kiro");
  mkdirSync(join(kiroDir, "specs"), { recursive: true });
  mkdirSync(join(kiroDir, "steering"), { recursive: true });
  mkdirSync(join(kiroDir, "adr"), { recursive: true });
  const context: RepoContext = { repoRoot, kiroDir, port: 0 };
  mkdirSync(resolveSkillsDir(context), { recursive: true });
  return context;
}

/** 監視開始 + 受信イベントの収集バッファを返す */
async function startCollecting(
  context: RepoContext,
): Promise<{ events: ChangeEvent[]; watcher: KiroWatcher }> {
  const bus = createEventBus();
  const events: ChangeEvent[] = [];
  bus.subscribe((event) => events.push(event));
  const watcher = await startKiroWatcher(context, bus);
  watchers.push(watcher);
  return { events, watcher };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 条件成立までポーリングする（上限付き）。成立しなければそのまま返り、expect 側で落とす */
async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return;
    }
    await sleep(25);
  }
}

afterEach(async () => {
  while (watchers.length > 0) {
    await watchers.pop()?.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("startKiroWatcher", () => {
  it(
    "spec ファイルの作成で category=spec / feature 付きイベントが発行される（8.1）",
    async () => {
      const context = makeRepo();
      const specDir = join(context.kiroDir, "specs", "demo-feature");
      mkdirSync(specDir);
      const { events } = await startCollecting(context);

      writeFileSync(join(specDir, "requirements.md"), "# Requirements\n");

      await waitFor(() => events.length > 0);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "add",
        path: ".kiro/specs/demo-feature/requirements.md",
        category: "spec",
        feature: "demo-feature",
      });
      // at は ISO 8601
      expect(new Date(events[0]?.at ?? "").toISOString()).toBe(events[0]?.at);
    },
    TEST_TIMEOUT,
  );

  it(
    "一時ファイル・dotfile・非 md/json ではイベントが発行されない（8.3）",
    async () => {
      const context = makeRepo();
      const specDir = join(context.kiroDir, "specs", "demo");
      mkdirSync(specDir);
      const { events } = await startCollecting(context);

      // 除外対象（イベントが出てはいけない）
      writeFileSync(join(specDir, ".tmp-a1b2c3"), "atomic write temp");
      writeFileSync(join(specDir, ".hidden.md"), "dotfile");
      writeFileSync(join(specDir, "notes.txt"), "not md/json");
      // 番兵（これのイベントだけが届くはず）
      writeFileSync(join(specDir, "design.md"), "# Design\n");

      await waitFor(() => events.some((e) => e.path.endsWith("design.md")));
      // デバウンス flush 後のストラグラーがいないことを確認する猶予
      await sleep(300);

      expect(events.map((e) => e.path)).toEqual([".kiro/specs/demo/design.md"]);
    },
    TEST_TIMEOUT,
  );

  it(
    "steering / adr / スキルディレクトリの変更がカテゴリ分類される（8.1）",
    async () => {
      const context = makeRepo();
      const skillDir = join(resolveSkillsDir(context), "kiro-review");
      mkdirSync(skillDir);
      const { events } = await startCollecting(context);

      writeFileSync(join(context.kiroDir, "steering", "product.md"), "# Product\n");
      writeFileSync(join(context.kiroDir, "adr", "core-0001-sample.md"), "# ADR\n");
      writeFileSync(join(skillDir, "SKILL.md"), "# Skill\n");

      await waitFor(() => events.length >= 3);
      const byPath = new Map(events.map((e) => [e.path, e]));
      expect(byPath.get(".kiro/steering/product.md")).toMatchObject({
        category: "steering",
        feature: null,
      });
      expect(byPath.get(".kiro/adr/core-0001-sample.md")).toMatchObject({
        category: "adr",
        feature: null,
      });
      expect(byPath.get(".claude/skills/kiro-review/SKILL.md")).toMatchObject({
        category: "skill",
        feature: null,
      });
    },
    TEST_TIMEOUT,
  );

  it(
    "デバウンス窓内の同一パスへのバースト変更は 1 イベントに集約される（8.2）",
    async () => {
      const context = makeRepo();
      const specDir = join(context.kiroDir, "specs", "demo");
      mkdirSync(specDir);
      const { events } = await startCollecting(context);

      const target = join(specDir, "tasks.md");
      writeFileSync(target, "v1");
      writeFileSync(target, "v2");
      writeFileSync(target, "v3");

      await waitFor(() => events.length > 0);
      await sleep(300);

      expect(events.filter((e) => e.path === ".kiro/specs/demo/tasks.md")).toHaveLength(1);
    },
    TEST_TIMEOUT,
  );

  it(
    "監視対象ファイルの削除で type=unlink イベントが発行される（8.1）",
    async () => {
      const context = makeRepo();
      const target = join(context.kiroDir, "steering", "tech.md");
      writeFileSync(target, "# Tech\n");
      const { events } = await startCollecting(context);

      unlinkSync(target);

      await waitFor(() => events.length > 0);
      expect(events[0]).toMatchObject({
        type: "unlink",
        path: ".kiro/steering/tech.md",
        category: "steering",
        feature: null,
      });
    },
    TEST_TIMEOUT,
  );

  it(
    "close() 後はファイル変更してもイベントが発行されない",
    async () => {
      const context = makeRepo();
      const specDir = join(context.kiroDir, "specs", "demo");
      mkdirSync(specDir);
      const { events, watcher } = await startCollecting(context);

      await watcher.close();
      writeFileSync(join(specDir, "requirements.md"), "# after close\n");
      await sleep(400);

      expect(events).toHaveLength(0);
    },
    TEST_TIMEOUT,
  );
});

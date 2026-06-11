/**
 * review.spec — sdd-review-ui のメイン E2E（tasks.md 10.1 / design.md「Testing Strategy」
 * E2E Tests シナリオ 1・2）。実 sdd-core サーバー（webServer で temp フィクスチャコピーへ向けて
 * 起動）+ クライアント（vite dev）に対して実ブラウザで駆動する。
 *
 * シナリオ 1（メインレビューフロー / Requirements 1.1, 2.1, 3.1, 5.1, 5.2）:
 *   一覧表示（feature 名の厳密値）→ requirements 閲覧 → Req チップ → CounterpartPopover で
 *   design 対応先を選択 → design ビューへジャンプ + 対象ハイライト → マトリクスで uncovered 行の
 *   ハイライトを確認。
 *
 * シナリオ 2（ライブ更新 / Requirements 7.1, 7.2）:
 *   requirements 表示中に「旧 AC テキスト表示」を境界アサート（偽 pass 防止）してから、temp コピーの
 *   requirements.md をディスク上で書き換え → リロードなしで新 AC テキスト（厳密値）が表示され、
 *   document 選択（requirements）が維持されることを検証する。
 *
 * 厳密値アサート（testing-conventions）: feature 名・AC 文・ハイライトクラスはすべて厳密値で照合し、
 * toBeVisible のみの曖昧検証は行わない。
 */
import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HIGHLIGHT_CLASS } from "../client/src/navigation/anchors";
import { UNCOVERED_ROW_CLASS } from "../client/src/features/matrix/MatrixGrid";
import { TEMP_REPO_POINTER } from "./paths";

/** フィクスチャの厳密値（server/test/fixtures/repo/.kiro/specs から確認した実値）。 */
const FEATURES = ["fixture-broken", "fixture-legacy", "fixture-normal"] as const;
/** Requirement 1.1 の旧 AC 英文（fixture-normal requirements.md の厳密値）。 */
const OLD_AC_TEXT = "When a user submits a keyword, the system shall return matching articles.";
/** 書き換え後に表示されるべき新 AC 英文（ライブ更新で注入する厳密値）。 */
const NEW_AC_TEXT = "When a user submits a keyword, the system shall return ranked articles within 200ms.";
/** fixture-legacy の uncovered 行（trace 診断 design-uncovered + task-uncovered の要件 ID）。 */
const UNCOVERED_REQ_ID = "2.2";
/** fixture-legacy の covered 行（境界対比: ハイライトされない要件 ID）。 */
const COVERED_REQ_ID = "2.1";

/** globalSetup が書き出した temp フィクスチャコピーの requirements.md 絶対パスを得る。 */
async function tempRequirementsPath(): Promise<string> {
  const tempRepo = (await readFile(TEMP_REPO_POINTER, "utf8")).trim();
  return join(tempRepo, ".kiro", "specs", "fixture-normal", "requirements.md");
}

test.describe("sdd-review-ui E2E", () => {
  test("シナリオ1: 一覧 → requirements → Req チップで design ジャンプ → マトリクス uncovered 行", async ({
    page,
  }) => {
    // 一覧表示: フィクスチャの feature 名を厳密値で確認（1.1）。
    await page.goto("/specs");
    for (const feature of FEATURES) {
      await expect(page.getByTestId(`spec-row-${feature}`).getByTestId("spec-feature")).toHaveText(
        feature,
      );
    }

    // requirements 閲覧（2.1）: fixture-normal の requirements を開く。
    await page.goto("/specs/fixture-normal/requirements");
    const reqView = page.getByTestId("requirements-view");
    await expect(reqView).toContainText(OLD_AC_TEXT);

    // Req チップ（AC 1.1 の ID チップ）クリック → CounterpartPopover（3.1）。
    // RequirementsView は各 AC の ID チップを RefChip として描画する。AC 1.1 のチップを開く。
    const reqCard = page.locator('section[data-node-id="1"]');
    const acChip = reqCard.getByTestId("ref-chip").first();
    await expect(acChip).toHaveText("1.1");
    await acChip.click();

    // 対応先（design）を選択 → design ビューへジャンプ + 対象ハイライト（3.1）。
    const popover = page.getByTestId("counterpart-popover");
    await expect(popover).toBeVisible();
    const designItem = popover.locator('[data-counterpart-kind="design"]').first();
    await expect(designItem).toHaveText("SearchService");
    await designItem.click();

    // 着地: design ドキュメントへ遷移し、対象 design アンカーに一時ハイライトが付く。
    await expect(page).toHaveURL(/\/specs\/fixture-normal\/design#design-searchservice$/);
    const target = page.locator("#design-searchservice");
    await expect(target).toHaveAttribute("data-node-name", "SearchService");
    await expect(target).toHaveClass(new RegExp(`(^|\\s)${HIGHLIGHT_CLASS}(\\s|$)`));

    // マトリクス: uncovered 行のハイライトを確認（5.1, 5.2）。fixture-normal は全カバーのため、
    // 未カバー診断を持つ fixture-legacy のマトリクスで境界対比して検証する。
    await page.goto("/specs/fixture-legacy/matrix");
    await expect(page.getByTestId("matrix-grid")).toBeVisible();

    const uncoveredRow = page.getByTestId(`matrix-row-${UNCOVERED_REQ_ID}`);
    await expect(uncoveredRow).toHaveAttribute("data-uncovered", "true");
    await expect(uncoveredRow).toHaveClass(new RegExp(`(^|\\s)${UNCOVERED_ROW_CLASS}(\\s|$)`));

    // 境界対比（偽 pass 防止）: カバー済み行は uncovered ハイライトを持たない。
    const coveredRow = page.getByTestId(`matrix-row-${COVERED_REQ_ID}`);
    await expect(coveredRow).toHaveAttribute("data-uncovered", "false");
    await expect(coveredRow).not.toHaveClass(new RegExp(`(^|\\s)${UNCOVERED_ROW_CLASS}(\\s|$)`));
  });

  test("シナリオ2: ライブ更新 — ディスク書換 → リロードなしで新 AC 表示・document 選択維持", async ({
    page,
  }) => {
    const requirementsPath = await tempRequirementsPath();
    const original = await readFile(requirementsPath, "utf8");

    try {
      await page.goto("/specs/fixture-normal/requirements");
      const reqView = page.getByTestId("requirements-view");

      // 境界アサート（偽 pass 防止）: 書換前に旧 AC が表示され、新 AC はまだ無いことを確定させる。
      await expect(reqView).toContainText(OLD_AC_TEXT);
      await expect(reqView).not.toContainText(NEW_AC_TEXT);

      // ディスク上で requirements.md を書き換える（temp コピー）。sdd-core の chokidar が
      // 変更を検知し SSE change（category=spec, feature=fixture-normal）を配信 → クライアントが
      // ['spec', feature] / ['trace', feature] を invalidate → リロードなしで再描画される。
      const mutated = original.replace(OLD_AC_TEXT, NEW_AC_TEXT);
      expect(mutated).not.toBe(original); // 置換が成立したこと（厳密値で書き換わる前提）
      expect(mutated).toContain(NEW_AC_TEXT);
      await writeFile(requirementsPath, mutated, "utf8");

      // リロードせずに新 AC が現れることを待つ（SSE 駆動。固定 sleep ではなく expect の自動待機）。
      await expect(reqView).toContainText(NEW_AC_TEXT, { timeout: 20_000 });
      await expect(reqView).not.toContainText(OLD_AC_TEXT);

      // document 選択が維持される（7.2）: URL とヘッダが requirements のまま。
      await expect(page).toHaveURL(/\/specs\/fixture-normal\/requirements$/);
      await expect(page.getByTestId("spec-document-heading")).toHaveText("fixture-normal/requirements");
    } finally {
      // temp コピーを元へ戻す（同一プロセス内のテスト順序に依存しないため。temp 自体は teardown が削除）。
      await writeFile(requirementsPath, original, "utf8");
    }
  });
});

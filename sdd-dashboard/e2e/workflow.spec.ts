/**
 * workflow.spec — sdd-workflow-ui のメイン E2E（tasks.md 7.1 / design.md「Testing Strategy」
 * E2E Tests シナリオ 1・2）。実 sdd-core サーバー（webServer で temp フィクスチャコピーへ向けて
 * 起動）+ クライアント（vite dev）に対して実ブラウザで駆動する。
 *
 * シナリオ 1（承認 / Requirements 1.1, 1.4, 2.2, 2.4, 8.2）:
 *   beforeAll で temp リポジトリへ「生成済み・未承認の design フェーズ」を持つ承認可能スペック
 *   （fixture-approvable）を書き込む（コミット済みフィクスチャは汚さない）。ボード表示 → 全レーンと
 *   フェーズ状態の厳密値（data-state）を確認 → スペックリンクでレビュー画面へ遷移 → 承認操作を
 *   確認ダイアログ経由で実行 → ディスク上 spec.json の approvals.design.approved が true になった
 *   ことをファイル読取でアサート → ボードが承認済み表示（design step=approved）へ自動更新される
 *   ことをリロードなしで確認する。
 *
 * シナリオ 2（手戻り / Requirements 1.4, 3.2, 3.4, 3.5）:
 *   全承認済み fixture-normal に対し、実行前に変更前状態の境界アサート（偽 pass 防止）を行ってから
 *   requirements へ巻き戻し → 影響表示の内容（design / tasks の承認解除・実装準備解除）を確認して
 *   確定 → spec.json 上で後続フェーズのフラグクリアと ready=false をファイルでアサート →
 *   `/kiro-spec-requirements fixture-normal` の案内表示を確認する。
 *
 * 厳密値アサート（testing-conventions）: feature 名・フェーズ状態（data-state）・影響表示・コマンド
 * 文字列はすべて厳密値で照合し、toBeVisible のみの曖昧検証は行わない。pre-state 境界アサートを
 * 各ミューテーションの前に置く（偽 pass 防止）。
 *
 * 注意: workflow.spec はアルファベット順で最後に走る。承認は別スペック（fixture-approvable）に対して
 * 行い、手戻りは fixture-normal を破壊的に変更するため、承認 → 手戻りの順で並べる。fixture-normal の
 * 変更は他スイート（自分の 3 spec の存在のみ検証し承認フラグは見ない）に影響しない。
 */
import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TEMP_REPO_POINTER } from "./paths";

/** 承認シナリオ用に temp へ注入する承認可能スペックの feature 名。 */
const APPROVABLE = "fixture-approvable";
/** 手戻りシナリオ対象（コミット済み・全承認済み・ready=true のフィクスチャ）。 */
const ROLLBACK_TARGET = "fixture-normal";

/** spec.json の最小スキーマ（fixture-normal/spec.json と同形: snake_case キー）。 */
interface SpecJson {
  feature_name: string;
  app: string | null;
  phase: string;
  language: string;
  approvals: Record<"requirements" | "design" | "tasks", { generated: boolean; approved: boolean }>;
  ready_for_implementation: boolean;
  created_at: string;
  updated_at: string;
}

/** globalSetup（start-core-server）が書き出した temp フィクスチャコピーの絶対パス。 */
async function tempRepo(): Promise<string> {
  return (await readFile(TEMP_REPO_POINTER, "utf8")).trim();
}

/** temp リポジトリ内の <feature>/spec.json への絶対パス。 */
async function specJsonPath(feature: string): Promise<string> {
  return join(await tempRepo(), ".kiro", "specs", feature, "spec.json");
}

/** ディスク上の spec.json を読み取りパースする（ファイルアサートの単一経路）。 */
async function readSpecJson(feature: string): Promise<SpecJson> {
  const raw = await readFile(await specJsonPath(feature), "utf8");
  return JSON.parse(raw) as SpecJson;
}

test.describe("sdd-workflow-ui 承認・手戻りワークフロー E2E", () => {
  /**
   * 承認シナリオ用に「design が生成済み・未承認」（= approvablePhase が design を返す）スペックを
   * temp リポジトリへ注入する。requirements は承認済み（先行フェーズ条件を満たす）、tasks は未生成。
   * spec.json は fixture-normal と同形（snake_case・feature_name など）に厳密一致させる。
   */
  test.beforeAll(async () => {
    const specDir = join(await tempRepo(), ".kiro", "specs", APPROVABLE);
    await mkdir(specDir, { recursive: true });

    const spec: SpecJson = {
      feature_name: APPROVABLE,
      app: "demo-app",
      // derivePhase 規則（design.generated → "design-generated"）と整合させる。
      phase: "design-generated",
      language: "japanese",
      approvals: {
        requirements: { generated: true, approved: true },
        design: { generated: true, approved: false },
        tasks: { generated: false, approved: false },
      },
      ready_for_implementation: false,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-05T00:00:00Z",
    };
    await writeFile(join(specDir, "spec.json"), `${JSON.stringify(spec, null, 2)}\n`, "utf8");
    // レビュー画面（概要）が成果物の有無を表示できるよう最小ドキュメントを置く。
    await writeFile(
      join(specDir, "requirements.md"),
      "# Requirements\n\n承認シナリオ用フィクスチャ。\n",
      "utf8",
    );
    await writeFile(
      join(specDir, "design.md"),
      "# Design\n\n承認シナリオ用フィクスチャ。\n",
      "utf8",
    );
  });

  test("承認: ボード厳密値 → レビュー遷移 → design 承認 → spec.json 反映 → ボード自動更新（1.1, 1.4, 2.2, 2.4, 8.2）", async ({
    page,
  }) => {
    // --- ボード表示: 注入スペックが SSE/監視で現れるのを待つ（1.1）。 ---
    await page.goto("/board");

    const approvableLane = page.getByTestId(`spec-lane-${APPROVABLE}`);
    await expect(approvableLane).toBeVisible({ timeout: 20_000 });

    // フェーズ状態の厳密値（data-state）を確認（1.1）。requirements=承認済み, design=生成済み(未承認),
    // tasks=未生成, implementation=未生成（ready=false）。
    const designStep = page.getByTestId(`spec-step-${APPROVABLE}-design`);
    await expect(page.getByTestId(`spec-step-${APPROVABLE}-requirements`)).toHaveAttribute(
      "data-state",
      "approved",
    );
    await expect(designStep).toHaveAttribute("data-state", "generated");
    await expect(page.getByTestId(`spec-step-${APPROVABLE}-tasks`)).toHaveAttribute(
      "data-state",
      "not-generated",
    );
    await expect(page.getByTestId(`spec-step-${APPROVABLE}-implementation`)).toHaveAttribute(
      "data-state",
      "not-generated",
    );
    // 既存フィクスチャのレーンも共存して表示される（他スペックが落ちていないことの境界確認）。
    await expect(page.getByTestId(`spec-lane-${ROLLBACK_TARGET}`)).toBeVisible();

    // pre-state 境界アサート（偽 pass 防止）: 承認前のディスク状態を確定させる。
    const before = await readSpecJson(APPROVABLE);
    expect(before.approvals.design.approved).toBe(false);
    expect(before.approvals.requirements.approved).toBe(true);

    // --- スペックを選択してレビュー画面へ遷移（1.4）。 ---
    // xyflow の pane（react-flow__pane）がレーン上に重なりポインタイベントを奪うため、ポインタ
    // クリックではなくレーンリンクへフォーカスして Enter で活性化する（react-router の Link は
    // キーボード活性化でも SPA 遷移する。href=/specs/<feature> がナビゲーション意図を担保する）。
    const laneLink = page.getByTestId(`spec-lane-link-${APPROVABLE}`);
    await expect(laneLink).toHaveAttribute("href", `/specs/${APPROVABLE}`);
    await laneLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/specs/${APPROVABLE}$`));

    // 承認操作スロットに承認ボタンが現れる（approvablePhase=design）。
    const slot = page.getByTestId("spec-action-slot");
    const approveButton = slot.getByRole("button", { name: "承認" });
    await expect(approveButton).toBeVisible();

    // --- 確認ダイアログ経由で承認（2.2: 確認ステップで対象 feature/phase を提示）。 ---
    await approveButton.click();
    const dialog = page.getByRole("dialog", { name: `承認: ${APPROVABLE}` });
    await expect(dialog).toContainText(APPROVABLE);
    await expect(dialog).toContainText("design");
    await expect(dialog).toContainText("design.md");

    // 確定（2.4）。確定後、承認成功で useSpecs キャッシュが同期反映され approvablePhase=null
    // （design 承認済 + tasks 未生成）になるため、承認ボタンは消える（承認状態が UI に反映される）。
    // ※ design 承認後の NextActionGuide はこの直後に approvablePhase=null で unmount されるため
    //   E2E では観測対象にしない（次コマンド案内 = 3.5 は手戻りシナリオで厳密検証する）。
    await dialog.getByRole("button", { name: "承認する" }).click();
    await expect(approveButton).toHaveCount(0);

    // --- ディスク上 spec.json の反映をファイル読取でアサート（2.4）。 ---
    await expect
      .poll(async () => (await readSpecJson(APPROVABLE)).approvals.design.approved, {
        timeout: 10_000,
      })
      .toBe(true);
    const after = await readSpecJson(APPROVABLE);
    expect(after.approvals.design.approved).toBe(true);
    // 導出値も整合: tasks 未承認のため phase=tasks-generated でなく、ready は依然 false。
    expect(after.ready_for_implementation).toBe(false);

    // --- ボードへ戻り、design フェーズが承認済み表示へ自動更新されることを確認（8.2）。 ---
    // 承認 mutation の成功で useSpecs キャッシュは既に invalidate 済み。ボードへ遷移すると
    // 最新キャッシュ（または SSE 反映後）の承認済み状態が手動リロードなしで描画される。
    await page.goto("/board");
    await expect(page.getByTestId(`spec-step-${APPROVABLE}-design`)).toHaveAttribute(
      "data-state",
      "approved",
      { timeout: 20_000 },
    );
  });

  test("手戻り: pre-state 境界 → requirements 巻き戻し → 影響表示 → spec.json クリア → 次コマンド案内（1.4, 3.2, 3.4, 3.5）", async ({
    page,
  }) => {
    // --- pre-state 境界アサート（偽 pass 防止）: 巻き戻し前は全承認済み・ready=true。 ---
    const before = await readSpecJson(ROLLBACK_TARGET);
    expect(before.approvals.requirements.approved).toBe(true);
    expect(before.approvals.design.approved).toBe(true);
    expect(before.approvals.tasks.approved).toBe(true);
    expect(before.ready_for_implementation).toBe(true);

    // --- レビュー画面を開き、手戻り操作を起動（3.1）。 ---
    await page.goto(`/specs/${ROLLBACK_TARGET}`);
    const slot = page.getByTestId("spec-action-slot");
    const rollbackButton = slot.getByRole("button", { name: "手戻り" });
    await expect(rollbackButton).toBeVisible();
    await rollbackButton.click();

    const dialog = page.getByRole("dialog", { name: `手戻り: ${ROLLBACK_TARGET}` });
    await expect(dialog).toBeVisible();

    // 巻き戻し先 requirements を選択（初期選択は最も早い選択可能フェーズ=requirements だが明示する）。
    await dialog.getByRole("radio", { name: "requirements" }).check();

    // --- 影響表示の内容を確認（3.2）。target=requirements。 ---
    // 承認解除: requirements, design, tasks（全承認済みのため）。
    await expect(page.getByTestId("rollback-impact-revoked")).toContainText(
      "requirements, design, tasks",
    );
    // 再生成が必要（後続の生成済みフェーズ）: design, tasks。
    await expect(page.getByTestId("rollback-impact-cleared")).toContainText("design, tasks");
    // 実装準備解除（ready=true → false）。
    await expect(page.getByTestId("rollback-impact-ready")).toHaveText("実装準備解除");

    // --- 確定（3.4）。 ---
    await dialog.getByRole("button", { name: "巻き戻す" }).click();

    // --- 次コマンド案内の厳密値（3.5）: requirements 再生成コマンド。 ---
    await expect(page.getByTestId("next-command")).toHaveText(
      `/kiro-spec-requirements ${ROLLBACK_TARGET}`,
    );

    // --- spec.json 上で後続フェーズのフラグクリアと ready=false をファイルでアサート（3.4）。 ---
    await expect
      .poll(async () => (await readSpecJson(ROLLBACK_TARGET)).ready_for_implementation, {
        timeout: 10_000,
      })
      .toBe(false);
    const after = await readSpecJson(ROLLBACK_TARGET);
    // 巻き戻し先 requirements: approved のみ false（generated は維持）。
    expect(after.approvals.requirements.approved).toBe(false);
    // 後続 design / tasks: generated・approved の両フラグが false。
    expect(after.approvals.design.generated).toBe(false);
    expect(after.approvals.design.approved).toBe(false);
    expect(after.approvals.tasks.generated).toBe(false);
    expect(after.approvals.tasks.approved).toBe(false);
    expect(after.ready_for_implementation).toBe(false);
  });
});

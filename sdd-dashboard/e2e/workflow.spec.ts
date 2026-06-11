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
import { expect, test, type Request } from "@playwright/test";
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

/** ディスク上の spec.json を「生のバイト列（文字列）」で読む（byte-identical 比較用）。 */
async function readSpecJsonRaw(feature: string): Promise<string> {
  return readFile(await specJsonPath(feature), "utf8");
}

/** ローカル（自オリジン / loopback）と見なすホスト（readonly-local.spec と同じ分類）。 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/** 収集した 1 リクエストの要点（readonly-local.spec の classify と同形）。 */
interface RecordedRequest {
  readonly url: string;
  readonly host: string;
  readonly method: string;
  readonly isExternal: boolean;
  /** sdd-core サーバー（/api/*）宛か（同一オリジン経由の proxy も含む）。 */
  readonly isApi: boolean;
}

function classify(request: Request): RecordedRequest {
  const url = request.url();
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const isLocal = LOCAL_HOSTS.has(host);
  return {
    url,
    host,
    method: request.method().toUpperCase(),
    isExternal: !isLocal,
    isApi: parsed.pathname.startsWith("/api/"),
  };
}

/**
 * 承認 / 手戻り以外の書込が無いことを検証するための許可された非 GET エンドポイント集合（9.4）。
 * sdd-core の書込契約はこの 2 つのみ:
 *   - PUT /api/specs/:feature/approvals（承認更新）
 *   - POST /api/specs/:feature/rollback（フェーズ巻き戻し）
 * pathname がこのどちらかにマッチするかを判定する。
 */
const APPROVALS_PATH = /^\/api\/specs\/[^/]+\/approvals$/;
const ROLLBACK_PATH = /^\/api\/specs\/[^/]+\/rollback$/;

function isAllowedWriteEndpoint(req: RecordedRequest): boolean {
  const pathname = new URL(req.url).pathname;
  if (req.method === "PUT" && APPROVALS_PATH.test(pathname)) return true;
  if (req.method === "POST" && ROLLBACK_PATH.test(pathname)) return true;
  return false;
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

/**
 * 誤操作防止・ローカル完結・ナレッジ閲覧 E2E（tasks.md 7.2 / design.md「Testing Strategy → E2E Tests」
 * シナリオ 3・4 / Requirements 4.1, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 9.3, 9.4, 9.5）。
 *
 * 本スイートは破壊的変更を行わない（承認・手戻りを「確定」しない）。対象に選ぶフィクスチャ:
 *   - キャンセル検証は fixture-legacy（コミット済み・全承認済み・ready=true）に対して行う。
 *     fixture-normal は別シナリオ（手戻り）が破壊的に変更するため避ける。
 *
 * 厳密値アサート（testing-conventions）: フロー 8 ステップの厳密ラベル・steering リンク href・
 * skill EN/JA タブの厳密挙動（fixture-skill は ja あり = タブ切替）・ADR status バッジの厳密値
 * （0001-fixture-decision.md frontmatter: status=accepted, id=1, date=2026-06-04）を照合する。
 */
test.describe("sdd-workflow-ui 誤操作防止・ローカル完結・ナレッジ閲覧 E2E", () => {
  /** キャンセル検証対象（コミット済み・全承認済み・ready=true。手戻りボタンが出る）。 */
  const CANCEL_TARGET = "fixture-legacy";

  test("キャンセル → ディスク無変更: 手戻りダイアログをキャンセルしても spec.json は byte 同一（9.3）", async ({
    page,
  }) => {
    // --- pre-state 境界（偽 pass 防止）: 対象は全承認済み・ready=true（手戻り対象あり）。 ---
    const before = await readSpecJson(CANCEL_TARGET);
    expect(before.approvals.requirements.approved).toBe(true);
    expect(before.approvals.design.approved).toBe(true);
    expect(before.approvals.tasks.approved).toBe(true);
    expect(before.ready_for_implementation).toBe(true);

    // ディスク上の「生バイト列」を確定（キャンセル後にこれと一致することを検証する）。
    const rawBefore = await readSpecJsonRaw(CANCEL_TARGET);

    // --- レビュー画面を開き、手戻りダイアログを起動（書込は確定ボタン経由のみ・9.3）。 ---
    await page.goto(`/specs/${CANCEL_TARGET}`);
    const slot = page.getByTestId("spec-action-slot");
    const rollbackButton = slot.getByRole("button", { name: "手戻り" });
    await expect(rollbackButton).toBeVisible();
    await rollbackButton.click();

    const dialog = page.getByRole("dialog", { name: `手戻り: ${CANCEL_TARGET}` });
    await expect(dialog).toBeVisible();
    // 影響表示が出ている（ダイアログが完全に開いた状態を確定してからキャンセルする）。
    await expect(page.getByTestId("rollback-impact-revoked")).toBeVisible();

    // --- キャンセル（確定しない）。承認/巻き戻しリクエストは一切発行されない（9.3）。 ---
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(dialog).toHaveCount(0);

    // --- ディスク上 spec.json が byte 同一であることをアサート（書込ゼロの構造的証跡）。 ---
    const rawAfter = await readSpecJsonRaw(CANCEL_TARGET);
    expect(rawAfter).toBe(rawBefore);
    // 念のためパース後の主要フラグも変化していない（二重の証跡）。
    const after = await readSpecJson(CANCEL_TARGET);
    expect(after.approvals.tasks.approved).toBe(true);
    expect(after.ready_for_implementation).toBe(true);
  });

  test("ローカル完結・書込サーフェス: 横断中の全リクエストが GET・全件ローカル・非 GET ゼロ（9.4, 9.5）", async ({
    page,
  }) => {
    const requests: RecordedRequest[] = [];
    page.on("request", (request) => {
      requests.push(classify(request));
    });

    // --- 走査: ボード → レビュー画面 → 手戻りダイアログ開閉（キャンセル）→ ナレッジ → ヘルプ。 ---
    await page.goto("/board");
    await expect(page.getByTestId(`spec-lane-${CANCEL_TARGET}`)).toBeVisible({ timeout: 20_000 });

    await page.goto(`/specs/${CANCEL_TARGET}`);
    const slot = page.getByTestId("spec-action-slot");
    const rollbackButton = slot.getByRole("button", { name: "手戻り" });
    await expect(rollbackButton).toBeVisible();
    await rollbackButton.click();
    const dialog = page.getByRole("dialog", { name: `手戻り: ${CANCEL_TARGET}` });
    await expect(dialog).toBeVisible();
    // キャンセル（確定しない → 非 GET を一切発生させない）。
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(dialog).toHaveCount(0);

    // ナレッジ + ヘルプを横断（GET のみのはず）。
    await page.goto("/steering");
    await expect(page.getByTestId("steering-list")).toBeVisible();
    await page.goto("/skills");
    await expect(page.getByTestId("workflow-skill-list-page")).toBeVisible();
    await page.goto("/adr");
    await expect(page.getByTestId("workflow-adr-list-page")).toBeVisible();
    await page.goto("/help");
    await expect(page.getByTestId("help-flow-steps")).toBeVisible();

    // --- 偽 pass 防止 (1): ログが空でない（走査が空振りしていない）。 ---
    expect(requests.length).toBeGreaterThan(0);

    // --- 偽 pass 防止 (2): GET /api/specs を実際に観測した（一覧取得が起きた証跡）。 ---
    const sawApiGet = requests.some(
      (r) => r.method === "GET" && new URL(r.url).pathname === "/api/specs",
    );
    expect(sawApiGet, "GET /api/specs を観測できていない（収集が空振り）").toBe(true);

    // --- (9.5) 外部オリジンへのリクエストは 0 件。 ---
    const external = requests.filter((r) => r.isExternal);
    expect(
      external,
      `外部オリジンへのリクエストを検出: ${external.map((r) => r.url).join(", ")}`,
    ).toEqual([]);

    // --- (9.4) サーバー（/api/*）への非 GET は承認/巻き戻しの 2 エンドポイント以外 0 件。 ---
    // 本テストは「キャンセルのみ・確定しない」ため、許可外の非 GET があれば即 fail する。
    const disallowedWrites = requests.filter(
      (r) => r.isApi && r.method !== "GET" && !isAllowedWriteEndpoint(r),
    );
    expect(
      disallowedWrites,
      `承認/巻き戻し以外の書込を検出: ${disallowedWrites
        .map((r) => `${r.method} ${r.url}`)
        .join(", ")}`,
    ).toEqual([]);

    // 本テストは確定しないので、許可された承認/巻き戻しの非 GET すら 0 件（キャンセルは無書込・9.3）。
    const apiNonGet = requests.filter((r) => r.isApi && r.method !== "GET");
    expect(
      apiNonGet,
      `キャンセルのみのはずが非 GET を検出: ${apiNonGet
        .map((r) => `${r.method} ${r.url}`)
        .join(", ")}`,
    ).toEqual([]);

    // --- すべてのリクエストがローカルホスト宛（ローカル完結の積極証跡・9.5）。 ---
    for (const r of requests) {
      expect(LOCAL_HOSTS.has(r.host), `想定外ホスト: ${r.host} (${r.url})`).toBe(true);
    }
  });

  test("ナレッジ + ヘルプ一連走査: help 8 ステップ → steering → skills EN/JA → adr バッジ（4.1, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2）", async ({
    page,
  }) => {
    // --- /help: cc-sdd フロー 8 ステップが定義順に厳密ラベルで描画される（4.1）。 ---
    await page.goto("/help");
    const steps = page.getByTestId("help-flow-step");
    await expect(steps).toHaveCount(8);
    await expect(steps).toHaveText([
      "Discovery",
      "Requirements",
      "承認",
      "Design",
      "承認",
      "Tasks",
      "承認",
      "実装",
    ]);

    // --- /steering: 一覧に product/tech が並ぶ（5.1）→ product を開き本文見出しを確認（5.2）。 ---
    await page.goto("/steering");
    const steeringList = page.getByTestId("steering-list");
    await expect(steeringList).toBeVisible();
    // href 厳密値で 2 件（product/tech）の存在を確認（リンクテキストは title=先頭見出し）。
    await expect(
      steeringList.getByRole("link", { name: "Product Overview" }),
    ).toHaveAttribute("href", "/steering/product");
    await expect(steeringList.getByRole("link", { name: "Technology Stack" })).toHaveAttribute(
      "href",
      "/steering/tech",
    );

    await steeringList.getByRole("link", { name: "Product Overview" }).click();
    await expect(page).toHaveURL(/\/steering\/product$/);
    const steeringDoc = page.getByTestId("steering-doc-page");
    await expect(steeringDoc).toBeVisible();
    // 本文（MarkdownDoc）に元文書の見出しが描画される（無欠落の証跡・5.2）。
    await expect(steeringDoc.getByRole("heading", { name: "Product Overview" })).toBeVisible();
    await expect(steeringDoc.getByRole("heading", { name: "Core Value" })).toBeVisible();

    // --- /skills: origin グループ + fixture-skill（6.1）→ EN/JA タブ切替（6.2）。 ---
    await page.goto("/skills");
    await expect(page.getByTestId("workflow-skill-list-page")).toBeVisible();
    // fixture-skill は origin=custom かつ en/ja 両方あり（フィクスチャ既知値）。
    const skillItem = page.getByTestId("skill-item-fixture-skill");
    await expect(skillItem).toBeVisible();
    await expect(skillItem.getByTestId("skill-badge-en")).toHaveText("EN");
    await expect(skillItem.getByTestId("skill-badge-ja")).toHaveText("JA");
    await skillItem.getByTestId("skill-list-item").click();
    await expect(page).toHaveURL(/\/skills\/fixture-skill/);

    const skillBody = page.getByTestId("skill-doc-body");
    // 既定は EN タブ: 英語正本の本文が描画される。
    const enTab = page.getByRole("tab", { name: "EN" });
    const jaTab = page.getByRole("tab", { name: "JA" });
    await expect(enTab).toHaveAttribute("aria-selected", "true");
    await expect(jaTab).toBeEnabled(); // ja あり = JA タブは有効。
    await expect(skillBody).toContainText("英語正本の本文");
    // JA タブへ切替: 日本語版の本文へ切り替わる（6.2）。
    await jaTab.click();
    await expect(jaTab).toHaveAttribute("aria-selected", "true");
    await expect(skillBody).toContainText("日本語版の本文");
    // ja あり時は「日本語版は未作成」の不在表示が出ないこと（偽 pass 防止）。
    await expect(page.getByTestId("skill-ja-missing")).toHaveCount(0);

    // --- /adr: status バッジ付き一覧（7.1）→ 本文セクション描画（7.2）。 ---
    await page.goto("/adr");
    await expect(page.getByTestId("workflow-adr-list-page")).toBeVisible();
    const adrItem = page.getByTestId("adr-item-0001-fixture-decision");
    await expect(adrItem).toBeVisible();
    // 厳密値: id=1, title, status バッジ=accepted, date=2026-06-04（frontmatter 由来）。
    await expect(adrItem.getByTestId("adr-item-id")).toHaveText("1");
    await expect(adrItem.getByTestId("adr-item-title")).toHaveText("フィクスチャ構成を採用する");
    const listBadge = adrItem.getByTestId("adr-status-badge");
    await expect(listBadge).toHaveText("accepted");
    await expect(listBadge).toHaveAttribute("data-status", "accepted");
    await expect(adrItem.getByTestId("adr-item-date")).toHaveText("2026-06-04");

    await adrItem.getByTestId("adr-list-item").click();
    await expect(page).toHaveURL(/\/adr\/0001-fixture-decision$/);
    const adrDetail = page.getByTestId("adr-detail-page");
    await expect(adrDetail).toBeVisible();
    // 詳細ヘッダの status バッジも accepted（7.1）。
    await expect(adrDetail.getByTestId("adr-status-badge")).toHaveText("accepted");
    // 本文セクション（Context / Decision / Consequences）が散文描画される（7.2）。
    const adrBody = page.getByTestId("adr-detail-body");
    await expect(adrBody.getByRole("heading", { name: "Context" })).toBeVisible();
    await expect(adrBody.getByRole("heading", { name: "Decision" })).toBeVisible();
    await expect(adrBody.getByRole("heading", { name: "Consequences" })).toBeVisible();
  });
});

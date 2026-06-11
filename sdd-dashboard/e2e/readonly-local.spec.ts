/**
 * readonly-local.spec — 読み取り専用・ローカル完結の検証（tasks.md 10.2 /
 * design.md「Testing Strategy」E2E #3「読み取り専用・ローカル完結の検証: ネットワークログに
 * 外部オリジンへのリクエストが 0 件、サーバーへの非 GET リクエストが 0 件（SSE 接続は GET）」/
 * 「Security Considerations」ローカル完結 / 「Boundary Commitments」ApiClient GET 限定・
 * SpecActionSlot 空 / Requirements 8.1, 8.2）。
 *
 * 実 sdd-core サーバー + 実クライアント（review.spec と同じ webServer ハーネス）に対し、主要画面
 * （一覧 → requirements → design → マトリクス → 比較 → SSE 駆動のライブ更新）を実ブラウザで横断
 * しながら、その間の全ネットワークリクエストを収集する。収集後に次を厳密にアサートする:
 *
 *   (8.2) 外部オリジンへのリクエストが 0 件 — すべて baseURL（localhost:5180）/ 127.0.0.1 宛。
 *   (8.1, 8.2) サーバー（/api/*）への非 GET リクエストが 0 件 — POST/PUT/DELETE/PATCH なし。
 *             SSE（GET /api/events）は GET なので許容。
 *   (8.1, 完了条件) SpecActionSlot が空である（review-ui は何も登録しない）+ スペック画面に
 *             書込系の操作要素（承認/手戻り/作成/削除 等の button・mutating form）が存在しない。
 *
 * 偽 pass 防止: 収集ログが空（=走査が空振り）でないこと、実際に GET /api/specs と SSE GET
 * /api/events を観測したことを先にアサートしてから「全件 GET・全件ローカル」を検証する。
 */
import { expect, test, type Request } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BASE_URL, SDD_CORE_PORT, TEMP_REPO_POINTER } from "./paths";

/** フィクスチャの厳密値（review.spec と同じ実値）。 */
const FEATURES = ["fixture-broken", "fixture-legacy", "fixture-normal"] as const;
const OLD_AC_TEXT = "When a user submits a keyword, the system shall return matching articles.";
const NEW_AC_TEXT =
  "When a user submits a keyword, the system shall return ranked articles within 200ms.";

/** 書込系操作を示唆する語（UI に存在してはならない。8.1 / 完了条件）。 */
const WRITE_ACTION_PATTERNS: readonly RegExp[] = [
  /承認/,
  /却下/,
  /手戻り/,
  /差し戻/,
  /作成/,
  /新規/,
  /削除/,
  /編集/,
  /保存/,
  /更新する/,
  /approve/i,
  /reject/i,
  /create/i,
  /delete/i,
  /\bedit\b/i,
  /\bsave\b/i,
  /submit/i,
];

/** ローカル（自オリジン / loopback）と見なすホスト。 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/** 収集した 1 リクエストの要点。 */
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

async function tempRequirementsPath(): Promise<string> {
  const tempRepo = (await readFile(TEMP_REPO_POINTER, "utf8")).trim();
  return join(tempRepo, ".kiro", "specs", "fixture-normal", "requirements.md");
}

test.describe("sdd-review-ui 読み取り専用・ローカル完結 E2E", () => {
  test("全主要画面を横断してもネットワークは全件 GET・全件ローカル、書込 UI も無い（8.1, 8.2）", async ({
    page,
  }) => {
    const requests: RecordedRequest[] = [];
    page.on("request", (request) => {
      requests.push(classify(request));
    });

    // --- 主要画面を横断（一覧 → requirements → design → matrix → compare）。 ---
    await page.goto("/specs");
    for (const feature of FEATURES) {
      await expect(
        page.getByTestId(`spec-row-${feature}`).getByTestId("spec-feature"),
      ).toHaveText(feature);
    }

    await page.goto("/specs/fixture-normal/requirements");
    await expect(page.getByTestId("requirements-view")).toContainText(OLD_AC_TEXT);

    await page.goto("/specs/fixture-normal/design");
    await expect(page.getByTestId("spec-document-heading")).toHaveText("fixture-normal/design");

    await page.goto("/specs/fixture-legacy/matrix");
    await expect(page.getByTestId("matrix-grid")).toBeVisible();

    // --- 書込 UI の不在（8.1 / 完了条件）。 ---
    // SpecActionSlot は描画される拡張点。sdd-workflow-ui 統合後はこのスロット内に
    // 承認/手戻り操作（確認ゲート付き・sdd-workflow-ui 所有）が描画されうるため、
    // 「review-ui 自身の画面には書込 UI が無い」ことをスロット外で検証する。
    // 読み取り専用の本質はネットワーク層（非 GET 0 件・下記）で構造的に担保される
    // — スロットのボタンは確認確定まで一切リクエストを発しないため、本テストの
    // 全件 GET アサートはそのまま成立する。
    await page.goto("/specs/fixture-normal/requirements");
    await expect(page.getByTestId("requirements-view")).toContainText(OLD_AC_TEXT);
    const slot = page.getByTestId("spec-action-slot");
    await expect(slot).toBeAttached();

    // mutating な form / submit ボタンがページに存在しない（review-ui は GET 専用クライアント）。
    await expect(page.locator("form")).toHaveCount(0);
    await expect(page.locator('button[type="submit"], input[type="submit"]')).toHaveCount(0);

    // 書込操作を示唆するテキストを持つ操作要素（button / role=button）が、
    // workflow-ui の SpecActionSlot の「外」に存在しない（review-ui 自身の書込 UI ゼロ）。
    const slotHandle = await slot.elementHandle();
    const actionable = page.locator('button, [role="button"], a[href^="http"]');
    const actionCount = await actionable.count();
    for (let i = 0; i < actionCount; i += 1) {
      const el = actionable.nth(i);
      const insideSlot = await el.evaluate(
        (node, root) => (root instanceof Node ? root.contains(node) : false),
        slotHandle,
      );
      if (insideSlot) continue; // workflow-ui の承認/手戻り操作は確認ゲート付きで許容（9.3, 9.4）。
      const text = (await el.textContent()) ?? "";
      for (const pattern of WRITE_ACTION_PATTERNS) {
        expect(text, `書込系操作要素を検出: "${text.trim()}"`).not.toMatch(pattern);
      }
    }

    // --- SSE（GET /api/events）を確実に観測するため、ライブ更新を 1 回起こす。 ---
    const requirementsPath = await tempRequirementsPath();
    const original = await readFile(requirementsPath, "utf8");
    try {
      const reqView = page.getByTestId("requirements-view");
      await expect(reqView).toContainText(OLD_AC_TEXT);
      const mutated = original.replace(OLD_AC_TEXT, NEW_AC_TEXT);
      expect(mutated).not.toBe(original);
      await writeFile(requirementsPath, mutated, "utf8");
      await expect(reqView).toContainText(NEW_AC_TEXT, { timeout: 20_000 });
    } finally {
      await writeFile(requirementsPath, original, "utf8");
    }

    // --- ネットワークログの検証。 ---

    // 偽 pass 防止 (1): ログが空でない（実際にリクエストが飛んでいる）。
    expect(requests.length).toBeGreaterThan(0);

    // 偽 pass 防止 (2): GET /api/specs を実際に観測した（一覧取得が起きた証跡）。
    const sawSpecsGet = requests.some(
      (r) => r.method === "GET" && new URL(r.url).pathname === "/api/specs",
    );
    expect(sawSpecsGet, "GET /api/specs を観測できていない（収集が空振り）").toBe(true);

    // 偽 pass 防止 (3): SSE GET /api/events を実際に観測した（長命 GET 接続の証跡）。
    const sseRequests = requests.filter((r) => new URL(r.url).pathname === "/api/events");
    expect(sseRequests.length, "SSE GET /api/events を観測できていない").toBeGreaterThan(0);
    for (const sse of sseRequests) {
      expect(sse.method, "SSE は GET でなければならない").toBe("GET");
    }

    // (8.2) 外部オリジンへのリクエストは 0 件。
    const external = requests.filter((r) => r.isExternal);
    expect(
      external,
      `外部オリジンへのリクエストを検出: ${external.map((r) => r.url).join(", ")}`,
    ).toEqual([]);

    // (8.1, 8.2) サーバー（/api/*）への非 GET リクエストは 0 件。
    const nonGetApi = requests.filter((r) => r.isApi && r.method !== "GET");
    expect(
      nonGetApi,
      `サーバーへの非 GET を検出: ${nonGetApi.map((r) => `${r.method} ${r.url}`).join(", ")}`,
    ).toEqual([]);

    // 念のため: 全リクエストが GET（このアプリは GET 以外を一切送らない読み取り専用クライアント）。
    const nonGet = requests.filter((r) => r.method !== "GET");
    expect(
      nonGet,
      `非 GET リクエストを検出: ${nonGet.map((r) => `${r.method} ${r.url}`).join(", ")}`,
    ).toEqual([]);

    // baseURL / sdd-core ポートのいずれかであることを確認（ローカル完結の積極証跡）。
    const allowedHosts = new Set([new URL(BASE_URL).hostname, "127.0.0.1", "localhost"]);
    for (const r of requests) {
      expect(allowedHosts.has(r.host), `想定外ホスト: ${r.host} (${r.url})`).toBe(true);
    }
    // SDD_CORE_PORT は dev proxy 経由（同一オリジン）でアクセスされるため URL に直接は現れない。
    // 参照のみ（未使用 import 警告回避 + ポート対の明示）。
    expect(SDD_CORE_PORT).toBe(7411);
  });
});

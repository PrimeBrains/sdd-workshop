---
type: impl
feature: sdd-core
date: 2026-06-11
decision: GO
---

# Validation Report: sdd-core（実装統合検証）

全 27 タスク完了後のフィーチャーレベル統合検証。各タスクは独立レビュー済みのため、本検証はタスク横断でのみ見える問題（契約の継ぎ目・カバレッジ・設計乖離・境界逸脱）に焦点を当てた。

## DECISION: GO

## MECHANICAL_RESULTS

- **Tests: PASS** — `npm test -- --run` で 33 ファイル / 345 テスト全 pass（exit 0、期待値 345/33 と一致）。`npx tsc --noEmit` も exit 0
- **TBD/TODO grep: CLEAN** — `src/` に TBD / TODO / FIXME / HACK / XXX マーカーなし
- **Secrets grep: CLEAN** — ハードコードされた秘密情報なし
- **Smoke boot: PASS** — `npm start -- /home/pbnakao/ghq/sdd-workshop --port 17988` で起動し全プローブ成功:
  - `GET /api/repo` → `{repoRoot, name}` 正常
  - `GET /api/specs` → 8 件（app グルーピング: evm-studio 5 / sdd-dashboard 3、app 値正常）
  - `GET /api/specs/sdd-core` → requirements 13 件 / AC 65 件（厳密一致）
  - `GET /api/specs/sdd-core/trace` → diagnostics 0 件。nodes: requirements 65 / designElements 47 / tasks 36、edges 328
  - `GET /api/steering` → 9 件、`GET /api/skills` → 22 件（origin: cc-sdd / custom 両方解決）、`GET /api/adr` → 1 件（frontmatter 9 キー + app 解析済み）
  - `GET /api/events` → SSE 接続が開き、実ファイル変更で `event: change` + 正しい `{type, path, category, feature, at}` フレームを 2 秒以内に受信
  - SIGTERM → クリーン終了（exit 0）
  - 注: 初回スモークは検証側の 30 秒 timeout 窓がプローブ完了前に切れたもの（exit 124 = timeout の SIGTERM）。120 秒窓で再実行し全項目成功。実装の不具合ではない

## INTEGRATION（タスク横断契約の継ぎ目）

検査した 4 継ぎ目すべて整合:

1. **parseSpecJson → SpecService.buildSummary**: `{meta, diagnostics}` の透過合成。`app: string | null` を含む全フィールドが SpecSummary 契約どおりにマップ（spec-service.ts:51-66）
2. **trace ルート → buildTraceGraph**: specs.ts の `loadTrace` が `TraceGraphOptions.resolveRequirements?: (feature: string) => RequirementsDoc | null` の同期リゾルバ契約に対し、クロス spec 参照先を事前ロードした Map で正確に適合（specs.ts:65-77 / trace-graph.ts:37-39）
3. **writers の AppError コード → エラーミドルウェア**: 各 writer が throw するコード（SPEC_NOT_FOUND / VALIDATION_FAILED / APPROVAL_NOT_GENERATED / APPROVAL_ORDER_VIOLATION / ADR_NUMBER_CONFLICT / WRITE_PATH_FORBIDDEN）はすべて errors/codes.ts の語彙内。app.ts の onError が `ERROR_HTTP_STATUS` 表のみを参照して変換し、`details.fieldErrors → error.fieldErrors`（11.4）と未知例外 → 500 INTERNAL_ERROR（13.4）を実装。8.2→8.3 申し送りどおり
4. **readValidations seam**: 4.1/4.3/8.1 の申し送りどおり app.ts:65-68 で `validationService.listForSpec` が本配線済み

## COVERAGE（要件カバレッジ）

**65/65 AC マップ済み、ギャップなし**。tasks.md の全 `_Requirements:_` 注記から抽出した参照 ID 集合（65 個）が、requirements.md の AC 母集合（Req1:5, 2:5, 3:4, 4:4, 5:4, 6:7, 7:7, 8:6, 9:5, 10:4, 11:6, 12:4, 13:4 = 65）と厳密一致。どのタスクにも現れない AC は 0、存在しない ID への参照も 0。

## DESIGN（設計整合）

- **File Structure Plan**: 実ツリーと 1:1 一致（src 配下 33 実装/テストファイル）。欠落なし。追加はコロケーションの `*.test.ts`（index.test.ts / config.test.ts 等）のみで計画記載の方針どおり
- **依存方向**: 違反 0。parsers は types + 兄弟 parser のみ import、services に api/watcher/entry への import なし、watcher は config/types/兄弟のみ。4.2→6.1 申し送りの `resolveSkillsDir` は advisory どおり config.ts へ移設済み（kiro-watcher.ts:16 が config から import）
- **API 契約表**: 14 エンドポイントすべてマウント済み（specs 3 + resources 7〔repo/steering×2/skills×2/adr×2〕+ writes 3 + events 1）。`GET /api/adr/:id` は申し送りどおり拡張子なしファイル名
- **ErrorCode 語彙**: design のエラー表 9 コードと codes.ts が 1:1。HTTP マッピングも表の右列と一致

## BOUNDARY（境界監査）

- **吸収逸脱なし**: UI 関心・スペック生成/再生成・表記法定義の所有・`.kiro/` 外書込・DB のいずれも実装に存在しない。dependencies は design の許可リストどおり（hono / @hono/node-server / remark 系 / unified / chokidar 4 / yaml / zod。DB 系なし）
- **下流契約ドリフトなし**: sdd-review-ui design.md の `@contracts` import 期待（`SpecSummary` / `SpecDetail` from spec、`TraceGraph` from trace、`RepoInfo` from api、`ApiError` / `ChangeEvent` / `TraceDiagnostic` / `NodeRef`）はすべて同名・同形で `src/types/` に存在。NodeRef の判別子（`type: "requirement" | "design" | "task"`）、TraceEdge の `from/to/source/legacyExpanded`、TraceDiagnostic の 4 kind、ApiError の `{error: {code, message, fieldErrors?}}` は design.md 正典と完全一致
- **Revalidation Triggers**: 発火する契約変更なし（型形状・URL・SSE スキーマ・ErrorCode 語彙・リクエスト時パース方式すべて design どおり）。下流再検証は不要

## OWNERSHIP: LOCAL

（指摘事項なし。既知の注記はすべて本スペック内で文書化済み）

## BLOCKED_TASKS: なし

`_Blocked:_` マーカー 0 件。27/27 タスク完了・全実装コミット済み（HEAD 25efacc、working tree clean）。

## Implementation Notes の評価（未解決横断課題の有無）

- **EVM 3 スペックの spec.json phase 不整合**（approvals 全 true なのに phase=tasks-generated）: 既知・文書化済み・by-design。読取は as-is 透過（スモークで確認: tasks-generated のまま返る）、書込時のみ derivePhase が「フラグが真実」原則で正規化。問題なし
- **vite ^7 固定**（ローカル Node 21.7.3 対応）: 既知・文書化済み。Node 22 更新時に解除可。devDependency のみでランタイム契約に影響なし
- **yaml パッケージが ISC ライセンス**（design の「すべて MIT」と厳密には不一致): OSI 承認・実質同等として文書化済み。advisory（必要なら design.md の一文を「すべて OSI 承認」へ修正する軽微な手直し候補）
- **ADR title/slug に zod .max() なし**（長大入力は 500 で安全側）: 文書化済みの将来改善候補。422 化は任意

## REMEDIATION: 不要（GO）

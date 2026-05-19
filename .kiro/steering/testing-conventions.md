# Testing Conventions

defect-pdca から抽出された **テスト戦略の learning 集約ファイル**。新しいテスト関連の Try が出たらこのファイルに H2 セクションで append する (1 トピック 1 ファイルではなく、テスト戦略カテゴリで束ねる)。

---

## 「自明」と判断したら疑う (assumption-error 対策)

「自明な変換」「ROI が低いから省略」と判断した箇所こそ暗黙仮定が積まれている。

### Rule

1. **単位を持つ数値の変換関数** (人日 / 時間 / 比率 / バイト等) は最低 1 ケースの boundary 値テスト必須 (例: `fmtMD(70) === "70.0 MD"`)
2. **設計書・PR の「自明 / 不要 / 変わらない」記述を見たら反例を 1 つ挙げる**
3. **要件文書に数式・magic number を埋め込まない** (実装詳細は design 以下)

### Evidence

`.kiro/postmortem/defects.md` #0001 — `fmtMD` の `1_000_000` スケール混入で表示全数 0.0 MD、user-report で初発覚。要件 4.7 に `(n / 1_000_000)` を埋め込んだことが仕様レビュー素通りの原因。

---

## データフロー結合テストを書く (integration-test-coverage)

「複数プロセス × 複数ファイル × データフロー」を跨ぐ結合は単体テストの `:memory:` パターンで隠蔽されやすい。検証層を **「ファイル単位」ではなく「データフロー単位」** で考える。

### Rule

1. **`:memory:` パターンの罠を意識**: SQLite を `new Database(':memory:')` でテストすると、seed と runtime を同一プロセスに閉じ込めてしまう
2. **CLI とサーバを跨ぐデータフロー結合テストを書く**: `seed CLI → server runtime → API レスポンス` のフロー全体を 1 つの自動テストで担保
3. **e2e を整合性検証の代替にしない**: integration-test 層で先に潰せる問題は integration で潰す

### Evidence

`.kiro/postmortem/defects.md` #0002 — server 側テストはすべて `:memory:` DB の単体寄り構成。seed → runtime の DB 整合を検証する結合テストが存在せず、e2e で `Project not found: id=1` として初発覚。

---

## 偽 pass を防ぐ (preventing-false-pass)

「テキストが存在する」「要素が見える」レベルの緩いアサートは、データが描画されていない世界でも pass する。

### Rule

1. **厳密値アサート**: `toBe(expectedValue)` / `toContainText(specificText)` で具体値を突き合わせる。`toBeVisible()` だけは「データ空でも pass する」と疑う
2. **動的期待値**: 期待値を **API レスポンス / seed データから取得して** UI と突き合わせる (`expect(uiText).toBe(`${apiResp.bac.toFixed(1)} MD`)`)
3. **偽 pass 検出**: 新規 e2e を書いたら「データなし / 異常データ」状態で 1 回流して fail することを確認してから本シナリオに進む
4. **前提条件の境界アサート**: 本体テストに入る前に「データが正常描画されている」ことを 1 行で確認

### Evidence

`.kiro/postmortem/defects.md` #0003 — Phase 8 e2e は UI 空表示でも「テキスト存在」アサートが pass していた。Phase 9 で DB を直したら大量 fail し、データ空の偶然に依存していたことが露呈。

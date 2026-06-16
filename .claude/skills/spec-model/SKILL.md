---
name: spec-model
description: cc-sdd の spec 成果物(.kiro/specs/*/ の requirements / design / tasks.md)を AI が意味で読み取り、言語・書式に頑健な構造化モデル(JSON)を生成して spec-viewer の dashboard キャッシュへ書き込む producer スキル。「構造化モデルを生成して」「spec-model 起動」「ダッシュボードの要件を更新して」「トレーサビリティを再生成して」などの会話、または sdd-dashboard の起動/更新手順から発火する。対象プロジェクトには一切書き込まない(キャッシュのみ・読み取り専用)。
disable-model-invocation: false
allowed-tools: Read, Glob, Grep, Agent, Bash
argument-hint: <カレントプロジェクト絶対パス>
---

# spec-model(構造化モデル生成スキル)

cc-sdd の spec 成果物(`.kiro/specs/{feature}/` の `requirements.md` / `design.md` / `tasks.md`)を **AI が意味で読み取り**、見出し語彙・本文言語・書式ドリフトに依存しない **構造化モデル(JSON)** を生成する producer スキル。生成物は spec-viewer の **dashboard キャッシュにのみ**書き込み、後段で spec-viewer サーバ(consumer)が `GET /api/specs/{feature}/traceability` の情報源として優先利用する(無効・不在なら #28 の決定的パースへ自動フォールバック)。

このスキルは、**ユーザーがダッシュボードの「起動」または「更新」を指示したとき**に走る生成フェーズである(`sdd-dashboard` スキルが `launcher start` の **前段**に本スキルを差し込む)。表示要求の処理時には一切走らない(サーバは LLM を持たない)。

## 何をするスキルか(要件 1.1, 1.5)

- 対象プロジェクト(`<カレントプロジェクト絶対パス>`)の各 spec(`.kiro/specs/*/`)について、
- **spec ごとにサブエージェントへ委譲**して `requirements.md` / `design.md` / `tasks.md` を読み、構造化モデル(JSON)を抽出させ、
- 抽出結果を同梱の決定的ヘルパ `spec-model-cache.mjs` の `writeSpecModel(projectPath, feature, model)` でキャッシュへ書き込む。

**サブエージェントへの委譲は必須**(要件 1.5)。md 本文を主コンテキスト(この会話)に読み込むと、spec が増えるほど主コンテキストが膨張する。各 spec の読み取り・抽出はサブエージェント内で完結させ、主コンテキストには「どの spec を成功/スキップしたか」の要約だけを返させる。生成コストは起動/更新あたりの抽出処理に限定する。

対象プロジェクトのファイルは一切変更しない(読み取り専用・要件 2.3/2.4)。書き込み先は dashboard キャッシュ(`<root>/cache/<projectHash>/<feature>.json`、`root = SDD_DASHBOARD_HOME || ~/.sdd-dashboard`)のみで、決定的ヘルパに委譲する。

## 実行手順

### Step 1: 対象 spec の列挙

`<カレントプロジェクト絶対パス>/.kiro/specs/` 配下のディレクトリを列挙する(各ディレクトリ名が `feature`)。`.kiro/specs/` が無い、または spec が 0 件なら、何も生成せず「対象 spec が無い」旨を会話に返して終了する(consumer は #28 へ自然フォールバックするので問題ない)。

### Step 2: spec ごとにサブエージェントへ抽出を委譲(要件 1.1, 1.2, 1.4, 1.5)

各 feature について、サブエージェント(Agent)を 1 つ起動し、以下を指示する。**spec が多い場合は複数のサブエージェントを並行起動してよい**(主コンテキストは膨張させない)。

サブエージェントへ渡す指示の骨子:

> あなたは単一 spec の構造化モデル抽出エージェントです。次の 3 ファイルを読み(存在するものだけ)、**意味に基づいて**(見出しや本文の言語・表記に依存せず)構造化モデル JSON を 1 つ生成し、その JSON **だけ**を返してください。解釈し切れない記述があっても止めず、解釈できた範囲を残し、解釈できなかった参照・矛盾は `inconsistencies` に記録してください。
> - `<projectPath>/.kiro/specs/<feature>/requirements.md`
> - `<projectPath>/.kiro/specs/<feature>/design.md`
> - `<projectPath>/.kiro/specs/<feature>/tasks.md`

#### スキーマ契約(サブエージェントへ厳守させる)

返させる JSON は次の形状に厳密に従わせる(`schemaVersion` はヘルパが付与するので**出力させなくてよい**)。

```jsonc
{
  "feature": "<feature 名>",          // ディレクトリ名と一致
  "language": "<本文言語コード>",      // 例 "ja" / "en"。spec.json の language があればそれに合わせる
  "requirements": [
    {
      "id": "1",                       // ★数値スキーム必須: requirement.id = "N"(整数の文字列)
      "title": "<要件の見出し相当>",
      "objective": "<目的。無ければ null>",
      "acceptanceCriteria": [
        {
          "id": "1.1",                 // ★数値スキーム必須: criterion.id = "N.M"
          "ears": "Event",            // EARS 種別が判れば。判らなければ null(任意・v1 表示では未使用)
          "text": "<受け入れ基準の本文>"
        }
      ]
    }
  ],
  "traceability": [
    {
      "criterionId": "1.1",            // ★"N.M" 数値スキーム必須(requirements の criterion.id と対応)
      "designRefs": [
        {
          "sectionTitle": "<design.md の参照先見出しの生テキスト>",
          "excerpt": "<その参照を述べている design.md 内の行テキスト>"
        }
      ],
      "taskRefs": [
        {
          "taskId": "2.1",             // tasks.md のタスク番号(参考)
          "excerpt": "<その参照を述べている tasks.md 内の行テキスト>"
        }
      ]
      // ★covered は出力しない(consumer が designRefs/taskRefs の有無から決定的に導出する)
    }
  ],
  "inconsistencies": [
    {
      "ref": "<解決不能な参照・矛盾の記述>",
      "doc": "requirements | design | tasks",
      "line": 0                        // best-effort の推定行(不明なら 0)
    }
  ]
}
```

#### 抽出ルール(必ず守らせる)

- **ID は数値スキーム必須**: `requirement.id` は `"1"`/`"2"` … の整数文字列、`criterion.id`・`traceability[].criterionId` は `"1.1"`/`"2.3"` … の `N.M` 形式。これは consumer/web の `req-N-M` アンカー・`resolveTaskId` 互換のための契約であり、逸脱した基準は consumer 側でスキップされる。元の md が独自の記号 ID(例 "AC-a")を使っていても、**意味上の順序で数値を採番し直す**こと。
- **`covered` は出力しない**: カバレッジの真偽は consumer が `designRefs`/`taskRefs` の有無から導出する。AI に判定させない(#28 と同一意味を保証するため)。
- **行番号(line/anchor)は出力しない**(`inconsistencies[].line` の best-effort 推定を除く): design/tasks 参照は `sectionTitle`(design)/`taskId`(tasks)と `excerpt` で持たせる。表示座標(line/anchor)は consumer が **live md** から決定的に解決するので、producer が出すと生成と提供の間で md が編集された際にズレる。`excerpt` は consumer が live md と照合できるよう、**md に実在する 1 行をそのまま**写させる。
- **飛び先は「実質セクション」を優先し、メタ表は飛び先にしない**: `designRefs` の `sectionTitle`/`excerpt` は、その基準を**実際に実現・説明している実質的な設計記述**(コンポーネント定義・処理方針・データモデル・エラー戦略など)を指させる。`## 要件トレーサビリティ` のような **メタ表(要件→コンポーネントの対応索引)は飛び先 ref にしない**——索引に飛んでも「どう設計したか」が分からず遷移として無価値だから。メタ表は「その基準が設計でカバーされている」**手掛かり**としてのみ捉え、designRef にするのは**実質セクションがどうしても他に無いときの最後の手段**に留める。これは #28 の「メタ表へは飛ばさない(#38)」の**原則**を継ぐが、#28 が「実質に届かないので — で諦める」しかなかったのと違い、**AI は実質セクションを意味で特定できる**(範囲記法『要件 3.1–3.3』の中間メンバーや、ID を一切書かず意味的にのみ実現している箇所も含む)。字面 regex が届かないこのロングテールを、実質セクションへの飛び先として拾い直すのが本スキルの主目的。同一基準に実質セクションとメタ表の両方が見つかったら、**実質セクションを採り、メタ表参照は落とす**。
- **意味で読む**(要件 1.2): 見出しが英語でも日本語でも語彙テーブルに無い言語でも、「これは要件か」「これは受け入れ基準か」「この行は design/tasks への参照か」を**意味で**判断させる。見出し字面のマッチに頼らせない。
- **解釈できた範囲を残す**(要件 1.4): 全体を完璧に解釈できなくても、解釈できた要件・基準・対応は出力に残し、解釈できなかった参照・矛盾(例: design に存在しない見出しを指す参照、要件番号の重複)を `inconsistencies` に記録させる。

### Step 3: 検証して書き込む(決定的ヘルパに委譲・要件 2.1–2.4)

サブエージェントが返した JSON を受け取り、**書き込みは同梱の決定的ヘルパに委譲**する(このスキルや会話で path を組み立てたり `fs` を直接叩いたりしない)。ヘルパは LLM を持たない純 Node で、`schemaVersion` 付与・最低限の構造検査・キャッシュ path 算出(launcher と同一キー規約)・JSON write を行う。

ヘルパ呼び出し(`<skill-dir>` は本 SKILL.md と同じディレクトリの絶対パス):

```bash
node --input-type=module -e '
import { writeSpecModel } from "<skill-dir>/spec-model-cache.mjs";
import { readFileSync } from "node:fs";
const projectPath = process.argv[1];
const feature = process.argv[2];
const model = JSON.parse(readFileSync(process.argv[3], "utf8")); // サブエージェント出力 JSON を一時ファイル経由で渡す
const out = writeSpecModel(projectPath, feature, model);
console.log(out);
' '<カレントプロジェクト絶対パス>' '<feature>' '<抽出 JSON の一時ファイルパス>'
```

- `writeSpecModel(projectPath, feature, model)` は `schemaVersion`(= `SPEC_MODEL_SCHEMA_VERSION`)を付与し、`requirements`/`traceability`/`inconsistencies` が配列であることを検査して `<root>/cache/<projectHash>/<feature>.json` へ書く。**書込先はキャッシュのみ。`projectPath`(対象プロジェクト)配下には一切書かない**(要件 2.1/2.3)。
- `projectHash = sha256(resolve(projectPath)).slice(0,16)` でプロジェクトごとに一意に区別される(要件 2.2。複数プロジェクトのモデルが混在しない)。
- 構造検査に失敗すると `writeSpecModel` は throw する。

### Step 4: 失敗・抽出不能な spec はスキップ(安全側フォールバック)

ある spec で抽出に失敗した(サブエージェントが妥当な JSON を返せない、`writeSpecModel` が構造不正で throw する、ファイルが読めない等)場合は、**その spec のモデルを書かずにスキップ**し、次の spec へ進む。**部分生成を許容する**(一部 spec だけ成功してもよい)。書かれなかった spec は consumer が #28 の決定的パースへ自然にフォールバックするため、表示は空に転落しない。スキップした spec は会話の要約に「スキップ(理由)」として残す。

### Step 5: 会話への要約

全 spec の処理後、「成功した spec 数 / スキップした spec 数(理由)」を簡潔に会話へ提示する。md 本文を会話に貼らない(主コンテキスト非膨張)。`sdd-dashboard` の起動/更新フローから呼ばれた場合は、この後 launcher が起動される。

## スキーマ世代(schemaVersion)

`spec-model-cache.mjs` が付与する `SPEC_MODEL_SCHEMA_VERSION` は `@sdd-dashboard/shared` の同名定数および consumer(`server/src/kiro/spec-model/spec-model-cache.ts`)と一致する。consumer は読込時に世代を厳密照合し、不一致・破損・不在ならその構造化モデルを使わず #28 へ縮退する(要件 4.1–4.3)。スキーマ形状を変えるときは shared 定数・producer・consumer の三者を同時に更新する。

## 正本とコピー(二重管理に注意)

- **正本(source of truth)**: 本リポジトリの `skill/spec-model/`(この `SKILL.md` と `spec-model-cache.mjs`)。
- **invocable コピー**: `.claude/skills/spec-model/`(この repo でスキルとして登録・実行するためのコピー)。

`skill/spec-model/SKILL.md` または `skill/spec-model/spec-model-cache.mjs` を更新したら、**必ず `.claude/skills/spec-model/` へ再コピーして同期**すること。

```bash
cp <repo>/skill/spec-model/SKILL.md <repo>/skill/spec-model/spec-model-cache.mjs \
   <repo>/.claude/skills/spec-model/
```

両ディレクトリの内容バイト一致は `server/test/spec-model-skill-sync.test.ts` が検証する(ズレるとテストが落ちる)。`spec-model-cache.mjs` の挙動は `server/test/spec-model-producer.test.ts` が検証する。

> sdd-dashboard スキルと同じ運用(`skill/` 正本 ↔ `.claude/skills/*` コピー)。`skill/spec-model/spec-model-cache.mjs` の中身を直接いじらず、変更は正本側で行ってから同期する。

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * 構造化モデル キャッシュの producer 側 決定的ヘルパ（path 算出・schema 検証・write）。
 *
 * - 依存ゼロの ESM・**LLM を持たない純 Node**。
 * - 書込先は dashboard キャッシュのみ。**対象プロジェクト（projectPath）配下には一切書かない**。
 *
 * 要件:
 *   2.1 生成物を利用者ごとの dashboard キャッシュ領域にのみ書き込む
 *   2.2 キャッシュ上の 構造化モデル を対象プロジェクトの絶対パスで一意に区別する
 *   2.3 対象プロジェクト内ファイルを作成・変更・削除しない
 *   1.3 schemaVersion を 構造化モデルのスキーマ世代として付与する
 * design:
 *   - 「producer レイヤー > spec-model skill ＋ spec-model-cache.mjs」
 *   - 「データモデル > 構造化モデル キャッシュ（物理）」
 *   - refinement 1（キー導出の単一情報源 ＋ launcher / consumer とのハッシュ一致）
 *
 * キー規約は launcher（`skill/launcher.mjs` の `instanceFileFor`）および consumer
 * （`server/src/kiro/spec-model/spec-model-cache.ts` の `cachePathFor`）と完全一致:
 *   - projectHash = sha256(resolve(projectPath)).slice(0, 16)
 *   - root        = process.env.SDD_DASHBOARD_HOME || join(os.homedir(), '.sdd-dashboard')
 *   - 配置        = <root>/cache/<projectHash>/<feature>.json
 * ここがズレると consumer が producer のファイルを見つけられず静かに常時フォールバックする。
 */

/**
 * 構造化モデルのスキーマ世代。
 * `@sdd-dashboard/shared` の `SPEC_MODEL_SCHEMA_VERSION` と一致させる（1.3）。
 * producer は依存ゼロの素の ESM のためここで定数を保持する（shared を import しない）。
 */
export const SPEC_MODEL_SCHEMA_VERSION = '1.0';

/** キャッシュルート（`SDD_DASHBOARD_HOME` で上書き可・既定 `~/.sdd-dashboard`）。launcher の `homeDir()` と同一規約。 */
function cacheRoot() {
  return process.env.SDD_DASHBOARD_HOME || join(homedir(), '.sdd-dashboard');
}

/** プロジェクト絶対パスの sha256 短縮（16 桁）。launcher の `instanceFileFor` と同一規約。 */
function projectHashFor(projectPath) {
  const abs = resolve(projectPath);
  return createHash('sha256').update(abs).digest('hex').slice(0, 16);
}

/**
 * プロジェクト絶対パスと feature から 構造化モデル キャッシュファイルパスを解決する。
 * launcher / consumer と同一キー規約: `<root>/cache/<projectHash>/<feature>.json`。
 *
 * @param {string} projectPath 対象プロジェクトの絶対/相対パス
 * @param {string} feature spec 名
 * @returns {string} 書込先キャッシュファイルの絶対パス
 */
export function cachePathFor(projectPath, feature) {
  return join(cacheRoot(), 'cache', projectHashFor(projectPath), `${feature}.json`);
}

/**
 * 最低限の構造検査（design「spec-model-cache.mjs」実装ノート）。
 * `requirements` / `traceability` / `inconsistencies` が配列であることのみを必須とする。
 * 厳密すぎる検証は 構造化モデル を無駄に捨てるため、形状逸脱の判定は最低限に留める。
 */
function isStructurallyValid(model) {
  if (typeof model !== 'object' || model === null) return false;
  return (
    Array.isArray(model.requirements) &&
    Array.isArray(model.traceability) &&
    Array.isArray(model.inconsistencies)
  );
}

/**
 * 構造化モデル を dashboard キャッシュへ書き込む（producer 用 write ヘルパ）。
 *
 * - `schemaVersion`（= `SPEC_MODEL_SCHEMA_VERSION`）を付与する（1.3）。
 * - 最低限の構造検査（requirements/traceability/inconsistencies が配列）を通す。
 *   不正なら throw（呼び出し側スキルが catch して当該 spec をスキップする想定）。
 * - 書込先ディレクトリを mkdir -p し、整形 JSON を書く。
 * - **書込先はキャッシュのみ。対象プロジェクト配下には一切触れない**（2.1/2.3）。
 *
 * @param {string} projectPath 対象プロジェクトの絶対/相対パス
 * @param {string} feature spec 名（ファイル名に使う）
 * @param {object} model 構造化モデル（schemaVersion は本関数が付与・上書き）
 * @returns {string} 書き込んだキャッシュファイルの絶対パス
 * @throws {TypeError} model が構造不正なとき
 */
export function writeSpecModel(projectPath, feature, model) {
  if (!isStructurallyValid(model)) {
    throw new TypeError(
      'writeSpecModel: model is structurally invalid (requirements/traceability/inconsistencies must be arrays)',
    );
  }

  const out = { ...model, schemaVersion: SPEC_MODEL_SCHEMA_VERSION };
  const filePath = cachePathFor(projectPath, feature);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return filePath;
}

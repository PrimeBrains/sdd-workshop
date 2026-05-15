/**
 * Members Service
 *
 * メンバー関連のドメインロジックを提供する純粋関数群。
 *
 * 現在のスコープ:
 * - `generateInitials(name)`: 氏名から表示用イニシャル (1〜2 文字) を生成する。
 *
 * このモジュールは副作用を持たず、DB / I/O に依存しない。
 * 利用者: `services/wbs-importer.ts`, `api/members.ts`
 *
 * Requirements: 2.6, 2.7
 */

/**
 * 半角空白 (U+0020) または全角空白 (U+3000) で `name` を分割するための正規表現。
 */
const SPACE_SPLITTER = /[ 　]+/

/**
 * 氏名からイニシャルを生成する純粋関数。
 *
 * アルゴリズム:
 * 1. 前後の空白 (半角 / 全角) を除去する。
 * 2. 半角空白 / 全角空白で分割し、2 トークン以上 (姓 + 名 + α) なら
 *    `token[0]` の先頭 1 文字 + `token[1]` の先頭 1 文字 を連結して返す。
 * 3. 分割できない (空白なし) 場合は `name` の先頭最大 2 文字を返す。
 *
 * 文字単位での扱い:
 * - サロゲートペアや結合絵文字を 1 文字として扱うため、`String#charAt` / `slice` ではなく
 *   `Array.from(str)` を用いてコードポイント単位で先頭を取り出す。
 *
 * Examples:
 * - `generateInitials('田中 美咲')` → `'田美'` (半角空白)
 * - `generateInitials('田中　美咲')` → `'田美'` (全角空白)
 * - `generateInitials('伊藤健太')` → `'伊藤'` (空白なし、先頭 2 文字)
 *
 * Preconditions: `name` は非空文字列を想定する (空文字列の扱いは呼び出し側責務)。
 * Postconditions: 戻り値は最大 2 コードポイント / 文字の文字列。
 *
 * @param name メンバー氏名
 * @returns 1〜2 文字のイニシャル
 */
export function generateInitials(name: string): string {
  const trimmed = name.trim()

  // 半角 / 全角空白で分割
  const tokens = trimmed.split(SPACE_SPLITTER).filter((t) => t.length > 0)

  if (tokens.length >= 2) {
    const first = tokens[0]!
    const second = tokens[1]!
    const firstChar = Array.from(first)[0] ?? ''
    const secondChar = Array.from(second)[0] ?? ''
    return firstChar + secondChar
  }

  // 分割できない場合は先頭最大 2 文字 (コードポイント単位)
  return Array.from(trimmed).slice(0, 2).join('')
}

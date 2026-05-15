import { describe, expect, it } from 'vitest'
import { generateInitials } from './members-service.js'

/**
 * generateInitials の単体テスト。
 *
 * 仕様:
 * - 半角空白 / 全角空白で `name` を分割し、2 トークン以上なら姓 + 名の
 *   先頭 1 文字ずつを連結して返す。
 * - 分割できない場合は先頭最大 2 文字 (コードポイント単位) を返す。
 * - サロゲートペア / 絵文字を 1 文字として扱う。
 *
 * Requirements: 2.6, 2.7, 8.4
 */
describe('generateInitials', () => {
  it('半角空白の名前: "田中 美咲" → "田美"', () => {
    expect(generateInitials('田中 美咲')).toBe('田美')
  })

  it('全角空白の名前: "田中　美咲" → "田美"', () => {
    expect(generateInitials('田中　美咲')).toBe('田美')
  })

  it('空白なしの名前: "伊藤健太" → "伊藤"', () => {
    expect(generateInitials('伊藤健太')).toBe('伊藤')
  })

  it('サロゲートペア (絵文字を含む名前): "田中 😀" → "田😀"', () => {
    // '😀' (U+1F600) はサロゲートペア。Array.from で 1 文字として扱う。
    expect(generateInitials('田中 😀')).toBe('田😀')
  })
})

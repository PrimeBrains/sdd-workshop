// 表示専用の用語辞書（純データ・issue #10）。i18n 層は無いので、内部語彙
// （英語生ステート・rid・de-rate 等）を人間向けラベルへ写像する単一の出所として使う。
// 標準 EVM 用語（PV/EV/AC/SPI/CPI/BAC/EAC/PMB）は対象外（本ツールの利用者は EVM を知る PM）。
// ニュアンス保持のため、各表示要素は title 属性に正準語（英語生値等）を残す規則。

import type { EstimateState, LifecycleState } from './engine';

export const LIFECYCLE_JA: Record<LifecycleState, string> = {
  pending: '未着手',
  ready: '着手可',
  implementing: '作業中',
  implemented: '完了(検収待ち)',
  accepted: '検収済',
  cancelled: '中止',
};

export const ESTIMATE_JA: Record<EstimateState, string> = {
  proposed: '見積提案中',
  agreed: '見積合意済',
};

/** rid（安定キー）→ 人間向け判断種別ラベル（#12 のセクション見出しと共有） */
export const DECISION_JA: Record<string, string> = {
  'R-U12': '見積合意の矛盾',
  'R-U13': '未合意のまま完了',
  P5: '差し戻しリスク',
  'R-C3': '前提タスクの中止',
  'commit·合意': '見積に合意する',
  'commit·割当': '担当を割り当てる',
  'commit·受入': '受入判断する', // #12 で追加される項目
};

export const EDGE_POLICY_JA: Record<'accepted' | 'implemented', string> = {
  implemented: '完了で解放',
  accepted: '検収で解放',
};

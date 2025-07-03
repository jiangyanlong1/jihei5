// rules.js：牌型判断、牌值比较
import { CARD_ORDER } from './core';

/** * 比较两张牌的大小
 * @param {Object} a - 第一张牌
 * @param {Object} b - 第二张牌
 * @returns {number} - 返回值大于0表示a大于b，小于0表示a小于b，等于0表示相等
 */
export function compareCard(a, b) {
  return CARD_ORDER.indexOf(a.value) - CARD_ORDER.indexOf(b.value);
}

/**
 * 判断当前出牌是否可以压过上家
 * @param {Array} selectedCards - 当前要出的牌
 * @param {Array} lastCards - 上家出的牌（桌面牌）
 * @returns {boolean}
 */
export function isValidPlay(selectedCards, lastCards) {
  // 不能出空牌
  if (!selectedCards || selectedCards.length === 0) return false;
  const type = getCardType(selectedCards);
  if (type === 'invalid') return false;
  // 桌面无牌，任意合法牌型可出
  if (!lastCards || lastCards.length === 0) return true;
  const lastType = getCardType(lastCards);
  // 牌型不同，炸弹能压一切，轰能压除炸弹外的所有
  if (type === 'bomb' && lastType !== 'bomb') return true;
  if (type === 'triple' && lastType !== 'bomb' && lastType !== 'triple') return true;
  if (type !== lastType) return false;
  // 牌型相同，数量必须相同
  if (selectedCards.length !== lastCards.length) return false;
  // 比较大小
  const sortedSel = sortCards(selectedCards);
  const sortedLast = sortCards(lastCards);
  // 只比较第一张即可
  return compareCard(sortedSel[0], sortedLast[0]) > 0;
}

export function sortCards(cards) {
  return cards.slice().sort(compareCard);
}

// 判断牌型
export function getCardType(cards) {
  if (cards.length === 2 && cards[0].value === cards[1].value) return 'pair';
  if (cards.length === 3 && cards[0].value === cards[1].value && cards[1].value === cards[2].value) return 'triple'; // 轰
  if (cards.length === 4 && cards[0].value === cards[1].value && cards[1].value === cards[2].value && cards[2].value === cards[3].value) return 'bomb'; // 炸
  if (isStraight(cards)) return 'straight';
  if (isDoubleStraight(cards)) return 'doubleStraight';
  if (cards.length === 1) return 'single';
  return 'invalid';
}

// 判断是否为顺子
// 顺子：3张或以上连续点数的牌，不能有重复
function isStraight(cards) {
  if (cards.length < 3) return false;
  const idxs = cards.map(c => CARD_ORDER.indexOf(c.value)).sort((a, b) => a - b);
  for (let i = 1; i < idxs.length; i++) {
    if (idxs[i] - idxs[i - 1] !== 1) return false;
  }
  return true;
}

// 判断是否为连对
// 连对：2张或以上连续点数的对子，且每个对子必须相同
// 例如：66、77、88、99
function isDoubleStraight(cards) {
  if (cards.length < 4 || cards.length % 2 !== 0) return false;
  const sorted = cards.slice().sort(compareCard);
  for (let i = 0; i < sorted.length; i += 2) {
    if (sorted[i].value !== sorted[i + 1].value) return false;
    if (i > 0) {
      // 当前对子
      const curr = CARD_ORDER.indexOf(sorted[i].value);
      // 当前对子后一个对子
      const prev = CARD_ORDER.indexOf(sorted[i - 2].value);
      
      if (curr - prev !== 1) return false;
    }
  }
  return true;
}

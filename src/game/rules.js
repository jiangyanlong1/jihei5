// rules.js：牌型判断、牌值比较
import { CARD_ORDER, STRAIGHT_CARD_ORDER } from './card';

/**
 * 单张
 */
const SINGLE = 'single';
/**
 * 对子
 */
const PAIR = 'pair';
/**
 * 轰
 */
const TRIPLE = 'triple';
/**
 * 炸
 */
const BOMB = 'bomb';
/**
 * 顺子
 */
const STRAIGHT = 'straight';
/**
 * 连对
 */
const DOUBLE_STRAIGHT = 'doubleStraight';
/**
 * 无效牌型
 */
const INVALID = 'invalid';

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
  if (type === INVALID) return false;
  // 桌面无牌，任意合法牌型可出
  if (!lastCards || lastCards.length === 0) return true;
  const lastType = getCardType(lastCards);
  // 牌型不同，炸弹能压一切，轰能压除炸弹外的所有
  if (type === BOMB && lastType !== BOMB) return true;
  if (type === TRIPLE && lastType !== BOMB && lastType !== TRIPLE) return true;
  if (type !== lastType) return false;
  // 牌型相同，数量必须相同
  if (selectedCards.length !== lastCards.length) return false;
  // 比较牌值为5的

  // 比较大小
  const sortedSel = sortCards(selectedCards);
  const sortedLast = sortCards(lastCards);
  // 只比较最后一张即可
  return compareCard(sortedSel[selectedCards.length - 1], sortedLast[lastCards.length - 1]) > 0;
}

/**
 * 排序手牌
 * @param {*} cards 乱序手牌
 * @returns 排序后的手牌
 */
export function sortCards(cards) {
  return cards.slice().sort(compareCard);
}

/**
 * 判断牌型
 * @param {*} cards 手牌
 * @returns 类型
 */
export function getCardType(cards) {
  if (cards.length === 1) return SINGLE; // 单
  if (cards.length === 2 && cards[0].value === cards[1].value) return PAIR; //对子
  if (cards.length === 3 && cards[0].value === cards[1].value && cards[1].value === cards[2].value) return TRIPLE; // 轰
  if (cards.length === 4 && cards[0].value === cards[1].value && cards[1].value === cards[2].value && cards[2].value === cards[3].value) return BOMB; // 炸
  if (isStraight(cards)) return STRAIGHT; // 顺子
  if (isDoubleStraight(cards)) return DOUBLE_STRAIGHT; // 连对
  return INVALID; // 无效牌型
}

export function isSingle(cards) {
  return cards.length === 1;
}

export function isPair(cards) {
  return cards.length === 2 && cards[0].value === cards[1].value;
}

export function isTriple(cards) {
  return cards.length === 3 && cards[0].value === cards[1].value && cards[1].value === cards[2].value;
}

export function isBomb(cards) {
  return cards.length === 4 && cards[0].value === cards[1].value && cards[1].value === cards[2].value && cards[2].value === cards[3].value;
}

/**
 * 判断是否为顺子
 * 例如：4、6、7或6、7、8
 * @param {*} cards 手牌
 * @returns {boolean}
 */
export function isStraight(cards) {
  if (cards.length < 3) return false;
  const idxs = cards.map(c => STRAIGHT_CARD_ORDER.indexOf(c.value)).sort((a, b) => a - b);
  if (idxs.includes(-1)) return false;
  for (let i = 1; i < idxs.length; i++) {
    // K后面只能接A
    if (STRAIGHT_CARD_ORDER[idxs[i - 1]] === 'K' && STRAIGHT_CARD_ORDER[idxs[i]] !== 'A') return false;
    // 允许K-A，但不允许A-2、A-3、A-5
    if (
      !(STRAIGHT_CARD_ORDER[idxs[i - 1]] === 'K' && STRAIGHT_CARD_ORDER[idxs[i]] === 'A') &&
      (idxs[i] - idxs[i - 1] !== 1)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * 判断是否为连对
 * 例如：44、66或66、77
 * @param {*} cards 手牌
 * @returns {boolean}
 */
export function isDoubleStraight(cards) {
  if (cards.length < 4 || cards.length % 2 !== 0) return false;
  const sorted = cards.slice().sort(compareCard);
  for (let i = 0; i < sorted.length; i += 2) {
    if (sorted[i].value !== sorted[i + 1].value) return false;
    if (i > 0) {
      const curr = STRAIGHT_CARD_ORDER.indexOf(sorted[i].value);
      const prev = STRAIGHT_CARD_ORDER.indexOf(sorted[i - 2].value);
      if (prev === -1 || curr === -1) return false;
      // K后面只能接A
      if (STRAIGHT_CARD_ORDER[prev] === 'K' && STRAIGHT_CARD_ORDER[curr] !== 'A') return false;
      if (
        !(STRAIGHT_CARD_ORDER[prev] === 'K' && STRAIGHT_CARD_ORDER[curr] === 'A') &&
        (curr - prev !== 1)
      ) {
        return false;
      }
    }
  }
  return true;
}

// ai.js：AI出牌逻辑
import { isValidPlay, sortCards } from './rules';

/**
 * 更智能的AI出牌：
 * - 桌面有牌时，优先使用桌面牌组类型进行压制，若有最小能压过该类型牌组，需要考虑是否拆开了最优牌组，若拆开了最优牌组，则不出，
 *   若已经是最优牌组则出，（不轻易拆炸弹/顺子/连对），如对方出炸弹可用更大炸弹压制
 * - 桌面无牌时，优先出顺子、连对、对子、单牌等减少手牌数量的组合
 * - 只在必要时拆牌或出炸弹
 * @param {Array} hand - AI当前手牌
 * @param {Array} lastCards - 桌面牌
 * @returns {Array} 要出的牌数组，不能出则返回空数组
 */
export function aiPlay(hand, lastCards = []) {
  if (!hand || hand.length === 0) return [];
  const sorted = sortCards(hand);
  const combos = getAllCombos(sorted);

  // 分类组合
  const bombs = combos.filter(c => c.length === 4 && isBomb(c));
  const straights = combos.filter(c => c.length >= 5 && isStraightFast(c));
  const doubleStraights = combos.filter(c => c.length >= 6 && isDoubleStraightFast(c));
  const triples = combos.filter(c => c.length === 3 && isTriple(c)); // 三张（轰）
  const pairs = combos.filter(c => c.length === 2 && isPair(c));
  const singles = combos.filter(c => c.length === 1);

  // 桌面有牌
  if (lastCards && lastCards.length > 0) {
    // 1. 如果对方是三张（轰），只能用更大的三张或炸弹压
    if (isTriple(lastCards)) {
      for (const t of triples) {
        if (isValidPlay(t, lastCards)) return t;
      }
      for (const b of bombs) {
        if (isValidPlay(b, lastCards)) return b;
      }
      return [];
    }
    // 2. 如果对方是炸弹，尝试用更大的炸弹压
    if (isBomb(lastCards)) {
      for (const b of bombs) {
        if (isValidPlay(b, lastCards)) return b;
      }
      return [];
    }
    // 3. 先找同类型最小能压过的（不拆炸弹/顺子/三张）
    for (const c of combos) {
      if (!isBomb(c) && !isTriple(c) && isValidPlay(c, lastCards)) {
        if (!wouldBreakBombOrStraightOrTriple(c, sorted, bombs, straights, doubleStraights, triples)) {
          // 优先选择单张或对子
          if (c.length === 1 || c.length === 2) return c;
        }
      }
    }
    // 4. 其次考虑三张、顺子、连对（不拆大牌）
    for (const c of combos) {
      if (!isBomb(c) && isValidPlay(c, lastCards)) {
        if (!wouldBreakBombOrStraightOrTriple(c, sorted, bombs, straights, doubleStraights, triples)) {
          return c;
        }
      }
    }
    // 5. 最后实在不行才考虑拆顺子/三张/炸弹
    for (const c of combos) {
      if (isValidPlay(c, lastCards)) return c;
    }
    return [];
  }

  // 桌面无牌，优先出最小单张或对子，除非手牌<=5才优先出顺子/三张等
  if (hand.length > 5) {
    if (singles.length > 0) return singles[0];
    if (pairs.length > 0) return pairs[0];
    if (triples.length > 0) return triples[0];
    if (straights.length > 0) return straights[0];
    if (doubleStraights.length > 0) return doubleStraights[0];
    if (bombs.length > 0) return bombs[0];
    return [sorted[0]];
  } else {
    // 剩余5张及以下，优先出能减少手牌数量的组合
    if (straights.length > 0) return straights[0];
    if (doubleStraights.length > 0) return doubleStraights[0];
    if (triples.length > 0) return triples[0];
    if (pairs.length > 0) return pairs[0];
    if (singles.length > 0) return singles[0];
    if (bombs.length > 0) return bombs[0];
    return [sorted[0]];
  }
}

// 判断是否炸弹
function isBomb(cards) {
  return cards.length === 4 && cards.every(c => c.value === cards[0].value);
}
// 判断是否三张
function isTriple(cards) {
  return cards.length === 3 && cards.every(c => c.value === cards[0].value);
}
// 判断是否对子
function isPair(cards) {
  return cards.length === 2 && cards[0].value === cards[1].value;
}
// 判断是否会拆炸弹/顺子/三张
function wouldBreakBombOrStraightOrTriple(combo, hand, bombs, straights, doubleStraights, triples) {
  for (const b of bombs) {
    if (b.some(card => combo.includes(card)) && !arraysEqual(b, combo)) return true;
  }
  for (const s of straights) {
    if (s.some(card => combo.includes(card)) && !arraysEqual(s, combo)) return true;
  }
  for (const d of doubleStraights) {
    if (d.some(card => combo.includes(card)) && !arraysEqual(d, combo)) return true;
  }
  for (const t of triples) {
    if (t.some(card => combo.includes(card)) && !arraysEqual(t, combo)) return true;
  }
  return false;
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// 获取所有可能的出牌组合，按牌型和大小升序排列
function getAllCombos(hand) {
  const res = [];
  // 单张
  for (let i = 0; i < hand.length; i++) {
    res.push([hand[i]]);
  }
  // 对子
  for (let i = 0; i < hand.length - 1; i++) {
    if (hand[i].value === hand[i + 1].value) {
      res.push([hand[i], hand[i + 1]]);
    }
  }
  // 三张
  for (let i = 0; i < hand.length - 2; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value) {
      res.push([hand[i], hand[i + 1], hand[i + 2]]);
    }
  }
  // 四张（炸弹）
  for (let i = 0; i < hand.length - 3; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value && hand[i].value === hand[i + 3].value) {
      res.push([hand[i], hand[i + 1], hand[i + 2], hand[i + 3]]);
    }
  }
  // 顺子（长度3及以上）
  for (let len = 3; len <= hand.length; len++) {
    for (let i = 0; i <= hand.length - len; i++) {
      const slice = hand.slice(i, i + len);
      if (isStraightFast(slice)) res.push(slice);
    }
  }
  // 连对（长度4及以上且为偶数）
  for (let len = 4; len <= hand.length; len += 2) {
    for (let i = 0; i <= hand.length - len; i++) {
      const slice = hand.slice(i, i + len);
      if (isDoubleStraightFast(slice)) res.push(slice);
    }
  }
  // 按长度和牌值升序排列
  res.sort((a, b) => a.length - b.length || a[0].value.localeCompare(b[0].value));
  return res;
}

// 快速顺子判断（假设已排序）
function isStraightFast(cards) {
  if (cards.length < 3) return false;
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].value === cards[i - 1].value) return false;
    if (cards[i].value.charCodeAt(0) - cards[i - 1].value.charCodeAt(0) !== 1) return false;
  }
  return true;
}
// 快速连对判断（假设已排序）
function isDoubleStraightFast(cards) {
  if (cards.length < 4 || cards.length % 2 !== 0) return false;
  for (let i = 0; i < cards.length; i += 2) {
    if (cards[i].value !== cards[i + 1].value) return false;
    if (i > 0) {
      if (cards[i].value.charCodeAt(0) - cards[i - 2].value.charCodeAt(0) !== 1) return false;
    }
  }
  return true;
}

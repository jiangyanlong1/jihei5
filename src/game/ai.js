import { isValidPlay, sortCards } from './rules';
import { CARD_ORDER, SUITS } from './core';
// 统计所有已出牌（包含历史出牌和自己当前手牌）
function getPlayedCards(historyPlays, myHand = []) {
  const played = [];
  for (const play of historyPlays) {
    if (play.cards && play.cards.length) {
      played.push(...play.cards);
    }
  }
  // 可选：也可统计自己当前手牌（用于推断其他玩家剩余牌）
  if (myHand && myHand.length) {
    played.push(...myHand);
  }
  return played;

}

// 推断场上尚未出现的牌（全牌库减已出牌和自己手牌）
function getRemainingCards(myHand, historyPlays) {
  // 需与createDeck保持一致，使用 core 导出的常量
  const values = CARD_ORDER;
  const allCards = [];
  for (const suit of SUITS) {
    for (const value of values) {
      allCards.push({ suit, value });
    }
  }
  const played = getPlayedCards(historyPlays, myHand);
  // 用字符串标识牌，方便比较
  const playedSet = new Set(played.map(c => `${c.suit}${c.value}`));
  return allCards.filter(c => !playedSet.has(`${c.suit}${c.value}`));
}

// 辅助：选择最小的单张（按 CARD_ORDER 排序）
function selectSmallestSingle(singles) {
  if (!singles || singles.length === 0) return null;
  return singles.slice().sort((a, b) => CARD_ORDER.indexOf(a[0].value) - CARD_ORDER.indexOf(b[0].value))[0];
}

// 辅助：选择最小的对子
function selectSmallestPair(pairs) {
  if (!pairs || pairs.length === 0) return null;
  return pairs.slice().sort((a, b) => CARD_ORDER.indexOf(a[0].value) - CARD_ORDER.indexOf(b[0].value))[0];
}

// 辅助：选择最小的顺子/连对（优先较短，再优先起始点较小）
function selectSmallestStraight(list) {
  if (!list || list.length === 0) return null;
  return list.slice().sort((A, B) => (A.length - B.length) || (CARD_ORDER.indexOf(A[0].value) - CARD_ORDER.indexOf(B[0].value)))[0];
}

/**
 * 更智能的 AI 出牌策略：
 * - 若桌面有牌，优先使用与桌面相同类型的牌进行压制；若最小能压过该类型的牌会拆开最优组合，则不出；若已经是最优组合则出。
 *   （不轻易拆炸弹/顺子/连对；如对方出炸弹可用更大炸弹压制）
 * - 若桌面无牌，优先出顺子、连对、对子、单牌等能减少手牌数量的组合
 * - 仅在必要时拆牌或出炸弹；前几回合避免出轰和炸弹
 * @param {Array} hand - AI 当前手牌
 * @param {Array} lastCards - 桌面牌
 * @param {number} playNumber - 当前出牌轮数
 * @param {Array} players - 所有玩家信息（含 team、isBanker、hand 等）
 * @param {number} playerIndex - 当前 AI 在 players 中的索引
 * @returns {Array} 要出的牌数组，若不能出牌返回空数组
 */

// 优化后的AI出牌逻辑
export function aiPlay(hand, lastCards = [], playNumber, players = [], playerIndex = 0, historyPlays = []) {
  // 动态风格调整
  let style = 'normal'; // normal: 默认，conservative: 保守，aggressive: 激进，team: 团队
  const round = playNumber % 4 + 1;
  if (!hand || hand.length === 0) return [];
  const sorted = sortCards(hand);
  const teammateIndexes = getTeammateIndexesWithSpade5(playerIndex, players, historyPlays);
  const nextPlayerIdx = getNextPlayerIndex(playerIndex, players.length || 4);
  const nextPlayerHandCount = players && players[nextPlayerIdx] ? players[nextPlayerIdx].hand.length : 99;
  const prevPlayerIdx = (playerIndex + players.length - 1) % players.length;
  const prevPlayer = players && players[prevPlayerIdx] ? players[prevPlayerIdx] : null;
  const prevPlayerIsTeammate = teammateIndexes.includes(prevPlayerIdx);
  const prevPlayerHandCount = prevPlayer ? prevPlayer.hand.length : 99;

  // 风格切换逻辑
  if (teammateIndexes.some(idx => players[idx].hand.length <= 2)) {
    style = 'team'; // 队友快走完，主动让牌
  } else if (hand.length <= 5 || nextPlayerHandCount <= 2) {
    style = 'aggressive'; // 后期或对手快走完，激进
  } else if (round <= 3) {
    style = 'conservative'; // 前期，保守
  }

  // 记牌与推理：统计场上剩余的关键牌
  const remainingCards = getRemainingCards(hand, historyPlays);
  // 统计剩余关键牌数量：炸弹、三张(轰)、2、A、5、3 等
  const keyValues = ['2', 'A', '5', '3'];
  const keyCount = {
    '2': 0,
    'A': 0,
    '5': 0,
    '3': 0,
    'bomb': 0,
    'triple': 0
  };
  for (const c of remainingCards) {
    if (keyValues.includes(c.value)) keyCount[c.value]++;
  }
  // 统计同点数数量以判断三张/炸弹
  const valueMap = {};
  for (const c of remainingCards) {
    valueMap[c.value] = (valueMap[c.value] || 0) + 1;
  }
  for (const v in valueMap) {
    if (valueMap[v] >= 4) keyCount.bomb++;
    else if (valueMap[v] >= 3) keyCount.triple++;
  }

  // 将手牌按可出的组合进行分类
  const combos = getOptimalCombos(sorted, round, hand.length);
  const triples = combos.filter(c => c.length === 3 && isTriple(c));
  const bombs = combos.filter(c => c.length === 4 && isBomb(c));
  const straights = combos.filter(c => c.length >= 3 && isStraightFast(c));
  const doubleStraights = combos.filter(c => c.length >= 4 && isDoubleStraightFast(c));
  const pairs = combos.filter(c => c.length === 2 && isPair(c));
  const singles = combos.filter(c => c.length === 1);

  // 检测：上一个非空出牌是否是自己出的并且之后无人压制（即自己赢得上一轮）
  let wonLastTurn = false;
  let lastNonEmptyPlay = null;
  if (historyPlays && historyPlays.length) {
    for (let i = historyPlays.length - 1; i >= 0; i--) {
      const p = historyPlays[i];
      if (p && p.cards && p.cards.length) {
        lastNonEmptyPlay = p;
        break;
      }
    }
    if (lastNonEmptyPlay) {
      // 尝试匹配玩家索引或名字
      const ownerMatches = (idx) => {
        if (!lastNonEmptyPlay) return false;
        if (typeof lastNonEmptyPlay.playerIndex === 'number') return lastNonEmptyPlay.playerIndex === idx;
        if (lastNonEmptyPlay.name && players && players[idx]) return lastNonEmptyPlay.name === players[idx].name;
        return false;
      };
      if (ownerMatches(playerIndex)) {
        // 确认在 lastNonEmptyPlay 之后没有别的非空出牌（否则可能被压制）
        let foundLaterNonEmpty = false;
        for (let j = historyPlays.indexOf(lastNonEmptyPlay) + 1; j < historyPlays.length; j++) {
          const p2 = historyPlays[j];
          if (p2 && p2.cards && p2.cards.length) {
            foundLaterNonEmpty = true; break;
          }
        }
        if (!foundLaterNonEmpty) wonLastTurn = true;
      }
    }
  }

  // 如果确实是自己赢得上一轮并成为出牌方，构造“安全”组合，排除会压过自己上次出牌的组合
  let safeStraights = straights;
  let safeDoubleStraights = doubleStraights;
  let safePairs = pairs;
  let safeSingles = singles;
  let safeTriples = triples;
  if (wonLastTurn && lastNonEmptyPlay && lastNonEmptyPlay.cards) {
    const avoidPlay = lastNonEmptyPlay.cards;
    const avoidIfBeats = (arr) => arr.filter(a => !isValidPlay(a, avoidPlay));
    safeStraights = avoidIfBeats(straights);
    safeDoubleStraights = avoidIfBeats(doubleStraights);
    safePairs = avoidIfBeats(pairs);
    safeSingles = avoidIfBeats(singles);
    safeTriples = avoidIfBeats(triples);
  // 不过滤炸弹（炸弹的使用由上层策略负责），因此不需要 safeBombs
  }

  // 1. 团队协作优先（team 风格）
  if (style === 'team') {
    if (lastCards && lastCards.length > 0 && prevPlayerIsTeammate && prevPlayerHandCount <= 2) {
      return [];
    }
  // 桌面无牌且队友快走完时，优先出最小单张或对子，避免主动出关键牌
  // 如果刚赢得上一轮且无人压制，则不允许拆牌，优先出最小单牌/对子/顺子
    if (wonLastTurn && (!lastCards || lastCards.length === 0)) {
      const s = selectSmallestSingle(singles);
      if (s) return s;
      const p = selectSmallestPair(pairs);
      if (p) return p;
      const st = selectSmallestStraight(straights);
      if (st) return st;
      const ds = selectSmallestStraight(doubleStraights);
      if (ds) return ds;
    }
  const teamSafeSingles = (wonLastTurn ? safeSingles : singles).filter(s => !['2','A'].includes(s[0].value));
  if (teamSafeSingles.length > 0) return teamSafeSingles[0];
  const teamSafePairs = (wonLastTurn ? safePairs : pairs).filter(p => !['2','A'].includes(p[0].value));
  if (teamSafePairs.length > 0) return teamSafePairs[0];
  const teamSafeStraights = (wonLastTurn ? safeStraights : straights).filter(arr => arr.every(c => !['2','A'].includes(c.value)));
  if (teamSafeStraights.length > 0) return teamSafeStraights[0];
  const teamSafeDoubleStraights = (wonLastTurn ? safeDoubleStraights : doubleStraights).filter(arr => arr.every(c => !['2','A'].includes(c.value)));
  if (teamSafeDoubleStraights.length > 0) return teamSafeDoubleStraights[0];
  const teamSafeTriples = (wonLastTurn ? safeTriples : triples).filter(arr => !['2','A'].includes(arr[0].value));
  if (teamSafeTriples.length > 0) return teamSafeTriples[0];
    // 炸弹只在无其他选择时出
    if (bombs.length > 0) return bombs[0];
    return [sorted[0]];
  }

  // 2. 激进风格（aggressive）
  if (style === 'aggressive') {
  // 下家快走完时，优先进行压制
    if (lastCards && lastCards.length > 0) {
      // 优先用能压制的最大组合
      for (let i = combos.length - 1; i >= 0; i--) {
        if (isValidPlay(combos[i], lastCards)) return combos[i];
      }
      return [];
    }
  // 桌面无牌时，优先出能减少手牌数量的组合；关键牌仅在无其他选择时主动使用
  // 如果刚赢得上一轮且无人压制，则不允许拆牌，优先出最小单牌/对子/顺子
    if (wonLastTurn && (!lastCards || lastCards.length === 0)) {
      const s = selectSmallestSingle(singles);
      if (s) return s;
      const p = selectSmallestPair(pairs);
      if (p) return p;
      const st = selectSmallestStraight(straights);
      if (st) return st;
      const ds = selectSmallestStraight(doubleStraights);
      if (ds) return ds;
    }
    const aggrSafeStraights = (wonLastTurn ? safeStraights : straights).filter(arr => arr.every(c => !['2','A'].includes(c.value)));
    if (aggrSafeStraights.length > 0) return aggrSafeStraights[0];
    const aggrSafeDoubleStraights = (wonLastTurn ? safeDoubleStraights : doubleStraights).filter(arr => arr.every(c => !['2','A'].includes(c.value)));
    if (aggrSafeDoubleStraights.length > 0) return aggrSafeDoubleStraights[0];
    const aggrSafeTriples = (wonLastTurn ? safeTriples : triples).filter(arr => !['2','A'].includes(arr[0].value));
    if (aggrSafeTriples.length > 0) return aggrSafeTriples[0];
    const aggrSafePairs = (wonLastTurn ? safePairs : pairs).filter(p => !['2','A'].includes(p[0].value));
    if (aggrSafePairs.length > 0) return aggrSafePairs[0];
    const aggrSafeSingles = (wonLastTurn ? safeSingles : singles).filter(s => !['2','A'].includes(s[0].value));
    if (aggrSafeSingles.length > 0) return aggrSafeSingles[0];
    if (bombs.length > 0) return bombs[0];
    if (!wonLastTurn) {
      const splitCombo = findSplitTripleOrBombForStraightOrDoubleStraight(sorted);
      if (splitCombo) return splitCombo;
    }
    return [sorted[0]];
  }

  // 3. 桌面有牌时的应对策略
  if (lastCards && lastCards.length > 0) {
  // 当对方出炸弹/轰/顺子/连对时，优先用同类型或更大炸弹进行压制
    for (const b of bombs) {
      if (isValidPlay(b, lastCards)) return b;
    }
    if (isTriple(lastCards)) {
      if (round <= 3) {
        for (const b of bombs) {
          if (isValidPlay(b, lastCards)) return b;
        }
        return [];
      }
      for (const t of triples) {
        if (isValidPlay(t, lastCards)) return t;
      }
      for (const b of bombs) {
        if (isValidPlay(b, lastCards)) return b;
      }
      return [];
    }
    if (isLongStraight(lastCards) || isLongDoubleStraight(lastCards)) {
      if (round <= 3) {
        for (const t of triples) {
          if (isValidPlay(t, lastCards)) return t;
        }
        for (const b of bombs) {
          if (isValidPlay(b, lastCards)) return b;
        }
      }
    }
    if (isStraightFast(lastCards)) {
      for (const s of (wonLastTurn ? safeStraights : straights)) {
        if (isValidPlay(s, lastCards)) return s;
      }
      const splitStraight = findSplittableStraightToBeat(lastCards, sorted);
      if (splitStraight) return splitStraight;
      for (const b of bombs) {
        if (isValidPlay(b, lastCards)) return b;
      }
      return [];
    }
    if (isDoubleStraightFast(lastCards)) {
      for (const ds of (wonLastTurn ? safeDoubleStraights : doubleStraights)) {
        if (isValidPlay(ds, lastCards)) return ds;
      }
      const splitDoubleStraight = findSplittableDoubleStraightToBeat(lastCards, sorted);
      if (splitDoubleStraight) return splitDoubleStraight;
      for (const b of bombs) {
        if (isValidPlay(b, lastCards)) return b;
      }
      return [];
    }
  // 优先使用同类型、且最小能压制桌面牌的组合（不拆炸弹/顺子/三张）
    for (const c of combos) {
      if (!isBomb(c) && !isTriple(c) && isValidPlay(c, lastCards)) {
        if (!wouldBreakOptimalCombo(c, sorted, combos)) {
          if (c.length === 1 || c.length === 2) return c;
        }
      }
    }
  // 其次考虑三张、顺子、连对（仍不拆大牌）
    for (const c of combos) {
      if (!isBomb(c) && isValidPlay(c, lastCards)) {
        if (!wouldBreakOptimalCombo(c, sorted, combos)) {
          return c;
        }
      }
    }
  // 若以上都无解，最后才考虑拆顺子/三张/炸弹
    for (const c of combos) {
      if (isValidPlay(c, lastCards)) return c;
    }
    return [];
  }

  // 4. 保守风格（conservative）和默认风格的策略
  if (style === 'conservative' || style === 'normal') {
    // 桌面有牌
    if (lastCards && lastCards.length > 0) {
      // 保守风格优先用最小能压制的组合
      for (const c of combos) {
        if (isValidPlay(c, lastCards)) return c;
      }
      return [];
    }
    // 桌面无牌
    if (hand.length > 5) {
  // 如果刚赢得上一轮且无人压制，则不允许拆牌，优先出最小单牌/对子/顺子
      if (wonLastTurn && (!lastCards || lastCards.length === 0)) {
        const s = selectSmallestSingle(singles);
        if (s) return s;
        const p = selectSmallestPair(pairs);
        if (p) return p;
        const st = selectSmallestStraight(straights);
        if (st) return st;
        const ds = selectSmallestStraight(doubleStraights);
        if (ds) return ds;
      }
      if (keyCount['2'] > 0 && singles.length > 0) {
        const non2 = singles.find(s => s[0].value !== '2');
        if (non2) return non2;
      }
      if (keyCount['A'] > 0 && singles.length > 0) {
        const nonA = singles.find(s => s[0].value !== 'A');
        if (nonA) return nonA;
      }
      if (keyCount.bomb > 0 && bombs.length > 0) {
        const nonBomb = singles.length > 0 ? singles[0] : null;
        if (nonBomb) return nonBomb;
      }
      if (pairs.length > 0) return pairs[0];
      if (straights.length > 0) return straights[0];
      if (doubleStraights.length > 0) return doubleStraights[0];
      if (singles.length > 0) return singles[0];
      if (triples.length > 0) return triples[0];
      if (bombs.length > 0) return bombs[0];
      if (!wonLastTurn) {
        const splitCombo = findSplitTripleOrBombForStraightOrDoubleStraight(sorted);
        if (splitCombo) return splitCombo;
      }
      return [sorted[0]];
    } else {
      // 剩余5张及以下，优先出能减少手牌数量的组合
      if (singles.length > 0) return singles[0];
      if (pairs.length > 0) return pairs[0];
      if (triples.length > 0) return triples[0];
      if (straights.length > 0) return straights[0];
      if (doubleStraights.length > 0) return doubleStraights[0];
      if (bombs.length > 0) return bombs[0];
      if (!wonLastTurn) {
        const splitCombo = findSplitTripleOrBombForStraightOrDoubleStraight(sorted);
        if (splitCombo) return splitCombo;
      }
      return [sorted[0]];
    }
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

// 判断是否会拆最优组合
function wouldBreakOptimalCombo(combo, hand, optimalCombos) {
  for (const optimal of optimalCombos) {
    if (optimal.some(card => combo.includes(card)) && !arraysEqual(optimal, combo)) return true;
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

/**
 * 获取最优的出牌组合
 * 策略：优先选择顺子、连对、对子、单牌，避免重复花色，炸弹和轰权重最低
 * 前几回合避免出轰和炸弹
 * @param {Array} hand - 手牌
 * @param {number} round - 当前回合
 * @param {number} handSize - 手牌数量
 * @returns {Array} 最优组合数组
 */
function getOptimalCombos(hand, round, handSize) {
  const combos = [];
  const usedCards = new Set(); // 记录已使用的牌

  // 1. 先找炸弹 - 权重最低，但优先整体保留
  const bombs = findBombs(hand, usedCards);
  bombs.forEach(bomb => bomb.forEach(card => usedCards.add(`${card.suit}${card.value}`)));
  // 2. 再找三张（轰）- 权重较低，但优先整体保留
  const triples = findTriples(hand, usedCards);
  triples.forEach(triple => triple.forEach(card => usedCards.add(`${card.suit}${card.value}`)));

  // 3. 找顺子（长度3及以上，不能用已被三张/炸弹占用的牌）
  const straights = findStraights(hand, usedCards);
  straights.forEach(straight => straight.forEach(card => usedCards.add(`${card.suit}${card.value}`)));

  // 4. 找连对（长度4及以上且为偶数，不能用已被三张/炸弹占用的牌）
  const doubleStraights = findDoubleStraights(hand, usedCards);
  doubleStraights.forEach(ds => ds.forEach(card => usedCards.add(`${card.suit}${card.value}`)));

  // 5. 找对子（不能用已被三张/炸弹/顺子/连对占用的牌）
  const pairs = findPairs(hand, usedCards);
  pairs.forEach(pair => pair.forEach(card => usedCards.add(`${card.suit}${card.value}`)));

  // 6. 找单牌（不能用已被三张/炸弹/顺子/连对/对子占用的牌）
  const singles = findSingles(hand, usedCards);
  singles.forEach(single => single.forEach(card => usedCards.add(`${card.suit}${card.value}`)));

  // 按优先级排序：顺子 > 连对 > 对子 > 单牌 > 三张 > 炸弹
  combos.push(...straights, ...doubleStraights, ...pairs, ...singles);
  // 轰和炸弹最后加（但整体保留，不会被对子/单张拆分）
  if (round > 3 || handSize <= 5) {
    combos.push(...triples, ...bombs);
  } else {
    // 前几回合不主动出轰和炸弹
    // 但如果没有其他组合可出，后续aiPlay会考虑拆
  }
  return combos;
}

// 找顺子（避免重复花色）
function findStraights(hand, usedCards) {
  const straights = [];
  for (let len = 3; len <= hand.length; len++) {
    for (let i = 0; i <= hand.length - len; i++) {
      const slice = hand.slice(i, i + len);
      if (isStraightFast(slice) && !hasRepeatedSuit(slice) && !hasUsedCards(slice, usedCards)) {
        straights.push(slice);
        // 标记已使用的牌
        slice.forEach(card => usedCards.add(`${card.suit}${card.value}`));
      }
    }
  }
  return straights;
}

// 找连对（避免重复花色）
function findDoubleStraights(hand, usedCards) {
  const doubleStraights = [];
  for (let len = 4; len <= hand.length; len += 2) {
    for (let i = 0; i <= hand.length - len; i++) {
      const slice = hand.slice(i, i + len);
      if (isDoubleStraightFast(slice) && !hasRepeatedSuit(slice) && !hasUsedCards(slice, usedCards)) {
        doubleStraights.push(slice);
        slice.forEach(card => usedCards.add(`${card.suit}${card.value}`));
      }
    }
  }
  return doubleStraights;
}

// 找对子（避免重复花色）
function findPairs(hand, usedCards) {
  const pairs = [];
  for (let i = 0; i < hand.length - 1; i++) {
    if (hand[i].value === hand[i + 1].value && !hasUsedCards([hand[i], hand[i + 1]], usedCards)) {
      pairs.push([hand[i], hand[i + 1]]);
      usedCards.add(`${hand[i].suit}${hand[i].value}`);
      usedCards.add(`${hand[i + 1].suit}${hand[i + 1].value}`);
    }
  }
  return pairs;
}

// 找单牌
function findSingles(hand, usedCards) {
  const singles = [];
  for (const card of hand) {
    if (!hasUsedCards([card], usedCards)) {
      singles.push([card]);
      usedCards.add(`${card.suit}${card.value}`);
    }
  }
  return singles;
}

// 找三张（轰）
function findTriples(hand, usedCards) {
  const triples = [];
  for (let i = 0; i < hand.length - 2; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value && 
        !hasUsedCards([hand[i], hand[i + 1], hand[i + 2]], usedCards)) {
      triples.push([hand[i], hand[i + 1], hand[i + 2]]);
      usedCards.add(`${hand[i].suit}${hand[i].value}`);
      usedCards.add(`${hand[i + 1].suit}${hand[i + 1].value}`);
      usedCards.add(`${hand[i + 2].suit}${hand[i + 2].value}`);
    }
  }
  return triples;
}

// 找炸弹
function findBombs(hand, usedCards) {
  const bombs = [];
  for (let i = 0; i < hand.length - 3; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value && 
        hand[i].value === hand[i + 3].value && !hasUsedCards([hand[i], hand[i + 1], hand[i + 2], hand[i + 3]], usedCards)) {
      bombs.push([hand[i], hand[i + 1], hand[i + 2], hand[i + 3]]);
      usedCards.add(`${hand[i].suit}${hand[i].value}`);
      usedCards.add(`${hand[i + 1].suit}${hand[i + 1].value}`);
      usedCards.add(`${hand[i + 2].suit}${hand[i + 2].value}`);
      usedCards.add(`${hand[i + 3].suit}${hand[i + 3].value}`);
    }
  }
  return bombs;
}

// 新增：允许拆顺子压制
function findSplittableStraightToBeat(lastCards, hand) {
  // lastCards是顺子，hand是已排序手牌
  const neededLen = lastCards.length;
  // 枚举所有长度为neededLen的组合
  for (let i = 0; i <= hand.length - neededLen; i++) {
    const slice = hand.slice(i, i + neededLen);
    if (isStraightFast(slice) && isValidPlay(slice, lastCards)) {
      return slice;
    }
  }
  // 如果直接切片找不到，尝试所有组合
  // 生成所有长度为neededLen的组合
  const allCombos = getAllStraightCombos(hand, neededLen);
  for (const combo of allCombos) {
    if (isValidPlay(combo, lastCards)) {
      return combo;
    }
  }
  return null;
}
// 枚举所有长度为len的顺子组合
function getAllStraightCombos(hand, len) {
  const results = [];
  // 用递归枚举所有组合
  function dfs(path, start) {
    if (path.length === len) {
      if (isStraightFast(path)) results.push([...path]);
      return;
    }
    for (let i = start; i < hand.length; i++) {
      // 不允许同点数重复
      if (path.length > 0 && hand[i].value === path[path.length - 1].value) continue;
      path.push(hand[i]);
      dfs(path, i + 1);
      path.pop();
    }
  }
  dfs([], 0);
  return results;
}

// 新增：允许拆连对压制
function findSplittableDoubleStraightToBeat(lastCards, hand) {
  // lastCards是连对，hand是已排序手牌
  const neededLen = lastCards.length;
  // 枚举所有长度为neededLen的组合
  for (let i = 0; i <= hand.length - neededLen; i++) {
    const slice = hand.slice(i, i + neededLen);
    if (isDoubleStraightFast(slice) && isValidPlay(slice, lastCards)) {
      return slice;
    }
  }
  // 如果直接切片找不到，尝试所有组合
  // 生成所有长度为neededLen的组合
  const allCombos = getAllDoubleStraightCombos(hand, neededLen);
  for (const combo of allCombos) {
    if (isValidPlay(combo, lastCards)) {
      return combo;
    }
  }
  return null;
}
// 枚举所有长度为len的连对组合
function getAllDoubleStraightCombos(hand, len) {
  const results = [];
  // 用递归枚举所有组合
  function dfs(path, start) {
    if (path.length === len) {
      if (isDoubleStraightFast(path)) results.push([...path]);
      return;
    }
    for (let i = start; i < hand.length; i++) {
      // 必须成对加入
      if (i + 1 < hand.length && hand[i].value === hand[i + 1].value) {
        // 不允许同点数重复
        if (path.length > 0 && hand[i].value === path[path.length - 1].value) continue;
        path.push(hand[i], hand[i + 1]);
        dfs(path, i + 2);
        path.pop();
        path.pop();
      }
    }
  }
  dfs([], 0);
  return results;
}

// 新增：主动拆三张/四张组成顺子或连对
function findSplitTripleOrBombForStraightOrDoubleStraight(hand) {
  // 1. 找所有三张和四张组合
  const triples = [];
  const bombs = [];
  for (let i = 0; i < hand.length - 2; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value) {
      triples.push([hand[i], hand[i + 1], hand[i + 2]]);
    }
  }
  for (let i = 0; i < hand.length - 3; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value && hand[i].value === hand[i + 3].value) {
      bombs.push([hand[i], hand[i + 1], hand[i + 2], hand[i + 3]]);
    }
  }
  // 2. 尝试拆三张或四张，组成顺子
  // 枚举所有三张/四张的拆分方式
  for (const group of [...triples, ...bombs]) {
    // 拆出单张
    for (let mask = 1; mask < (1 << group.length) - 1; mask++) {
      // mask表示拆出哪些牌
      const left = [];
      const removed = [];
      let used = new Array(hand.length).fill(false);
      // 标记group中被拆的牌
      for (let j = 0, k = 0; j < hand.length; j++) {
        if (k < group.length && hand[j] === group[k]) {
          if (mask & (1 << k)) {
            removed.push(hand[j]);
            used[j] = true;
          } else {
            left.push(hand[j]);
          }
          k++;
        } else if (!used[j]) {
          left.push(hand[j]);
        }
      }
      // 尝试用removed和left组成顺子
      const tryHand = [...removed, ...left];
      // 枚举所有长度>=3的顺子
      for (let len = 3; len <= tryHand.length; len++) {
        for (let i = 0; i <= tryHand.length - len; i++) {
          const slice = tryHand.slice(i, i + len);
          if (isStraightFast(slice)) {
            // 拆后能组成顺子，返回该顺子
            return slice;
          }
        }
      }
      // 尝试用removed和left组成连对
      for (let len = 4; len <= tryHand.length; len += 2) {
        for (let i = 0; i <= tryHand.length - len; i++) {
          const slice = tryHand.slice(i, i + len);
          if (isDoubleStraightFast(slice)) {
            // 拆后能组成连对，返回该连对
            return slice;
          }
        }
      }
    }
  }
  return null;
}

// 检查是否有重复花色
function hasRepeatedSuit(cards) {
  const suits = new Set();
  for (const card of cards) {
    if (suits.has(card.suit)) return true;
    suits.add(card.suit);
  }
  return false;
}

// 检查是否包含已使用的牌
function hasUsedCards(cards, usedCards) {
  for (const card of cards) {
    if (usedCards.has(`${card.suit}${card.value}`)) return true;
  }
  return false;
}

// 快速顺子判断（假设已排序）
function isStraightFast(cards) {
  if (cards.length < 3) return false;
  for (let i = 1; i < cards.length; i++) {
    // K后面只能接A
    if (cards[i - 1].value === 'K' && cards[i].value !== 'A') return false;
    // 允许K-A，但不允许A-2、A-3、A-5
    if (
      !(cards[i - 1].value === 'K' && cards[i].value === 'A') &&
      (cards[i].value.charCodeAt(0) - cards[i - 1].value.charCodeAt(0) !== 1)
    ) {
      return false;
    }
    if (cards[i].value === cards[i - 1].value) return false;
  }
  return true;
}

// 快速连对判断（假设已排序）
function isDoubleStraightFast(cards) {
  if (cards.length < 4 || cards.length % 2 !== 0) return false;
  for (let i = 0; i < cards.length; i += 2) {
    if (cards[i].value !== cards[i + 1].value) return false;
    if (i > 0) {
      // K后面只能接A
      if (cards[i - 2].value === 'K' && cards[i].value !== 'A') return false;
      if (
        !(cards[i - 2].value === 'K' && cards[i].value === 'A') &&
        (cards[i].value.charCodeAt(0) - cards[i - 2].value.charCodeAt(0) !== 1)
      ) {
        return false;
      }
    }
  }
  return true;
}

// 判断是否为长顺子（5个以上）
function isLongStraight(cards) {
  return isStraightFast(cards) && cards.length >= 5;
}

// 判断是否为长连对（6个以上）
function isLongDoubleStraight(cards) {
  return isDoubleStraightFast(cards) && cards.length >= 6;
}

/**
 * 根据黑桃5和出牌历史动态推断队友
 * @param {number} playerIndex - 当前AI索引
 * @param {Array} players - 所有玩家
 * @param {Array} historyPlays - 出牌历史（含cards）
 * @returns {Array} teammateIndexes
 */
function getTeammateIndexesWithSpade5(playerIndex, players, historyPlays) {
  // 1. 检查黑桃5是否已被打出
  let spade5Owner = null;
  for (let i = 0; i < players.length; i++) {
    if (players[i].hand.some(card => card.suit === '♠' && card.value === '5')) {
      spade5Owner = i;
      break;
    }
  }
  // 2. 检查出牌历史
  if (spade5Owner === null && historyPlays && historyPlays.length) {
    for (const play of historyPlays) {
      if (play.cards && play.cards.some(card => card.suit === '♠' && card.value === '5')) {
        // 找到打出黑桃5的玩家
        spade5Owner = players.findIndex(p => p.name === play.name);
        break;
      }
    }
  }
  // 3. 如果能确定黑桃5持有者
  if (spade5Owner !== null) {
    // 庄家和黑桃5持有者为一队
    const teammateIndexes = players
      .map((p, idx) => idx)
      .filter(idx => (players[idx].isBanker || idx === spade5Owner) && idx !== playerIndex);
    return teammateIndexes;
  }
  // 4. 否则，无法确定队友
  return [];
}

// 获取下一个玩家索引
function getNextPlayerIndex(currentIndex, totalPlayers) {
  return (currentIndex + 1) % totalPlayers;
}


import { isValidPlay, sortCards } from './rules';
import { CARD_ORDER, SUITS } from './core';
function getPlayedCards(historyPlays, myHand = []) {
  const played = [];
  for (const play of historyPlays) {
    if (play.cards && play.cards.length) {
      played.push(...play.cards);
    }
  }
  if (myHand && myHand.length) played.push(...myHand);
  return played;
}

/**
 * 推断场上尚未出现的牌（全牌库减已出牌和自己手牌）。
 */
function getRemainingCards(myHand, historyPlays) {
  const values = CARD_ORDER;
  const allCards = [];
  for (const suit of SUITS) for (const value of values) allCards.push({ suit, value });
  const played = getPlayedCards(historyPlays, myHand);
  const playedSet = new Set(played.map(c => `${c.suit}${c.value}`));
  return allCards.filter(c => !playedSet.has(`${c.suit}${c.value}`));
}

/** 选择最小的单张（按 CARD_ORDER 排序） */
function selectSmallestSingle(singles) {
  if (!singles || singles.length === 0) return null;
  return singles.slice().sort((a, b) => CARD_ORDER.indexOf(a[0].value) - CARD_ORDER.indexOf(b[0].value))[0];
}

/** 选择最小的对子 */
function selectSmallestPair(pairs) {
  if (!pairs || pairs.length === 0) return null;
  return pairs.slice().sort((a, b) => CARD_ORDER.indexOf(a[0].value) - CARD_ORDER.indexOf(b[0].value))[0];
}

/** 选择最小的顺子/连对（优先较短，再优先起始点较小） */
function selectSmallestStraight(list) {
  if (!list || list.length === 0) return null;
  return list.slice().sort((A, B) => (A.length - B.length) || (CARD_ORDER.indexOf(A[0].value) - CARD_ORDER.indexOf(B[0].value)))[0];
}

/** 更智能的 AI 出牌策略（已禁用拆顺/拆连对/拆三炸行为） */
export function aiPlay(hand, lastCards = [], playNumber, players = [], playerIndex = 0, historyPlays = []) {
  let style = 'normal';
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

  if (teammateIndexes.some(idx => players[idx].hand.length <= 2)) style = 'team';
  else if (hand.length <= 5 || nextPlayerHandCount <= 2) style = 'aggressive';
  else if (round <= 3) style = 'conservative';

  const remainingCards = getRemainingCards(hand, historyPlays);
  const keyValues = ['2', 'A', '5', '3'];
  const keyCount = { '2': 0, 'A': 0, '5': 0, '3': 0, bomb: 0, triple: 0 };
  for (const c of remainingCards) if (keyValues.includes(c.value)) keyCount[c.value]++;
  const valueMap = {};
  for (const c of remainingCards) valueMap[c.value] = (valueMap[c.value] || 0) + 1;
  for (const v in valueMap) {
    if (valueMap[v] >= 4) keyCount.bomb++;
    else if (valueMap[v] >= 3) keyCount.triple++;
  }

  const combos = getOptimalCombos(sorted, round, hand.length);
  const triples = combos.filter(c => c.length === 3 && isTriple(c));
  const bombs = combos.filter(c => c.length === 4 && isBomb(c));
  const straights = combos.filter(c => c.length >= 3 && isStraightFast(c));
  const doubleStraights = combos.filter(c => c.length >= 4 && isDoubleStraightFast(c));
  const pairs = combos.filter(c => c.length === 2 && isPair(c));
  const singles = combos.filter(c => c.length === 1);

  let wonLastTurn = false;
  let lastNonEmptyPlay = null;
  if (historyPlays && historyPlays.length) {
    for (let i = historyPlays.length - 1; i >= 0; i--) {
      const p = historyPlays[i];
      if (p && p.cards && p.cards.length) { lastNonEmptyPlay = p; break; }
    }
    if (lastNonEmptyPlay) {
      const ownerMatches = (idx) => {
        if (!lastNonEmptyPlay) return false;
        if (typeof lastNonEmptyPlay.playerIndex === 'number') return lastNonEmptyPlay.playerIndex === idx;
        if (lastNonEmptyPlay.name && players && players[idx]) return lastNonEmptyPlay.name === players[idx].name;
        return false;
      };
      if (ownerMatches(playerIndex)) {
        let foundLaterNonEmpty = false;
        for (let j = historyPlays.indexOf(lastNonEmptyPlay) + 1; j < historyPlays.length; j++) {
          const p2 = historyPlays[j];
          if (p2 && p2.cards && p2.cards.length) { foundLaterNonEmpty = true; break; }
        }
        if (!foundLaterNonEmpty) wonLastTurn = true;
      }
    }
  }

  let safeStraights = straights, safeDoubleStraights = doubleStraights, safePairs = pairs, safeSingles = singles, safeTriples = triples;
  if (wonLastTurn && lastNonEmptyPlay && lastNonEmptyPlay.cards) {
    const avoidPlay = lastNonEmptyPlay.cards;
    const avoidIfBeats = (arr) => arr.filter(a => !isValidPlay(a, avoidPlay));
    safeStraights = avoidIfBeats(straights);
    safeDoubleStraights = avoidIfBeats(doubleStraights);
    safePairs = avoidIfBeats(pairs);
    safeSingles = avoidIfBeats(singles);
    safeTriples = avoidIfBeats(triples);
  }

  // team
  if (style === 'team') {
    if (lastCards && lastCards.length > 0 && prevPlayerIsTeammate && prevPlayerHandCount <= 2) return [];
    if (wonLastTurn && (!lastCards || lastCards.length === 0)) {
      const s = selectSmallestSingle(singles); if (s) return s;
      const p = selectSmallestPair(pairs); if (p) return p;
      const st = selectSmallestStraight(straights); if (st) return st;
      const ds = selectSmallestStraight(doubleStraights); if (ds) return ds;
    }
    const teamSafeSingles = (wonLastTurn ? safeSingles : singles).filter(s => !['2', 'A'].includes(s[0].value));
    if (teamSafeSingles.length > 0) return teamSafeSingles[0];
    const teamSafePairs = (wonLastTurn ? safePairs : pairs).filter(p => !['2', 'A'].includes(p[0].value));
    if (teamSafePairs.length > 0) return teamSafePairs[0];
    const teamSafeStraights = (wonLastTurn ? safeStraights : straights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
    if (teamSafeStraights.length > 0) return teamSafeStraights[0];
    const teamSafeDoubleStraights = (wonLastTurn ? safeDoubleStraights : doubleStraights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
    if (teamSafeDoubleStraights.length > 0) return teamSafeDoubleStraights[0];
    const teamSafeTriples = (wonLastTurn ? safeTriples : triples).filter(arr => !['2', 'A'].includes(arr[0].value));
    if (teamSafeTriples.length > 0) return teamSafeTriples[0];
    if (bombs.length > 0) return bombs[0];
    return [sorted[0]];
  }

  // aggressive
  if (style === 'aggressive') {
    if (lastCards && lastCards.length > 0) {
      for (let i = combos.length - 1; i >= 0; i--) if (isValidPlay(combos[i], lastCards)) return combos[i];
      return [];
    }
    if (wonLastTurn && (!lastCards || lastCards.length === 0)) {
      const s = selectSmallestSingle(singles); if (s) return s;
      const p = selectSmallestPair(pairs); if (p) return p;
      const st = selectSmallestStraight(straights); if (st) return st;
      const ds = selectSmallestStraight(doubleStraights); if (ds) return ds;
    }
    const aggrSafeStraights = (wonLastTurn ? safeStraights : straights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
    if (aggrSafeStraights.length > 0) return aggrSafeStraights[0];
    const aggrSafeDoubleStraights = (wonLastTurn ? safeDoubleStraights : doubleStraights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
    if (aggrSafeDoubleStraights.length > 0) return aggrSafeDoubleStraights[0];
    const aggrSafeTriples = (wonLastTurn ? safeTriples : triples).filter(arr => !['2', 'A'].includes(arr[0].value));
    if (aggrSafeTriples.length > 0) return aggrSafeTriples[0];
    const aggrSafePairs = (wonLastTurn ? safePairs : pairs).filter(p => !['2', 'A'].includes(p[0].value));
    if (aggrSafePairs.length > 0) return aggrSafePairs[0];
    const aggrSafeSingles = (wonLastTurn ? safeSingles : singles).filter(s => !['2', 'A'].includes(s[0].value));
    if (aggrSafeSingles.length > 0) return aggrSafeSingles[0];
    if (bombs.length > 0) return bombs[0];
    return [sorted[0]];
  }

  // lastCards present
  if (lastCards && lastCards.length > 0) {
    for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
    if (isTriple(lastCards)) {
      if (round <= 3) {
        for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
        return [];
      }
      for (const t of triples) if (isValidPlay(t, lastCards)) return t;
      for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
      return [];
    }
    if (isLongStraight(lastCards) || isLongDoubleStraight(lastCards)) {
      if (round <= 3) {
        for (const t of triples) if (isValidPlay(t, lastCards)) return t;
        for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
      }
    }
    if (isStraightFast(lastCards)) {
      for (const s of (wonLastTurn ? safeStraights : straights)) if (isValidPlay(s, lastCards)) return s;
      for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
      return [];
    }
    if (isDoubleStraightFast(lastCards)) {
      for (const ds of (wonLastTurn ? safeDoubleStraights : doubleStraights)) if (isValidPlay(ds, lastCards)) return ds;
      for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
      return [];
    }
    for (const c of combos) {
      if (!isBomb(c) && !isTriple(c) && isValidPlay(c, lastCards)) {
        if (!wouldBreakOptimalCombo(c, sorted, combos)) {
          if (c.length === 1 || c.length === 2) return c;
        }
      }
    }
    for (const c of combos) {
      if (!isBomb(c) && isValidPlay(c, lastCards)) {
        if (!wouldBreakOptimalCombo(c, sorted, combos)) return c;
      }
    }
    for (const c of combos) if (isValidPlay(c, lastCards)) return c;
    return [];
  }

  // conservative / normal when no lastCards
  if (style === 'conservative' || style === 'normal') {
    if (lastCards && lastCards.length > 0) {
      for (const c of combos) if (isValidPlay(c, lastCards)) return c;
      return [];
    }
    if (hand.length > 5) {
      if (wonLastTurn && (!lastCards || lastCards.length === 0)) {
        const s = selectSmallestSingle(singles); if (s) return s;
        const p = selectSmallestPair(pairs); if (p) return p;
        const st = selectSmallestStraight(straights); if (st) return st;
        const ds = selectSmallestStraight(doubleStraights); if (ds) return ds;
      }
      if (keyCount['2'] > 0 && singles.length > 0) {
        const non2 = singles.find(s => s[0].value !== '2'); if (non2) return non2;
      }
      if (keyCount['A'] > 0 && singles.length > 0) {
        const nonA = singles.find(s => s[0].value !== 'A'); if (nonA) return nonA;
      }
      if (keyCount.bomb > 0 && bombs.length > 0) {
        const nonBomb = singles.length > 0 ? singles[0] : null; if (nonBomb) return nonBomb;
      }
      if (pairs.length > 0) return pairs[0];
      if (straights.length > 0) return straights[0];
      if (doubleStraights.length > 0) return doubleStraights[0];
      if (singles.length > 0) return singles[0];
      if (triples.length > 0) return triples[0];
      if (bombs.length > 0) return bombs[0];
      return [sorted[0]];
    } else {
      if (singles.length > 0) return singles[0];
      if (pairs.length > 0) return pairs[0];
      if (triples.length > 0) return triples[0];
      if (straights.length > 0) return straights[0];
      if (doubleStraights.length > 0) return doubleStraights[0];
      if (bombs.length > 0) return bombs[0];
      return [sorted[0]];
    }
  }
}

/** 判断是否为炸弹。 */
function isBomb(cards) { return cards.length === 4 && cards.every(c => c.value === cards[0].value); }
/** 判断是否为三张。 */
function isTriple(cards) { return cards.length === 3 && cards.every(c => c.value === cards[0].value); }
/** 判断是否为对子。 */
function isPair(cards) { return cards.length === 2 && cards[0].value === cards[1].value; }

/** 判断是否会拆分最优组合。 */
function wouldBreakOptimalCombo(combo, hand, optimalCombos) {
  for (const optimal of optimalCombos) {
    if (optimal.some(card => combo.includes(card)) && !arraysEqual(optimal, combo)) return true;
  }
  return false;
}

/** 判断两个数组元素是否逐一相等（严格相等）。 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** 生成最优的出牌组合列表。 */
function getOptimalCombos(hand, round, handSize) {
  const combos = [];
  const usedCards = new Set();
  const bombs = findBombs(hand, usedCards);
  bombs.forEach(b => b.forEach(card => usedCards.add(`${card.suit}${card.value}`)));
  const triples = findTriples(hand, usedCards);
  triples.forEach(t => t.forEach(card => usedCards.add(`${card.suit}${card.value}`)));
  const straights = findStraights(hand, usedCards);
  straights.forEach(s => s.forEach(card => usedCards.add(`${card.suit}${card.value}`)));
  const doubleStraights = findDoubleStraights(hand, usedCards);
  doubleStraights.forEach(ds => ds.forEach(card => usedCards.add(`${card.suit}${card.value}`)));
  const pairs = findPairs(hand, usedCards);
  pairs.forEach(p => p.forEach(card => usedCards.add(`${card.suit}${card.value}`)));
  const singles = findSingles(hand, usedCards);
  singles.forEach(s => s.forEach(card => usedCards.add(`${card.suit}${card.value}`)));
  combos.push(...straights, ...doubleStraights, ...pairs, ...singles);
  if (round > 3 || handSize <= 5) combos.push(...triples, ...bombs);
  return combos;
}

/** 找顺子（避免重复花色）。 */
function findStraights(hand, usedCards) {
  const straights = [];
  for (let len = 3; len <= hand.length; len++) {
    for (let i = 0; i <= hand.length - len; i++) {
      const slice = hand.slice(i, i + len);
      if (isStraightFast(slice) && !hasRepeatedSuit(slice) && !hasUsedCards(slice, usedCards)) {
        straights.push(slice);
        slice.forEach(card => usedCards.add(`${card.suit}${card.value}`));
      }
    }
  }
  return straights;
}

/** 找连对（避免重复花色）。 */
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

/** 找对子（避免重复花色）。 */
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

/** 找单牌。 */
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

/** 找三张（轰）。 */
function findTriples(hand, usedCards) {
  const triples = [];
  for (let i = 0; i < hand.length - 2; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value && !hasUsedCards([hand[i], hand[i + 1], hand[i + 2]], usedCards)) {
      triples.push([hand[i], hand[i + 1], hand[i + 2]]);
      usedCards.add(`${hand[i].suit}${hand[i].value}`);
      usedCards.add(`${hand[i + 1].suit}${hand[i + 1].value}`);
      usedCards.add(`${hand[i + 2].suit}${hand[i + 2].value}`);
    }
  }
  return triples;
}

/** 找炸弹。 */
function findBombs(hand, usedCards) {
  const bombs = [];
  for (let i = 0; i < hand.length - 3; i++) {
    if (hand[i].value === hand[i + 1].value && hand[i].value === hand[i + 2].value && hand[i].value === hand[i + 3].value && !hasUsedCards([hand[i], hand[i + 1], hand[i + 2], hand[i + 3]], usedCards)) {
      bombs.push([hand[i], hand[i + 1], hand[i + 2], hand[i + 3]]);
      usedCards.add(`${hand[i].suit}${hand[i].value}`);
      usedCards.add(`${hand[i + 1].suit}${hand[i + 1].value}`);
      usedCards.add(`${hand[i + 2].suit}${hand[i + 2].value}`);
      usedCards.add(`${hand[i + 3].suit}${hand[i + 3].value}`);
    }
  }
  return bombs;
}

// 注：已移除拆分顺子/连对/拆三炸的函数，AI 不会主动拆这些组合。


/**
 * 检查是否存在重复花色。
 */
function hasRepeatedSuit(cards) {
  const suits = new Set();
  for (const card of cards) {
    if (suits.has(card.suit)) return true;
    suits.add(card.suit);
  }
  return false;
}

/**
 * 检查是否包含已使用的牌。
 */
function hasUsedCards(cards, usedCards) {
  for (const card of cards) {
    if (usedCards.has(`${card.suit}${card.value}`)) return true;
  }
  return false;
}

/**
 * 快速顺子判断（假设已排序）。
 */
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

/**
 * 快速连对判断（假设已排序）。
 */
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

/**
 * 判断是否为长顺子（5个及以上）。
 */
function isLongStraight(cards) {
  return isStraightFast(cards) && cards.length >= 5;
}

/**
 * 判断是否为长连对（6个及以上）。
 */
function isLongDoubleStraight(cards) {
  return isDoubleStraightFast(cards) && cards.length >= 6;
}

/**
 * 根据黑桃5与出牌历史动态推断队友索引。
 *
 * 逻辑：优先检查玩家手牌中是否持有黑桃5；若未找到再检查出牌历史中谁打出过黑桃5。
 * 已知黑桃5持有者与庄家为一队。
 *
 * @param {number} playerIndex - 当前 AI 的玩家索引
 * @param {Array<Object>} players - 所有玩家信息数组
 * @param {Array<Object>} historyPlays - 出牌历史（每项可含 cards、name 等）
 * @returns {Array<number>} 返回推断出的队友索引数组（若无法确定返回空数组）
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


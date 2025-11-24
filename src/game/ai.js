import { isValidPlay, sortCards, isStraight, isDoubleStraight, isBomb, isTriple, isPair } from './rules';
import { CARD_ORDER } from './card';

/**
 * 选择最小的单张（按 CARD_ORDER 排序）
 * @param {Array<Array<Object>>} singles 单牌候选集合
 * @returns {Array<Object>|null} 最小单张或 null
 */
function selectSmallestSingle(singles) {
  if (!singles || singles.length === 0) return null;
  return singles.slice().sort((a, b) => CARD_ORDER.indexOf(a[0].value) - CARD_ORDER.indexOf(b[0].value))[0];
}

/**
 * 选择最小的对子（按 CARD_ORDER 排序）
 * @param {Array<Array<Object>>} pairs 对子候选集合
 * @returns {Array<Object>|null} 最小对子或 null
 */
function selectSmallestPair(pairs) {
  if (!pairs || pairs.length === 0) return null;
  return pairs.slice().sort((a, b) => CARD_ORDER.indexOf(a[0].value) - CARD_ORDER.indexOf(b[0].value))[0];
}

/**
 * 选择最小的顺子/连对（优先较短，再优先起始点较小）
 * @param {Array<Array<Object>>} list 顺子或连对候选集合
 * @returns {Array<Object>|null} 最小组合或 null
 */
function selectSmallestStraight(list) {
  if (!list || list.length === 0) return null;
  return list.slice().sort((A, B) => (A.length - B.length) || (CARD_ORDER.indexOf(A[0].value) - CARD_ORDER.indexOf(B[0].value)))[0];
}

/**
 * 依据当前轮次与玩家手牌/上下家情况，确定AI出牌风格
 * @param {Array} hand 当前手牌
 * @param {Array} players 所有玩家信息
 * @param {number} playerIndex 当前玩家索引
 * @param {number} playNumber 出牌序号
 * @param {Array} historyPlays 历史出牌记录
 * @returns {{style:string, round:number, teammateIndexes:number[], nextPlayerIdx:number}}
 */
function getBasicContext(hand, handCounts, playerIndex, playNumber, historyPlays, isBankerList) {
  const round = playNumber % 4 + 1;
  const teammateIndexes = getTeammateIndexesWithSpade5(playerIndex, isBankerList, historyPlays, hand);
  const nextPlayerIdx = getNextPlayerIndex(playerIndex, handCounts.length || 4);
  return { round, teammateIndexes, nextPlayerIdx };
}

/**
 * 将候选组合拆分为不同类型的集合
 * @param {Array} sorted 排序后的手牌
 * @param {number} round 当前轮次
 * @param {number} handSize 手牌规模
 * @returns {{combos:Array,triples:Array,bombs:Array,straights:Array,doubleStraights:Array,pairs:Array,singles:Array}}
 */
function splitCombos(sorted, round, handSize) {
  const combos = getOptimalCombos(sorted, round, handSize);
  return {
    combos,
    triples: combos.filter(c => c.length === 3 && isTriple(c)),
    bombs: combos.filter(c => c.length === 4 && isBomb(c)),
    straights: combos.filter(c => c.length >= 3 && isStraightFast(c)),
    doubleStraights: combos.filter(c => c.length >= 4 && isDoubleStraightFast(c)),
    pairs: combos.filter(c => c.length === 2 && isPair(c)),
    singles: combos.filter(c => c.length === 1)
  };
}

/**
 * 获取上一轮是否由我赢下及最近一次非空出牌
 * @param {Array} historyPlays 历史出牌
 * @param {Array} players 玩家列表
 * @param {number} playerIndex 当前玩家索引
 * @returns {{wonLastTurn:boolean,lastNonEmptyPlay:Object|null}}
 */
function getLastNonEmptyPlay(historyPlays) {
  if (!historyPlays || historyPlays.length === 0) return null;
  for (let i = historyPlays.length - 1; i >= 0; i--) {
    const p = historyPlays[i];
    if (p && p.cards && p.cards.length) return p;
  }
  return null;
}

/**
 * team 风格的出牌选择
 * @returns {Array|null|[]} 返回要出的牌；null表示未选中
 */
function pickPlaySimple(params) {
  const { lastCards, lastOwnerIsTeammate, singles, pairs, straights, doubleStraights, bombs, triples, nextPlayerIdx, teammateIndexes, handCounts, sorted } = params;
  const nextIsTeammate = teammateIndexes && teammateIndexes.includes(nextPlayerIdx);
  const nextHandCount = handCounts[nextPlayerIdx] ?? 99;

  // 规则：若队友在下家且手牌≤2，尽量出最小牌让队友走；若桌面有牌则直接让出（不要）
  if (nextIsTeammate && typeof nextHandCount === 'number' && nextHandCount <= 2) {
    if (!lastCards || lastCards.length === 0) {
      const s = selectSmallestSingle(singles); if (s) return s;
      const p = selectSmallestPair(pairs); if (p) return p;
      return [sorted[0]];
    }
    return [];
  }

  // 规则：若上家是队友，优先使用小牌压制或顺子响应，避免动用轰/炸
  if (lastCards && lastCards.length > 0 && lastOwnerIsTeammate) {
    if (isPair(lastCards)) {
      for (const pr of pairs) if (isValidPlay(pr, lastCards)) return pr;
      return [];
    }
    if (lastCards && lastCards.length === 1) {
      for (const sg of singles) if (isValidPlay(sg, lastCards)) return sg;
      return [];
    }
    if (isStraightFast(lastCards)) {
      for (const st of straights) if (isValidPlay(st, lastCards)) return st;
      return [];
    }
    if (isDoubleStraightFast(lastCards)) {
      for (const ds of doubleStraights) if (isValidPlay(ds, lastCards)) return ds;
      return [];
    }
    return [];
  }

  // 常规：有桌面牌按同型优先响应（允许轰/炸）；无桌面牌按最小领出
  if (lastCards && lastCards.length > 0) {
    return respondWithLastCards({ lastCards, bombs, triples, straights, doubleStraights, singles, pairs, handLength: sorted.length });
  }
  const s = selectSmallestSingle(singles); if (s) return s;
  const p = selectSmallestPair(pairs); if (p) return p;
  const st = selectSmallestStraight(straights); if (st) return st;
  const ds = selectSmallestStraight(doubleStraights); if (ds) return ds;
  if (triples.length > 0) return triples[0];
  if (bombs.length > 0) return bombs[0];
  return [sorted[0]];
}

/**
 * 有桌面牌时的统一响应策略
 * @returns {Array|[]} 返回要出的牌或空
 */
function respondWithLastCards(params) {
  const { lastCards, bombs, triples, straights, doubleStraights, singles, pairs, handLength } = params;
  if (isBomb(lastCards)) {
    for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
    return [];
  }
  if (isTriple(lastCards)) {
    for (const t of triples) if (isValidPlay(t, lastCards)) return t;
    if (handLength <= 4) { for (const b of bombs) if (isValidPlay(b, lastCards)) return b; }
    return [];
  }
  if (isDoubleStraightFast(lastCards)) {
    for (const ds of doubleStraights) if (isValidPlay(ds, lastCards)) return ds;
    return [];
  }
  if (isStraightFast(lastCards)) {
    for (const s of straights) if (isValidPlay(s, lastCards)) return s;
    return [];
  }
  if (isPair(lastCards)) {
    for (const p of pairs) if (isValidPlay(p, lastCards)) return p;
    return [];
  }
  if (lastCards && lastCards.length === 1) {
    for (const s of singles) if (isValidPlay(s, lastCards)) return s;
    return [];
  }
  return [];
}

/**
 * 智能的 AI 出牌策略
 * @param {Array} hand - 当前手牌
 * @param {Array} lastCards - 上一手牌
 * @param {number} playNumber - 当前出牌轮数
 * @param {Array} players - 所有玩家信息
 * @param {number} playerIndex - 当前玩家索引
 * @param {Array} historyPlays - 历史出牌记录
 * @returns {Array} 最佳出牌
 */
export function aiPlay(hand, lastCards = [], playNumber, playerIndex = 0, historyPlays = [], handCounts = [], isBankerList = []) {
  const { round, teammateIndexes, nextPlayerIdx } = getBasicContext(hand, handCounts, playerIndex, playNumber, historyPlays, isBankerList);
  if (!hand || hand.length === 0) return [];
  const sorted = sortCards(hand);
  const { triples, bombs, straights, doubleStraights, pairs, singles } = splitCombos(sorted, round, hand.length);
  const lastNonEmptyPlay = getLastNonEmptyPlay(historyPlays);
  let lastOwnerIdx = -1;
  if (lastNonEmptyPlay && typeof lastNonEmptyPlay.playerIndex === 'number') lastOwnerIdx = lastNonEmptyPlay.playerIndex;
  const lastOwnerIsTeammate = teammateIndexes.includes(lastOwnerIdx);

  const pick = pickPlaySimple({ lastCards, lastOwnerIsTeammate, singles, pairs, straights, doubleStraights, bombs, triples, nextPlayerIdx, teammateIndexes, handCounts, sorted });
  if (pick) return pick;
  return [sorted[0]];
}

/**
 * 生成最优的出牌组合列表。
 * 策略：优先抽取顺子/连对/对/单，必要时（后期或小牌阶段）再加入轰/炸。
 * @param {Array<Object>} hand 已排序的手牌
 * @param {number} round 当前回合数（1-4）
 * @param {number} handSize 手牌数量
 * @returns {Array<Array<Object>>} 候选组合列表
 */
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

/**
 * 找顺子（避免重复花色与重复使用）。
 * @param {Array<Object>} hand 已排序的手牌
 * @param {Set<string>} usedCards 已占用牌集合（suit+value）
 * @returns {Array<Array<Object>>}
 */
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

/**
 * 找连对（避免重复花色与重复使用）。
 * @param {Array<Object>} hand
 * @param {Set<string>} usedCards
 * @returns {Array<Array<Object>>}
 */
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

/**
 * 找对子（避免重复使用）。
 * @param {Array<Object>} hand
 * @param {Set<string>} usedCards
 * @returns {Array<Array<Object>>}
 */
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

/**
 * 找单牌（避免重复使用）。
 * @param {Array<Object>} hand
 * @param {Set<string>} usedCards
 * @returns {Array<Array<Object>>}
 */
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

/**
 * 找三张（轰，避免重复使用）。
 * @param {Array<Object>} hand
 * @param {Set<string>} usedCards
 * @returns {Array<Array<Object>>}
 */
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

/**
 * 找炸弹（避免重复使用）。
 * @param {Array<Object>} hand
 * @param {Set<string>} usedCards
 * @returns {Array<Array<Object>>}
 */
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

/**
 * 检查是否存在重复花色。
 * @param {Array<Object>} cards
 * @returns {boolean}
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
 * @param {Array<Object>} cards
 * @param {Set<string>} usedCards
 * @returns {boolean}
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
function isStraightFast(cards) { return isStraight(cards); }

/**
 * 快速连对判断（假设已排序）。
 */
function isDoubleStraightFast(cards) { return isDoubleStraight(cards); }

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
function getTeammateIndexesWithSpade5(playerIndex, isBankerList, historyPlays, myHand) {
  let spade5Owner = null;
  if (Array.isArray(myHand) && myHand.some(card => card && card.suit === '♠' && card.value === '5')) spade5Owner = playerIndex;
  if (spade5Owner === null && historyPlays && historyPlays.length) {
    for (const play of historyPlays) {
      if (play.cards && play.cards.some(card => card.suit === '♠' && card.value === '5')) {
        if (typeof play.playerIndex === 'number') spade5Owner = play.playerIndex;
        break;
      }
    }
  }
  if (spade5Owner !== null) {
    const teammateIndexes = isBankerList
      .map((flag, idx) => idx)
      .filter(idx => (isBankerList[idx] || idx === spade5Owner) && idx !== playerIndex);
    return teammateIndexes;
  }
  return isBankerList
    .map((flag, idx) => idx)
    .filter(idx => isBankerList[idx] && idx !== playerIndex);
}

// 获取下一个玩家索引
function getNextPlayerIndex(currentIndex, totalPlayers) {
  return (currentIndex + 1) % totalPlayers;
}



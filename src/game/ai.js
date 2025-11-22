import { isValidPlay, sortCards, isStraight, isDoubleStraight, isBomb, isTriple, isPair } from './rules';
import { CARD_ORDER, SUITS } from './card';

/**
 * 汇总“已知的已出现牌”：历史中所有非空出牌 + 自己当前手牌。
 * 作用：为推断剩余牌和记牌统计提供基础集合。
 * @param {Array<Object>} historyPlays 历史出牌记录（含每次 play 的 cards）
 * @param {Array<Object>} [myHand=[]] 我的手牌
 * @returns {Array<Object>} 已出现的牌列表
 */
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
function determineStyle(hand, handCounts, playerIndex, playNumber, historyPlays, isBankerList) {
  const round = playNumber % 4 + 1;
  const teammateIndexes = getTeammateIndexesWithSpade5(playerIndex, isBankerList, historyPlays);
  const nextPlayerIdx = getNextPlayerIndex(playerIndex, handCounts.length || 4);
  const nextPlayerHandCount = handCounts[nextPlayerIdx] ?? 99;
  let style = 'normal';
  if (teammateIndexes.some(idx => (handCounts[idx] ?? 99) <= 2)) style = 'team';
  else if (hand.length <= 5 || nextPlayerHandCount <= 2) style = 'aggressive';
  else if (round <= 3) style = 'conservative';
  return { style, round, teammateIndexes, nextPlayerIdx };
}

/**
 * 统计关键牌与潜在炸/轰数量
 * @param {Array} remainingCards 尚未出现的牌
 * @returns {{'2':number,'A':number,'5':number,'3':number,bomb:number,triple:number}}
 */
function computeKeyCount(remainingCards) {
  const keyValues = ['2', 'A', '5', '3'];
  const keyCount = { '2': 0, 'A': 0, '5': 0, '3': 0, bomb: 0, triple: 0 };
  for (const c of remainingCards) if (keyValues.includes(c.value)) keyCount[c.value]++;
  const valueMap = {};
  for (const c of remainingCards) valueMap[c.value] = (valueMap[c.value] || 0) + 1;
  for (const v in valueMap) {
    if (valueMap[v] >= 4) keyCount.bomb++;
    else if (valueMap[v] >= 3) keyCount.triple++;
  }
  return keyCount;
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
function getLastTurnInfo(historyPlays, playerIndex) {
  let wonLastTurn = false;
  let lastNonEmptyPlay = null;
  if (historyPlays && historyPlays.length) {
    for (let i = historyPlays.length - 1; i >= 0; i--) {
      const p = historyPlays[i];
      if (p && p.cards && p.cards.length) { lastNonEmptyPlay = p; break; }
    }
    if (lastNonEmptyPlay) {
      if (typeof lastNonEmptyPlay.playerIndex === 'number' && lastNonEmptyPlay.playerIndex === playerIndex) {
        let foundLaterNonEmpty = false;
        for (let j = historyPlays.indexOf(lastNonEmptyPlay) + 1; j < historyPlays.length; j++) {
          const p2 = historyPlays[j];
          if (p2 && p2.cards && p2.cards.length) { foundLaterNonEmpty = true; break; }
        }
        if (!foundLaterNonEmpty) wonLastTurn = true;
      }
    }
  }
  return { wonLastTurn, lastNonEmptyPlay };
}

/**
 * 在赢下上一轮时，基于最近出牌计算“安全集合”
 * @param {boolean} wonLastTurn 是否赢下上一轮
 * @param {Object|null} lastNonEmptyPlay 最近一次非空出牌
 * @param {{straights:Array,doubleStraights:Array,pairs:Array,singles:Array,triples:Array}} sets 原集合
 * @returns 同结构的安全集合
 */
function safeSets(wonLastTurn, lastNonEmptyPlay, sets) {
  let { straights, doubleStraights, pairs, singles, triples } = sets;
  if (wonLastTurn && lastNonEmptyPlay && lastNonEmptyPlay.cards) {
    const avoidPlay = lastNonEmptyPlay.cards;
    const avoidIfBeats = (arr) => arr.filter(a => !isValidPlay(a, avoidPlay));
    straights = avoidIfBeats(straights);
    doubleStraights = avoidIfBeats(doubleStraights);
    pairs = avoidIfBeats(pairs);
    singles = avoidIfBeats(singles);
    triples = avoidIfBeats(triples);
  }
  return { straights, doubleStraights, pairs, singles, triples };
}

/**
 * 判定下家是否构成“威胁”，用于 team 风格的保护性接力决策。
 * 规则：
 * - 若下家是队友：不构成威胁；
 * - 若下家手牌≤2：直接视为威胁；
 * - 若桌面顶牌对应点数在其他玩家处仍有剩余：存在被轻易压制的风险。
 * @param {Array<Object>} players 所有玩家
 * @param {number} nextPlayerIdx 下家索引
 * @param {Array<Object>} lastCards 桌面最近一次非空出牌
 * @param {Array<number>} teammateIndexes 队友索引列表
 * @returns {boolean} 是否存在威胁
 */
function isOpponentThreat(handCounts, nextPlayerIdx, lastCards, teammateIndexes, remainingCards) {
  const nextIsTeammate = teammateIndexes && teammateIndexes.includes(nextPlayerIdx);
  if (nextIsTeammate) return false;
  const nextCount = handCounts[nextPlayerIdx] ?? 99;
  if (typeof nextCount === 'number' && nextCount <= 2) return true;
  if (!lastCards || lastCards.length === 0) return false;
  const top = lastCards[lastCards.length - 1] || lastCards[0];
  if (!top || !top.value) return false;
  const leftCount = remainingCards.filter(c => c.value === top.value).length;
  return leftCount > 0;
}

/**
 * team 风格的出牌选择
 * @returns {Array|null|[]} 返回要出的牌；null表示未选中
 */
function pickTeamPlay(params) {
  const { lastCards, lastOwnerIsTeammate, lastOwnerHandCount, wonLastTurn, singles, pairs, straights, doubleStraights, bombs, triples, safe, nextPlayerIdx, round, combos, sorted, teammateIndexes, handCounts, remainingCards } = params;
  if (lastCards && lastCards.length > 0 && lastOwnerIsTeammate && lastOwnerHandCount <= 2) {
    const threat = isOpponentThreat(handCounts, nextPlayerIdx, lastCards, teammateIndexes, remainingCards);
    if (threat) {
      const protect = respondWithLastCards({ lastCards, bombs, triples, straights, doubleStraights, combos, sorted, wonLastTurn, safe, round });
      if (protect && protect.length) return protect;
    }
    return [];
  }
  if (wonLastTurn && (!lastCards || lastCards.length === 0)) {
    const s = selectSmallestSingle(singles); if (s) return s;
    const p = selectSmallestPair(pairs); if (p) return p;
    const st = selectSmallestStraight(straights); if (st) return st;
    const ds = selectSmallestStraight(doubleStraights); if (ds) return ds;
  }
  const teamSafeSingles = (wonLastTurn ? safe.singles : singles).filter(s => !['2', 'A'].includes(s[0].value));
  if (teamSafeSingles.length > 0) return teamSafeSingles[0];
  const teamSafePairs = (wonLastTurn ? safe.pairs : pairs).filter(p => !['2', 'A'].includes(p[0].value));
  if (teamSafePairs.length > 0) return teamSafePairs[0];
  const teamSafeStraights = (wonLastTurn ? safe.straights : straights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
  if (teamSafeStraights.length > 0) return teamSafeStraights[0];
  const teamSafeDoubleStraights = (wonLastTurn ? safe.doubleStraights : doubleStraights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
  if (teamSafeDoubleStraights.length > 0) return teamSafeDoubleStraights[0];
  const teamSafeTriples = (wonLastTurn ? safe.triples : triples).filter(arr => !['2', 'A'].includes(arr[0].value));
  if (teamSafeTriples.length > 0) return teamSafeTriples[0];
  if (bombs.length > 0) return bombs[0];
  return null;
}

/**
 * aggressive 风格的出牌选择
 * @returns {Array|null|[]} 返回要出的牌；null表示未选中
 */
function pickAggressivePlay(params) {
  const { lastCards, combos, wonLastTurn, singles, pairs, straights, doubleStraights, bombs, triples, safe } = params;
  if (lastCards && lastCards.length > 0) {
    for (let i = combos.length - 1; i >= 0; i--) if (isValidPlay(combos[i], lastCards)) return combos[i];
    return [];
  }
  if (wonLastTurn) {
    const s = selectSmallestSingle(singles); if (s) return s;
    const p = selectSmallestPair(pairs); if (p) return p;
    const st = selectSmallestStraight(straights); if (st) return st;
    const ds = selectSmallestStraight(doubleStraights); if (ds) return ds;
  }
  const aggrSafeStraights = (wonLastTurn ? safe.straights : straights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
  if (aggrSafeStraights.length > 0) return aggrSafeStraights[0];
  const aggrSafeDoubleStraights = (wonLastTurn ? safe.doubleStraights : doubleStraights).filter(arr => arr.every(c => !['2', 'A'].includes(c.value)));
  if (aggrSafeDoubleStraights.length > 0) return aggrSafeDoubleStraights[0];
  const aggrSafeTriples = (wonLastTurn ? safe.triples : triples).filter(arr => !['2', 'A'].includes(arr[0].value));
  if (aggrSafeTriples.length > 0) return aggrSafeTriples[0];
  const aggrSafePairs = (wonLastTurn ? safe.pairs : pairs).filter(p => !['2', 'A'].includes(p[0].value));
  if (aggrSafePairs.length > 0) return aggrSafePairs[0];
  const aggrSafeSingles = (wonLastTurn ? safe.singles : singles).filter(s => !['2', 'A'].includes(s[0].value));
  if (aggrSafeSingles.length > 0) return aggrSafeSingles[0];
  if (bombs.length > 0) return bombs[0];
  return null;
}

/**
 * 有桌面牌时的统一响应策略
 * @returns {Array|[]} 返回要出的牌或空
 */
function respondWithLastCards(params) {
  const { lastCards, bombs, triples, straights, doubleStraights, combos, sorted, wonLastTurn, safe, round } = params;
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
    for (const s of (wonLastTurn ? safe.straights : straights)) if (isValidPlay(s, lastCards)) return s;
    for (const b of bombs) if (isValidPlay(b, lastCards)) return b;
    return [];
  }
  if (isDoubleStraightFast(lastCards)) {
    for (const ds of (wonLastTurn ? safe.doubleStraights : doubleStraights)) if (isValidPlay(ds, lastCards)) return ds;
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

/**
 * 无桌面牌时（或保守/正常风格）优先级选择
 * @returns {Array} 返回要出的牌
 */
function leadConservativeOrNormal(params) {
  const { lastCards, combos, hand, wonLastTurn, singles, pairs, straights, doubleStraights, bombs, triples, keyCount, sorted } = params;
  if (lastCards && lastCards.length > 0) {
    for (const c of combos) if (isValidPlay(c, lastCards)) return c;
    return [];
  }
  if (hand.length > 5) {
    if (wonLastTurn) {
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
  const { style, round, teammateIndexes, nextPlayerIdx } = determineStyle(hand, handCounts, playerIndex, playNumber, historyPlays, isBankerList);
  if (!hand || hand.length === 0) return [];
  const sorted = sortCards(hand);
  // 保留计算上一位玩家索引以便可能的扩展逻辑
  
  const remainingCards = getRemainingCards(hand, historyPlays);
  const keyCount = computeKeyCount(remainingCards);
  const { combos, triples, bombs, straights, doubleStraights, pairs, singles } = splitCombos(sorted, round, hand.length);
  const { wonLastTurn, lastNonEmptyPlay } = getLastTurnInfo(historyPlays, playerIndex);
  const safe = safeSets(wonLastTurn, lastNonEmptyPlay, { straights, doubleStraights, pairs, singles, triples });

  let lastOwnerIdx = -1;
  if (lastNonEmptyPlay) {
    if (typeof lastNonEmptyPlay.playerIndex === 'number') lastOwnerIdx = lastNonEmptyPlay.playerIndex;
  }
  const lastOwnerIsTeammate = teammateIndexes.includes(lastOwnerIdx);
  const lastOwnerHandCount = lastOwnerIdx >= 0 ? (handCounts[lastOwnerIdx] ?? 99) : 99;

  if (style === 'team') {
    const pick = pickTeamPlay({ lastCards, lastOwnerIsTeammate, lastOwnerHandCount, wonLastTurn, singles, pairs, straights, doubleStraights, bombs, triples, safe, nextPlayerIdx, round, combos, sorted, teammateIndexes, handCounts, remainingCards });
    if (pick) return pick;
    return [sorted[0]];
  }

  if (style === 'aggressive') {
    const pick = pickAggressivePlay({ lastCards, combos, wonLastTurn, singles, pairs, straights, doubleStraights, bombs, triples, safe });
    if (pick) return pick;
    return [sorted[0]];
  }

  if (lastCards && lastCards.length > 0) {
    return respondWithLastCards({ lastCards, bombs, triples, straights, doubleStraights, combos, sorted, wonLastTurn, safe, round });
  }

  return leadConservativeOrNormal({ lastCards, combos, hand, wonLastTurn, singles, pairs, straights, doubleStraights, bombs, triples, keyCount, sorted });
}

/**
 * 判断是否会拆分最优组合。
 * 若响应组合与某“最优组合”存在交集，且两者不完全一致，则视为拆分。
 * @param {Array<Object>} combo 响应或拟出的组合
 * @param {Array<Object>} hand 当前手牌（已排序）
 * @param {Array<Array<Object>>} optimalCombos 预先计算的最优组合集合
 * @returns {boolean} 是否会拆分
 */
function wouldBreakOptimalCombo(combo, hand, optimalCombos) {
  for (const optimal of optimalCombos) {
    if (optimal.some(card => combo.includes(card)) && !arraysEqual(optimal, combo)) return true;
  }
  return false;
}

/**
 * 判断两个数组元素是否逐一相等（严格相等）。
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
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
 * 判断是否为长顺子（5个及以上）。
 */
function isLongStraight(cards) { return isStraight(cards) && cards.length >= 5; }

/**
 * 判断是否为长连对（6个及以上）。
 */
function isLongDoubleStraight(cards) { return isDoubleStraight(cards) && cards.length >= 6; }

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
function getTeammateIndexesWithSpade5(playerIndex, isBankerList, historyPlays) {
  // 1. 检查黑桃5是否已被打出
  let spade5Owner = null;
  // 仅使用公共信息：出牌历史
  if (historyPlays && historyPlays.length) {
    for (const play of historyPlays) {
      if (play.cards && play.cards.some(card => card.suit === '♠' && card.value === '5')) {
        // 找到打出黑桃5的玩家，优先使用历史记录的 playerIndex
        if (typeof play.playerIndex === 'number') spade5Owner = play.playerIndex;
        break;
      }
    }
  }
  // 3. 如果能确定黑桃5持有者
  if (spade5Owner !== null) {
    // 庄家和黑桃5持有者为一队
    const teammateIndexes = isBankerList
      .map((flag, idx) => idx)
      .filter(idx => (isBankerList[idx] || idx === spade5Owner) && idx !== playerIndex);
    return teammateIndexes;
  }
  // 4. 否则，仅依据庄家信息确定队友（不窥视他人手牌）
  return isBankerList
    .map((flag, idx) => idx)
    .filter(idx => isBankerList[idx] && idx !== playerIndex);
}

// 获取下一个玩家索引
function getNextPlayerIndex(currentIndex, totalPlayers) {
  return (currentIndex + 1) % totalPlayers;
}



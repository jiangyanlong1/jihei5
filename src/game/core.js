// 挤黑5棋牌核心逻辑模块
// core.js：负责全副牌生成、洗牌、发牌等基础操作

/**
 * 所有花色
 * @type {string[]}
 */
export const SUITS = ['♠','♥','♣','♦'];

/**
 * 牌面点数顺序（特殊顺序，5最大）
 * @type {string[]}
 */
export const CARD_ORDER = ['4', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3', '5'];

/**
 * 生成一副完整的牌（共16种点数*4花色=64张）
 * @returns {Array<{suit:string,value:string}>}
 */
export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of CARD_ORDER) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

/**
 * 洗牌（Fisher-Yates算法，原地打乱）
 * @param {Array} deck - 牌堆
 * @returns {Array} 洗好的牌堆
 */
export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * 发牌，将牌堆均分为4份，并按牌值从小到大排序
 * @param {Array} deck - 已洗好的牌堆
 * @returns {Array[]} hands - 4个玩家的手牌数组
 */
export function deal(deck) {
  const hands = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) {
    hands[i % 4].push(deck[i]);
  }
  // 按牌值顺序排序每个玩家手牌
  for (let i = 0; i < 4; i++) {
    hands[i].sort((a, b) => CARD_ORDER.indexOf(a.value) - CARD_ORDER.indexOf(b.value));
  }
  return hands;
}

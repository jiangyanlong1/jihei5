// 记牌器逻辑模块
export const CARD_ORDER = ['4', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3', '5'];
export const SUITS = ['♠','♥','♣','♦'];

// 获取某点数在其他玩家手牌中的剩余数量
// 记牌器统计：其他玩家剩余牌值的个数
export function getCardLeftCount(players, value) {
  let count = 0;
  for (let i = 1; i < players.length; i++) {
    count += players[i].hand.filter(c => c.value === value).length;
  }
  return count;
}

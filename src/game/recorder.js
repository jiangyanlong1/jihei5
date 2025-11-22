/**
 * 获取某点数在其他玩家手牌中的剩余数量
 * 记牌器统计：其他玩家剩余牌值的个数
 * @param {*} players 所有玩家的手牌信息
 * @param {*} value 判断的牌值
 * @returns 
 */
export function getCardLeftCount(players, value) {
  let count = 0;
  for (let i = 1; i < players.length; i++) {
    count += players[i].hand.filter(c => c.value === value).length;
  }
  return count;
}

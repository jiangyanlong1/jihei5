# jihei5

## 挤黑5棋牌规则

本项目是一个单机版的挤黑5棋牌小游戏，规则如下：

- 打开网站页面后，点击“开始游戏”按钮即可开始。
- 玩家共4人，您在页面最下方，其余3人为AI，按顺时针排列。
- 庄家轮流做，您为第一个庄家。
- 黑桃5与庄家为一组。
- 您的牌组会展示在页面下方，可选择出牌或不出。
- 牌面大小顺序为：`4 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 < 3 < 5`，4最小，5最大。
- 牌型说明：
  - 顺子：最少3张连续牌。
  - 连顺：最少2组连续对子。
  - 对子：2张点数相同的牌。
  - 轰：3张点数相同的牌。
  - 炸：4张点数相同的牌。
  - 炸 > 轰 > 其他牌型。
- 每轮可选择出牌或“不要”，轮到下家继续。
- 先出完手中所有牌者获胜。

---

## 项目目录与模块说明

```
jihei5/
├── public/                # 静态资源
├── src/
│   ├── App.vue, main.js   # Vue入口
│   ├── assets/            # 静态图片
│   ├── components/        # 前端页面组件
│   │   ├── AIBlock.vue    # AI区域UI
│   │   ├── CardHand.vue   # 手牌展示
│   │   ├── GameTable.vue  # 游戏主桌面
│   │   └── Recorder.vue   # 记牌器
│   └── game/              # 核心游戏逻辑
│       ├── ai.js          # AI出牌逻辑
│       ├── core.js        # 牌堆生成/洗牌/发牌
│       ├── recorder.js    # 记牌器逻辑
│       └── rules.js       # 规则判定
```

## 各模块方法梳理与无用方法排查

### src/game/core.js
- createDeck：生成一副完整的牌（64张）
- shuffle：洗牌（Fisher-Yates算法）
- deal：发牌，均分4份并排序
> 均为核心方法，无冗余。

### src/game/ai.js
- aiPlay(hand, lastCards)：AI出牌主逻辑（唯一导出，外部调用）
- getAllCombos(hand)：获取所有可能的出牌组合（仅aiPlay内部调用）
- isStraightFast(cards)、isDoubleStraightFast(cards)：AI内部快速顺子/连对判定（仅getAllCombos内部调用）
> 以上均为AI出牌所需，无冗余。

### src/game/rules.js
- isValidPlay(selectedCards, lastCards)：判断出牌是否合法（导出，主流程调用）
- compareCard(a, b)：牌面大小比较（导出，排序等用）
- sortCards(cards)：按牌面排序（导出，AI/主流程用）
- getCardType(cards)：判断牌型（导出，主流程/AI用）
- isStraight(cards)、isDoubleStraight(cards)：顺子/连对判定（仅getCardType内部调用）
> 均为规则判定所需，无冗余。

### src/game/recorder.js
- CARD_ORDER、SUITS：记牌器用的牌面顺序和花色（被Recorder组件等引用）
- getCardLeftCount(players, value)：统计某点数剩余数量（被Recorder组件调用）
> 均为记牌器功能所需，无冗余。

## 结论
目前 game 目录下各模块方法均有实际用途，无未被调用的冗余方法。建议后续如有功能调整，定期梳理并移除无用代码。


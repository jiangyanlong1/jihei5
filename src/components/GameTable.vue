<template>
  <div class="game-table">
    <!-- 记牌器放最上方 -->
    <div class="recorder-top-bar">
      <div class="recorder-top-inner">
        <Recorder :players="players" :cardOrder="cardOrder" />
      </div>
    </div>
    <div class="players">
      <!-- AI区块 -->
      <AIBlock v-for="(player, idx) in players.slice(1)" :key="idx+1" :name="player.name" :hand="player.hand" />
    </div>
    <div class="table-center">
      <div class="current-play history-scroll">
        <div>出牌记录：</div>
        <div v-if="historyPlays.length">
          <div v-for="(item, idx) in historyPlays" :key="idx">
            <span style="font-weight:bold">{{ item.name }}：</span>
            <span v-if="item.cards.length">{{ item.cards.map(c => c.suit + c.value).join(' ') }}</span>
            <span v-else style="color:#aaa">不要</span>
          </div>
        </div>
        <div v-else>无</div>
      </div>
      <div class="current-turn">当前轮到：<span :class="{me: currentTurn===0}">{{ players[currentTurn].name }}</span></div>
    </div>
    <!-- 底部手牌与操作区 -->
    <div class="bottom-bar">
      <CardHand
        :hand="players[0].hand"
        :selectedIndexes="selectedIndexes"
        :getSuitClass="getSuitClass"
        @toggleSelect="toggleSelect"
      />
      <div class="actions" v-if="currentTurn === 0 && winner === null">
        <button @click="playCards" :disabled="selectedIndexes.length === 0">出牌</button>
        <button @click="pass">不要</button>
      </div>
    </div>
    <div v-if="winner !== null" class="winner-modal">
      <div class="winner-content">
        <div>胜者：{{ players[winner].name }}</div>
        <button @click="startGame">再来一局</button>
      </div>
    </div>
  </div>
</template>

<script>

import { createDeck, shuffle, deal } from '../game/core';
import { aiPlay } from '../game/ai';
import { isValidPlay } from '../game/rules';
import CardHand from './CardHand.vue';
import Recorder from './Recorder.vue';
import AIBlock from './AIBlock.vue';

export default {
  name: 'GameTable',
  components: { CardHand, Recorder, AIBlock },
  data() {
    return {
      // 四个玩家，0为自己，1-3为AI
      players: [
        { name: '我', hand: [] },
        { name: 'AI1', hand: [] },
        { name: 'AI2', hand: [] },
        { name: 'AI3', hand: [] },
      ],
      // 记牌器用的牌面顺序
      cardOrder: ['4', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3', '5'],
      currentTurn: 0, // 当前轮到的玩家索引
      currentPlay: [], // 当前桌面上的出牌
      winner: null, // 胜者索引
      selectedIndexes: [], // 选中的手牌索引
      historyPlays: [], // 出牌历史，{name, cards:[]}对象数组
    };
  },
  computed: {
    // 是否可以出牌（仅自己且未结束）
    canPlay() {
      return this.currentTurn === 0 && this.players[0].hand.length > 0 && this.winner === null;
    },
    // 是否可以不要
    canPass() {
      return this.currentTurn === 0 && this.winner === null;
    },
  },
  methods: {
    // 初始化并开始新一局游戏
    startGame() {
      const deck = shuffle(createDeck()); // 洗牌
      const hands = deal(deck); // 发牌
      for (let i = 0; i < 4; i++) {
        this.players[i].hand = hands[i]; // 分配手牌
      }
      this.currentTurn = 0; // 从自己开始
      this.currentPlay = [];
      this.historyPlays = [];
      this.winner = null;
      this.selectedIndexes = [];
    },
    // 获取上一个有效出牌（非不要），返回 {name, cards} 或 null
    getLastValidPlay() {
      for (let i = this.historyPlays.length - 1; i >= 0; i--) {
        if (this.historyPlays[i].cards && this.historyPlays[i].cards.length > 0) {
          return this.historyPlays[i];
        }
      }
      return null;
    },
    // 玩家出牌（根据选择的牌）
    playCards() {
      if (this.selectedIndexes.length === 0) return;
      const sorted = this.selectedIndexes.slice().sort((a, b) => a - b);
      const outCards = sorted.map(i => this.players[0].hand[i]);
      // 获取上家有效出牌
      const lastValid = this.getLastValidPlay();
      // 如果上家有效出牌是自己，则lastCards为空，允许任意出牌
      let lastCards = [];
      if (lastValid && lastValid.name !== this.players[0].name) {
        lastCards = lastValid.cards;
      }
      // 出牌合法性校验
      if (!isValidPlay(outCards, lastCards)) {
        alert('手牌小');
        return;
      }
      this.currentPlay = outCards;
      // 记录本轮出牌
      this.historyPlays.push({ name: this.players[0].name, cards: outCards.map(c => ({...c})) });
      for (let i = sorted.length - 1; i >= 0; i--) {
        this.players[0].hand.splice(sorted[i], 1);
      }
      this.selectedIndexes = [];
      this.checkWinner();
      this.nextTurn();
    },
    // 根据花色返回对应class
    getSuitClass(suit) {
      if (suit === '♥' || suit === '♦') return 'red-suit';
      if (suit === '♠') return 'black-suit';
      if (suit === '♣') return 'club-suit';
      return '';
    },
    // 切换选中/取消选中某张牌
    toggleSelect(idx) {
      if (this.currentTurn !== 0 || this.winner !== null) return;
      const i = this.selectedIndexes.indexOf(idx);
      if (i === -1) {
        // 用新数组赋值，保证响应式
        this.selectedIndexes = [...this.selectedIndexes, idx];
      } else {
        this.selectedIndexes = this.selectedIndexes.filter(j => j !== idx);
      }
    },
    // 玩家选择不要
    pass() {
      this.nextTurn();
    },
    // 切换到下一个玩家
    nextTurn() {
      if (this.winner !== null) return; // 已有胜者则不再轮转
      this.currentTurn = (this.currentTurn + 1) % 4;
      if (this.currentTurn !== 0) {
        this.aiPlay(); // AI自动出牌
      }
    },
    // AI出牌逻辑，调用ai.js，带延时
    aiPlay() {
      const ai = this.players[this.currentTurn];
      if (ai.hand.length > 0) {
        setTimeout(() => {
          // 获取上家有效出牌
          const lastValid = this.getLastValidPlay();
          // 如果上家有效出牌是当前AI，则lastCards为空
          let lastCards = [];
          if (lastValid && lastValid.name !== ai.name) {
            lastCards = lastValid.cards;
          }
          const outCards = aiPlay(ai.hand, lastCards);
          if (outCards && outCards.length > 0) {
            this.currentPlay = outCards;
            // 记录AI出牌
            this.historyPlays.push({ name: ai.name, cards: outCards.map(c => ({...c})) });
            ai.hand = ai.hand.filter(
              c => !outCards.some(sel => sel.suit === c.suit && sel.value === c.value)
            );
          } else {
            // AI选择不要
            this.historyPlays.push({ name: ai.name, cards: [] });
            this.currentPlay = [];
          }
          this.checkWinner();
          this.nextTurn();
        }, 700 + Math.random() * 800); // 700~1500ms
      } else {
        this.currentPlay = [];
        this.checkWinner();
        this.nextTurn();
      }
    },
    // 检查是否有玩家出完牌，设置胜者
    checkWinner() {
      for (let i = 0; i < 4; i++) {
        if (this.players[i].hand.length === 0) {
          this.winner = i;
        }
      }
    },
  },
  // 组件挂载后自动开始游戏
  mounted() {
    this.startGame();
  },
};
</script>

<style scoped>
/**** 桌面端基础样式 ****/
.game-table { padding: 20px; background: #f8fafc; border-radius: 12px; box-shadow: 0 2px 8px #e0e0e0; max-width: 900px; margin: 0 auto; }
.players { display: flex; justify-content: space-around; margin-bottom: 20px; flex-wrap: wrap; }
.player.me { border: 2px solid #42b983; padding: 10px; border-radius: 8px; background: #e3f9f1; }
.hand { margin: 8px 0; min-height: 38px; }
.hand .selected { background: #ffe082; border-radius: 4px; padding: 2px 4px; box-shadow: 0 2px 8px #ffd54f; border: 1.5px solid #ffb300; }
.red-suit { color: #e53935; }
.black-suit { color: #222; }
.club-suit { color: #388e3c; }
.suit-symbol { font-size: 18px; font-weight: bold; margin-right: 1px; }
.ai-block { background: #f3f3f3; border-radius: 8px; padding: 8px 12px; margin: 0 4px; min-width: 90px; box-shadow: 0 1px 4px #eee; }
.ai-title { font-weight: bold; color: #888; margin-bottom: 4px; }
.ai-hand { color: #666; }
.table-center { text-align: center; margin-bottom: 20px; }
.current-play { font-size: 18px; margin-bottom: 6px; }
.current-turn { font-size: 16px; }
.current-turn .me { color: #42b983; font-weight: bold; }
.winner-modal { position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.18); display: flex; align-items: center; justify-content: center; z-index: 100; }
.winner-content { background: #fff; border-radius: 12px; padding: 32px 40px; box-shadow: 0 4px 24px #bbb; text-align: center; font-size: 22px; }
.winner-content button { margin-top: 18px; font-size: 18px; background: #42b983; color: #fff; border: none; border-radius: 6px; padding: 8px 24px; cursor: pointer; }
/* 底部手牌与操作区固定样式 */
.bottom-bar {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100vw;
  background: #f8fafc;
  box-shadow: 0 -2px 12px #e0e0e0;
  z-index: 10;
  padding: 10px 0 8px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bottom-bar .actions {
  margin-top: 8px;
}

/* 出牌历史区滚动 */
/* 出牌记录滚动区域 */
.history-scroll {
  max-height: 180px;
  overflow-y: auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px #eee;
  padding: 8px 12px;
  margin-bottom: 10px;
}

@media (max-width: 600px) {
  .game-table {
    padding: 6px;
    border-radius: 0;
    box-shadow: none;
    max-width: 100vw;
    min-height: 100vh;
  }
  .recorder-top-bar {
    margin-bottom: 0;
    padding: 0;
    justify-content: flex-start;
    min-height: 0;
  }
  .recorder-top-bar .recorder {
    transform: scale(0.7);
    transform-origin: top left;
    margin-top: 0;
  }
  .players {
    flex-direction: column;
    align-items: stretch;
    margin-bottom: 10px;
    gap: 8px;
  }
  .ai-block {
    min-width: 0;
    font-size: 15px;
    padding: 6px 4px;
    margin: 2px 0;
  }
  .hand {
    min-height: 28px;
    font-size: 15px;
  }
  .hand .selected {
    padding: 1px 2px;
    font-size: 15px;
  }
  .suit-symbol {
    font-size: 15px;
  }
  .current-play, .current-turn {
    font-size: 15px;
  }
  .winner-content {
    padding: 18px 8px;
    font-size: 17px;
  }
  .winner-content button {
    font-size: 15px;
    padding: 6px 12px;
  }
  .bottom-bar {
    padding: 4px 0 4px 0;
  }
  .history-scroll {
    max-height: 110px;
    padding: 4px 4px;
    font-size: 13px;
  }
}
/* 让顶部记牌器样式居中 */
.recorder-top-bar {
  width: 100vw;
  display: flex;
  justify-content: center;
  background: #f8fafc;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 20;
  box-shadow: 0 2px 8px #e0e0e0;
}
.recorder-top-inner {
  margin: 0 auto;
  padding: 8px 0 0 0;
}
/* 让主内容下移，避免被顶部记牌器遮挡 */
.game-table {
  padding-top: 70px;
}
</style>

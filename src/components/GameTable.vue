<template>
  <div class="game-table">
    <!-- 新增顶部容器，包含记牌器和玩家卡片 -->
    <div class="top-container">
      <!-- 记牌器放最上方 -->
      <div class="recorder-top-bar">
        <div class="recorder-top-inner">
          <Recorder :players="players" :cardOrder="cardOrder" />
        </div>
      </div>
      <div class="ai-row-on-top">
        <!-- 所有玩家横向并排标签卡，悬浮在记牌器同一层 -->
        <div class="ai-block-wrap">
          <div
            v-for="(player, idx) in players"
            :key="idx"
            :class="['player-tab', { active: currentTurn === idx, me: idx === 0 }]"
          >
            <span class="player-label">{{ idx === 0 ? '我' : player.name }}</span>
            <span class="player-hand-count">剩余：{{ player.hand.length }} 张</span>
          </div>
        </div>
      </div>
    </div>
    <div class="table-center">
      <div class="current-play history-scroll" ref="historyScroll">
        <div>出牌记录：</div>
        <div v-if="historyPlays.length" ref="historyList" class="history-list">
          <div v-for="(item, idx) in historyPlays" :key="idx" class="history-item">
            <span class="history-name">{{ item.name }}：</span>
            <span v-if="item.cards.length" class="history-cards">
              <span v-for="(c, cidx) in item.cards" :key="cidx" :class="['card-item', getSuitClass(c.suit)]">
                <span class="card-corner top-left">
                  <span class="corner-value" :class="getSuitClass(c.suit)">{{ c.value }}</span>
                  <span class="corner-suit" :class="getSuitClass(c.suit)">{{ c.suit }}</span>
                </span>
                <span class="card-corner bottom-right">
                  <span class="corner-value" :class="getSuitClass(c.suit)">{{ c.value }}</span>
                  <span class="corner-suit" :class="getSuitClass(c.suit)">{{ c.suit }}</span>
                </span>
              </span>
            </span>
            <span v-else class="history-pass">不要</span>
          </div>
        </div>
        <div v-else>无</div>
      </div>
    </div>
    <!-- 当前出牌 + 当前轮到 -->
    <div class="fixed-play-info">
      <div class="current-play-area">
        <div class="play-area-label">当前出牌：</div>
        <div class="play-area-cards">
          <template v-if="currentPlay && currentPlay.length">
            <span v-for="(c, idx) in currentPlay" :key="idx" :class="['card-item', getSuitClass(c.suit)]">
              <span class="card-corner top-left">
                <span class="corner-value" :class="getSuitClass(c.suit)">{{ c.value }}</span>
                <span class="corner-suit" :class="getSuitClass(c.suit)">{{ c.suit }}</span>
              </span>
              <span class="card-corner bottom-right">
                <span class="corner-value" :class="getSuitClass(c.suit)">{{ c.value }}</span>
                <span class="corner-suit" :class="getSuitClass(c.suit)">{{ c.suit }}</span>
              </span>
            </span>
          </template>
          <span v-else class="play-pass">不要</span>
        </div>
      </div>
    </div>
    <!-- 底部手牌与操作区 -->
    <div class="bottom-bar">
      <div class="actions">
        <button @click="playCards" :disabled="canPlay">出牌</button>
        <button @click="pass" :disabled="canPass">不要</button>
      </div>
      <CardHand
        :hand="players[this.currentTurn].hand"
        :selectedIndexes="selectedIndexes"
        :getSuitClass="getSuitClass"
        @toggleSelect="toggleSelect"
      />
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

export default {
  name: 'GameTable',
  components: { CardHand, Recorder },
  created() {
    this.players = [
      { name: '自己', isAI: false, isBanker: true, hand: [] },
      { name: 'AI1', isAI: true, isBanker: false, hand: [] },
      { name: 'AI2', isAI: true, isBanker: false, hand: [] },
      { name: 'AI3', isAI: true, isBanker: false, hand: [] },
    ];
  },
  data() {
    return {
      // 四个玩家，0为自己，1-3为AI
      players: [],
      // 记牌器用的牌面顺序
      cardOrder: ['4', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3', '5'],
      currentTurn: 0, // 当前轮到的玩家索引
      currentPlay: [], // 当前桌面上的出牌
      winner: null, // 胜者索引
      selectedIndexes: [], // 选中的手牌索引
      historyPlays: [], // 出牌历史，{name, cards:[]}对象数组
    };
  },
  watch: {
    historyPlays: {
      handler() {
        this.$nextTick(() => {
          const list = this.$refs.historyList;
          if (list) {
            requestAnimationFrame(() => {
              list.scrollTop = list.scrollHeight;
              // 双重保险确保滚动到底部
              requestAnimationFrame(() => {
                list.scrollTop = list.scrollHeight;
              });
            });
          }
        });
      },
      deep: true
    }
  },
  computed: {
    // 是否可以出牌（仅自己且未结束）
    canPlay() {
      return this.players[this.currentTurn].isAI || this.winner !== null || this.selectedIndexes.length === 0;
    },
    // 是否可以不要（仅自己且未结束）
    canPass() {
      return this.players[this.currentTurn].isAI || this.winner !== null;
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
      this.currentPlay = []; // 清空当前出牌
      this.historyPlays = []; // 清空出牌历史
      this.winner = null; // 清空胜者索引
      this.selectedIndexes = []; // 清空选中的手牌索引
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
      const player = this.players[this.currentTurn];
      if (this.selectedIndexes.length === 0) return;
      const sorted = this.selectedIndexes.slice().sort((a, b) => a - b); // (a, b) => a - b是排序函数
      const outCards = sorted.map(i => player.hand[i]);
      // 获取上家有效出牌
      const lastValid = this.getLastValidPlay();
      // 如果上家有效出牌是自己，则lastCards为空，允许任意出牌
      let lastCards = [];
      if (lastValid && lastValid.name !== player.name) {
        lastCards = lastValid.cards;
      }
      // 出牌合法性校验
      if (!isValidPlay(outCards, lastCards)) {
        alert('手牌小');
        return;
      }
      // 赋值本轮出牌
      this.currentPlay = outCards;
      // 记录本轮出牌
      this.historyPlays.push({ name: player.name, cards: outCards.map(c => ({...c})) });
      // 从手牌中移除出牌
      for (let i = sorted.length - 1; i >= 0; i--) {
        player.hand.splice(sorted[i], 1);
      }
      this.selectedIndexes = [];
      // 检查胜者
      this.checkWinner();
      // 切换到下一个玩家
      this.nextTurn();
    },
    // 根据花色返回对应class
    getSuitClass(suit) {
      if (suit === '♥' || suit === '♦') return 'red-suit';
      if (suit === '♠' || suit === '♣') return 'black-suit';
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
      const player = this.players[this.currentTurn];
      if (player.isAI) {
        this.aiPlay();
      }
    },
    // AI出牌逻辑，调用ai.js，带延时
    aiPlay() {
      console.log('当前轮数', this.currentTurn);
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
/* 新增顶部容器样式 */
.top-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  z-index: 30;
}
/**** 桌面端基础样式 ****/


.top-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  z-index: 30;
}
/**** 桌面端基础样式 ****/
.game-table {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #f8fafc;
  overflow: hidden;
  z-index: 9;
}
.players { display: flex; justify-content: space-around; margin-bottom: 20px; flex-wrap: wrap; }
.ai-row-on-top {
  width: 100vw;
  display: flex;
  justify-content: center;
  padding-top: 0;
  padding-bottom: 4px;
  background: #f8fafc;
}
.ai-block-wrap {
  display: flex;
  flex-direction: row;
  gap: 16px;
  justify-content: center;
  width: auto;
  background: transparent;
  pointer-events: auto;
}
.ai-block-wrap {
  display: flex;
  flex-direction: row;
  gap: 8px;
  justify-content: center;
  width: 100%;
}
.player-tab {
  min-width: 68px;
  max-width: 90px;
  background: #f8fafc; /* 与记牌器背景一致 */
  border-radius: 6px;
  padding: 4px 4px 2px 4px;
  box-shadow: 0 1px 2px #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 2px solid #d0d0d0;
  transition: border 0.2s, background 0.2s, box-shadow 0.2s;
  font-size: 13px;
  line-height: 1.1;
}
.player-tab.me {
  font-weight: bold;
}
.player-tab.active {
  border: 2px solid #42b983;
  background: #e3f9f1;
  box-shadow: 0 2px 8px #b2f2e5;
}
.player-label {
  font-size: 14px;
  margin-bottom: 1px;
}
.player-hand-count {
  color: #888;
  font-size: 12px;
  margin-top: 1px;
}
.player.me { border: 2px solid #42b983; padding: 10px; border-radius: 8px; background: #e3f9f1; }
.hand { margin: 8px 0; min-height: 38px; }
.hand .selected {
  background: #ffe082;
  border-radius: 4px;
  padding: 2px 4px;
  box-shadow: 0 2px 8px #ffd54f;
  border: 1.5px solid #ffb300;
}
.red-suit { color: #e53935; }
.black-suit { color: #222; }
.club-suit { color: #388e3c; }
.suit-symbol { font-size: 18px; font-weight: bold; margin-right: 1px; }
.ai-block { background: #f3f3f3; border-radius: 8px; padding: 8px 12px; margin: 0 4px; min-width: 90px; box-shadow: 0 1px 4px #eee; }
.ai-title { font-weight: bold; color: #888; margin-bottom: 4px; }
.ai-hand { color: #666; }
.current-play { font-size: 14px; margin-bottom: 4px; }
.current-turn { font-size: 13px; }
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
  padding: 2px 0 2px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.bottom-bar .actions {
  margin-top: 2px;
}


/* 统一卡片样式，完全同步 CardHand.vue 的 .card-item 及相关样式 */
.card-item {
  user-select: none;
  position: relative;
  width: 44px;
  height: 70px;
  text-align: left;
  box-shadow: 0 2px 8px #bbb;
  transition: all .2s;
  border-radius: 7px;
  background: #fff;
  border: 1.5px solid #cccccc;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0;
}
.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-size: 15px;
  line-height: 1;
  font-family: 'Arial', sans-serif;
}
.top-left {
  top: 4px;
  left: 5px;
  text-align: left;
}
.bottom-right {
  bottom: 4px;
  right: 5px;
  text-align: right;
  align-items: flex-end;
}
.corner-value {
  font-weight: bold;
  font-size: 15px;
  line-height: 1;
}
.corner-suit {
  font-size: 13px;
  margin-top: 1px;
}
.red-suit { color: #e53935; }
.black-suit { color: #222; }
.club-suit { color: #388e3c; }

/* 出牌记录滚动区域 */
.table-center {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 10px;
  margin-top: 80px;
  height: 100%;
  margin-bottom: 336px; /* 增加下边距 */
  background-color: #f5f5f5;
}

.current-play.history-scroll {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  padding: 10px 0;
  height: 100%;
  /* 添加滚动行为平滑过渡 */
  scroll-behavior: smooth;
}

.history-list {
  flex-grow: 1;
  overflow-y: auto;
  min-height: 0;
}
.history-item {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
  font-size: 13px;
}
.history-name {
  font-weight: bold;
  margin-right: 4px;
}
.history-cards {
  display: flex;
  flex-direction: row;
  gap: 4px;
  align-items: center;
}
.history-pass {
  color: #aaa;
  margin-left: 2px;
}

@media (max-width: 600px) {
  .game-table {
    padding: 2px;
    border-radius: 0;
    box-shadow: none;
    max-width: 100vw;
    min-height: 100vh;
    padding-top: 60px; /* 顶部记牌器高度适配，略大 */
  }
  .recorder-top-bar {
    align-items: flex-start;
    margin-bottom: 0;
    padding: 0;
    justify-content: center;
    min-height: unset;
    height: auto;
    background: #f8fafc;
    box-shadow: 0 1px 4px #e0e0e0;
    overflow: visible;
  }
  .recorder-top-inner {
    transform: scale(0.7);
    transform-origin: top center;
    margin-top: 0;
    padding: 0;
    height: auto;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: visible;
    min-width: max-content;
  }
  .players {
    flex-direction: column;
    align-items: stretch;
    margin-bottom: 6px;
    gap: 4px;
  }
  .ai-block {
    min-width: 0;
    font-size: 13px;
    padding: 4px 2px;
    margin: 1px 0;
  }
  .hand {
    min-height: 22px;
    font-size: 13px;
  }
  .hand .selected {
    background: #ffe082;
    border-radius: 4px;
    padding: 2px 4px;
    box-shadow: 0 2px 8px #ffd54f;
    border: 1.5px solid #ffb300; /* 保持选中状态的边框样式不变 */
  }
  .suit-symbol {
    font-size: 13px;
  }
  .current-play, .current-turn {
    font-size: 13px;
  }
  .winner-content {
    padding: 10px 4px;
    font-size: 15px;
  }
  .winner-content button {
    font-size: 13px;
    padding: 4px 8px;
  }
  .bottom-bar {
    padding: 2px 0 2px 0;
    bottom: 0;
    min-height: 54px;
  }
  .bottom-bar .actions {
    margin-top: 2px;
  }
  .bottom-bar button {
    font-size: 14px;
    padding: 4px 10px;
  }
  .history-scroll {
    max-height: 460px;
    padding: 2px 2px;
    font-size: 12px;
    touch-action: none;
  }
  .fixed-play-info {
    height: 60px; /* 移动端高度从90px减小到60px */
    bottom: 145px;
    padding: 5px 0;
  }
}
/* 让顶部记牌器样式居中 */
.recorder-top-bar {
  width: 100vw;
  height: 80px;
  display: flex;
  justify-content: center;
  background: #f8fafc;
  box-shadow: 0 2px 8px #e0e0e0;
  overflow: visible;
}
.recorder-top-inner {
  margin: 0 auto;
  padding: 8px 0 0 0;
  overflow: visible;
}
/* 出牌区样式 */
.current-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 6px;
}
.play-area-label {
  font-size: 13px;
  color: #888;
  margin-bottom: 2px;
}
.play-area-cards {
  display: flex;
  flex-direction: row;
  gap: 4px;
  min-height: 32px;
  align-items: center;
}
.play-pass {
  color: #aaa;
  font-size: 15px;
  padding: 0 8px;
}
/* 禁止页面整体滚动，防止抖动和内容被遮挡 */
:global(html), :global(body) {
  height: 100vh;
  overflow: hidden;
}

/* 固定区域样式 */
.fixed-play-info {
  position: fixed;
  bottom: 120px; /* 位于手牌区域上方 */
  left: 0;
  width: 100vw;
  height: 130px; /* 高度从100px减小到70px */
  background: #f8fafc;
  padding: 8px 0;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  z-index: 9; /* 确保在手牌区域上方但在顶部容器下方 */
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>

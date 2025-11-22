<template>
  <div class="test-table">
    <div>
      <span>Selected Cards:</span>
      <input type="input" v-model="selectedCards" placeholder="如: 7,7 或 ♠7,♥7" />
    </div>
    <div>
      <span>Last Cards:</span>
      <input type="input" v-model="lastCards" placeholder="如: 6,6 或 ♣6,♦6" />
    </div>
    <button @click="testPlay">Test Play</button>
    <div v-if="result !== null" style="margin-top:8px;">
      <div>Is valid: {{ result }}</div>
      <div>Selected Type: {{ selType }}</div>
      <div>Last Type: {{ lastType }}</div>
    </div>
    <div style="margin-top:12px;">
      <button @click="runSamples">Run Samples</button>
      <div v-if="sampleResults.length" style="margin-top:6px;">
        <div v-for="(r, idx) in sampleResults" :key="idx">{{ idx+1 }}. {{ r.selected }} | {{ r.last }} => {{ r.actual }} (expect {{ r.expect }})</div>
      </div>
    </div>
    <div style="margin-top:12px;">
      <span>Type Cards:</span>
      <input type="input" v-model="typeCards" placeholder="如: 6,7,8 或 7,7" />
      <button @click="checkType">Check Type</button>
      <div v-if="typeResult" style="margin-top:6px;">Type: {{ typeResult }}</div>
    </div>
  </div>
</template>

<script>

import { isValidPlay, getCardType } from '../game/rules';

export default {
  name: 'TestTable',
  created() {
    
  },
  data() {
    return {
      selectedCards: '',
      lastCards: '',
      result: null,
      selType: '',
      lastType: '',
      sampleResults: [],
      typeCards: '',
      typeResult: ''
    };
  },
  methods: {
    parseInput(str) {
      const suitMap = { 'S': '♠', 'H': '♥', 'C': '♣', 'D': '♦' };
      return (str || '')
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(tok => {
          const m = tok.match(/^([♠♥♣♦]|[SHCD])?\s*(10|[4-9]|[JQKA]|2|3|5)$/i);
          if (!m) return null;
          const suit = m[1] ? (suitMap[m[1].toUpperCase()] || m[1]) : '♠';
          const val = m[2].toUpperCase();
          return { suit, value: val };
        })
        .filter(Boolean);
    },
    testPlay() {
      const sc = this.parseInput(this.selectedCards);
      const lc = this.parseInput(this.lastCards);
      const res = isValidPlay(sc, lc);
      this.result = res;
      this.selType = getCardType(sc);
      this.lastType = getCardType(lc);
    },
    formatType(t) {
      const map = {
        single: '单张',
        pair: '对子',
        triple: '轰',
        bomb: '炸',
        straight: '顺子',
        doubleStraight: '连对',
        invalid: '无效'
      };
      return map[t] || t;
    },
    checkType() {
      const cards = this.parseInput(this.typeCards);
      const t = getCardType(cards);
      this.typeResult = this.formatType(t);
    },
    runSamples() {
      const samples = [
        { selected: '7', last: '', expect: true },
        { selected: '8', last: '7', expect: true },
        { selected: '7', last: '7', expect: false },
        { selected: '8,8', last: '7,7', expect: true },
        { selected: '7,7', last: '7,7', expect: false },
        { selected: '6,7,8', last: '4,6,7', expect: true },
        { selected: 'K,A', last: 'Q,K', expect: true },
        { selected: 'A,2', last: 'K,A', expect: false },
        { selected: '7,7,7', last: 'K', expect: true },
        { selected: '7,7,7', last: '7,7,7,7', expect: false },
        { selected: '9,9,9', last: '7,7,7', expect: true }
      ];
      this.sampleResults = samples.map(s => {
        const sc = this.parseInput(s.selected);
        const lc = this.parseInput(s.last);
        const actual = isValidPlay(sc, lc);
        return { ...s, actual };
      });
    }
  }
  
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
.test-table {
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
.hand-tooltip-debug {
  pointer-events: none;
  min-width: 120px;
  min-height: 80px;
  position: fixed;
}
</style>

<template>
  <div class="recorder">
    <div class="recorder-title">记牌器</div>
    <div class="recorder-cards">
      <div class="recorder-row">
        <span v-for="v in cardOrder" :key="v" class="recorder-num">{{ v }}</span>
      </div>
      <div class="recorder-row">
        <span v-for="v in cardOrder" :key="v" class="recorder-count">{{ getCardLeftCount(players, v) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { getCardLeftCount, CARD_ORDER } from '../game/recorder';
export default {
  // eslint-disable-next-line vue/multi-word-component-names
  name: 'Recorder',
  props: {
    players: Array,
    cardOrder: {
      type: Array,
      default: () => CARD_ORDER
    }
  },
  methods: { getCardLeftCount }
}
</script>

<style scoped>
.recorder { margin-top: 0; background: #fffbe7; border-radius: 8px; padding: 10px 16px; box-shadow: 0 1px 4px #ffe082; display: inline-block; }
.recorder-title { font-weight: bold; color: #bfa100; margin-bottom: 4px; }
.recorder-cards { display: flex; flex-direction: column; align-items: flex-start; }
.recorder-row { display: flex; flex-direction: row; gap: 8px; margin-bottom: 2px; }
.recorder-num { font-size: 18px; font-weight: bold; min-width: 32px; text-align: center; color: #333; }
.recorder-count { background: #ffd54f; color: #222; border-radius: 8px; padding: 1px 0; font-weight: bold; min-width: 32px; text-align: center; font-size: 15px; margin-bottom: 2px; }
/* 顶部记牌器样式 */
.recorder-top-bar {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  margin-bottom: 8px;
}
.recorder-top-bar .recorder {
  transform: scale(0.85);
  transform-origin: top center;
}
</style>

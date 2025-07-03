<template>
  <div class="hand" ref="myHand">
    <span v-for="(card, i) in hand" :key="i"
      :class="[{ selected: selectedIndexes.includes(i) }, getSuitClass(card.suit), 'card-item']"
      @click="toggleSelect(i)"
    >
      <span class="suit-symbol" :class="getSuitClass(card.suit)">{{ card.suit }}</span>
      <span :class="getSuitClass(card.suit)">{{ card.value }}</span>
    </span>
  </div>
</template>

<script>
export default {
  name: 'CardHand',
  props: {
    hand: Array,
    selectedIndexes: Array,
    getSuitClass: Function
  },
  emits: ['toggleSelect'],
  methods: {
    toggleSelect(i) {
      this.$emit('toggleSelect', i);
    }
  }
}
</script>

<style scoped>
/* 手牌区样式 */
.hand { margin: 8px 0; min-height: 38px; }
.card-item {
  cursor: pointer;
  user-select: none;
  display: inline-block;
  margin-right: 4px;
  min-width: 32px;
  text-align: center;
  box-shadow: 0 1px 2px #ccc;
  transition: all .2s;
  border-radius: 4px;
  padding: 2px 4px;
}
.hand .selected { background: #ffe082; box-shadow: 0 2px 8px #ffd54f; border: 1.5px solid #ffb300; }
.suit-symbol { font-size: 18px; font-weight: bold; margin-right: 1px; }
/* 花色颜色 */
.red-suit { color: #e53935; }
.black-suit { color: #222; }
.club-suit { color: #388e3c; }
</style>

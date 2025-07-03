<template>
  <div class="hand-outer">
    <div class="hand" ref="myHand" :style="{ width: handWidth + 'px' }">
      <span v-for="(card, i) in hand" :key="i"
        :class="[{ selected: selectedIndexes.includes(i) }, getSuitClass(card.suit), 'card-item']"
        @click="toggleSelect(i)"
        :style="{
          left: (i * 22) + 'px',
          zIndex: i,
        }"
      >
        <span class="card-corner top-left">
          <span class="corner-value" :class="getSuitClass(card.suit)">{{ card.value }}</span>
          <span class="corner-suit" :class="getSuitClass(card.suit)">{{ card.suit }}</span>
        </span>
        <span class="card-corner bottom-right">
          <span class="corner-value" :class="getSuitClass(card.suit)">{{ card.value }}</span>
          <span class="corner-suit" :class="getSuitClass(card.suit)">{{ card.suit }}</span>
        </span>
      </span>
    </div>
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
  computed: {
    handWidth() {
      // 44px为单牌宽度，22px为重叠宽度
      if (!this.hand || this.hand.length === 0) return 0;
      if (this.hand.length === 1) return 44;
      return 44 + (this.hand.length - 1) * 22;
    }
  },
  methods: {
    toggleSelect(i) {
      this.$emit('toggleSelect', i);
    }
  }
}
</script>

<style scoped>
.hand-outer {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}
.hand {
  margin: 8px 0;
  min-height: 70px;
  min-width: 44px;
  position: relative;
  height: 90px;
}
.card-item {
  cursor: pointer;
  user-select: none;
  position: absolute;
  top: 0;
  width: 44px;
  height: 70px;
  text-align: left;
  box-shadow: 0 2px 8px #bbb;
  transition: all .2s;
  border-radius: 7px;
  background: #fff;
  border: 1.5px solid #e0e0e0;
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
.hand .selected { background: #ffe082; box-shadow: 0 2px 8px #ffd54f; border: 2px solid #ffb300; }
.red-suit { color: #e53935; }
.black-suit { color: #222; }
.club-suit { color: #388e3c; }
</style>

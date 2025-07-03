<template>
  <div class="ai-block">
    <div class="ai-title">{{ name }}</div>
    <div class="hand ai-hand">剩余：{{ hand.length }} 张</div>
  </div>
</template>

<script>
export default {
  name: 'AIBlock',
  props: {
    name: String,
    hand: Array
  }
}
</script>

<style scoped>
.ai-block { background: #f3f3f3; border-radius: 8px; padding: 8px 12px; margin: 0 4px; min-width: 90px; box-shadow: 0 1px 4px #eee; }
.ai-title { font-weight: bold; color: #888; margin-bottom: 4px; }
.ai-hand { color: #666; }
</style>

<template>
  <div id="app">
    <button v-if="!showGame" @click="showGame = true">开始</button>
    <GameTable v-if="showGame" />
  </div>
</template>

<script>
import GameTable from './components/GameTable.vue'

export default {
  name: 'App',
  components: {
    GameTable
  },
  data() {
    return {
      showGame: false
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>

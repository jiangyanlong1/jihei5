<template>
  <div id="app">
    <button v-if="!showGame" @click="showGame = true">开始</button>
    <button v-if="!showTest" @click="showTest = true">测试</button>
    <GameTable v-if="showGame" />
    <TestTable v-if="showTest" />
  </div>
</template>

<script>
import GameTable from './components/GameTable.vue'
import TestTable from './components/TestTable.vue';

export default {
  name: 'App',
  components: {
    GameTable,
    TestTable
  },
  data() {
    return {
      showGame: false,
      showTest: false
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

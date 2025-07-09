import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

// 禁止双击放大
if (typeof window !== 'undefined') {
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
  }, { passive: false });
}

import Vue from 'vue'
import App from './App.vue'
import axios from 'axios'
import router from './router'

Vue.config.productionTip = false

axios.defaults.baseURL = "https://y7o9kwa76j.execute-api.us-west-2.amazonaws.com/prod/"

new Vue({
  router,
  render: h => h(App),
}).$mount('#app')

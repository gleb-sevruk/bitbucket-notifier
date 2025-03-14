<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import {ConfigStore} from "./store/storage.ts";

const greetMsg = ref("");
const name = ref("");
const bitbucket_url = ref("");
const new_bitbucket_url = ref("");
const bitbucket_apiKey = ref("");

const bitbucket_username = ref("");
const new_bitbucket_apiKey = ref("");

const new_bitbucket_username = ref("");

const store = new ConfigStore()

// bitbucket_url.value = await store.getUrl();
async function initializeData() {
  bitbucket_url.value = await store.getUrl();
  bitbucket_apiKey.value = await store.getApiKey();
  bitbucket_username.value = await store.getUsername();
}

// Call the initialize function
initializeData().catch(error => {
  console.error("Failed to initialize data:", error);
});

async function greet() {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  greetMsg.value = await invoke("greet_2", { name: name.value });
}

async function saveUrl() {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  await store.saveUrl(new_bitbucket_url.value)
  bitbucket_url.value = new_bitbucket_url.value;
}
async function saveApiKey() {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  await store.saveApiKey(new_bitbucket_apiKey.value)
  bitbucket_apiKey.value = new_bitbucket_apiKey.value;
}

async function saveUsername() {
  await store.saveUsername(new_bitbucket_username.value)
  bitbucket_username.value = new_bitbucket_username.value;
}


</script>

<template>
  <main class="container">
    <h1>Welcome to Tauri + Vue (Gleb)</h1>

    <div class="row">
      <a href="https://vitejs.dev" target="_blank">
        <img src="/vite.svg" class="logo vite" alt="Vite logo" />
      </a>
      <a href="https://tauri.app" target="_blank">
        <img src="/tauri.svg" class="logo tauri" alt="Tauri logo" />
      </a>
      <a href="https://vuejs.org/" target="_blank">
        <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
      </a>
    </div>
    <p>Click on the Tauri, Vite, and Vue logos to learn more.</p>
    <p>bb: {{ bitbucket_url }}</p>
    <p>api: {{bitbucket_apiKey}}</p>
    <p>username: {{bitbucket_username}}</p>

    <form class="row" @submit.prevent="greet">
      <input id="greet-input" v-model="name" placeholder="Enter a name..." />
      <button type="submit">Greet</button>
    </form>

    <form class="row" @submit.prevent="saveUrl">
      <input id="greet-input" v-model="new_bitbucket_url" placeholder="Bitbucket url..." />
      <button type="submit">Greet</button>
    </form>

    <form class="row" @submit.prevent="saveApiKey">
      <input id="greet-input" v-model="new_bitbucket_apiKey" placeholder="Bitbucket api key..." />
      <button type="submit">Greet</button>
    </form>

    <form class="row" @submit.prevent="saveUsername">
      <input id="greet-input" v-model="new_bitbucket_username" placeholder="Bitbucket username..." />
      <button type="submit">Greet</button>
    </form>
    <p>{{ greetMsg }}</p>
  </main>
</template>

<style scoped>
.logo.vite:hover {
  filter: drop-shadow(0 0 2em #747bff);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #249b73);
}

</style>
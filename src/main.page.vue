<script setup lang="ts">
import Button from 'primevue/button';
import VueJsonView from '@matpool/vue-json-view'
import {ref} from "vue";
import {ConfigStore} from "./store/storage.ts";
import { fetch } from '@tauri-apps/plugin-http';


const store = new ConfigStore()
const data_from_bb =  ref(null)


async function handleClick() {
  console.log('Clicked');
  let value = await getCurrentUser();
  let value1 = JSON.stringify(value);
  // debugger
  data_from_bb.value = value;
}

async function getAuthHeader() {
  // Base64 encode the username:apiKey combination
  let username = await store.getUsername();
  let apiKey = await store.getApiKey();
  const auth = btoa(`${username}:${apiKey}`);
  return `Basic ${auth}`;
}

async function request(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Authorization': await getAuthHeader(),
      'Content-Type': 'application/json'
    }
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }
  const baseUrl = await store.getUrl();

  try {
    const response = await fetch(`${baseUrl}/rest/api/latest${endpoint}`, options);
    console.log(response)
    // if (!response.status.toString().startsWith('2')) {
    //   const errorText = await response.text();
    //   throw new Error(`API error (${response.status}): ${errorText}`);
    // }

    let newVar = await response.json();
    return newVar;
  } catch (error) {
    console.error(`Bitbucket API error (${endpoint}):`, error);
    throw error;
  }
}

async function getCurrentUser() {
  return request('/profile/recent/repos');
}

</script>

<template>
<main class="container">
  <h1>Main page</h1>
  <div>
    <Button severity="primary" @click="handleClick">Bitbucket fetch</Button>
    <VueJsonView v-if="data_from_bb" collapsed="false" :src="data_from_bb" />
    <div v-if="!data_from_bb">No data fetched yet</div>
  </div>
</main>
</template>

<style scoped>

</style>
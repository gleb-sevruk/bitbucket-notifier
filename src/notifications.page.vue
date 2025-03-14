<script setup lang="ts">
import Knob from 'primevue/knob';
import PVButton from 'primevue/button';
import { ref } from 'vue';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import {invoke} from "@tauri-apps/api/core";





const value = ref(0)

async function applyNotificationCounter(){
  console.log(value.value)
  let count = value.value;
  await invoke("update_dock_badge", {count});
}

async function requestPermission(){
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
}

async function testNotification(){
  let permissionGranted = await isPermissionGranted();
  if (permissionGranted) {
    sendNotification('Tauri is awesome!');
    sendNotification({ title: 'TAURI', body: 'Tauri is awesome!'});
  }
}



</script>

<template>
<main class="container">
<div>aaa</div>
<div>aaa</div>
  <Knob v-model="value" />
  <PVButton label="Save" @click="applyNotificationCounter">Apply Counter</PVButton>
  <PVButton label="Request" @click="requestPermission">Request permissions</PVButton>
  <PVButton label="Request" @click="testNotification">Test</PVButton>

</main>
</template>

<style scoped>

</style>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useConfigStore, useNotificationStore, usePRStore } from "./store";
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import InputNumber from 'primevue/inputnumber';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Panel from 'primevue/panel';
import Message from 'primevue/message';
import InputSwitch from 'primevue/inputswitch';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';

// Use Pinia stores
const configStore = useConfigStore();
const notificationStore = useNotificationStore();
const prStore = usePRStore();

// Local settings
const formUrl = ref('');
const formApiKey = ref('');
const formUsername = ref('');
const pollInterval = ref(300);
const saveStatus = ref('');
const saving = ref(false);
const showAdvancedSettings = ref(false);

// Load data from Tauri store on mount
onMounted(async () => {
  // Load configuration
  await configStore.loadConfig();
  
  // Update local refs
  formUrl.value = configStore.baseUrl;
  formApiKey.value = configStore.apiKey;
  formUsername.value = configStore.username;
  pollInterval.value = configStore.pollInterval;
});

// Save configuration
async function saveConfig() {
  saving.value = true;
  saveStatus.value = '';
  
  try {
    // Update store values
    configStore.baseUrl = formUrl.value;
    configStore.apiKey = formApiKey.value;
    configStore.username = formUsername.value;
    configStore.pollInterval = pollInterval.value;
    
    // Save to Tauri store
    await configStore.saveConfig();
    
    // Reset sync interval with new poll interval
    prStore.stopPeriodicSync();
    prStore.startPeriodicSync(pollInterval.value);
    
    saveStatus.value = 'success';
    setTimeout(() => { saveStatus.value = ''; }, 3000);
  } catch (error) {
    console.error('Failed to save configuration:', error);
    saveStatus.value = 'error';
  } finally {
    saving.value = false;
  }
}

// Add a repository to track


// Reset all data
async function resetData() {
  if (confirm('Are you sure you want to reset all data? This will clear all pull request and notification data.')) {
    prStore.repositories = [];
    await prStore.saveToLocalStorage();
    notificationStore.clearHistory();
    location.reload();
  }
}
</script>

<template>
  <main class="container">
    <h1>Settings</h1>
    
    <Card class="mb-4">
      <template #title>Bitbucket Connection Settings</template>
      <template #content>
        <form @submit.prevent="saveConfig" class="flex flex-column gap-3">
          <div class="field">
            <label for="url" class="block mb-1">Bitbucket URL</label>
            <span class="p-input-icon-left w-full">
              <i class="pi pi-link" />
              <InputText id="url" v-model="formUrl" placeholder="https://bitbucket.example.com" class="w-full" />
            </span>
            <small class="text-gray-500">The URL of your Bitbucket server instance</small>
          </div>
          
          <div class="field">
            <label for="username" class="block mb-1">Username</label>
            <span class="p-input-icon-left w-full">
              <i class="pi pi-user" />
              <InputText id="username" v-model="formUsername" placeholder="Username" class="w-full" />
            </span>
          </div>
          
          <div class="field">
            <label for="apiKey" class="block mb-1">API Key</label>
            <Password id="apiKey" v-model="formApiKey" placeholder="API Key" :feedback="false" toggleMask class="w-full" />
            <small class="text-gray-500">Your Bitbucket API access token</small>
          </div>
          
          <Button type="submit" label="Save Settings" icon="pi pi-save" :loading="saving" />
          
          <Message v-if="saveStatus === 'success'" severity="success" :closable="false">
            Settings saved successfully!
          </Message>
          <Message v-if="saveStatus === 'error'" severity="error" :closable="false">
            Failed to save settings. Please try again.
          </Message>
        </form>
      </template>
    </Card>
    
<!--    <Card class="mb-4">-->
<!--      <template #title>Repositories to Monitor</template>-->
<!--      <template #content>-->
<!--        <div class="flex flex-column gap-3">-->
<!--          <div class="flex gap-2">-->
<!--            <InputText v-model="repositoryToAdd" placeholder="project/repository-slug" class="flex-1" />-->
<!--            <Button icon="pi pi-plus" @click="addRepository" />-->
<!--          </div>-->
<!--          -->
<!--          <div v-if="configStore.trackedRepositories.length > 0" class="flex flex-wrap gap-2 mt-2">-->
<!--            <Chip -->
<!--              v-for="repo in configStore.trackedRepositories" -->
<!--              :key="repo"-->
<!--              :label="repo"-->
<!--              removable-->
<!--              @remove="removeRepository(repo)"-->
<!--            />-->
<!--          </div>-->
<!--          <div v-else>-->
<!--            <Message severity="info" :closable="false">-->
<!--              No repositories are being tracked. Add a repository above.-->
<!--            </Message>-->
<!--          </div>-->
<!--        </div>-->
<!--      </template>-->
<!--    </Card>-->
    
    <Panel header="Notification Settings" toggleable>
      <div class="flex flex-column gap-3">
        <div class="flex align-items-center justify-content-between">
          <label for="show-notifications">Show Notifications</label>
          <InputSwitch id="show-notifications" v-model="notificationStore.showNotifications" />
        </div>
        
        <div class="flex align-items-center justify-content-between">
          <label for="dock-badge">Enable Dock Badge</label>
          <InputSwitch id="dock-badge" v-model="notificationStore.dockBadgeEnabled" />
        </div>
        
        <div class="flex align-items-center justify-content-between">
          <label for="sound-enabled">Enable Sound</label>
          <InputSwitch id="sound-enabled" v-model="notificationStore.soundEnabled" />
        </div>
        
        <div class="flex align-items-center justify-content-between">
          <label for="poll-interval">Poll Interval (seconds)</label>
          <InputNumber id="poll-interval" v-model="pollInterval" :min="30" :max="3600" showButtons />
        </div>
      </div>
    </Panel>
    
    <Button 
      @click="showAdvancedSettings = !showAdvancedSettings" 
      class="mt-4"
      severity="secondary"
      outlined
    >
      {{ showAdvancedSettings ? 'Hide' : 'Show' }} Advanced Settings
    </Button>
    
    <Accordion v-if="showAdvancedSettings" class="mt-3">
      <AccordionTab header="Reset Application Data">
        <div class="flex flex-column gap-3">
          <Message severity="warn" :closable="false">
            This will reset all application data, including tracked pull requests, read/unread status, and notification history.
          </Message>
          <Button @click="resetData" severity="danger" label="Reset All Data" />
        </div>
      </AccordionTab>
      
      <AccordionTab header="Debug Information">
        <div class="flex flex-column gap-2">
          <div><strong>Total PRs tracked:</strong> {{ prStore.repositories.flatMap(r => r.pullRequests).length }}</div>
          <div><strong>Total unread comments:</strong> {{ prStore.totalUnreadCount }}</div>
          <div><strong>Last sync time:</strong> {{ prStore.lastSyncTime?.toLocaleString() || 'Never' }}</div>
          <div><strong>Is polling active:</strong> {{ prStore.syncInterval ? 'Yes' : 'No' }}</div>
        </div>
      </AccordionTab>
    </Accordion>
  </main>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 1rem;
}

.mb-4 {
  margin-bottom: 1.5rem;
}

.field {
  margin-bottom: 1rem;
}

.w-full {
  width: 100%;
}
</style>
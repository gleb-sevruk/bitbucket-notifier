import { createMemoryHistory, createRouter } from 'vue-router'

import HomeView from './main.page.vue'
import SettingsView from './settings.component.vue'
import NotificationView from './notifications.page.vue'
import PRDetailsView from './pr-details.page.vue'

const routes = [
    { path: '/', component: HomeView },
    { path: '/settings', component: SettingsView },
    { path: '/test-notifications', component: NotificationView },
    { path: '/pr/:repoSlug/:prId', component: PRDetailsView, props: true },
]

const router = createRouter({
    history: createMemoryHistory(),
    routes,
})

export default router
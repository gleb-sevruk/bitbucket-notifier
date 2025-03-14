import { createApp } from "vue";
import router from './router'
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import { createPinia } from 'pinia';
import Tooltip from 'primevue/tooltip';

import App from "./App.vue";

const app = createApp(App);
const pinia = createPinia();

app.use(PrimeVue, {
    theme: {
        preset: Aura
    }
});

// Register PrimeVue directives globally
app.directive('tooltip', Tooltip);

app.use(router);
app.use(pinia);
app.mount("#app");

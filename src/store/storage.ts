import {load, Store} from '@tauri-apps/plugin-store';

export class ConfigStore {
    private store : Store | null;
    private storePromise: any;
    constructor() {
        this.store = null;
        this.storePromise = this.initStore();

    }

    async getStore() {
        if (!this.store) {
            await this.storePromise;
        }
        return this.store;
    }

    async initStore() {
        this.store = await load('bitbucket-config.json', {autoSave : true});
        return this.store;
    }


    async saveUrl(bitbucket_url: string) {
        const store = await this.getStore();
        await store.set('bitbucket_url', bitbucket_url);
    }

    async saveUsername(username: string) {
        const store = await this.getStore();
        await store.set('bitbucket_username', username);
    }

    async getUsername(): Promise<string> {
        const store = await this.getStore();
        return (await store.get('bitbucket_username') || '');
    }

    async getUrl() : Promise<string> {
        const store = await this.getStore();

        return (await store.get('bitbucket_url') || '');
    }

    async saveApiKey(bitbucket_api_key: string) {
        const store = await this.getStore();
        await store.set('bitbucket_api_key', bitbucket_api_key);
    }

    async getApiKey() : Promise<string> {
        const store = await this.getStore();
        return (await store.get('bitbucket_api_key') || '');
    }
}
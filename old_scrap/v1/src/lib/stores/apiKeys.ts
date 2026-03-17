import { writable } from 'svelte/store';

export interface ApiKey {
	id: number;
	name: string;
	key: string;
	created: string;
}

function createApiKeysStore() {
	const { subscribe, set, update } = writable<ApiKey[]>([
		{
			id: 1,
			name: 'Production Key',
			key: 'whs_live_sk_abc123def456ghi789jkl',
			created: '2 weeks ago'
		},
		{
			id: 2,
			name: 'Development Key',
			key: 'whs_test_sk_xyz789uvw456rst123pqr',
			created: '1 month ago'
		}
	]);

	return {
		subscribe,
		create: (name: string) => {
			const newKey: ApiKey = {
				id: Date.now(),
				name,
				key: `whs_live_sk_${generateRandomString(24)}`,
				created: 'Just now'
			};
			
			update((keys: ApiKey[]) => [newKey, ...keys]);
			return newKey;
		},
		delete: (id: number) => {
			update((keys: ApiKey[]) => keys.filter((key: ApiKey) => key.id !== id));
		}
	};
}

function generateRandomString(length: number): string {
	const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

export const apiKeys = createApiKeysStore();
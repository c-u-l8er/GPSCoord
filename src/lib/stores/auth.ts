import { writable } from 'svelte/store';

export interface User {
	name: string;
	email: string;
	organization: string;
}

export interface AuthState {
	isAuthenticated: boolean;
	user: User;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		isAuthenticated: false,
		user: {
			name: 'Demo User',
			email: 'demo@gpscoord.com',
			organization: 'Demo Fleet Co.'
		}
	});

	return {
		subscribe,
		login: (user: User) => {
			update(state => ({
				...state,
				isAuthenticated: true,
				user
			}));
			// Store in localStorage for persistence
			if (typeof window !== 'undefined') {
				localStorage.setItem('gpscoord_user', JSON.stringify(user));
			}
		},
		logout: () => {
			update(state => ({
				...state,
				isAuthenticated: false
			}));
			// Clear localStorage
			if (typeof window !== 'undefined') {
				localStorage.removeItem('gpscoord_user');
			}
		},
		initialize: () => {
			// Check localStorage on app initialization
			if (typeof window !== 'undefined') {
				const stored = localStorage.getItem('gpscoord_user');
				if (stored) {
					try {
						const user = JSON.parse(stored);
						update(state => ({
							...state,
							isAuthenticated: true,
							user
						}));
					} catch (e) {
						console.error('Failed to parse stored user data:', e);
					}
				}
			}
		}
	};
}

export const auth = createAuthStore();
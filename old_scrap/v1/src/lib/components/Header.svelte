<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { onMount, createEventDispatcher } from 'svelte';

	let currentTab = 'overview';
	let userMenuOpen = false;
	const dispatch = createEventDispatcher();

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'api-keys', label: 'API Keys' },
		{ id: 'usage', label: 'Usage' },
		{ id: 'settings', label: 'Settings' }
	];

	onMount(() => {
		auth.initialize();
	});

	function handleTabChange(tabId: string) {
		currentTab = tabId;
		// Dispatch event to parent
		dispatch('tabChange', { tab: tabId });
	}

	function logout() {
		auth.logout();
	}

	function handleDocumentationClick(event: MouseEvent) {
		event.preventDefault();
		const testUrl = 'https://webhost.systems/documentation#DOCUMENTATION-INDEX.md';
		window.open(testUrl, '_blank');
	}
</script>

<header class="header">
	<div class="header-left">
		<div class="logo">GPS Coord</div>
		<nav class="nav-tabs">
			{#each tabs as tab}
				<button 
					on:click={() => handleTabChange(tab.id)}
					class="nav-tab"
					class:active={currentTab === tab.id}
				>
					{tab.label}
				</button>
			{/each}
		</nav>
	</div>

	<div class="header-right">
		<span class="badge badge-success">
			<span style="width: 6px; height: 6px; background: currentColor; border-radius: 50%; display: inline-block; margin-right: 0.5rem;"></span>
			api.webhost.systems
		</span>

		<div class="user-menu">
			<button on:click={() => userMenuOpen = !userMenuOpen} class="user-button">
				<div class="user-avatar">{$auth.user.name.charAt(0)}</div>
				<span>{$auth.user.name}</span>
				<svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
				</svg>
			</button>

			{#if userMenuOpen}
				<div class="dropdown" on:click={() => userMenuOpen = false}>
					<button on:click={() => { handleTabChange('settings'); userMenuOpen = false; }} class="dropdown-item">Account Settings</button>
					<button on:click={handleDocumentationClick} class="dropdown-item">Documentation</button>
					<div class="dropdown-divider"></div>
					<button on:click={logout} class="dropdown-item" style="color: var(--danger);">Sign Out</button>
				</div>
			{/if}
		</div>
	</div>
</header>
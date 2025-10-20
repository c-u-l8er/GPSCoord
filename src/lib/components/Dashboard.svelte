<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import Header from './Header.svelte';
	import Overview from './Overview.svelte';
	import ApiKeys from './ApiKeys.svelte';
	import Usage from './Usage.svelte';
	import Settings from './Settings.svelte';

	let currentTab = 'overview';

	onMount(() => {
		auth.initialize();
	});

	function handleTabChange(event: CustomEvent) {
		currentTab = event.detail.tab;
	}

	$: currentComponent = (() => {
		switch (currentTab) {
			case 'overview':
				return Overview;
			case 'api-keys':
				return ApiKeys;
			case 'usage':
				return Usage;
			case 'settings':
				return Settings;
			default:
				return Overview;
		}
	})();
</script>

<div class="dashboard">
	<Header on:tabChange={handleTabChange} />
	
	<main class="main">
		<svelte:component this={currentComponent} />
	</main>
</div>
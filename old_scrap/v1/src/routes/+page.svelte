<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import Login from '$lib/components/Login.svelte';
	import Dashboard from '$lib/components/Dashboard.svelte';

	onMount(() => {
		auth.initialize();
	});
</script>

{#if $auth.isAuthenticated}
	<Dashboard />
{:else}
	<Login />
{/if}

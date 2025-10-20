<script lang="ts">
	import { apiKeys } from '$lib/stores/apiKeys';
	import CreateApiKeyModal from './CreateApiKeyModal.svelte';

	let showCreateKeyModal = false;

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			alert('✅ API key copied to clipboard!');
		}).catch(() => {
			alert('❌ Failed to copy to clipboard');
		});
	}

	function deleteApiKey(id: number) {
		if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
			apiKeys.delete(id);
		}
	}

	function openCreateModal() {
		showCreateKeyModal = true;
	}

	function closeModal() {
		showCreateKeyModal = false;
	}
</script>

<div>
	<div class="page-header">
		<h2>API Keys</h2>
		<p>Manage your WebHost.Systems API authentication keys</p>
	</div>

	<div class="card">
		<div class="card-header">
			<h3 class="card-title">Your API Keys</h3>
			<button on:click={openCreateModal} class="btn btn-primary btn-small">
				+ Create New Key
			</button>
		</div>

		{#if $apiKeys.length > 0}
			<div class="api-keys-list">
				{#each $apiKeys as key (key.id)}
					<div class="api-key-item">
						<div class="api-key-info">
							<div class="api-key-name">{key.name}</div>
							<div class="api-key-value">{key.key}</div>
							<div style="margin-top: 0.5rem;">
								<span class="badge badge-info">Created {key.created}</span>
							</div>
						</div>
						<div class="api-key-actions">
							<button on:click={() => copyToClipboard(key.key)} class="btn btn-outline btn-small">
								Copy
							</button>
							<button on:click={() => deleteApiKey(key.id)} class="btn btn-danger btn-small">
								Revoke
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<div class="empty-state-icon">🔑</div>
				<h3>No API Keys Yet</h3>
				<p>Create your first API key to start using the WebHost.Systems platform</p>
				<button on:click={openCreateModal} class="btn btn-primary">
					Create Your First Key
				</button>
			</div>
		{/if}
	</div>

	<CreateApiKeyModal isOpen={showCreateKeyModal} on:close={closeModal} />
</div>
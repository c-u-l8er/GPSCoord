<script lang="ts">
	import { apiKeys, type ApiKey } from '$lib/stores/apiKeys';
	import { createEventDispatcher } from 'svelte';

	export let isOpen = false;
	let newKeyName = '';
	const dispatch = createEventDispatcher();

	function createApiKey() {
		if (!newKeyName.trim()) {
			alert('Please enter a key name');
			return;
		}

		const newKey: ApiKey = apiKeys.create(newKeyName);
		
		// Show success message
		alert(`✅ API Key "${newKey.name}" created successfully!\n\nKey: ${newKey.key}\n\nMake sure to copy it now - you won't be able to see it again!`);
		
		// Reset and close
		newKeyName = '';
		isOpen = false;
		dispatch('close');
	}

	function closeModal() {
		isOpen = false;
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			createApiKey();
		}
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" on:click={closeModal}>
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header">
				<h3 class="modal-title">Create New API Key</h3>
			</div>
			<div class="form-group">
				<label class="form-label">Key Name</label>
				<input 
					type="text" 
					class="form-input" 
					bind:value={newKeyName}
					placeholder="Production API Key"
					on:keydown={handleKeydown}
				/>
				<p style="color: var(--gray); font-size: 0.875rem; margin-top: 0.5rem;">
					Give your key a descriptive name to identify its purpose
				</p>
			</div>
			<div class="modal-actions">
				<button on:click={closeModal} class="btn btn-outline" style="flex: 1;">
					Cancel
				</button>
				<button on:click={createApiKey} class="btn btn-primary" style="flex: 1;">
					Create Key
				</button>
			</div>
		</div>
	</div>
{/if}
<script lang="ts">
	import { auth } from '$lib/stores/auth';

	let userName = $auth.user.name;
	let organization = $auth.user.organization;

	function saveChanges() {
		// Update the auth store with new values
		auth.login({
			...$auth.user,
			name: userName,
			organization
		});
		alert('Settings saved successfully!');
	}

	function deleteAccount() {
		if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
			alert('Account deletion functionality would be implemented here.');
		}
	}
</script>

<div>
	<div class="page-header">
		<h2>Account Settings</h2>
		<p>Manage your account preferences and integrations</p>
	</div>

	<div class="card">
		<div class="card-header">
			<h3 class="card-title">Profile Information</h3>
		</div>
		<div class="form-group">
			<label class="form-label">Full Name</label>
			<input type="text" class="form-input" bind:value={userName} />
		</div>
		<div class="form-group">
			<label class="form-label">Email Address</label>
			<input type="email" class="form-input" value={$auth.user.email} disabled />
			<p style="color: var(--gray); font-size: 0.875rem; margin-top: 0.5rem;">
				Email managed by WorkOS SSO
			</p>
		</div>
		<div class="form-group">
			<label class="form-label">Organization</label>
			<input type="text" class="form-input" bind:value={organization} />
		</div>
		<button on:click={saveChanges} class="btn btn-primary btn-small">Save Changes</button>
	</div>

	<div class="card">
		<div class="card-header">
			<h3 class="card-title">API Configuration</h3>
		</div>
		<div class="form-group">
			<label class="form-label">API Endpoint</label>
			<input type="text" class="form-input" value="https://api.webhost.systems" disabled />
		</div>
		<div class="form-group">
			<label class="form-label">WebSocket Endpoint</label>
			<input type="text" class="form-input" value="wss://sync.webhost.systems" disabled />
		</div>
		<div class="form-group">
			<label class="form-label">Rate Limit</label>
			<input type="text" class="form-input" value="Unlimited (Starter Plan)" disabled />
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h3 class="card-title">Webhooks</h3>
			<button class="btn btn-outline btn-small">+ Add Webhook</button>
		</div>
		<div class="empty-state">
			<div class="empty-state-icon">🔗</div>
			<h3>No Webhooks Configured</h3>
			<p>Set up webhooks to receive real-time notifications about vehicle events</p>
		</div>
	</div>

	<div class="card" style="border-color: var(--danger);">
		<div class="card-header">
			<h3 class="card-title" style="color: var(--danger);">Danger Zone</h3>
		</div>
		<p style="color: var(--gray); margin-bottom: 1rem;">
			Once you delete your account, there is no going back. Please be certain.
		</p>
		<button on:click={deleteAccount} class="btn btn-danger btn-small">Delete Account</button>
	</div>
</div>
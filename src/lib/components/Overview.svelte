<script lang="ts">
	import { apiKeys } from '$lib/stores/apiKeys';

	$: firstApiKey = $apiKeys[0]?.key || 'whs_live_...';
</script>

<div>
	<div class="page-header">
		<h2>Dashboard Overview</h2>
		<p>Monitor your fleet tracking infrastructure at a glance</p>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">24</div>
					<div class="stat-label">Active Vehicles</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);">🚛</div>
			</div>
			<span class="stat-change positive">↑ 12% from last month</span>
		</div>

		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">1.2M</div>
					<div class="stat-label">GPS Points Today</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #22c55e, #10b981);">📍</div>
			</div>
			<span class="stat-change positive">↑ 8% from yesterday</span>
		</div>

		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">18ms</div>
					<div class="stat-label">Avg Query Time</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #ec4899, #f43f5e);">⚡</div>
			</div>
			<span class="stat-change positive">↓ 6ms improvement</span>
		</div>

		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">99.98%</div>
					<div class="stat-label">Uptime (30d)</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b, #f97316);">🔄</div>
			</div>
			<span class="stat-change positive">↑ 0.05% from last month</span>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h3 class="card-title">Quick Start</h3>
		</div>
		<p style="color: var(--gray); margin-bottom: 1.5rem;">
			Get started with the WebHost.Systems API in minutes. Copy your API key and start tracking!
		</p>
		<div style="background: var(--dark); color: white; padding: 1.5rem; border-radius: 12px; font-family: monospace; font-size: 0.875rem; line-height: 1.8; overflow-x: auto;">
			<div style="color: #6b7280;">// Install the client</div>
			<div style="color: #a5d6a7;">npm install @webhost.systems/client</div>
			<br>
			<div style="color: #6b7280;">// Initialize and start tracking</div>
			<div>{@html `<span style="color: #c792ea;">import</span> { WebHostClient } <span style="color: #c792ea;">from</span> <span style="color: #a5d6a7;">'@webhost.systems/client'</span>;`}</div>
			<br>
			<div>{@html `<span style="color: #c792ea;">const</span> client = <span style="color: #c792ea;">new</span> <span style="color: #82aaff;">WebHostClient</span>({`}</div>
			<div>&nbsp;&nbsp;{@html `<span style="color: #f78c6c;">apiKey</span>: <span style="color: #a5d6a7;">'${firstApiKey}'</span>`}</div>
			<div>});</div>
		</div>
	</div>
</div>
<div>
	<div class="page-header">
		<h2>Usage & Billing</h2>
		<p>Track your API usage and manage your subscription</p>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">47%</div>
					<div class="stat-label">Vehicle Limit Used</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);">📊</div>
			</div>
			<div style="margin-top: 1rem; color: var(--gray); font-size: 0.875rem;">24 of 50 vehicles</div>
		</div>

		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">68%</div>
					<div class="stat-label">GPS Points Used</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #22c55e, #10b981);">📍</div>
			</div>
			<div style="margin-top: 1rem; color: var(--gray); font-size: 0.875rem;">340K of 500K daily limit</div>
		</div>

		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">32</div>
					<div class="stat-label">Active Geofences</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #ec4899, #f43f5e);">🗺️</div>
			</div>
			<div style="margin-top: 1rem; color: var(--gray); font-size: 0.875rem;">32 of 50 geofences</div>
		</div>

		<div class="stat-card">
			<div class="stat-header">
				<div>
					<div class="stat-value">$49</div>
					<div class="stat-label">Current Plan</div>
				</div>
				<div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b, #f97316);">💳</div>
			</div>
			<div style="margin-top: 1rem;">
				<span class="badge badge-warning">Starter Plan</span>
			</div>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h3 class="card-title">Current Subscription</h3>
			<button class="btn btn-outline btn-small">Upgrade Plan</button>
		</div>
		<div style="margin-bottom: 1.5rem;">
			<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
				<span style="font-weight: 600; color: var(--dark);">Starter Plan</span>
				<span style="font-weight: 700; color: var(--dark);">$49/month</span>
			</div>
			<p style="color: var(--gray); font-size: 0.875rem; margin-bottom: 1rem;">Next billing date: January 15, 2025</p>
		</div>
		<div style="background: var(--light); padding: 1.5rem; border-radius: 12px;">
			<div style="font-weight: 600; margin-bottom: 1rem; color: var(--dark);">Plan includes:</div>
			<ul style="list-style: none; display: grid; gap: 0.75rem;">
				<li style="display: flex; align-items: center; gap: 0.5rem; color: var(--gray);">
					<span style="color: var(--success); font-weight: 900;">✓</span> 50 vehicles
				</li>
				<li style="display: flex; align-items: center; gap: 0.5rem; color: var(--gray);">
					<span style="color: var(--success); font-weight: 900;">✓</span> 500K GPS points/day
				</li>
				<li style="display: flex; align-items: center; gap: 0.5rem; color: var(--gray);">
					<span style="color: var(--success); font-weight: 900;">✓</span> 90-day data retention
				</li>
				<li style="display: flex; align-items: center; gap: 0.5rem; color: var(--gray);">
					<span style="color: var(--success); font-weight: 900;">✓</span> Priority support
				</li>
			</ul>
		</div>
	</div>

	<div class="card">
		<div class="card-header">
			<h3 class="card-title">Usage History</h3>
		</div>
		<div style="overflow-x: auto;">
			<table style="width: 100%; border-collapse: collapse;">
				<thead>
					<tr style="border-bottom: 2px solid var(--border);">
						<th style="text-align: left; padding: 0.75rem; color: var(--gray); font-weight: 600; font-size: 0.875rem;">Date</th>
						<th style="text-align: left; padding: 0.75rem; color: var(--gray); font-weight: 600; font-size: 0.875rem;">GPS Points</th>
						<th style="text-align: left; padding: 0.75rem; color: var(--gray); font-weight: 600; font-size: 0.875rem;">API Requests</th>
						<th style="text-align: left; padding: 0.75rem; color: var(--gray); font-weight: 600; font-size: 0.875rem;">Status</th>
					</tr>
				</thead>
				<tbody>
					<tr style="border-bottom: 1px solid var(--border);">
						<td style="padding: 0.75rem; color: var(--dark);">Oct 14, 2025</td>
						<td style="padding: 0.75rem; color: var(--dark);">342,156</td>
						<td style="padding: 0.75rem; color: var(--dark);">18,234</td>
						<td style="padding: 0.75rem;"><span class="badge badge-success">Active</span></td>
					</tr>
					<tr style="border-bottom: 1px solid var(--border);">
						<td style="padding: 0.75rem; color: var(--dark);">Oct 13, 2025</td>
						<td style="padding: 0.75rem; color: var(--dark);">389,421</td>
						<td style="padding: 0.75rem; color: var(--dark);">21,567</td>
						<td style="padding: 0.75rem;"><span class="badge badge-success">Completed</span></td>
					</tr>
					<tr>
						<td style="padding: 0.75rem; color: var(--dark);">Oct 12, 2025</td>
						<td style="padding: 0.75rem; color: var(--dark);">298,765</td>
						<td style="padding: 0.75rem; color: var(--dark);">16,890</td>
						<td style="padding: 0.75rem;"><span class="badge badge-success">Completed</span></td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</div>
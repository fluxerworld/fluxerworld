/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {Layout} from '@fluxer/admin/src/components/Layout';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {Input} from '@fluxer/ui/src/components/Form';
import {Grid, Stack} from '@fluxer/ui/src/components/Layout';
import type {FC} from 'hono/jsx';

export type BanType = 'ip' | 'email' | 'phone';

interface BanConfig {
	title: string;
	route: string;
	inputLabel: string;
	inputName: string;
	inputType: 'text' | 'email' | 'tel';
	placeholder: string;
	entityName: string;
	activePage: string;
}

export function getBanConfig(banType: BanType): BanConfig {
	switch (banType) {
		case 'ip':
			return {
				title: 'IP Bans',
				route: '/ip-bans',
				inputLabel: 'IP Address or CIDR',
				inputName: 'ip',
				inputType: 'text',
				placeholder: '192.168.1.1 or 192.168.0.0/16',
				entityName: 'IP/CIDR',
				activePage: 'ip-bans',
			};
		case 'email':
			return {
				title: 'Email Bans',
				route: '/email-bans',
				inputLabel: 'Email Address',
				inputName: 'email',
				inputType: 'email',
				placeholder: 'user@example.com',
				entityName: 'Email',
				activePage: 'email-bans',
			};
		case 'phone':
			return {
				title: 'Phone Bans',
				route: '/phone-bans',
				inputLabel: 'Phone Number',
				inputName: 'phone',
				inputType: 'tel',
				placeholder: '+1234567890',
				entityName: 'Phone',
				activePage: 'phone-bans',
			};
	}
}

export interface BanManagementPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	banType: BanType;
	csrfToken: string;
	listResult?: {ok: true; bans: Array<{value: string; reverseDns?: string | null}>} | {ok: false; errorMessage: string};
}

const BanCard: FC<{config: Config; banConfig: BanConfig; csrfToken: string}> = ({config, banConfig, csrfToken}) => {
	return (
		<Card padding="md">
			<Stack gap="4">
				<Heading level={3} size="base">
					Ban {banConfig.inputLabel}
				</Heading>
				<form method="post" action={`${config.basePath}${banConfig.route}?action=ban`}>
					<CsrfInput token={csrfToken} />
					<Stack gap="4">
						<Input
							label={banConfig.inputLabel}
							name={banConfig.inputName}
							type={banConfig.inputType}
							required={true}
							placeholder={banConfig.placeholder}
						/>
						<Input
							label="Private reason (audit log, optional)"
							name="audit_log_reason"
							type="text"
							required={false}
							placeholder="Why is this ban being applied?"
						/>
						<Button type="submit" variant="primary">
							Ban {banConfig.entityName}
						</Button>
					</Stack>
				</form>
			</Stack>
		</Card>
	);
};

const CheckBanCard: FC<{config: Config; banConfig: BanConfig; csrfToken: string}> = ({
	config,
	banConfig,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<Stack gap="4">
				<Heading level={3} size="base">
					Check {banConfig.inputLabel} Ban Status
				</Heading>
				<form method="post" action={`${config.basePath}${banConfig.route}?action=check`}>
					<CsrfInput token={csrfToken} />
					<Stack gap="4">
						<Input
							label={banConfig.inputLabel}
							name={banConfig.inputName}
							type={banConfig.inputType}
							required={true}
							placeholder={banConfig.placeholder}
						/>
						<Button type="submit" variant="primary">
							Check Status
						</Button>
					</Stack>
				</form>
			</Stack>
		</Card>
	);
};

const UnbanCard: FC<{config: Config; banConfig: BanConfig; csrfToken: string}> = ({config, banConfig, csrfToken}) => {
	return (
		<Card padding="md">
			<Stack gap="4">
				<Heading level={3} size="base">
					Remove {banConfig.inputLabel} Ban
				</Heading>
				<form method="post" action={`${config.basePath}${banConfig.route}?action=unban`}>
					<CsrfInput token={csrfToken} />
					<Stack gap="4">
						<Input
							label={banConfig.inputLabel}
							name={banConfig.inputName}
							type={banConfig.inputType}
							required={true}
							placeholder={banConfig.placeholder}
						/>
						<Input
							label="Private reason (audit log, optional)"
							name="audit_log_reason"
							type="text"
							required={false}
							placeholder="Why is this ban being removed?"
						/>
						<Button type="submit" variant="danger">
							Unban {banConfig.entityName}
						</Button>
					</Stack>
				</form>
			</Stack>
		</Card>
	);
};

const BanListCard: FC<{
	config: Config;
	banType: BanType;
	banConfig: BanConfig;
	listResult: BanManagementPageProps['listResult'];
	csrfToken: string;
}> = ({config, banType, banConfig, listResult, csrfToken}) => {
	if (!listResult) return null;

	return (
		<Card padding="md">
			<Stack gap="4">
				<Heading level={3} size="base">
					Current bans
				</Heading>
				{!listResult.ok ? (
					<Text size="sm" color="muted">
						Failed to load bans list: {listResult.errorMessage}
					</Text>
				) : listResult.bans.length === 0 ? (
					<Text size="sm" color="muted">
						No {banConfig.entityName.toLowerCase()} bans found
					</Text>
				) : (
					<div class="overflow-x-auto">
						<table class="w-full border-collapse text-sm">
							<thead>
								<tr class="border-neutral-200 border-b text-left text-neutral-600">
									<th class="px-3 py-2">{banConfig.inputLabel}</th>
									{banType === 'ip' && <th class="px-3 py-2">Reverse DNS</th>}
									<th class="px-3 py-2">Actions</th>
								</tr>
							</thead>
							<tbody>
								{listResult.bans.map((ban) => (
									<tr class="border-neutral-200 border-b">
										<td class="px-3 py-2">
											<span class="font-mono">{ban.value}</span>
											<a
												href={`${config.basePath}/users?q=${encodeURIComponent(ban.value)}`}
												class="ml-2 text-blue-600 text-xs no-underline hover:underline"
											>
												Search users
											</a>
										</td>
										{banType === 'ip' && <td class="px-3 py-2 text-neutral-700">{ban.reverseDns ?? '—'}</td>}
										<td class="px-3 py-2">
											<form
												method="post"
												action={`${config.basePath}${banConfig.route}?action=unban`}
												onsubmit={`return confirm('Unban ${banConfig.entityName} ${ban.value}?')`}
											>
												<CsrfInput token={csrfToken} />
												<input type="hidden" name={banConfig.inputName} value={ban.value} />
												<Button type="submit" variant="danger" size="small">
													Unban
												</Button>
											</form>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Stack>
		</Card>
	);
};

export const BanManagementPage: FC<BanManagementPageProps> = ({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	banType,
	csrfToken,
	listResult,
}) => {
	const banConfig = getBanConfig(banType);

	return (
		<Layout
			csrfToken={csrfToken}
			title={banConfig.title}
			activePage={banConfig.activePage}
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<Stack gap="6">
				<Heading level={1}>{banConfig.title}</Heading>

				<Grid cols="2" gap="6">
					<BanCard config={config} banConfig={banConfig} csrfToken={csrfToken} />
					<CheckBanCard config={config} banConfig={banConfig} csrfToken={csrfToken} />
				</Grid>

				<UnbanCard config={config} banConfig={banConfig} csrfToken={csrfToken} />
				<BanListCard
					config={config}
					banType={banType}
					banConfig={banConfig}
					listResult={listResult}
					csrfToken={csrfToken}
				/>
			</Stack>
		</Layout>
	);
};

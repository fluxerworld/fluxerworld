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

import {hasPermission} from '@fluxer/admin/src/AccessControlList';
import {getErrorMessage} from '@fluxer/admin/src/api/Errors';
import {getInstanceConfig, listSnowflakeReservations} from '@fluxer/admin/src/api/InstanceConfig';
import {getLimitConfig} from '@fluxer/admin/src/api/LimitConfig';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Grid} from '@fluxer/admin/src/components/ui/Grid';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Caption, Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {
	InstanceConfigResponse,
	LimitConfigGetResponse,
	SnowflakeReservationEntry,
	SsoConfigResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {Checkbox, Input, Select} from '@fluxer/ui/src/components/Form';
import {FlexRowBetween} from '@fluxer/ui/src/components/Layout';
import {
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableHeaderCell,
	TableRow,
} from '@fluxer/ui/src/components/Table';
import type {FC} from 'hono/jsx';
import type {z} from 'zod';

type LimitConfigResponse = z.infer<typeof LimitConfigGetResponse>;

export interface InstanceConfigPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	csrfToken: string;
}

export async function InstanceConfigPage({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	csrfToken,
}: InstanceConfigPageProps) {
	const configResult = await getInstanceConfig(config, session);
	const limitResult = await getLimitConfig(config, session);

	const adminAcls = currentAdmin?.acls ?? [];
	const reservationViewAcl = hasPermission(adminAcls, AdminACLs.INSTANCE_SNOWFLAKE_RESERVATION_VIEW);
	const reservationManageAcl = hasPermission(adminAcls, AdminACLs.INSTANCE_SNOWFLAKE_RESERVATION_MANAGE);

	let reservations: Array<SnowflakeReservationEntry> = [];
	if (reservationViewAcl && !config.selfHosted) {
		const reservationResult = await listSnowflakeReservations(config, session);
		if (reservationResult.ok) {
			reservations = reservationResult.data.sort((a, b) => a.email.localeCompare(b.email));
		}
	}

	if (!configResult.ok) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Instance Configuration"
				activePage="instance-config"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
			>
				<ErrorAlert error={getErrorMessage(configResult.error)} />
			</Layout>
		);
	}

	if (!limitResult.ok) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Instance Configuration"
				activePage="instance-config"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
			>
				<ErrorAlert error={getErrorMessage(limitResult.error)} />
			</Layout>
		);
	}

	const instanceConfig = configResult.data;
	const limitInfo = limitResult.data;

	return (
		<Layout
			csrfToken={csrfToken}
			title="Instance Configuration"
			activePage="instance-config"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<Stack gap="lg">
				<Heading level={1}>Instance Configuration</Heading>
				<ConfigForm config={config} instanceConfig={instanceConfig} csrfToken={csrfToken} />
				<SsoConfigForm config={config} sso={instanceConfig.sso} csrfToken={csrfToken} />
				<LimitConfigSection config={config} limitInfo={limitInfo} />
				{reservationViewAcl && !config.selfHosted && (
					<SnowflakeReservationSection
						config={config}
						reservations={reservations}
						canManage={reservationManageAcl}
						csrfToken={csrfToken}
					/>
				)}
			</Stack>
		</Layout>
	);
}

const ConfigForm: FC<{config: Config; instanceConfig: InstanceConfigResponse; csrfToken: string}> = ({
	config,
	instanceConfig,
	csrfToken,
}) => {
	const hours = Array.from({length: 24}, (_, i) => i);
	const hourOptions = hours.map((hour) => ({value: hour.toString(), label: `${hour}:00`}));

	return (
		<Card padding="md">
			<Stack gap="md">
				<Heading level={2} size="base">
					Manual Review Settings
				</Heading>
				<Text size="sm" color="muted">
					Configure whether new registrations require manual review before the account is activated.
				</Text>
				<form method="post" action={`${config.basePath}/instance-config?action=update`}>
					<CsrfInput token={csrfToken} />
					<Stack gap="lg">
						<Stack gap="sm">
							<Checkbox
								name="manual_review_enabled"
								value="true"
								label="Enable manual review for new registrations"
								checked={instanceConfig.manual_review_enabled}
							/>
							<Caption>When enabled, new accounts will require approval before they can use the platform.</Caption>
						</Stack>

						<Stack gap="md">
							<Stack gap="sm">
								<Checkbox
									name="manual_review_schedule_enabled"
									value="true"
									label="Enable schedule-based activation"
									checked={instanceConfig.manual_review_schedule_enabled}
								/>
								<Caption>When enabled, manual review will only be active during the specified hours (UTC).</Caption>
							</Stack>
							<Grid cols={2} gap="md">
								<Select
									label="Start Hour (UTC)"
									name="manual_review_schedule_start_hour_utc"
									value={instanceConfig.manual_review_schedule_start_hour_utc.toString()}
									options={hourOptions}
								/>
								<Select
									label="End Hour (UTC)"
									name="manual_review_schedule_end_hour_utc"
									value={instanceConfig.manual_review_schedule_end_hour_utc.toString()}
									options={hourOptions}
								/>
							</Grid>
						</Stack>

						<Stack gap="md">
							<Input
								label="Registration Alerts Webhook URL"
								name="registration_alerts_webhook_url"
								type="url"
								value={instanceConfig.registration_alerts_webhook_url ?? ''}
								placeholder="https://hooks.example.com/webhook"
								helper="Webhook URL for receiving alerts about new user registrations."
							/>
							<Input
								label="System Alerts Webhook URL"
								name="system_alerts_webhook_url"
								type="url"
								value={instanceConfig.system_alerts_webhook_url ?? ''}
								placeholder="https://hooks.example.com/webhook"
								helper="Webhook URL for receiving system alerts (virus scan failures, etc.)."
							/>
						</Stack>

						<Button type="submit" variant="primary">
							Save Configuration
						</Button>
					</Stack>
				</form>
			</Stack>
		</Card>
	);
};

const SsoConfigForm: FC<{config: Config; sso: SsoConfigResponse; csrfToken: string}> = ({config, sso, csrfToken}) => {
	const allowedDomainsText = sso.allowed_domains.join('\n');

	return (
		<Card padding="md">
			<Stack gap="md">
				<Heading level={2} size="base">
					Single Sign-On (SSO)
				</Heading>
				<Text size="sm" color="muted">
					Configure OIDC-style SSO for the admin and client apps. When enabled, password logins will be blocked and
					users will be directed through your SSO provider.
				</Text>
				<form method="post" action={`${config.basePath}/instance-config?action=update_sso`}>
					<CsrfInput token={csrfToken} />
					<Stack gap="lg">
						<Stack gap="sm">
							<Checkbox
								name="sso_enabled"
								value="true"
								label="Enable SSO (disables local password login)"
								checked={sso.enabled}
							/>
							<Checkbox
								name="sso_auto_provision"
								value="true"
								label="Automatically provision users on first SSO login"
								checked={sso.auto_provision}
							/>
						</Stack>

						<Grid cols={2} gap="md">
							<Input
								label="Display Name"
								name="sso_display_name"
								type="text"
								value={sso.display_name ?? ''}
								placeholder="Example Identity Provider"
							/>
							<Input
								label="Issuer"
								name="sso_issuer"
								type="url"
								value={sso.issuer ?? ''}
								placeholder="https://idp.example.com"
							/>
							<Input
								label="Authorization URL"
								name="sso_authorization_url"
								type="url"
								value={sso.authorization_url ?? ''}
								placeholder="https://idp.example.com/oauth/authorize"
							/>
							<Input
								label="Token URL"
								name="sso_token_url"
								type="url"
								value={sso.token_url ?? ''}
								placeholder="https://idp.example.com/oauth/token"
							/>
							<Input
								label="User Info URL"
								name="sso_userinfo_url"
								type="url"
								value={sso.userinfo_url ?? ''}
								placeholder="https://idp.example.com/oauth/userinfo"
							/>
							<Input
								label="JWKS URL"
								name="sso_jwks_url"
								type="url"
								value={sso.jwks_url ?? ''}
								placeholder="https://idp.example.com/.well-known/jwks.json"
							/>
						</Grid>

						<Grid cols={2} gap="md">
							<Input
								label="Client ID"
								name="sso_client_id"
								type="text"
								value={sso.client_id ?? ''}
								placeholder="client-id"
							/>
							<Stack gap="sm">
								<Input
									label="Client Secret"
									name="sso_client_secret"
									type="password"
									value=""
									placeholder="Leave blank to keep existing"
								/>
								<Stack gap="sm">
									<Checkbox name="sso_clear_client_secret" value="true" label="Clear secret" />
									<Caption>
										{sso.client_secret_set
											? 'A secret is set. Check to clear, or enter a new value to rotate.'
											: 'No secret set yet.'}
									</Caption>
								</Stack>
							</Stack>
						</Grid>

						<Grid cols={2} gap="md">
							<Input
								label="Scope"
								name="sso_scope"
								type="text"
								value={sso.scope ?? ''}
								placeholder="openid email profile"
							/>
							<Input
								label="Redirect URI"
								name="sso_redirect_uri"
								type="url"
								value={sso.redirect_uri ?? ''}
								disabled={true}
								helper="Configure this exact URI in your IdP. It is derived from the public gateway URL."
							/>
						</Grid>

						<Input
							label="Allowed Email Domains"
							name="sso_allowed_domains"
							type="text"
							value={allowedDomainsText}
							placeholder="example.com"
							helper="Limit SSO logins to these domains (one per line). Leave empty to allow any verified email."
						/>

						<Button type="submit" variant="primary">
							Save SSO Settings
						</Button>
					</Stack>
				</form>
			</Stack>
		</Card>
	);
};

const LimitConfigSection: FC<{config: Config; limitInfo: LimitConfigResponse}> = ({config, limitInfo}) => {
	const description = limitInfo.self_hosted
		? 'Self-hosted instance with all premium features enabled. Configure user and guild limits.'
		: 'Configure limit rules that control user and guild restrictions based on traits and features.';

	return (
		<Card padding="md">
			<FlexRowBetween>
				<Stack gap="sm">
					<Heading level={2} size="base">
						Limit Configuration
					</Heading>
					<Caption>{description}</Caption>
				</Stack>
				<Button href={`${config.basePath}/limit-config`} variant="primary">
					Configure Limits
				</Button>
			</FlexRowBetween>
		</Card>
	);
};

const SnowflakeReservationSection: FC<{
	config: Config;
	reservations: Array<SnowflakeReservationEntry>;
	canManage: boolean;
	csrfToken: string;
}> = ({config, reservations, canManage, csrfToken}) => {
	return (
		<Card padding="md">
			<Stack gap="md">
				<Heading level={2} size="base">
					Snowflake Reservations
				</Heading>
				<Caption>
					Reserve specific snowflake IDs for trusted testers. Every reservation maps a normalized email to a hard ID.
				</Caption>
				<SnowflakeReservationTable
					config={config}
					reservations={reservations}
					canManage={canManage}
					csrfToken={csrfToken}
				/>
				{canManage ? (
					<AddSnowflakeReservationForm config={config} csrfToken={csrfToken} />
				) : (
					<Caption>You need additional permissions to modify reservations.</Caption>
				)}
			</Stack>
		</Card>
	);
};

const SnowflakeReservationTable: FC<{
	config: Config;
	reservations: Array<SnowflakeReservationEntry>;
	canManage: boolean;
	csrfToken: string;
}> = ({config, reservations, canManage, csrfToken}) => {
	return (
		<TableContainer>
			<Table>
				<TableHead>
					<TableRow>
						<TableHeaderCell label="Email" />
						<TableHeaderCell label="Snowflake" />
						<TableHeaderCell label="Updated At" />
						<TableHeaderCell label="Actions" />
					</TableRow>
				</TableHead>
				<TableBody>
					{reservations.length === 0 ? (
						<TableRow>
							<TableCell colSpan={4}>
								<Caption>No reservations configured</Caption>
							</TableCell>
						</TableRow>
					) : (
						reservations.map((entry) => (
							<TableRow>
								<TableCell>
									<Text size="sm">{entry.email}</Text>
								</TableCell>
								<TableCell muted>{entry.snowflake}</TableCell>
								<TableCell muted>{entry.updated_at ? entry.updated_at : <Caption>-</Caption>}</TableCell>
								<TableCell>
									{canManage ? (
										<form method="post" action={`${config.basePath}/instance-config?action=delete_reservation`}>
											<CsrfInput token={csrfToken} />
											<input type="hidden" name="reservation_email" value={entry.email} />
											<Button type="submit" variant="danger" size="small">
												Remove
											</Button>
										</form>
									) : (
										<Caption>-</Caption>
									)}
								</TableCell>
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</TableContainer>
	);
};

const AddSnowflakeReservationForm: FC<{config: Config; csrfToken: string}> = ({config, csrfToken}) => {
	return (
		<form method="post" action={`${config.basePath}/instance-config?action=add_reservation`}>
			<CsrfInput token={csrfToken} />
			<Stack gap="md">
				<FormFieldGroup
					label="Email (normalized)"
					helper="Use normalized email addresses (lowercase) when reserving snowflake IDs."
					htmlFor="reservation-email"
				>
					<Input id="reservation-email" name="reservation_email" type="email" placeholder="user@example.com" />
				</FormFieldGroup>
				<FormFieldGroup label="Snowflake ID" htmlFor="reservation-snowflake">
					<Input id="reservation-snowflake" name="reservation_snowflake" type="text" placeholder="123456789012345678" />
				</FormFieldGroup>
				<Button type="submit" variant="primary">
					Reserve Snowflake
				</Button>
			</Stack>
		</form>
	);
};

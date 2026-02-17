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
import {getDefaultValue, getKeysByCategory, getLimitConfig, isModified} from '@fluxer/admin/src/api/LimitConfig';
import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Caption, Heading, Label, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {LIMIT_KEY_BOUNDS} from '@fluxer/constants/src/LimitBounds';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {LimitConfigGetResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {FlexRowBetween} from '@fluxer/ui/src/components/Layout';
import type {Child, FC} from 'hono/jsx';
import type {z} from 'zod';

type LimitConfigResponse = z.infer<typeof LimitConfigGetResponse>;
type LimitRule = LimitConfigResponse['limit_config']['rules'][number];
type LimitKeyMetadata = LimitConfigResponse['metadata'][string];

const CATEGORY_ORDER = ['features', 'messages', 'guilds', 'channels', 'expressions', 'files', 'social'];

function orderRulesDefaultFirst(rules: Array<LimitRule>): Array<LimitRule> {
	const defaultIndex = rules.findIndex((rule) => rule.id === 'default');
	if (defaultIndex <= 0) {
		return [...rules];
	}

	const sorted = [...rules];
	const [defaultRule] = sorted.splice(defaultIndex, 1);
	return [defaultRule, ...sorted];
}

export interface LimitConfigPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	selectedRule?: string;
	csrfToken: string;
}

export async function LimitConfigPage({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	selectedRule,
	csrfToken,
}: LimitConfigPageProps) {
	const result = await getLimitConfig(config, session);
	const adminAcls = currentAdmin?.acls ?? [];
	const canUpdate = hasPermission(adminAcls, AdminACLs.INSTANCE_LIMIT_CONFIG_UPDATE);

	if (!result.ok) {
		return (
			<Layout
				csrfToken={csrfToken}
				title="Limit Configuration"
				activePage="limit-config"
				config={config}
				session={session}
				currentAdmin={currentAdmin}
				flash={flash}
				assetVersion={assetVersion}
			>
				<ErrorAlert error={getErrorMessage(result.error)} />
			</Layout>
		);
	}

	const response = result.data;
	const sortedRules = orderRulesDefaultFirst(response.limit_config.rules);
	const activeRuleId = selectedRule ?? sortedRules[0]?.id ?? 'default';

	return (
		<Layout
			csrfToken={csrfToken}
			title="Limit Configuration"
			activePage="limit-config"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<VStack gap={6}>
				<RenderHeader response={response} />
				<RenderRuleTabs config={config} rules={sortedRules} activeRuleId={activeRuleId} />
				<RenderRuleEditor
					config={config}
					response={response}
					ruleId={activeRuleId}
					canUpdate={canUpdate}
					csrfToken={csrfToken}
				/>
				{canUpdate && <RenderCreateRuleModal config={config} response={response} csrfToken={csrfToken} />}
			</VStack>
		</Layout>
	);
}

const RenderHeader: FC<{response: LimitConfigResponse}> = ({response}) => {
	const description = response.self_hosted
		? 'Self-hosted instance with all premium features enabled by default. Configure limits to customize user and guild restrictions.'
		: 'Configure limit rules that control user and guild restrictions. Different rules apply based on user traits (like premium) or guild features.';

	return (
		<Card padding="md">
			<VStack gap={2}>
				<Heading level={3} size="base">
					Limit Configuration
				</Heading>
				<Text color="muted">{description}</Text>
			</VStack>
		</Card>
	);
};

const RenderRuleTabs: FC<{config: Config; rules: Array<LimitRule>; activeRuleId: string}> = ({
	config,
	rules,
	activeRuleId,
}) => {
	return (
		<HStack gap={2}>
			<HStack gap={2}>
				{rules.map((rule) => {
					const isActive = rule.id === activeRuleId;
					const modifiedCount = rule.modifiedFields?.length ?? 0;
					const modifiedBadge =
						modifiedCount > 0 ? <RuleModifiedBadge count={modifiedCount} isActive={isActive} /> : null;

					return (
						<Button
							href={`${config.basePath}/limit-config?rule=${rule.id}`}
							variant={isActive ? 'primary' : 'secondary'}
							size="small"
						>
							<HStack gap={2}>
								{formatRuleName(rule)}
								{modifiedBadge}
							</HStack>
						</Button>
					);
				})}
			</HStack>
			<Button
				type="button"
				variant="secondary"
				size="small"
				onclick="document.getElementById('create-rule-modal').classList.remove('hidden')"
			>
				<Text size="sm">+ Create New Rule</Text>
			</Button>
		</HStack>
	);
};

function formatRuleName(rule: LimitRule): string {
	return rule.id.charAt(0).toUpperCase() + rule.id.slice(1);
}

const RuleModifiedBadge: FC<{count: number; isActive: boolean}> = ({count, isActive}) => {
	if (isActive) {
		return <ActiveModifiedBadge count={count} />;
	}
	return <InactiveModifiedBadge count={count} />;
};

const ActiveModifiedBadge: FC<{count: number}> = ({count}) => {
	return (
		<Text size="xs" class="rounded-full bg-white/20 px-1.5 py-0.5 text-white">
			{count} modified
		</Text>
	);
};

const InactiveModifiedBadge: FC<{count: number}> = ({count}) => {
	return (
		<Text size="xs" class="rounded-full bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
			{count} modified
		</Text>
	);
};

const RenderRuleHeader: FC<{config: Config; rule: LimitRule; canDelete: boolean; csrfToken: string}> = ({
	config,
	rule,
	canDelete,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<FlexRowBetween>
				<VStack gap={2}>
					<HStack gap={2}>
						<RuleTitle rule={rule} />
						<RuleId ruleId={rule.id} />
					</HStack>
					{rule.filters && <RuleFilters filters={rule.filters} />}
				</VStack>
				{canDelete && (
					<form
						method="post"
						action={`${config.basePath}/limit-config?action=delete&rule=${rule.id}`}
						onsubmit="return confirm('Are you sure you want to delete this rule? This action cannot be undone.');"
					>
						<CsrfInput token={csrfToken} />
						<Button type="submit" variant="danger" size="small">
							Delete Rule
						</Button>
					</form>
				)}
			</FlexRowBetween>
		</Card>
	);
};

const RuleTitle: FC<{rule: LimitRule}> = ({rule}) => {
	return (
		<Heading level={3} size="lg">
			{formatRuleName(rule)}
		</Heading>
	);
};

const RuleId: FC<{ruleId: string}> = ({ruleId}) => {
	return (
		<Text size="sm" color="muted">
			ID: {ruleId}
		</Text>
	);
};

const RuleFilters: FC<{filters: {traits?: Array<string>; guildFeatures?: Array<string>}}> = ({filters}) => {
	return (
		<VStack gap={1}>
			{filters.traits && filters.traits.length > 0 && (
				<Text size="sm" color="muted">
					Traits: {filters.traits.join(', ')}
				</Text>
			)}
			{filters.guildFeatures && filters.guildFeatures.length > 0 && (
				<Text size="sm" color="muted">
					Guild Features: {filters.guildFeatures.join(', ')}
				</Text>
			)}
		</VStack>
	);
};

const RenderFilterInputs: FC<{rule: LimitRule; editable: boolean}> = ({rule, editable}) => {
	if (!editable) return null;

	const traitValues = rule.filters?.traits ?? [];
	const featureValues = rule.filters?.guildFeatures ?? [];
	const traitValueText = traitValues.join(', ');
	const featureValueText = featureValues.join(', ');

	return (
		<Card padding="md">
			<VStack gap={4}>
				<VStack gap={2}>
					<VStack gap={1}>
						<Label>User Traits (Optional)</Label>
						<Text size="xs" color="muted">
							Separate values with commas; leave blank to disable this filter.
						</Text>
					</VStack>
					<Input type="text" name="traits" value={traitValueText} placeholder="e.g., premium, supporter" />
				</VStack>
				<VStack gap={2}>
					<VStack gap={1}>
						<Label>Guild Features (Optional)</Label>
						<Text size="xs" color="muted">
							Separate values with commas; leave blank to disable this filter.
						</Text>
					</VStack>
					<Input
						type="text"
						name="guild_features"
						value={featureValueText}
						placeholder="e.g., VIP_SERVERS, BOOSTER_LEVEL_2"
					/>
				</VStack>
			</VStack>
		</Card>
	);
};

const RenderRuleEditor: FC<{
	config: Config;
	response: LimitConfigResponse;
	ruleId: string;
	canUpdate: boolean;
	csrfToken: string;
}> = ({config, response, ruleId, canUpdate, csrfToken}) => {
	const rule = response.limit_config.rules.find((r) => r.id === ruleId);

	if (!rule) {
		return (
			<Card padding="md">
				<Text color="muted">Rule not found: {ruleId}</Text>
			</Card>
		);
	}

	const keysByCategory = getKeysByCategory(response);
	const canDelete = canUpdate && ruleId !== 'default';
	const formId = `limit-config-form-${ruleId}`;

	const ruleHeader = canUpdate ? (
		<RenderRuleHeader config={config} rule={rule} canDelete={canDelete} csrfToken={csrfToken} />
	) : null;

	if (canUpdate) {
		return (
			<VStack gap={6}>
				{ruleHeader}
				<form id={formId} method="post" action={`${config.basePath}/limit-config?action=update&rule=${ruleId}`}>
					<CsrfInput token={csrfToken} />
					<input type="hidden" name="rule_id" value={ruleId} />
					<VStack gap={6}>
						<RenderFilterInputs rule={rule} editable={true} />
						{CATEGORY_ORDER.map((category) => {
							const keys = keysByCategory[category];
							if (!keys) return null;
							return (
								<RenderCategorySection
									response={response}
									rule={rule}
									category={category}
									keys={keys}
									editable={true}
									formId={formId}
								/>
							);
						})}
						<RenderSubmitSection />
					</VStack>
				</form>
			</VStack>
		);
	}

	return (
		<VStack gap={6}>
			{ruleHeader}
			{CATEGORY_ORDER.map((category) => {
				const keys = keysByCategory[category];
				if (!keys) return null;
				return (
					<RenderCategorySection
						response={response}
						rule={rule}
						category={category}
						keys={keys}
						editable={false}
						formId={formId}
					/>
				);
			})}
		</VStack>
	);
};

const RenderCategorySection: FC<{
	response: LimitConfigResponse;
	rule: LimitRule;
	category: string;
	keys: Array<string>;
	editable: boolean;
	formId: string;
}> = ({response, rule, category, keys, editable, formId}) => {
	const categoryLabel = response.categories[category] ?? category.charAt(0).toUpperCase() + category.slice(1);

	return (
		<Card padding="md">
			<Heading level={3} size="base" class="mb-4">
				{categoryLabel}
			</Heading>
			<VStack gap={4}>
				{keys.map((key) => {
					const metadata = response.metadata[key];
					if (!metadata) return null;
					return (
						<RenderLimitField
							response={response}
							rule={rule}
							limitKey={key}
							metadata={metadata}
							editable={editable}
							formId={formId}
						/>
					);
				})}
			</VStack>
		</Card>
	);
};

const RenderLimitField: FC<{
	response: LimitConfigResponse;
	rule: LimitRule;
	limitKey: string;
	metadata: LimitKeyMetadata;
	editable: boolean;
	formId: string;
}> = ({response, rule, limitKey, metadata, editable, formId}) => {
	const currentValue = rule.limits[limitKey] ?? null;
	const defaultValue = getDefaultValue(response, rule.id, limitKey);
	const modified = isModified(rule, limitKey);

	if (metadata.isToggle) {
		return (
			<RenderToggleField
				limitKey={limitKey}
				metadata={metadata}
				currentValue={currentValue}
				isModified={modified}
				editable={editable}
			/>
		);
	}

	return (
		<RenderNumericField
			limitKey={limitKey}
			metadata={metadata}
			currentValue={currentValue}
			defaultValue={defaultValue}
			isModified={modified}
			editable={editable}
			formId={formId}
		/>
	);
};

const RenderToggleField: FC<{
	limitKey: string;
	metadata: LimitKeyMetadata;
	currentValue: number | null;
	isModified: boolean;
	editable: boolean;
}> = ({limitKey, metadata, currentValue, isModified, editable}) => {
	const isEnabled = currentValue !== null && currentValue > 0;

	return (
		<ToggleFieldContainer isModified={isModified}>
			<ToggleFieldLabel limitKey={limitKey} metadata={metadata} isModified={isModified} />
			<HStack gap={2}>
				{editable ? <ToggleSwitch limitKey={limitKey} isEnabled={isEnabled} /> : <ToggleStatus isEnabled={isEnabled} />}
			</HStack>
		</ToggleFieldContainer>
	);
};

const RenderNumericField: FC<{
	limitKey: string;
	metadata: LimitKeyMetadata;
	currentValue: number | null;
	defaultValue: number | null;
	isModified: boolean;
	editable: boolean;
	formId: string;
}> = ({limitKey, metadata, currentValue, defaultValue, isModified, editable, formId}) => {
	const valueStr = currentValue !== null ? currentValue.toString() : '';
	const placeholder = defaultValue !== null ? formatValueWithUnit(defaultValue, metadata.unit) : '';

	return (
		<NumericFieldContainer isModified={isModified}>
			<NumericFieldHeader
				limitKey={limitKey}
				metadata={metadata}
				isModified={isModified}
				editable={editable}
				defaultValue={defaultValue}
				formId={formId}
			/>
			<NumericFieldDescription description={metadata.description} limitKey={limitKey} />
			<HStack gap={3}>
				{editable ? (
					<NumericInput limitKey={limitKey} valueStr={valueStr} placeholder={placeholder} />
				) : (
					<NumericValue currentValue={currentValue} unit={metadata.unit} />
				)}
				{defaultValue !== null && <DefaultValueLabel defaultValue={defaultValue} unit={metadata.unit} />}
			</HStack>
		</NumericFieldContainer>
	);
};

const NumericFieldDescription: FC<{description: string; limitKey: string}> = ({description, limitKey}) => {
	const bounds = LIMIT_KEY_BOUNDS[limitKey as keyof typeof LIMIT_KEY_BOUNDS];
	return (
		<Caption variant="default" class="mb-2">
			{description}
			{bounds && ` (Allowed: ${bounds.min}\u2013${bounds.max})`}
		</Caption>
	);
};

const NumericInput: FC<{limitKey: string; valueStr: string; placeholder: string}> = ({
	limitKey,
	valueStr,
	placeholder,
}) => {
	const bounds = LIMIT_KEY_BOUNDS[limitKey as keyof typeof LIMIT_KEY_BOUNDS];
	return (
		<Input
			type="number"
			name={limitKey}
			id={limitKey}
			value={valueStr}
			placeholder={placeholder}
			min={bounds ? String(bounds.min) : '0'}
			max={bounds ? String(bounds.max) : undefined}
			class="max-w-xs"
		/>
	);
};

const NumericValue: FC<{currentValue: number | null; unit: string | null | undefined}> = ({currentValue, unit}) => {
	return (
		<Text size="sm" class="font-mono">
			{currentValue !== null ? formatValueWithUnit(currentValue, unit) : '-'}
		</Text>
	);
};

const DefaultValueLabel: FC<{defaultValue: number; unit: string | null | undefined}> = ({defaultValue, unit}) => {
	return <Caption variant="default">Default: {formatValueWithUnit(defaultValue, unit)}</Caption>;
};

const RenderScopeBadge: FC<{scope: string}> = ({scope}) => {
	let label: string;
	let color: string;

	switch (scope) {
		case 'user':
			label = 'User';
			color = 'bg-blue-100 text-blue-700';
			break;
		case 'guild':
			label = 'Guild';
			color = 'bg-purple-100 text-purple-700';
			break;
		case 'both':
			label = 'Both';
			color = 'bg-neutral-100 text-neutral-600';
			break;
		default:
			label = scope;
			color = 'bg-neutral-100 text-neutral-600';
	}

	return (
		<Text size="xs" class={`rounded px-1.5 py-0.5 ${color}`}>
			{label}
		</Text>
	);
};

const ToggleFieldContainer: FC<{isModified: boolean; children: Child}> = ({isModified, children}) => {
	return (
		<HStack
			gap={2}
			justify="between"
			class={`rounded-lg border p-3 ${isModified ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200 bg-white'}`}
		>
			{children}
		</HStack>
	);
};

const ToggleFieldLabel: FC<{limitKey: string; metadata: LimitKeyMetadata; isModified: boolean}> = ({
	limitKey,
	metadata,
	isModified,
}) => {
	return (
		<VStack gap={1} class="flex-1">
			<HStack gap={2}>
				<FieldLabel limitKey={limitKey} label={metadata.label} />
				<RenderScopeBadge scope={metadata.scope} />
				{isModified && <ModifiedIndicator />}
			</HStack>
			<FieldDescription description={metadata.description} />
		</VStack>
	);
};

const FieldLabel: FC<{limitKey: string; label: string}> = ({limitKey, label}) => {
	return (
		<Label htmlFor={limitKey} class="font-medium text-neutral-900 text-sm">
			{label}
		</Label>
	);
};

const ModifiedIndicator: FC = () => {
	return (
		<Text size="xs" class="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-700">
			Modified
		</Text>
	);
};

const FieldDescription: FC<{description: string}> = ({description}) => {
	return (
		<Caption variant="default" class="mt-0.5">
			{description}
		</Caption>
	);
};

const ToggleSwitch: FC<{limitKey: string; isEnabled: boolean}> = ({limitKey, isEnabled}) => {
	return (
		<label class="relative inline-flex cursor-pointer items-center">
			<input type="checkbox" name={limitKey} id={limitKey} value="1" checked={isEnabled} class="peer sr-only" />
			<div class="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300" />
		</label>
	);
};

const ToggleStatus: FC<{isEnabled: boolean}> = ({isEnabled}) => {
	return (
		<Text size="sm" weight="medium" color={isEnabled ? 'success' : 'muted'}>
			{isEnabled ? 'Enabled' : 'Disabled'}
		</Text>
	);
};

const NumericFieldContainer: FC<{isModified: boolean; children: Child}> = ({isModified, children}) => {
	return (
		<VStack
			gap={2}
			class={`rounded-lg border p-3 ${isModified ? 'border-neutral-200 bg-neutral-50' : 'border-neutral-200 bg-white'}`}
		>
			{children}
		</VStack>
	);
};

const NumericFieldHeader: FC<{
	limitKey: string;
	metadata: LimitKeyMetadata;
	isModified: boolean;
	editable: boolean;
	defaultValue: number | null;
	formId: string;
}> = ({limitKey, metadata, isModified, editable, defaultValue, formId}) => {
	return (
		<HStack gap={2} justify="between" class="mb-2">
			<HStack gap={2}>
				<FieldLabel limitKey={limitKey} label={metadata.label} />
				<RenderScopeBadge scope={metadata.scope} />
				{isModified && <ModifiedIndicator />}
			</HStack>
			{isModified && editable && <ResetButton limitKey={limitKey} defaultValue={defaultValue} formId={formId} />}
		</HStack>
	);
};

const ResetButton: FC<{limitKey: string; defaultValue: number | null; formId: string}> = ({
	limitKey,
	defaultValue,
	formId,
}) => {
	return (
		<Button
			type="button"
			variant="ghost"
			size="small"
			class="text-neutral-700 text-xs hover:text-neutral-900"
			onclick={buildResetScript(limitKey, defaultValue, formId)}
		>
			Reset to default
		</Button>
	);
};

function buildResetScript(limitKey: string, defaultValue: number | null, formId: string): string {
	const valueLiteral = JSON.stringify(defaultValue !== null ? defaultValue.toString() : '');
	const selectorLiteral = JSON.stringify(`#${formId} input[name="${limitKey}"]`);
	return `(function(){const field=document.querySelector(${selectorLiteral});if(!field)return;field.value=${valueLiteral};field.dispatchEvent(new Event('input',{bubbles:true}));})();`;
}

const RenderSubmitSection: FC = () => {
	return (
		<VStack class="sticky bottom-0 -mx-4 -mb-4 border-neutral-200 border-t bg-neutral-50 px-4 py-4">
			<HStack justify="end">
				<Button type="submit" variant="primary">
					Save Changes
				</Button>
			</HStack>
		</VStack>
	);
};

const RenderCreateRuleModal: FC<{config: Config; response: LimitConfigResponse; csrfToken: string}> = ({
	config,
	response,
	csrfToken,
}) => {
	const existingIds = response.limit_config.rules.map((r) => r.id).sort();

	return (
		<div id="create-rule-modal" class="fixed inset-0 z-50 flex hidden items-center justify-center bg-black/50">
			<VStack class="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
				<VStack gap={6} class="p-6">
					<HStack gap={2} justify="between">
						<Heading level={3} size="lg">
							Create New Limit Rule
						</Heading>
						<Button
							type="button"
							variant="ghost"
							class="text-neutral-400 hover:text-neutral-600"
							onclick="document.getElementById('create-rule-modal').classList.add('hidden')"
						>
							x
						</Button>
					</HStack>
					<form method="post" action={`${config.basePath}/limit-config?action=create`}>
						<CsrfInput token={csrfToken} />
						<VStack gap={4}>
							<VStack gap={2}>
								<VStack gap={1}>
									<Label htmlFor="new-rule-id">Rule ID</Label>
									<Text size="xs" color="muted">
										Unique identifier for this rule (e.g., 'supporter', 'vip')
									</Text>
								</VStack>
								<Input
									type="text"
									id="new-rule-id"
									name="rule_id"
									required
									placeholder="e.g., supporter, vip, custom"
								/>
							</VStack>
							<VStack gap={2}>
								<VStack gap={1}>
									<Label htmlFor="new-rule-traits">User Traits (Optional)</Label>
									<Text size="xs" color="muted">
										Users with these traits will match this rule
									</Text>
								</VStack>
								<Input type="text" id="new-rule-traits" name="traits" placeholder="e.g., premium, supporter" />
							</VStack>
							<VStack gap={2}>
								<VStack gap={1}>
									<Label htmlFor="new-rule-features">Guild Features (Optional)</Label>
									<Text size="xs" color="muted">
										Guilds with these features will match this rule
									</Text>
								</VStack>
								<Input
									type="text"
									id="new-rule-features"
									name="guild_features"
									placeholder="e.g., VIP_SERVERS, BOOSTER_LEVEL_2"
								/>
							</VStack>
							<VStack class="rounded bg-neutral-50 p-3">
								<Caption variant="default">Existing rule IDs: {existingIds.join(', ')}</Caption>
							</VStack>
							<HStack gap={2} justify="end" class="pt-4">
								<Button
									type="button"
									variant="secondary"
									size="small"
									onclick="document.getElementById('create-rule-modal').classList.add('hidden')"
								>
									Cancel
								</Button>
								<Button type="submit" variant="primary" size="small">
									Create Rule
								</Button>
							</HStack>
						</VStack>
					</form>
				</VStack>
			</VStack>
		</div>
	);
};

function formatValueWithUnit(value: number, unit: string | null | undefined): string {
	if (unit === 'bytes') {
		return formatBytes(value);
	}
	return value.toString();
}

function formatBytes(bytes: number): string {
	if (bytes >= 1_073_741_824) {
		return `${Math.floor(bytes / 1_073_741_824)} GB`;
	}
	if (bytes >= 1_048_576) {
		return `${Math.floor(bytes / 1_048_576)} MB`;
	}
	if (bytes >= 1024) {
		return `${Math.floor(bytes / 1024)} KB`;
	}
	return `${bytes} B`;
}

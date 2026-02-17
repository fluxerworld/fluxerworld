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

import {DISABLED_OPERATIONS, GUILD_FEATURES, SELF_HOSTED_GUILD_FEATURES} from '@fluxer/admin/src/AdminPackageConstants';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Text} from '@fluxer/admin/src/components/ui/Typography';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {Button} from '@fluxer/ui/src/components/Button';
import {NativeCheckboxItem} from '@fluxer/ui/src/components/CheckboxForm';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import type {FC} from 'hono/jsx';

interface RenderFeaturesFormProps {
	config: Config;
	currentFeatures: Array<string>;
	guildId: string;
	csrfToken: string;
	selfHosted: boolean;
}

export function RenderFeaturesForm({config, currentFeatures, guildId, csrfToken, selfHosted}: RenderFeaturesFormProps) {
	const knownFeatureValues = selfHosted ? SELF_HOSTED_GUILD_FEATURES : GUILD_FEATURES;
	const customFeatures = currentFeatures.filter(
		(f) => !knownFeatureValues.includes(f as (typeof GUILD_FEATURES)[number]),
	);

	return (
		<form
			method="post"
			action={`${config.basePath}/guilds/${guildId}?action=update_features&tab=features`}
			id="features-form"
		>
			<CsrfInput token={csrfToken} />
			<VStack gap={3}>
				{knownFeatureValues.map((feature) => {
					const isChecked = currentFeatures.includes(feature);

					return (
						<NativeCheckboxItem
							name="features[]"
							value={feature}
							label={feature}
							checked={isChecked}
							saveButtonId="features-save-button"
						/>
					);
				})}
			</VStack>
			<VStack gap={0} class="mt-6 border-neutral-200 border-t pt-6">
				<FormFieldGroup label="Custom Features">
					<Text color="muted" size="xs" class="mb-2">
						Enter custom feature strings separated by commas (e.g., CUSTOM_FEATURE_1, CUSTOM_FEATURE_2)
					</Text>
					<Input
						type="text"
						name="custom_features"
						placeholder="CUSTOM_FEATURE_1, CUSTOM_FEATURE_2"
						value={customFeatures.join(', ')}
					/>
				</FormFieldGroup>
			</VStack>
			<div class="mt-6 border-neutral-200 border-t pt-6" id="features-save-button">
				<Button type="submit" variant="primary">
					Save Changes
				</Button>
			</div>
		</form>
	);
}

interface RenderDisabledOperationsFormProps {
	config: Config;
	currentDisabledOperations: number;
	guildId: string;
	csrfToken: string;
}

export const RenderDisabledOperationsForm: FC<RenderDisabledOperationsFormProps> = ({
	config,
	currentDisabledOperations,
	guildId,
	csrfToken,
}) => (
	<form
		method="post"
		action={`${config.basePath}/guilds/${guildId}?action=update_disabled_operations&tab=settings`}
		id="disabled-ops-form"
	>
		<CsrfInput token={csrfToken} />
		<VStack gap={3}>
			{DISABLED_OPERATIONS.map((operation) => (
				<NativeCheckboxItem
					name="disabled_operations[]"
					value={operation.value.toString()}
					label={operation.name}
					checked={(currentDisabledOperations & operation.value) === operation.value}
					saveButtonId="disabled-ops-save-button"
				/>
			))}
		</VStack>
		<div class="mt-6 hidden border-neutral-200 border-t pt-6" id="disabled-ops-save-button">
			<Button type="submit" variant="primary">
				Save Changes
			</Button>
		</div>
	</form>
);

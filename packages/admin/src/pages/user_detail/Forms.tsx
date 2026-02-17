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

import {
	ALL_ACLS,
	PATCHABLE_FLAGS,
	SELF_HOSTED_PATCHABLE_FLAGS,
	SUSPICIOUS_ACTIVITY_FLAGS,
} from '@fluxer/admin/src/AdminPackageConstants';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Grid} from '@fluxer/admin/src/components/ui/Grid';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Textarea} from '@fluxer/admin/src/components/ui/Textarea';
import {Text} from '@fluxer/admin/src/components/ui/Typography';
import {hasBigIntFlag} from '@fluxer/admin/src/utils/Bigint';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {CheckboxForm, CheckboxItem} from '@fluxer/ui/src/components/CheckboxForm';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {Checkbox} from '@fluxer/ui/src/components/Form';
import type {FC} from 'hono/jsx';

export function FlagsForm({
	currentFlags,
	csrfToken,
	selfHosted,
}: {
	currentFlags: string;
	csrfToken: string;
	selfHosted: boolean;
}) {
	const flagsBigInt = BigInt(currentFlags);
	const flags = selfHosted ? SELF_HOSTED_PATCHABLE_FLAGS : PATCHABLE_FLAGS;
	return (
		<CheckboxForm id="flags-form" action="?action=update_flags">
			<CsrfInput token={csrfToken} />
			<Stack gap="sm">
				{flags.map((flag) => (
					<CheckboxItem
						name="flags[]"
						value={flag.value.toString()}
						label={flag.name}
						checked={hasBigIntFlag(flagsBigInt, flag.value)}
						saveButtonId="flags-form-save-button"
					/>
				))}
			</Stack>
		</CheckboxForm>
	);
}

export function SuspiciousFlagsForm({currentFlags, csrfToken}: {currentFlags: number; csrfToken: string}) {
	return (
		<CheckboxForm id="suspicious-flags-form" action="?action=update_suspicious_flags">
			<CsrfInput token={csrfToken} />
			<Stack gap="sm">
				{SUSPICIOUS_ACTIVITY_FLAGS.map((flag) => (
					<CheckboxItem
						name="suspicious_flags[]"
						value={String(flag.value)}
						label={flag.name}
						checked={(currentFlags & flag.value) === flag.value}
						saveButtonId="suspicious-flags-form-save-button"
					/>
				))}
			</Stack>
		</CheckboxForm>
	);
}

export function AclsForm({
	user,
	adminAcls,
	csrfToken,
}: {
	user: UserAdminResponse;
	adminAcls: Array<string>;
	csrfToken: string;
}) {
	const canEditAcls = adminAcls.includes(AdminACLs.ACL_SET_USER) || adminAcls.includes(AdminACLs.WILDCARD);
	const isDisabled = !canEditAcls;

	if (isDisabled) {
		if (user.acls.length === 0) {
			return (
				<Text size="sm" color="muted" class="italic">
					No ACLs assigned
				</Text>
			);
		}
		return (
			<Stack gap="sm">
				{user.acls.map((acl: string) => (
					<div class="rounded bg-neutral-50 px-2 py-1 text-neutral-700 text-sm">{acl}</div>
				))}
			</Stack>
		);
	}

	return (
		<CheckboxForm id="acls-form" action="?action=update_acls">
			<CsrfInput token={csrfToken} />
			<div class="max-h-96 overflow-y-auto overscroll-contain">
				<Stack gap="sm">
					{ALL_ACLS.map((acl) => (
						<CheckboxItem
							name="acls[]"
							value={acl}
							label={acl}
							checked={user.acls.includes(acl)}
							saveButtonId="acls-form-save-button"
						/>
					))}
				</Stack>
			</div>
		</CheckboxForm>
	);
}

export function TraitsForm({
	definitions,
	currentTraits,
	customTraits,
	csrfToken,
}: {
	definitions: Array<string>;
	currentTraits: Array<string>;
	customTraits: Array<string>;
	csrfToken: string;
}): ReturnType<
	FC<{
		definitions: Array<string>;
		currentTraits: Array<string>;
		customTraits: Array<string>;
		csrfToken: string;
	}>
> {
	const traitsPresent = definitions.length > 0;

	return (
		<form method="post" action="?action=update_traits&tab=overview">
			<CsrfInput token={csrfToken} />
			<Stack gap="md">
				{traitsPresent ? (
					<Grid cols={2} gap="sm">
						{definitions.map((def) => (
							<TraitCheckbox definition={def} currentTraits={currentTraits} />
						))}
					</Grid>
				) : (
					<Text size="sm" color="muted">
						No trait definitions are configured yet. Define them under Instance Configuration &gt; Limit Configuration.
					</Text>
				)}
				<FormFieldGroup
					label="Custom traits"
					htmlFor="custom-traits"
					helper="Enter additional trait names that do not appear above. Separate values with commas or line breaks."
				>
					<Textarea
						id="custom-traits"
						name="custom_traits"
						rows={3}
						placeholder="e.g. beta-tester, experimental"
						value={customTraits.join(', ')}
					/>
				</FormFieldGroup>
				<div class="flex justify-end">
					<Button type="submit" variant="primary">
						Save trait assignments
					</Button>
				</div>
			</Stack>
		</form>
	);
}

const TraitCheckbox: FC<{definition: string; currentTraits: Array<string>}> = ({definition, currentTraits}) => {
	const isChecked = currentTraits.includes(definition);

	return <Checkbox name="traits[]" value={definition} label={definition} checked={isChecked} />;
};

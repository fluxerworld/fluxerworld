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

import {Button} from '@fluxer/ui/src/components/Button';
import {Checkbox} from '@fluxer/ui/src/components/Form';
import type {Child, FC} from 'hono/jsx';

export interface CheckboxFormProps {
	id: string;
	action?: string;
	method?: 'post' | 'get';
	saveButtonId?: string;
	autoReveal?: boolean;
	saveButtonLabel?: string;
	children?: Child;
}

function getRevealScript(saveButtonId: string | undefined): string | undefined {
	if (!saveButtonId) {
		return undefined;
	}
	return `document.getElementById('${saveButtonId}')?.classList.remove('hidden');`;
}

export const CheckboxForm: FC<CheckboxFormProps> = ({
	id,
	action,
	method = 'post',
	saveButtonId,
	autoReveal = false,
	saveButtonLabel = 'Save Changes',
	children,
}) => {
	const actualSaveButtonId = saveButtonId ?? `${id}-save-button`;

	return (
		<form method={method} action={action} id={id}>
			{children}
			<div class={`mt-6 border-neutral-200 border-t pt-6 ${autoReveal ? '' : 'hidden'}`} id={actualSaveButtonId}>
				<Button type="submit" variant="primary" size="medium">
					{saveButtonLabel}
				</Button>
			</div>
		</form>
	);
};

export interface CheckboxItemProps {
	name: string;
	value: string;
	label: string;
	checked: boolean;
	saveButtonId?: string;
}

export const CheckboxItem: FC<CheckboxItemProps> = ({name, value, label, checked, saveButtonId}) => {
	const revealScript = getRevealScript(saveButtonId);
	return <Checkbox name={name} value={value} label={label} checked={checked} onChange={revealScript} />;
};

export interface NativeCheckboxItemProps {
	name: string;
	value: string | number;
	label: string;
	checked: boolean;
	saveButtonId?: string;
}

export const NativeCheckboxItem: FC<NativeCheckboxItemProps> = ({name, value, label, checked, saveButtonId}) => {
	return (
		<Checkbox
			name={name}
			value={String(value)}
			label={label}
			checked={checked}
			onChange={getRevealScript(saveButtonId)}
		/>
	);
};

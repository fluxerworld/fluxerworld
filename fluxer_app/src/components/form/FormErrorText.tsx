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

import styles from '@app/components/form/FormErrorText.module.css';
import {clsx} from 'clsx';

interface FormErrorTextProps {
	message: string | null | undefined;
	className?: string;
}

export function FormErrorText({message, className}: FormErrorTextProps) {
	if (!message) return null;
	return (
		<p className={clsx(styles.errorText, className)} role="alert" aria-live="polite" aria-atomic={true}>
			{message}
		</p>
	);
}

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

import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import {Alert} from '@fluxer/ui/src/components/Alert';
import {Card} from '@fluxer/ui/src/components/Card';
import type {FC} from 'hono/jsx';

interface ErrorAlertProps {
	error: string;
}

interface ErrorCardProps {
	title: string;
	message: string;
}

export const ErrorAlert: FC<ErrorAlertProps> = ({error}) => <Alert variant="error">{error}</Alert>;

export const ErrorCard: FC<ErrorCardProps> = ({title, message}) => (
	<Card padding="md">
		<VStack gap={4}>
			<Heading level={3} size="base">
				{title}
			</Heading>
			<Text size="sm" color="muted">
				{message}
			</Text>
		</VStack>
	</Card>
);

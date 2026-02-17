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
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Stack} from '@fluxer/admin/src/components/ui/Stack';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Card} from '@fluxer/ui/src/components/Card';
import type {FC} from 'hono/jsx';

export interface StrangePlacePageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	assetVersion: string;
	csrfToken: string;
	pageName?: string;
}

export const StrangePlacePage: FC<StrangePlacePageProps> = ({
	config,
	session,
	currentAdmin,
	flash,
	assetVersion,
	csrfToken,
	pageName,
}) => {
	return (
		<Layout
			csrfToken={csrfToken}
			title={pageName ?? 'Strange Place'}
			activePage=""
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			<VStack class="mx-auto max-w-2xl">
				<Card padding="lg">
					<Stack gap="md">
						<HStack align="center" justify="center" class="mx-auto h-16 w-16 rounded-full bg-neutral-100">
							<Text size="lg">?</Text>
						</HStack>
						<Heading level={2} size="lg" class="text-center">
							{pageName ?? "You've reached a strange place"}
						</Heading>
						<Text class="text-center">
							{pageName
								? 'This page is under construction.'
								: "You don't have access to any admin features. Contact an administrator to request access."}
						</Text>
					</Stack>
				</Card>
			</VStack>
		</Layout>
	);
};

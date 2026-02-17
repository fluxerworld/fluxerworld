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

import {ErrorAlert} from '@fluxer/admin/src/components/ErrorDisplay';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Heading} from '@fluxer/admin/src/components/ui/Typography';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
export interface LoginPageProps {
	config: Config;
	errorMessage: string | undefined;
}

export function LoginPage({config, errorMessage}: LoginPageProps) {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Login ~ Fluxer Admin</title>
				<link rel="stylesheet" href={`${config.basePath}/static/app.css`} />
			</head>
			<body class="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
				<VStack gap={4} class="w-full max-w-sm">
					<Card padding="lg">
						<VStack gap={8}>
							<VStack gap={2} align="center">
								<Heading level={1} size="xl">
									Fluxer Admin
								</Heading>
							</VStack>

							{errorMessage && <ErrorAlert error={errorMessage} />}

							<Button href={`${config.basePath}/auth/start`} variant="primary" fullWidth>
								Sign in with Fluxer
							</Button>
						</VStack>
					</Card>
				</VStack>
			</body>
		</html>
	);
}

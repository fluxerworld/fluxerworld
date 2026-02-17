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
import {Layout} from '@fluxer/admin/src/components/Layout';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {PageLayout} from '@fluxer/admin/src/components/ui/Layout/PageLayout';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Select} from '@fluxer/admin/src/components/ui/Select';
import {Textarea} from '@fluxer/admin/src/components/ui/Textarea';
import {Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {SliderInput} from '@fluxer/ui/src/components/SliderInput';
import type {FC} from 'hono/jsx';

const MAX_GIFT_CODES = 100;
const DEFAULT_GIFT_COUNT = 10;

const GIFT_PRODUCT_OPTIONS: Array<{value: string; label: string}> = [
	{value: 'gift_1_month', label: 'Gift - 1 Month subscription'},
	{value: 'gift_1_year', label: 'Gift - 1 Year subscription'},
	{value: 'gift_visionary', label: 'Gift - Visionary lifetime'},
];

export interface GiftCodesPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	adminAcls: Array<string>;
	assetVersion: string;
	csrfToken: string;
	generatedCodes?: Array<string>;
}

export const GiftCodesPage: FC<GiftCodesPageProps> = ({
	config,
	session,
	currentAdmin,
	flash,
	adminAcls,
	assetVersion,
	csrfToken,
	generatedCodes,
}) => {
	const hasGeneratePermission = hasPermission(adminAcls, AdminACLs.GIFT_CODES_GENERATE);
	const codesValue = generatedCodes ? generatedCodes.join('\n') : '';

	return (
		<Layout
			csrfToken={csrfToken}
			title="Gift Codes"
			activePage="gift-codes"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			{hasGeneratePermission ? (
				<PageLayout maxWidth="7xl">
					<VStack gap={6}>
						<Card padding="md">
							<VStack gap={2}>
								<Heading level={1} size="2xl">
									Generate Gift Codes
								</Heading>
							</VStack>
							<form id="gift-form" class="mt-4" method="post" action={`${config.basePath}/gift-codes`}>
								<CsrfInput token={csrfToken} />
								<VStack gap={4}>
									<VStack gap={4}>
										<VStack gap={1}>
											<SliderInput
												id="gift-count-slider"
												name="count"
												label="How many codes"
												min={1}
												max={MAX_GIFT_CODES}
												value={DEFAULT_GIFT_COUNT}
												rangeText={`Range: 1-${MAX_GIFT_CODES}`}
											/>
											<Text size="xs" color="muted">
												Select the number of gift codes to generate.
											</Text>
										</VStack>
										<FormFieldGroup
											label="Product"
											helper="Generated codes are rendered as https://fluxer.gift/<code>."
										>
											<Select id="gift-product-type" name="product_type" options={GIFT_PRODUCT_OPTIONS} />
										</FormFieldGroup>
										<Button type="submit" variant="primary">
											Generate Gift Codes
										</Button>
									</VStack>
								</VStack>
								<VStack gap={2} class="mt-4">
									<FormFieldGroup label="Generated URLs" helper="Copy one URL per line when sharing codes.">
										<Textarea
											id="gift-generated-urls"
											name="generated_urls"
											readonly
											rows={10}
											placeholder="Full gift URLs will appear here after generation."
											value={codesValue}
										/>
									</FormFieldGroup>
								</VStack>
							</form>
						</Card>
					</VStack>
				</PageLayout>
			) : (
				<Card padding="md">
					<Heading level={1} size="2xl">
						Gift Codes
					</Heading>
					<Text color="muted" size="sm" class="mt-2">
						You do not have permission to generate gift codes.
					</Text>
				</Card>
			)}
		</Layout>
	);
};

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
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {PageLayout} from '@fluxer/admin/src/components/ui/Layout/PageLayout';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Table} from '@fluxer/admin/src/components/ui/Table';
import {TableBody} from '@fluxer/admin/src/components/ui/TableBody';
import {TableCell} from '@fluxer/admin/src/components/ui/TableCell';
import {TableContainer} from '@fluxer/admin/src/components/ui/TableContainer';
import {TableHeader} from '@fluxer/admin/src/components/ui/TableHeader';
import {TableHeaderCell} from '@fluxer/admin/src/components/ui/TableHeaderCell';
import {TableRow} from '@fluxer/admin/src/components/ui/TableRow';
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

const MAX_EXPAND_COUNT = 1000;
const DEFAULT_EXPAND_COUNT = 10;

export interface VisionarySlot {
	slot_index: number;
	user_id: string | null;
}

export interface VisionarySlotsPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	adminAcls: Array<string>;
	assetVersion: string;
	csrfToken: string;
	slots: Array<VisionarySlot>;
	totalCount: number;
	reservedCount: number;
}

export const VisionarySlotsPage: FC<VisionarySlotsPageProps> = ({
	config,
	session,
	currentAdmin,
	flash,
	adminAcls,
	assetVersion,
	csrfToken,
	slots,
	totalCount,
	reservedCount,
}) => {
	const hasViewPermission = hasPermission(adminAcls, AdminACLs.VISIONARY_SLOT_VIEW);
	const hasExpandPermission = hasPermission(adminAcls, AdminACLs.VISIONARY_SLOT_EXPAND);
	const hasShrinkPermission = hasPermission(adminAcls, AdminACLs.VISIONARY_SLOT_SHRINK);
	const hasReservePermission = hasPermission(adminAcls, AdminACLs.VISIONARY_SLOT_RESERVE);
	const hasSwapPermission = hasPermission(adminAcls, AdminACLs.VISIONARY_SLOT_SWAP);

	const reservedSlots = slots.filter((s) => s.user_id !== null);
	const minAllowedTotalCount = reservedSlots.length > 0 ? Math.max(...reservedSlots.map((s) => s.slot_index)) : 0;

	return (
		<Layout
			csrfToken={csrfToken}
			title="Visionary Slots"
			activePage="visionary-slots"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
		>
			{hasViewPermission ? (
				<PageLayout maxWidth="7xl">
					<VStack gap={6}>
						<Card padding="md">
							<VStack gap={2}>
								<Heading level={1} size="2xl">
									Visionary Slots Management
								</Heading>
								<Text size="sm" color="muted">
									Total slots: <strong>{totalCount}</strong> | Reserved: <strong>{reservedCount}</strong> | Available:{' '}
									<strong>{totalCount - reservedCount}</strong>
								</Text>
							</VStack>
						</Card>

						{hasExpandPermission && (
							<Card padding="md">
								<VStack gap={4}>
									<Heading level={2} size="xl">
										Expand Slots
									</Heading>
									<form id="expand-form" method="post" action={`${config.basePath}/visionary-slots/expand`}>
										<CsrfInput token={csrfToken} />
										<VStack gap={4}>
											<SliderInput
												id="expand-count-slider"
												name="count"
												label="Number of slots to add"
												min={1}
												max={MAX_EXPAND_COUNT}
												value={DEFAULT_EXPAND_COUNT}
												rangeText={`Range: 1-${MAX_EXPAND_COUNT}`}
											/>
											<Button type="submit" variant="primary">
												Add Slots
											</Button>
										</VStack>
									</form>
								</VStack>
							</Card>
						)}

						{hasShrinkPermission && (
							<Card padding="md">
								<VStack gap={4}>
									<Heading level={2} size="xl">
										Shrink Slots
									</Heading>
									{totalCount === 0 ? (
										<Text color="muted">No slots to shrink.</Text>
									) : minAllowedTotalCount >= totalCount ? (
										<Text color="muted">
											Cannot shrink further. The highest reserved slot is index {minAllowedTotalCount}.
										</Text>
									) : (
										<form id="shrink-form" method="post" action={`${config.basePath}/visionary-slots/shrink`}>
											<CsrfInput token={csrfToken} />
											<VStack gap={4}>
												<SliderInput
													id="shrink-target-slider"
													name="target_count"
													label="Target total number of slots"
													min={minAllowedTotalCount}
													max={totalCount}
													value={totalCount}
													rangeText={`Range: ${minAllowedTotalCount}-${totalCount} ${
														reservedSlots.length > 0
															? '(cannot shrink below highest reserved slot)'
															: '(can shrink to 0)'
													}`}
												/>
												<Button type="submit" variant="primary">
													Shrink to Target
												</Button>
											</VStack>
										</form>
									)}
								</VStack>
							</Card>
						)}

						{hasReservePermission && (
							<Card padding="md">
								<VStack gap={4}>
									<Heading level={2} size="xl">
										Reserve Slot
									</Heading>
									{totalCount === 0 ? (
										<Text color="muted">No slots exist yet. Expand slots first before reserving.</Text>
									) : (
										<form id="reserve-form" method="post" action={`${config.basePath}/visionary-slots/reserve`}>
											<CsrfInput token={csrfToken} />
											<VStack gap={4}>
												<FormFieldGroup
													label="Slot Index"
													helper="The slot index to reserve or unreserve (slots start at 1)"
												>
													<Input type="number" id="slot-index" name="slot_index" required min={1} max={totalCount} />
												</FormFieldGroup>
												<FormFieldGroup
													label="User ID"
													helper="User ID to reserve the slot for. Leave empty or use 'null' to unreserve. Special value '-1' is also valid."
												>
													<Input type="text" id="user-id" name="user_id" placeholder="null" />
												</FormFieldGroup>
												<Button type="submit" variant="primary">
													Update Slot
												</Button>
											</VStack>
										</form>
									)}
								</VStack>
							</Card>
						)}

						{hasSwapPermission && (
							<Card padding="md">
								<VStack gap={4}>
									<Heading level={2} size="xl">
										Swap Slots
									</Heading>
									{totalCount < 2 ? (
										<Text color="muted">Need at least two slots to swap.</Text>
									) : (
										<form id="swap-form" method="post" action={`${config.basePath}/visionary-slots/swap`}>
											<CsrfInput token={csrfToken} />
											<VStack gap={4}>
												<FormFieldGroup label="Slot Index A" helper="The first slot index to swap (slots start at 1)">
													<Input
														type="number"
														id="slot-index-a"
														name="slot_index_a"
														required
														min={1}
														max={totalCount}
													/>
												</FormFieldGroup>
												<FormFieldGroup label="Slot Index B" helper="The second slot index to swap (slots start at 1)">
													<Input
														type="number"
														id="slot-index-b"
														name="slot_index_b"
														required
														min={1}
														max={totalCount}
													/>
												</FormFieldGroup>
												<Button type="submit" variant="primary">
													Swap Slots
												</Button>
											</VStack>
										</form>
									)}
								</VStack>
							</Card>
						)}

						<Card padding="md">
							<VStack gap={4}>
								<Heading level={2} size="xl">
									All Slots
								</Heading>
								{slots.length === 0 ? (
									<Text color="muted">No slots exist yet.</Text>
								) : (
									<TableContainer>
										<Table>
											<TableHeader>
												<TableRow>
													<TableHeaderCell>Slot Index</TableHeaderCell>
													<TableHeaderCell>User ID</TableHeaderCell>
													<TableHeaderCell>Status</TableHeaderCell>
												</TableRow>
											</TableHeader>
											<TableBody>
												{slots.map((slot) => (
													<TableRow key={slot.slot_index}>
														<TableCell>{slot.slot_index}</TableCell>
														<TableCell>{slot.user_id ?? <em>null</em>}</TableCell>
														<TableCell>{slot.user_id ? 'Reserved' : 'Available'}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</TableContainer>
								)}
							</VStack>
						</Card>
					</VStack>
				</PageLayout>
			) : (
				<Card padding="md">
					<Heading level={1} size="2xl">
						Visionary Slots
					</Heading>
					<Text color="muted" size="sm" class="mt-2">
						You do not have permission to view visionary slots.
					</Text>
				</Card>
			)}
		</Layout>
	);
};

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

import {Input, Textarea} from '@app/components/form/Input';
import {Switch} from '@app/components/form/Switch';
import {UsernameValidationRules} from '@app/components/form/UsernameValidationRules';
import styles from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetail.module.css';
import type {ApplicationDetailForm} from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetailTypes';
import {SectionCard} from '@app/components/modals/tabs/applications_tab/application_detail/SectionCard';
import {AvatarUploader} from '@app/components/modals/tabs/my_profile_tab/AvatarUploader';
import {BannerUploader} from '@app/components/modals/tabs/my_profile_tab/BannerUploader';
import {ImagePreviewField} from '@app/components/shared/ImagePreviewField';
import type {DeveloperApplication} from '@app/records/DeveloperApplicationRecord';
import {useLingui} from '@lingui/react/macro';
import type React from 'react';
import {Controller} from 'react-hook-form';

interface BotProfileSectionProps {
	application: DeveloperApplication;
	form: ApplicationDetailForm;
	displayAvatarUrl: string | null;
	hasAvatar: boolean;
	hasClearedAvatar: boolean;
	displayBannerUrl: string | null;
	hasBanner: boolean;
	hasClearedBanner: boolean;
	onAvatarChange: (value: string) => void;
	onAvatarClear: () => void;
	onBannerChange: (value: string) => void;
	onBannerClear: () => void;
}

export const BotProfileSection: React.FC<BotProfileSectionProps> = ({
	application,
	form,
	displayAvatarUrl,
	hasAvatar,
	hasClearedAvatar,
	displayBannerUrl,
	hasBanner,
	hasClearedBanner,
	onAvatarChange,
	onAvatarClear,
	onBannerChange,
	onBannerClear,
}) => {
	const {t} = useLingui();
	const friendlyFlagEnabled = form.watch('friendlyBot') ?? false;
	return (
		<SectionCard title={t`Bot Profile`} subtitle={t`Avatar, tag, and rich profile details for your bot.`}>
			<div className={styles.fieldStack}>
				<div className={styles.avatarRow}>
					{displayAvatarUrl ? (
						<img src={displayAvatarUrl} alt={t`Bot avatar`} className={styles.avatarPreview} />
					) : (
						<div className={styles.avatarPlaceholder}>{application.bot?.username.charAt(0).toUpperCase()}</div>
					)}
					<AvatarUploader
						hasAvatar={hasAvatar && !hasClearedAvatar}
						onAvatarChange={onAvatarChange}
						onAvatarClear={onAvatarClear}
						isPerGuildProfile={false}
						errorMessage={form.formState.errors.avatar?.message}
					/>
				</div>

				<div className={styles.tagRow}>
					<Controller
						name="username"
						control={form.control}
						rules={{
							required: t`Username is required`,
							minLength: {value: 1, message: t`Username must be at least 1 character`},
							maxLength: {value: 32, message: t`Username must be at most 32 characters`},
							pattern: {
								value: /^[a-zA-Z0-9_]+$/,
								message: t`Username can only contain letters, numbers, and underscores`,
							},
						}}
						render={({field}) => (
							<Input
								{...field}
								aria-label={t`Bot Username`}
								placeholder={t`BotName`}
								maxLength={32}
								required
								label={t`FluxerTag`}
							/>
						)}
					/>
					<div className={styles.discriminatorInput}>
						<Input
							value={application.bot?.discriminator}
							readOnly
							disabled
							maxLength={4}
							aria-label={t`Discriminator`}
						/>
					</div>
				</div>

				{form.formState.errors.username && (
					<div className={styles.error}>{form.formState.errors.username?.message}</div>
				)}

				<div className={styles.validationBox}>
					<UsernameValidationRules username={form.watch('username') || ''} />
				</div>

				<Controller
					name="bio"
					control={form.control}
					render={({field}) => (
						<Textarea
							ref={field.ref}
							name={field.name}
							onBlur={field.onBlur}
							label={t`Bot Bio`}
							value={field.value ?? ''}
							onChange={(event) => field.onChange(event.target.value)}
							placeholder={t`A helpful bot that does amazing things!`}
							minRows={3}
							maxRows={6}
							maxLength={1024}
							error={form.formState.errors.bio?.message}
						/>
					)}
				/>

				<div className={styles.bannerRow}>
					<BannerUploader
						hasBanner={hasBanner}
						onBannerChange={onBannerChange}
						onBannerClear={onBannerClear}
						isPerGuildProfile={false}
						alwaysEnabled={true}
						errorMessage={form.formState.errors.banner?.message as string | undefined}
					/>
				</div>

				<ImagePreviewField
					imageUrl={hasBanner && !hasClearedBanner ? displayBannerUrl : null}
					showPlaceholder={!hasBanner || hasClearedBanner}
					placeholderText={t`No bot banner`}
					altText={t`Bot banner preview`}
					objectFit="contain"
				/>

				<Controller
					name="friendlyBot"
					control={form.control}
					render={({field}) => (
						<Switch
							label={t`Friendly bot`}
							description={t`Allow users to send this bot friend requests for manual approval.`}
							value={Boolean(field.value)}
							onChange={field.onChange}
						/>
					)}
				/>

				<Controller
					name="botManualFriendRequestApproval"
					control={form.control}
					render={({field}) => (
						<Switch
							label={t`Require manual friend approval`}
							description={t`When enabled, you must accept friend requests to this bot manually.`}
							value={Boolean(field.value)}
							onChange={field.onChange}
							disabled={!friendlyFlagEnabled}
						/>
					)}
				/>
			</div>
		</SectionCard>
	);
};

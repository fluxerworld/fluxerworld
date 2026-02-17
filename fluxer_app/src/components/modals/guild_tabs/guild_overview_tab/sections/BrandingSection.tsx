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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {Input} from '@app/components/form/Input';
import {Switch} from '@app/components/form/Switch';
import {SettingsSection} from '@app/components/modals/guild_tabs/guild_overview_tab/components/SettingsSection';
import {GuildBannerUploadField} from '@app/components/modals/guild_tabs/guild_overview_tab/fields/GuildBannerUploadField';
import {GuildEmbedSplashUploadField} from '@app/components/modals/guild_tabs/guild_overview_tab/fields/GuildEmbedSplashUploadField';
import {GuildIconUploadField} from '@app/components/modals/guild_tabs/guild_overview_tab/fields/GuildIconUploadField';
import {GuildInviteSplashSettingsField} from '@app/components/modals/guild_tabs/guild_overview_tab/fields/GuildInviteSplashSettingsField';
import {GuildInviteSplashUploadField} from '@app/components/modals/guild_tabs/guild_overview_tab/fields/GuildInviteSplashUploadField';
import styles from '@app/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import type {GuildLike} from '@app/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTypes';
import {InviteAcceptModalPreview} from '@app/components/modals/InviteAcceptModalPreview';
import {InvitePagePreviewModal} from '@app/components/modals/InvitePagePreviewModal';
import GuildStore from '@app/stores/GuildStore';
import type {FormInputs} from '@app/utils/modals/guild_tabs/GuildOverviewTabUtils';
import {GuildFeatures, type GuildSplashCardAlignmentValue} from '@fluxer/constants/src/GuildConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import type React from 'react';
import {useCallback} from 'react';
import type {UseFormReturn} from 'react-hook-form';
import {Controller} from 'react-hook-form';

export const BrandingSection: React.FC<{
	guildId: string;
	guild: GuildLike;
	form: UseFormReturn<FormInputs>;
	canManageGuild: boolean;

	previewIconUrl: string | null;
	setPreviewIconUrl: React.Dispatch<React.SetStateAction<string | null>>;
	hasClearedIcon: boolean;
	setHasClearedIcon: React.Dispatch<React.SetStateAction<boolean>>;

	previewBannerUrl: string | null;
	setPreviewBannerUrl: React.Dispatch<React.SetStateAction<string | null>>;
	hasClearedBanner: boolean;
	setHasClearedBanner: React.Dispatch<React.SetStateAction<boolean>>;
	bannerAspectRatio: number | undefined;
	setBannerAspectRatio: (ratio: number | undefined) => void;

	previewSplashUrl: string | null;
	setPreviewSplashUrl: React.Dispatch<React.SetStateAction<string | null>>;
	hasClearedSplash: boolean;
	setHasClearedSplash: React.Dispatch<React.SetStateAction<boolean>>;
	splashAspectRatio: number | undefined;
	setSplashAspectRatio: (ratio: number | undefined) => void;

	previewEmbedSplashUrl: string | null;
	setPreviewEmbedSplashUrl: React.Dispatch<React.SetStateAction<string | null>>;
	hasClearedEmbedSplash: boolean;
	setHasClearedEmbedSplash: React.Dispatch<React.SetStateAction<boolean>>;

	computeAspectRatioFromBase64: (dataUrl: string) => Promise<number>;
}> = (props) => {
	const {t} = useLingui();
	const {
		guildId,
		guild,
		form,
		canManageGuild,
		previewIconUrl,
		setPreviewIconUrl,
		hasClearedIcon,
		setHasClearedIcon,
		previewBannerUrl,
		setPreviewBannerUrl,
		hasClearedBanner,
		setHasClearedBanner,
		bannerAspectRatio,
		setBannerAspectRatio,
		previewSplashUrl,
		setPreviewSplashUrl,
		hasClearedSplash,
		setHasClearedSplash,
		splashAspectRatio,
		setSplashAspectRatio,
		previewEmbedSplashUrl,
		setPreviewEmbedSplashUrl,
		hasClearedEmbedSplash,
		setHasClearedEmbedSplash,
		computeAspectRatioFromBase64,
	} = props;

	const handleAlignmentChange = useCallback(
		(alignment: GuildSplashCardAlignmentValue) => {
			form.setValue('splash_card_alignment', alignment, {shouldDirty: true});
		},
		[form],
	);

	const handlePreviewInvitePage = useCallback(() => {
		const currentName = form.getValues('name');
		const currentAlignment = form.getValues('splash_card_alignment');

		ModalActionCreators.push(
			modal(() => (
				<InvitePagePreviewModal
					guildId={guildId}
					previewSplashUrl={hasClearedSplash ? null : previewSplashUrl}
					previewIconUrl={hasClearedIcon ? null : previewIconUrl}
					previewName={currentName}
					previewSplashAlignment={currentAlignment}
					onAlignmentChange={handleAlignmentChange}
				/>
			)),
		);
	}, [guildId, previewSplashUrl, hasClearedSplash, previewIconUrl, hasClearedIcon, form, handleAlignmentChange]);

	const handlePreviewInviteModal = useCallback(() => {
		const currentName = form.getValues('name');
		const guildRecord = GuildStore.getGuild(guildId);
		if (!guildRecord) return;

		const previewIcon = hasClearedIcon ? null : previewIconUrl;
		const previewSplash = hasClearedSplash ? null : previewSplashUrl;

		ModalActionCreators.push(
			modal(() => (
				<InviteAcceptModalPreview
					guild={guildRecord}
					previewName={currentName}
					previewIconUrl={previewIcon}
					hasClearedIcon={hasClearedIcon}
					previewSplashUrl={previewSplash}
					hasClearedSplash={hasClearedSplash}
				/>
			)),
		);
	}, [guildId, hasClearedIcon, previewIconUrl, hasClearedSplash, previewSplashUrl, form]);

	return (
		<SettingsSection
			title={<Trans>Branding</Trans>}
			description={<Trans>Update your icon, name, banner, and invite background</Trans>}
		>
			<div className={styles.brandingContent}>
				<GuildIconUploadField
					guild={guild}
					form={form}
					canManageGuild={canManageGuild}
					previewIconUrl={previewIconUrl}
					setPreviewIconUrl={setPreviewIconUrl}
					hasClearedIcon={hasClearedIcon}
					setHasClearedIcon={setHasClearedIcon}
				/>

				<Input
					{...form.register('name')}
					type="text"
					label={t`Name`}
					placeholder={t`My Awesome Community`}
					minLength={1}
					maxLength={100}
					error={form.formState.errors.name?.message}
					disabled={!canManageGuild}
				/>

				{guild.features.has(GuildFeatures.BANNER) ? (
					<Controller
						name="detached_banner"
						control={form.control}
						render={({field}) => (
							<Switch
								label={t`Detached Banner`}
								description={t`When enabled, the banner appears in its own section below the community header.`}
								value={field.value ?? false}
								onChange={field.onChange}
								disabled={!canManageGuild}
							/>
						)}
					/>
				) : null}

				{guild.features.has(GuildFeatures.BANNER) ? (
					<GuildBannerUploadField
						guild={guild}
						form={form}
						canManageGuild={canManageGuild}
						previewBannerUrl={previewBannerUrl}
						setPreviewBannerUrl={setPreviewBannerUrl}
						hasClearedBanner={hasClearedBanner}
						setHasClearedBanner={setHasClearedBanner}
						bannerAspectRatio={bannerAspectRatio}
						setBannerAspectRatio={setBannerAspectRatio}
						computeAspectRatioFromBase64={computeAspectRatioFromBase64}
					/>
				) : null}

				{guild.features.has(GuildFeatures.INVITE_SPLASH) ? (
					<GuildInviteSplashUploadField
						guild={guild}
						form={form}
						canManageGuild={canManageGuild}
						previewSplashUrl={previewSplashUrl}
						setPreviewSplashUrl={setPreviewSplashUrl}
						hasClearedSplash={hasClearedSplash}
						setHasClearedSplash={setHasClearedSplash}
						splashAspectRatio={splashAspectRatio}
						setSplashAspectRatio={setSplashAspectRatio}
						computeAspectRatioFromBase64={computeAspectRatioFromBase64}
					/>
				) : null}

				{guild.features.has(GuildFeatures.INVITE_SPLASH) ? (
					<GuildInviteSplashSettingsField
						form={form}
						canManageGuild={canManageGuild}
						onPreviewInvitePage={handlePreviewInvitePage}
						onPreviewInviteModal={handlePreviewInviteModal}
					/>
				) : null}

				{guild.features.has(GuildFeatures.INVITE_SPLASH) ? (
					<GuildEmbedSplashUploadField
						guildId={guildId}
						guild={guild}
						form={form}
						canManageGuild={canManageGuild}
						previewEmbedSplashUrl={previewEmbedSplashUrl}
						setPreviewEmbedSplashUrl={setPreviewEmbedSplashUrl}
						hasClearedEmbedSplash={hasClearedEmbedSplash}
						setHasClearedEmbedSplash={setHasClearedEmbedSplash}
					/>
				) : null}
			</div>
		</SettingsSection>
	);
};

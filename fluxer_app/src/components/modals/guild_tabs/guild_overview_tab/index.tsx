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

import * as UnsavedChangesActionCreators from '@app/actions/UnsavedChangesActionCreators';
import {Form} from '@app/components/form/Form';
import styles from '@app/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTab.module.css';
import type {ChannelLike, GuildLike} from '@app/components/modals/guild_tabs/guild_overview_tab/GuildOverviewTypes';
import {BrandingSection} from '@app/components/modals/guild_tabs/guild_overview_tab/sections/BrandingSection';
import {DefaultNotificationsSection} from '@app/components/modals/guild_tabs/guild_overview_tab/sections/DefaultNotificationsSection';
import {IdleSettingsSection} from '@app/components/modals/guild_tabs/guild_overview_tab/sections/IdleSettingsSection';
import {SystemWelcomeSection} from '@app/components/modals/guild_tabs/guild_overview_tab/sections/SystemWelcomeSection';
import {TextChannelNamesSection} from '@app/components/modals/guild_tabs/guild_overview_tab/sections/TextChannelNamesSection';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import type {FormInputs} from '@app/utils/modals/guild_tabs/GuildOverviewTabUtils';
import {GUILD_OVERVIEW_TAB_ID, useGuildOverviewData} from '@app/utils/modals/guild_tabs/GuildOverviewTabUtils';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';
import {useForm} from 'react-hook-form';

const GuildOverviewTab: React.FC<{guildId: string}> = observer(({guildId}) => {
	const data = useGuildOverviewData(guildId);

	const {
		guild,
		voiceChannels,
		textChannels,
		defaultValues,
		handleReset,
		onSubmit,

		hasClearedIcon,
		setHasClearedIcon,
		previewIconUrl,
		setPreviewIconUrl,

		hasClearedBanner,
		setHasClearedBanner,
		previewBannerUrl,
		setPreviewBannerUrl,

		hasClearedSplash,
		setHasClearedSplash,
		previewSplashUrl,
		setPreviewSplashUrl,

		hasClearedEmbedSplash,
		setHasClearedEmbedSplash,
		previewEmbedSplashUrl,
		setPreviewEmbedSplashUrl,

		bannerAspectRatio,
		setBannerAspectRatio,
		splashAspectRatio,
		setSplashAspectRatio,

		canManageGuild,
		computeAspectRatioFromBase64,
	} = data;

	const form = useForm<FormInputs>({defaultValues});

	const {handleSubmit: handleSave} = useFormSubmit({
		form,
		onSubmit: (values) => onSubmit(values, form),
		defaultErrorField: 'name',
	});

	const isFormDirty = form.formState.isDirty;
	const isSubmitting = form.formState.isSubmitting;

	// NOTE: do NOT rely on isDirty alone; clearing assets may keep the form value == defaultValue.
	const hasUnsavedChanges = Boolean(
		isFormDirty ||
			previewIconUrl ||
			hasClearedIcon ||
			previewBannerUrl ||
			hasClearedBanner ||
			previewSplashUrl ||
			hasClearedSplash ||
			previewEmbedSplashUrl ||
			hasClearedEmbedSplash,
	);

	useEffect(() => {
		UnsavedChangesActionCreators.setUnsavedChanges(GUILD_OVERVIEW_TAB_ID, hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		UnsavedChangesActionCreators.setTabData(GUILD_OVERVIEW_TAB_ID, {
			onReset: () => handleReset(form),
			onSave: handleSave,
			isSubmitting,
		});
	}, [handleReset, handleSave, form, isSubmitting]);

	useEffect(() => {
		return () => {
			UnsavedChangesActionCreators.clearUnsavedChanges(GUILD_OVERVIEW_TAB_ID);
		};
	}, []);

	useEffect(() => {
		if (!guild) return;
		if (hasUnsavedChanges) return;
		handleReset(form);
	}, [guild?.id, defaultValues, handleReset, form, hasUnsavedChanges]);

	if (!guild) return null;

	return (
		<div className={styles.container}>
			<Form form={form} onSubmit={handleSave}>
				<BrandingSection
					guildId={guildId}
					guild={guild as GuildLike}
					form={form}
					canManageGuild={canManageGuild}
					previewIconUrl={previewIconUrl}
					setPreviewIconUrl={setPreviewIconUrl}
					hasClearedIcon={hasClearedIcon}
					setHasClearedIcon={setHasClearedIcon}
					previewBannerUrl={previewBannerUrl}
					setPreviewBannerUrl={setPreviewBannerUrl}
					hasClearedBanner={hasClearedBanner}
					setHasClearedBanner={setHasClearedBanner}
					bannerAspectRatio={bannerAspectRatio}
					setBannerAspectRatio={setBannerAspectRatio}
					previewSplashUrl={previewSplashUrl}
					setPreviewSplashUrl={setPreviewSplashUrl}
					hasClearedSplash={hasClearedSplash}
					setHasClearedSplash={setHasClearedSplash}
					splashAspectRatio={splashAspectRatio}
					setSplashAspectRatio={setSplashAspectRatio}
					previewEmbedSplashUrl={previewEmbedSplashUrl}
					setPreviewEmbedSplashUrl={setPreviewEmbedSplashUrl}
					hasClearedEmbedSplash={hasClearedEmbedSplash}
					setHasClearedEmbedSplash={setHasClearedEmbedSplash}
					computeAspectRatioFromBase64={computeAspectRatioFromBase64}
				/>

				<IdleSettingsSection
					form={form}
					canManageGuild={canManageGuild}
					voiceChannels={voiceChannels as Array<ChannelLike>}
				/>

				<SystemWelcomeSection
					form={form}
					canManageGuild={canManageGuild}
					textChannels={textChannels as Array<ChannelLike>}
				/>

				<DefaultNotificationsSection form={form} canManageGuild={canManageGuild} guildId={guildId} />

				<TextChannelNamesSection form={form} canManageGuild={canManageGuild} />
			</Form>
		</div>
	);
});

export default GuildOverviewTab;

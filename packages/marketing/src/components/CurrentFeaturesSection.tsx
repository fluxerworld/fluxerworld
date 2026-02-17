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

import {FeatureCard} from '@fluxer/marketing/src/components/FeatureCard';
import {Section} from '@fluxer/marketing/src/components/Section';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

interface CurrentFeaturesSectionProps {
	ctx: MarketingContext;
}

export function CurrentFeaturesSection(props: CurrentFeaturesSectionProps): JSX.Element {
	const {ctx} = props;

	return (
		<Section
			variant="dark"
			title={ctx.i18n.getMessage('general.coming_soon.whats_available_today', ctx.locale)}
			description={ctx.i18n.getMessage('beta_and_access.featured_benefit_line', ctx.locale)}
		>
			<div class="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
				<FeatureCard
					ctx={ctx}
					icon="chats"
					title={ctx.i18n.getMessage('app.messaging.title', ctx.locale)}
					description={ctx.i18n.getMessage('app.messaging.description', ctx.locale)}
					features={[
						ctx.i18n.getMessage('app.messaging.features.full_markdown_support', ctx.locale),
						ctx.i18n.getMessage('app.messaging.features.private_dms_and_group_chats', ctx.locale),
						ctx.i18n.getMessage('app.messaging.features.organised_channels_for_communities', ctx.locale),
						ctx.i18n.getMessage('app.messaging.features.file_sharing', ctx.locale),
					]}
				/>
				<FeatureCard
					ctx={ctx}
					icon="microphone"
					title={ctx.i18n.getMessage('app.voice_and_video.title', ctx.locale)}
					description={ctx.i18n.getMessage('app.voice_and_video.hop_in_a_call', ctx.locale)}
					features={[
						ctx.i18n.getMessage('misc_labels.join_multiple_devices', ctx.locale),
						ctx.i18n.getMessage('app.voice_and_video.features.screen_sharing', ctx.locale),
						ctx.i18n.getMessage('app.voice_and_video.features.noise_suppression', ctx.locale),
						ctx.i18n.getMessage('app.voice_and_video.features.mute_controls', ctx.locale),
					]}
				/>
				<FeatureCard
					ctx={ctx}
					icon="gear"
					title={ctx.i18n.getMessage('app.communities.moderation.tools', ctx.locale)}
					description={ctx.i18n.getMessage('app.communities.roles_permissions_audit.keep_running_smoothly', ctx.locale)}
					features={[
						ctx.i18n.getMessage('app.communities.roles_permissions_audit.granular_roles_and_permissions', ctx.locale),
						ctx.i18n.getMessage('app.communities.moderation.actions_and_tools', ctx.locale),
						ctx.i18n.getMessage('app.communities.roles_permissions_audit.audit_logs', ctx.locale),
						ctx.i18n.getMessage('pricing_and_tiers.plutonium.features.webhooks_and_bot_support', ctx.locale),
					]}
				/>
				<FeatureCard
					ctx={ctx}
					icon="magnifying_glass"
					title={ctx.i18n.getMessage('app.messaging.features.search.search_and_quick_switcher', ctx.locale)}
					description={ctx.i18n.getMessage('app.messaging.features.search.find_old_messages', ctx.locale)}
					features={[
						ctx.i18n.getMessage('app.messaging.features.search.label', ctx.locale),
						ctx.i18n.getMessage('app.messaging.features.search.filter_options', ctx.locale),
						ctx.i18n.getMessage('app.messaging.features.search.quick_switcher_shortcuts', ctx.locale),
						ctx.i18n.getMessage('app.profiles_identity.manage_friends_and_block_users', ctx.locale),
					]}
				/>
				<FeatureCard
					ctx={ctx}
					icon="palette"
					title={ctx.i18n.getMessage('app.customization.title', ctx.locale)}
					description={ctx.i18n.getMessage('app.customization.saved_media_and_css', ctx.locale)}
					features={[
						ctx.i18n.getMessage('app.customization.upload_custom_emojis_and_stickers', ctx.locale),
						ctx.i18n.getMessage('app.messaging.features.save_media', ctx.locale),
						ctx.i18n.getMessage('app.customization.custom_css_themes', ctx.locale),
						ctx.i18n.getMessage('app.customization.compact_mode', ctx.locale),
					]}
				/>
				<FeatureCard
					ctx={ctx}
					icon="server"
					title={ctx.i18n.getMessage('product_positioning.self_hosting.label', ctx.locale)}
					description={ctx.i18n.getMessage('product_positioning.self_hosting.run_backend_on_your_hardware', ctx.locale)}
					features={[
						ctx.i18n.getMessage('product_positioning.open_source.fully_open_source_agplv3', ctx.locale),
						ctx.i18n.getMessage('product_positioning.self_hosting.host_your_own_instance', ctx.locale),
						ctx.i18n.getMessage('platform_support.desktop.use_desktop_client_mobile_soon', ctx.locale),
						ctx.i18n.getMessage('product_positioning.self_hosting.switch_between_instances', ctx.locale),
					]}
					learnMoreLink="https://docs.fluxer.app/self-hosting"
				/>
			</div>
		</Section>
	);
}

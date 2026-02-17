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

import {ArrowRightIcon} from '@fluxer/marketing/src/components/icons/ArrowRightIcon';
import {MarketingButton, MarketingButtonSecondary} from '@fluxer/marketing/src/components/MarketingButton';
import {Section} from '@fluxer/marketing/src/components/Section';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';

interface LaunchBlogSectionProps {
	ctx: MarketingContext;
}

export function LaunchBlogSection(props: LaunchBlogSectionProps): JSX.Element {
	const {ctx} = props;

	return (
		<Section
			variant="light"
			title={ctx.i18n.getMessage('launch.heading', ctx.locale)}
			description={ctx.i18n.getMessage('launch.description', ctx.locale)}
		>
			<div class="mx-auto max-w-4xl">
				<div class="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-stretch">
					<MarketingButton
						href="https://blog.fluxer.app/how-i-built-fluxer-a-discord-like-chat-app/"
						size="large"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 md:text-xl"
					>
						{ctx.i18n.getMessage('launch.read_more', ctx.locale)}
						<ArrowRightIcon class="h-5 w-5 md:h-6 md:w-6" />
					</MarketingButton>
					<MarketingButtonSecondary
						href="https://blog.fluxer.app/roadmap-2026"
						size="large"
						target="_blank"
						rel="noopener noreferrer"
						class="md:text-xl"
					>
						{ctx.i18n.getMessage('launch.view_full_roadmap', ctx.locale)}
						<ArrowRightIcon class="h-5 w-5 md:h-6 md:w-6" />
					</MarketingButtonSecondary>
				</div>
			</div>
		</Section>
	);
}

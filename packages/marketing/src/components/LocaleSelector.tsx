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

import {AllLocales} from '@fluxer/constants/src/Locales';
import {getLocaleName} from '@fluxer/locale/src/LocaleService';
import {FlagSvg} from '@fluxer/marketing/src/components/Flags';
import {TranslateIcon} from '@fluxer/marketing/src/components/icons/TranslateIcon';
import type {MarketingContext} from '@fluxer/marketing/src/MarketingContext';
import {href, prependBasePath} from '@fluxer/marketing/src/UrlUtils';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';

interface LocaleSelectorProps {
	ctx: MarketingContext;
	currentPath: string;
}

export function LocaleSelector(props: LocaleSelectorProps): JSX.Element {
	return (
		<div>
			<LocaleSelectorTrigger ctx={props.ctx} />
			<LocaleSelectorModal ctx={props.ctx} currentPath={props.currentPath} />
		</div>
	);
}

interface LocaleSelectorTriggerProps {
	ctx: MarketingContext;
	className?: string;
	text?: string;
}

export function LocaleSelectorTrigger(props: LocaleSelectorTriggerProps): JSX.Element {
	const {ctx, className, text} = props;
	const label = ctx.i18n.getMessage('languages.change_language', ctx.locale);
	const baseClass = 'locale-toggle flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-gray-100';
	const classes = [baseClass, className].filter(Boolean).join(' ');

	return (
		<a class={classes} aria-label={label} id="locale-button" href={href(ctx, '#locale-modal-backdrop')}>
			<TranslateIcon class="h-5 w-5" />
			{text ? <span class="ml-2 font-semibold text-base text-gray-900">{text}</span> : null}
		</a>
	);
}

export function LocaleSelectorModal(props: LocaleSelectorProps): JSX.Element {
	const ctx = props.ctx;
	const currentPath = props.currentPath;
	const title = ctx.i18n.getMessage('languages.choose_your_language', ctx.locale);
	const notice = ctx.i18n.getMessage(
		'company_and_resources.source_and_contribution.translation.llm_translation_note',
		ctx.locale,
	);

	return (
		<div id="locale-modal-backdrop" class="locale-modal-backdrop">
			<div class="locale-modal">
				<div class="flex h-full flex-col">
					<div class="flex items-center justify-between p-6 pb-0">
						<h2 class="font-bold text-gray-900 text-xl">{title}</h2>
						<a
							class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
							id="locale-close"
							aria-label={ctx.i18n.getMessage('navigation.close', ctx.locale)}
							href={href(ctx, '#')}
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</a>
					</div>
					<p class="px-6 pb-2 text-gray-500 text-xs leading-relaxed">{notice}</p>
					<div class="flex-1 overflow-y-auto p-6 pt-4">
						<div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
							{AllLocales.map((locale) => {
								const isCurrent = locale === ctx.locale;
								const nativeName = getLocaleName(locale);
								const localizedName = getLocalizedLocaleName(ctx, locale);
								const localeCode = locale;

								return (
									<form action={prependBasePath(ctx.basePath, '/_locale')} method="post" class="locale-form contents">
										<CsrfInput token={ctx.csrfToken} />
										<input type="hidden" name="locale" value={localeCode} />
										<input type="hidden" name="redirect" value={currentPath} />
										<button
											type="submit"
											class={`relative flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-xl border-2 p-4 text-center transition-colors hover:bg-gray-50 ${
												isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
											}`}
										>
											{isCurrent ? (
												<div class="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
													<svg
														class="h-4 w-4 text-white"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
														stroke-width="2"
													>
														<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
													</svg>
												</div>
											) : null}
											<FlagSvg locale={locale} ctx={ctx} class="h-8 w-8 rounded" />
											<div class="font-semibold text-gray-900 text-sm">{nativeName}</div>
											<div class="text-gray-500 text-xs">{localizedName}</div>
										</button>
									</form>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function getLocalizedLocaleName(ctx: MarketingContext, locale: string): string {
	switch (locale) {
		case 'ar':
			return ctx.i18n.getMessage('languages.list.arabic', ctx.locale);
		case 'bg':
			return ctx.i18n.getMessage('languages.list.bulgarian', ctx.locale);
		case 'cs':
			return ctx.i18n.getMessage('languages.list.czech', ctx.locale);
		case 'da':
			return ctx.i18n.getMessage('languages.list.danish', ctx.locale);
		case 'de':
			return ctx.i18n.getMessage('languages.list.german', ctx.locale);
		case 'el':
			return ctx.i18n.getMessage('languages.list.greek', ctx.locale);
		case 'en-GB':
			return ctx.i18n.getMessage('languages.list.english', ctx.locale);
		case 'en-US':
			return ctx.i18n.getMessage('languages.list.english_us', ctx.locale);
		case 'es-ES':
			return ctx.i18n.getMessage('languages.list.spanish_spain', ctx.locale);
		case 'es-419':
			return ctx.i18n.getMessage('languages.list.spanish_latin_america', ctx.locale);
		case 'fi':
			return ctx.i18n.getMessage('languages.list.finnish', ctx.locale);
		case 'fr':
			return ctx.i18n.getMessage('languages.list.french', ctx.locale);
		case 'he':
			return ctx.i18n.getMessage('languages.list.hebrew', ctx.locale);
		case 'hi':
			return ctx.i18n.getMessage('languages.list.hindi', ctx.locale);
		case 'hr':
			return ctx.i18n.getMessage('languages.list.croatian', ctx.locale);
		case 'hu':
			return ctx.i18n.getMessage('languages.list.hungarian', ctx.locale);
		case 'id':
			return ctx.i18n.getMessage('languages.list.indonesian', ctx.locale);
		case 'it':
			return ctx.i18n.getMessage('languages.list.italian', ctx.locale);
		case 'ja':
			return ctx.i18n.getMessage('languages.list.japanese', ctx.locale);
		case 'ko':
			return ctx.i18n.getMessage('languages.list.korean', ctx.locale);
		case 'lt':
			return ctx.i18n.getMessage('languages.list.lithuanian', ctx.locale);
		case 'nl':
			return ctx.i18n.getMessage('languages.list.dutch', ctx.locale);
		case 'no':
			return ctx.i18n.getMessage('languages.list.norwegian', ctx.locale);
		case 'pl':
			return ctx.i18n.getMessage('languages.list.polish', ctx.locale);
		case 'pt-BR':
			return ctx.i18n.getMessage('languages.list.portuguese_brazil', ctx.locale);
		case 'ro':
			return ctx.i18n.getMessage('languages.list.romanian', ctx.locale);
		case 'ru':
			return ctx.i18n.getMessage('languages.list.russian', ctx.locale);
		case 'sv-SE':
			return ctx.i18n.getMessage('languages.list.swedish', ctx.locale);
		case 'th':
			return ctx.i18n.getMessage('languages.list.thai', ctx.locale);
		case 'tr':
			return ctx.i18n.getMessage('languages.list.turkish', ctx.locale);
		case 'uk':
			return ctx.i18n.getMessage('languages.list.ukrainian', ctx.locale);
		case 'vi':
			return ctx.i18n.getMessage('languages.list.vietnamese', ctx.locale);
		case 'zh-CN':
			return ctx.i18n.getMessage('languages.list.chinese_simplified', ctx.locale);
		case 'zh-TW':
			return ctx.i18n.getMessage('languages.list.chinese_traditional', ctx.locale);
		default:
			return locale;
	}
}

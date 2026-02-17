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

import styles from '@app/components/channel/embeds/attachments/TextualAttachmentPreview.module.css';
import {
	HIGHLIGHT_LANGUAGE_OPTIONS,
	type TextualAttachmentLanguagePopoutProps,
} from '@app/components/channel/embeds/attachments/TextualAttachmentPreviewUtils';
import {
	SearchableListPopout,
	type SearchableListPopoutItem,
	type SearchableListPopoutSection,
} from '@app/components/uikit/popout/searchable_list_popout/SearchableListPopout';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

export const TextualAttachmentLanguagePopout = observer(function TextualAttachmentLanguagePopout({
	defaultSearchQuery,
	onClose,
	onSelectLanguage,
	selectedLanguage,
}: TextualAttachmentLanguagePopoutProps) {
	const {t} = useLingui();

	const handleLanguageSelect = useCallback(
		(languageCode: string) => {
			onSelectLanguage(languageCode);
			onClose();
		},
		[onClose, onSelectLanguage],
	);

	const sections = useMemo<Array<SearchableListPopoutSection>>(() => {
		const languageItems: Array<SearchableListPopoutItem> = HIGHLIGHT_LANGUAGE_OPTIONS.map((languageOption) => ({
			id: languageOption.code,
			ariaLabel: languageOption.code,
			searchValues: [languageOption.code, languageOption.canonicalCode],
			isSelected: languageOption.code === selectedLanguage,
			onSelect: () => {
				handleLanguageSelect(languageOption.code);
			},
			render: () => (
				<>
					<span className={styles.languageOptionCode}>{languageOption.code}</span>
					{languageOption.canonicalCode !== languageOption.code && (
						<span className={styles.languageOptionCanonical}>{languageOption.canonicalCode}</span>
					)}
				</>
			),
		}));

		return [
			{
				id: 'languages',
				items: languageItems,
			},
		];
	}, [handleLanguageSelect, selectedLanguage]);

	return (
		<SearchableListPopout
			className={styles.languagePopout}
			scrollerClassName={styles.languageScroller}
			placeholder={t`Search language code...`}
			searchInputAriaLabel={t`Search language code`}
			listAriaLabel={t`Code language options`}
			defaultSearchQuery={defaultSearchQuery}
			noResultsLabel={t`No results found`}
			sections={sections}
			onRequestClose={onClose}
		/>
	);
});

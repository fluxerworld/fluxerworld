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

import {type AutocompleteOption, isCommand} from '@app/components/channel/Autocomplete';
import {AutocompleteItem} from '@app/components/channel/AutocompleteItem';
import {observer} from 'mobx-react-lite';
import type {MutableRefObject} from 'react';

interface Props {
	onSelect: (option: AutocompleteOption) => void;
	keyboardFocusIndex: number;
	hoverIndex: number;
	options: Array<AutocompleteOption>;
	onMouseEnter: (index: number) => void;
	onMouseLeave: () => void;
	rowRefs?: MutableRefObject<Array<HTMLButtonElement | null>>;
}

export const AutocompleteCommand = observer(
	({onSelect, keyboardFocusIndex, hoverIndex, options, onMouseEnter, onMouseLeave, rowRefs}: Props) => {
		const commands = options.filter(isCommand);

		return commands.map((option, index) => (
			<AutocompleteItem
				key={option.command.name}
				name={option.command.name}
				description={option.command.description}
				isKeyboardSelected={index === keyboardFocusIndex}
				isHovered={index === hoverIndex}
				onSelect={() => onSelect(option)}
				onMouseEnter={() => onMouseEnter(index)}
				onMouseLeave={onMouseLeave}
				innerRef={
					rowRefs
						? (node: HTMLButtonElement | null) => {
								rowRefs.current[index] = node;
							}
						: undefined
				}
			/>
		));
	},
);

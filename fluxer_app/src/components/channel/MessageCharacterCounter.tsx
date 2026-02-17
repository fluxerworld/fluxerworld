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

import * as PremiumModalActionCreators from '@app/actions/PremiumModalActionCreators';
import styles from '@app/components/channel/MessageCharacterCounter.module.css';
import {CharacterCounter} from '@app/components/uikit/character_counter/CharacterCounter';
import {observer} from 'mobx-react-lite';

interface MessageCharacterCounterProps {
	currentLength: number;
	maxLength: number;
	canUpgrade: boolean;
	premiumMaxLength: number;
	threshold?: number;
}

export const MessageCharacterCounter = observer(
	({currentLength, maxLength, canUpgrade, premiumMaxLength, threshold = 0.8}: MessageCharacterCounterProps) => {
		if (currentLength <= maxLength * threshold) {
			return null;
		}

		return (
			<div className={styles.container}>
				<CharacterCounter
					currentLength={currentLength}
					maxLength={maxLength}
					canUpgrade={canUpgrade}
					premiumMaxLength={premiumMaxLength}
					onUpgradeClick={() => PremiumModalActionCreators.open()}
				/>
			</div>
		);
	},
);

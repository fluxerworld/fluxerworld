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

import * as CallActionCreators from '@app/actions/CallActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {CallNotRingableModal} from '@app/components/alerts/CallNotRingableModal';
import {Logger} from '@app/lib/Logger';

const logger = new Logger('CallUtils');

export async function checkAndStartCall(channelId: string, silent = false): Promise<boolean> {
	try {
		const {ringable} = await CallActionCreators.checkCallEligibility(channelId);
		if (!ringable) {
			ModalActionCreators.push(modal(() => <CallNotRingableModal />));
			return false;
		}
		CallActionCreators.startCall(channelId, silent);
		return true;
	} catch (error) {
		logger.error('Failed to check call eligibility:', error);
		return false;
	}
}

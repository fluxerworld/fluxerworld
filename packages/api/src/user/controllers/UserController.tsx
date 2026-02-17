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

import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {UserAccountController} from '@fluxer/api/src/user/controllers/UserAccountController';
import {UserAuthController} from '@fluxer/api/src/user/controllers/UserAuthController';
import {UserChannelController} from '@fluxer/api/src/user/controllers/UserChannelController';
import {UserContentController} from '@fluxer/api/src/user/controllers/UserContentController';
import {UserRelationshipController} from '@fluxer/api/src/user/controllers/UserRelationshipController';
import {UserScheduledMessageController} from '@fluxer/api/src/user/controllers/UserScheduledMessageController';

export function UserController(app: HonoApp) {
	UserAccountController(app);
	UserAuthController(app);
	UserRelationshipController(app);
	UserChannelController(app);
	UserContentController(app);
	UserScheduledMessageController(app);
}

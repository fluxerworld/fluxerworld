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

import type {IAuditLogSearchService} from '@fluxer/api/src/search/IAuditLogSearchService';
import type {IGuildMemberSearchService} from '@fluxer/api/src/search/IGuildMemberSearchService';
import type {IGuildSearchService} from '@fluxer/api/src/search/IGuildSearchService';
import type {IMessageSearchService} from '@fluxer/api/src/search/IMessageSearchService';
import type {IReportSearchService} from '@fluxer/api/src/search/IReportSearchService';
import type {IUserSearchService} from '@fluxer/api/src/search/IUserSearchService';

export interface ISearchProvider {
	initialize(): Promise<void>;
	shutdown(): Promise<void>;

	getMessageSearchService(): IMessageSearchService | null;
	getGuildSearchService(): IGuildSearchService | null;
	getUserSearchService(): IUserSearchService | null;
	getReportSearchService(): IReportSearchService | null;
	getAuditLogSearchService(): IAuditLogSearchService | null;
	getGuildMemberSearchService(): IGuildMemberSearchService | null;
}

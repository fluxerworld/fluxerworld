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

import {ApiClient, type ApiResult} from '@fluxer/admin/src/api/Client';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {
	BanCheckResponseSchema,
	ListEmailBansResponseSchema,
	ListIpBansResponseSchema,
	ListPhoneBansResponseSchema,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

export type BanCheckResponse = z.infer<typeof BanCheckResponseSchema>;
export type ListIpBansResponse = z.infer<typeof ListIpBansResponseSchema>;
export type ListEmailBansResponse = z.infer<typeof ListEmailBansResponseSchema>;
export type ListPhoneBansResponse = z.infer<typeof ListPhoneBansResponseSchema>;

export async function banEmail(
	config: Config,
	session: Session,
	email: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/bans/email/add', {email}, auditLogReason);
}

export async function unbanEmail(
	config: Config,
	session: Session,
	email: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/bans/email/remove', {email}, auditLogReason);
}

export async function checkEmailBan(
	config: Config,
	session: Session,
	email: string,
): Promise<ApiResult<BanCheckResponse>> {
	const client = new ApiClient(config, session);
	return client.post<BanCheckResponse>('/admin/bans/email/check', {email});
}

export async function banIp(
	config: Config,
	session: Session,
	ip: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/bans/ip/add', {ip}, auditLogReason);
}

export async function unbanIp(
	config: Config,
	session: Session,
	ip: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/bans/ip/remove', {ip}, auditLogReason);
}

export async function checkIpBan(config: Config, session: Session, ip: string): Promise<ApiResult<BanCheckResponse>> {
	const client = new ApiClient(config, session);
	return client.post<BanCheckResponse>('/admin/bans/ip/check', {ip});
}

export async function banPhone(
	config: Config,
	session: Session,
	phone: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/bans/phone/add', {phone}, auditLogReason);
}

export async function unbanPhone(
	config: Config,
	session: Session,
	phone: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/bans/phone/remove', {phone}, auditLogReason);
}

export async function checkPhoneBan(
	config: Config,
	session: Session,
	phone: string,
): Promise<ApiResult<BanCheckResponse>> {
	const client = new ApiClient(config, session);
	return client.post<BanCheckResponse>('/admin/bans/phone/check', {phone});
}

export async function listIpBans(
	config: Config,
	session: Session,
	limit: number = 200,
): Promise<ApiResult<ListIpBansResponse>> {
	const client = new ApiClient(config, session);
	return client.post<ListIpBansResponse>('/admin/bans/ip/list', {limit});
}

export async function listEmailBans(
	config: Config,
	session: Session,
	limit: number = 200,
): Promise<ApiResult<ListEmailBansResponse>> {
	const client = new ApiClient(config, session);
	return client.post<ListEmailBansResponse>('/admin/bans/email/list', {limit});
}

export async function listPhoneBans(
	config: Config,
	session: Session,
	limit: number = 200,
): Promise<ApiResult<ListPhoneBansResponse>> {
	const client = new ApiClient(config, session);
	return client.post<ListPhoneBansResponse>('/admin/bans/phone/list', {limit});
}

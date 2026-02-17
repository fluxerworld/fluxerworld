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

import type {ReportType} from '@app/components/pages/report/ReportTypes';
import {msg} from '@lingui/core/macro';

export interface SelectDescriptor {
	value: string;
	label: MessageDescriptor;
}

export interface RadioDescriptor<T> {
	value: T;
	name: MessageDescriptor;
}

type MessageDescriptor = ReturnType<typeof msg>;

export const REPORT_TYPE_OPTION_DESCRIPTORS: ReadonlyArray<RadioDescriptor<ReportType>> = [
	{value: 'message', name: msg`Report a Message`},
	{value: 'user', name: msg`Report a User Profile`},
	{value: 'guild', name: msg`Report a Community`},
];

export const MESSAGE_CATEGORY_OPTIONS: ReadonlyArray<SelectDescriptor> = [
	{value: '', label: msg`Select a category`},
	{value: 'harassment', label: msg`Harassment or Bullying`},
	{value: 'hate_speech', label: msg`Hate Speech`},
	{value: 'violent_content', label: msg`Violent or Graphic Content`},
	{value: 'spam', label: msg`Spam or Scam`},
	{value: 'nsfw_violation', label: msg`NSFW Policy Violation`},
	{value: 'illegal_activity', label: msg`Illegal Activity`},
	{value: 'doxxing', label: msg`Sharing Personal Information`},
	{value: 'self_harm', label: msg`Self-Harm or Suicide`},
	{value: 'child_safety', label: msg`Child Safety Concerns`},
	{value: 'malicious_links', label: msg`Malicious Links`},
	{value: 'impersonation', label: msg`Impersonation`},
	{value: 'other', label: msg`Other`},
];

export const USER_CATEGORY_OPTIONS: ReadonlyArray<SelectDescriptor> = [
	{value: '', label: msg`Select a category`},
	{value: 'harassment', label: msg`Harassment or Bullying`},
	{value: 'hate_speech', label: msg`Hate Speech`},
	{value: 'spam_account', label: msg`Spam Account`},
	{value: 'impersonation', label: msg`Impersonation`},
	{value: 'underage_user', label: msg`Underage User`},
	{value: 'inappropriate_profile', label: msg`Inappropriate Profile`},
	{value: 'other', label: msg`Other`},
];

export const GUILD_CATEGORY_OPTIONS: ReadonlyArray<SelectDescriptor> = [
	{value: '', label: msg`Select a category`},
	{value: 'harassment', label: msg`Harassment`},
	{value: 'hate_speech', label: msg`Hate Speech`},
	{value: 'extremist_community', label: msg`Extremist Community`},
	{value: 'illegal_activity', label: msg`Illegal Activity`},
	{value: 'child_safety', label: msg`Child Safety Concerns`},
	{value: 'raid_coordination', label: msg`Raid Coordination`},
	{value: 'spam', label: msg`Spam or Scam Community`},
	{value: 'malware_distribution', label: msg`Malware Distribution`},
	{value: 'other', label: msg`Other`},
];

export const COUNTRY_OPTIONS: ReadonlyArray<SelectDescriptor> = [
	{value: '', label: msg`Select a country`},
	{value: 'AT', label: msg`Austria`},
	{value: 'BE', label: msg`Belgium`},
	{value: 'BG', label: msg`Bulgaria`},
	{value: 'HR', label: msg`Croatia`},
	{value: 'CY', label: msg`Cyprus`},
	{value: 'CZ', label: msg`Czech Republic`},
	{value: 'DK', label: msg`Denmark`},
	{value: 'EE', label: msg`Estonia`},
	{value: 'FI', label: msg`Finland`},
	{value: 'FR', label: msg`France`},
	{value: 'DE', label: msg`Germany`},
	{value: 'GR', label: msg`Greece`},
	{value: 'HU', label: msg`Hungary`},
	{value: 'IE', label: msg`Ireland`},
	{value: 'IT', label: msg`Italy`},
	{value: 'LV', label: msg`Latvia`},
	{value: 'LT', label: msg`Lithuania`},
	{value: 'LU', label: msg`Luxembourg`},
	{value: 'MT', label: msg`Malta`},
	{value: 'NL', label: msg`Netherlands`},
	{value: 'PL', label: msg`Poland`},
	{value: 'PT', label: msg`Portugal`},
	{value: 'RO', label: msg`Romania`},
	{value: 'SK', label: msg`Slovakia`},
	{value: 'SI', label: msg`Slovenia`},
	{value: 'ES', label: msg`Spain`},
	{value: 'SE', label: msg`Sweden`},
];

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

import type {ModalRender} from '@app/actions/ModalRender';
import {ChannelSettingsModal} from '@app/components/modals/ChannelSettingsModal';
import {GuildSettingsModal} from '@app/components/modals/GuildSettingsModal';
import {UserSettingsModal} from '@app/components/modals/UserSettingsModal';
import {Logger} from '@app/lib/Logger';
import ModalStore from '@app/stores/ModalStore';
import lodash from 'lodash';
import type React from 'react';

const logger = new Logger('Modal');

const BACKGROUND_MODAL_TYPES = [UserSettingsModal, GuildSettingsModal, ChannelSettingsModal] as const;

const isBackgroundModal = (element: React.ReactElement): boolean => {
	return BACKGROUND_MODAL_TYPES.some((type) => element.type === type);
};

export function modal(render: () => React.ReactElement): ModalRender {
	return render as ModalRender;
}

export function push(modal: ModalRender): void {
	const renderedModal = modal();
	const isBackground = isBackgroundModal(renderedModal);

	if (renderedModal.type === UserSettingsModal && ModalStore.hasModalOfType(UserSettingsModal)) {
		logger.debug('Skipping duplicate UserSettingsModal');
		return;
	}
	if (renderedModal.type === GuildSettingsModal && ModalStore.hasModalOfType(GuildSettingsModal)) {
		logger.debug('Skipping duplicate GuildSettingsModal');
		return;
	}
	if (renderedModal.type === ChannelSettingsModal && ModalStore.hasModalOfType(ChannelSettingsModal)) {
		logger.debug('Skipping duplicate ChannelSettingsModal');
		return;
	}

	const key = lodash.uniqueId('modal');
	logger.debug(`Pushing modal: ${key} (background=${isBackground})`);
	ModalStore.push(modal, key, {isBackground});
}

export function pushWithKey(modal: ModalRender, key: string): void {
	const renderedModal = modal();
	const isBackground = isBackgroundModal(renderedModal);

	if (renderedModal.type === UserSettingsModal && ModalStore.hasModalOfType(UserSettingsModal)) {
		logger.debug('Skipping duplicate UserSettingsModal');
		return;
	}
	if (renderedModal.type === GuildSettingsModal && ModalStore.hasModalOfType(GuildSettingsModal)) {
		logger.debug('Skipping duplicate GuildSettingsModal');
		return;
	}
	if (renderedModal.type === ChannelSettingsModal && ModalStore.hasModalOfType(ChannelSettingsModal)) {
		logger.debug('Skipping duplicate ChannelSettingsModal');
		return;
	}

	if (ModalStore.hasModal(key)) {
		logger.debug(`Updating existing modal with key: ${key}`);
		ModalStore.update(key, () => modal, {isBackground});
		return;
	}

	logger.debug(`Pushing modal with key: ${key} (background=${isBackground})`);
	ModalStore.push(modal, key, {isBackground});
}

export function update(key: string, updater: (currentModal: ModalRender) => ModalRender): void {
	logger.debug(`Updating modal with key: ${key}`);
	ModalStore.update(key, updater);
}

export function pop(): void {
	logger.debug('Popping most recent modal');
	ModalStore.pop();
}

export function popWithKey(key: string): void {
	logger.debug(`Popping modal with key: ${key}`);
	ModalStore.pop(key);
}

export function popByType<T>(component: React.ComponentType<T>): void {
	logger.debug(`Popping modal by type: ${component.displayName ?? component.name ?? 'unknown'}`);
	ModalStore.popByType(component);
}

export function popAll(): void {
	logger.debug('Popping all modals');
	ModalStore.popAll();
}

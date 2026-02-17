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

import * as AuthenticationActionCreators from '@app/actions/AuthenticationActionCreators';
import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {getAccountAvatarUrl} from '@app/components/accounts/AccountListItem';
import {showBrowserLoginHandoffModal} from '@app/components/auth/BrowserLoginHandoffModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {Endpoints} from '@app/Endpoints';
import i18n from '@app/I18n';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import {type Account, SessionExpiredError} from '@app/lib/SessionManager';
import AccountManager from '@app/stores/AccountManager';
import {describeApiEndpoint} from '@app/stores/RuntimeConfigStore';
import {DEFAULT_API_VERSION} from '@fluxer/constants/src/AppConstants';
import {msg} from '@lingui/core/macro';
import {Trans} from '@lingui/react/macro';
import {SignOutIcon} from '@phosphor-icons/react';
import type React from 'react';

const logger = new Logger('AccountSwitcherModalUtils');

export interface AccountSwitcherLogic {
	currentAccount: Account | null;
	accounts: Array<Account>;
	secondaryAccounts: Array<Account>;
	isBusy: boolean;
	currentInstanceLabel: string | null;
	handleSwitchAccount: (userId: string) => Promise<void>;
	handleLogout: () => Promise<void>;
	handleLogoutStoredAccount: (account: Account) => Promise<void>;
	handleAddAccount: () => void;
	handleReLogin: (_userId: string) => void;
	handleRemoveAccount: (userId: string) => Promise<void>;
	getAvatarUrl: (account: Account) => string | undefined;
}

const handleLoginSuccess = async ({token, userId}: {token: string; userId: string}): Promise<void> => {
	await AuthenticationActionCreators.completeLogin({token, userId});
	ModalActionCreators.popAll();
};

function buildAccountLogoutUrl(account: Account): string {
	const endpoint = account.instance?.apiEndpoint?.replace(/\/+$/, '');
	if (!endpoint) {
		return Endpoints.AUTH_LOGOUT;
	}
	return `${endpoint}/v${DEFAULT_API_VERSION}${Endpoints.AUTH_LOGOUT}`;
}

export function useAccountSwitcherLogic(): AccountSwitcherLogic {
	const currentAccount = AccountManager.currentAccount;
	const accounts = AccountManager.getAllAccounts();

	const isBusy = AccountManager.isSwitching || AccountManager.isLoading;

	const secondaryAccounts = accounts.filter((a) => a.userId !== currentAccount?.userId);

	const currentInstanceLabel = currentAccount?.instance
		? describeApiEndpoint(currentAccount.instance.apiEndpoint)
		: null;

	const handleReLogin = (userId: string): void => {
		const account = AccountManager.accounts.get(userId);
		const email = account?.userData?.email ?? undefined;
		showBrowserLoginHandoffModal(handleLoginSuccess, undefined, email);
	};

	const handleSwitchAccount = async (userId: string): Promise<void> => {
		if (isBusy) {
			return;
		}

		try {
			await AccountManager.switchToAccount(userId);
			ModalActionCreators.pop();
		} catch (error) {
			if (error instanceof SessionExpiredError) {
				handleReLogin(userId);
			} else {
				logger.error('Failed to switch account', error);
				ToastActionCreators.error(i18n._(msg`We couldn't switch accounts. Please try again.`));
			}
		}
	};

	const handleLogout = async (): Promise<void> => {
		if (isBusy) {
			return;
		}

		try {
			await AccountManager.logout();
			ModalActionCreators.pop();
		} catch (error) {
			logger.error('Logout failed', error);
			ToastActionCreators.error(i18n._(msg`Logging out failed. Try again in a moment.`));
		}
	};

	const handleLogoutStoredAccount = async (account: Account): Promise<void> => {
		if (isBusy) {
			return;
		}

		try {
			await http.post({
				url: buildAccountLogoutUrl(account),
				headers: {Authorization: account.token},
				timeout: 5000,
				retries: 0,
				skipAuth: true,
			});
		} catch (error) {
			logger.warn('Failed to log out stored account', error);
		}

		await handleRemoveAccount(account.userId);
	};

	const handleAddAccount = (): void => {
		showBrowserLoginHandoffModal(handleLoginSuccess);
	};

	const handleRemoveAccount = async (userId: string): Promise<void> => {
		if (isBusy) {
			return;
		}

		try {
			await AccountManager.removeStoredAccount(userId);
		} catch (error) {
			logger.error('Failed to remove account', error);
			ToastActionCreators.error(i18n._(msg`Could not remove this account. Please try again.`));
		}
	};

	return {
		currentAccount,
		accounts,
		secondaryAccounts,
		isBusy,
		currentInstanceLabel,
		handleSwitchAccount,
		handleLogout,
		handleLogoutStoredAccount,
		handleAddAccount,
		handleReLogin,
		handleRemoveAccount,
		getAvatarUrl: getAccountAvatarUrl,
	};
}

export interface OpenSignOutConfirmOptions {
	account: Account;
	currentAccountId: string | null;
	hasMultipleAccounts: boolean;
	onLogout: () => Promise<void>;
	onLogoutStoredAccount: (account: Account) => Promise<void>;
}

export function openSignOutConfirm({
	account,
	currentAccountId,
	hasMultipleAccounts,
	onLogout,
	onLogoutStoredAccount,
}: OpenSignOutConfirmOptions): void {
	const displayName = account.userData?.username ?? account.userId;
	const isCurrentAccount = account.userId === currentAccountId;

	ModalActionCreators.push(
		modal(() => (
			<ConfirmModal
				title={<Trans>Sign out of {displayName}</Trans>}
				description={
					isCurrentAccount ? (
						hasMultipleAccounts ? (
							<Trans>Signing out will bring you to the login screen so you can pick another account.</Trans>
						) : (
							<Trans>Signing out will bring you to the login screen.</Trans>
						)
					) : (
						<Trans>Signing out will remove this account from the device.</Trans>
					)
				}
				primaryText={<Trans>Sign out</Trans>}
				primaryVariant="danger-primary"
				onPrimary={async () => {
					if (isCurrentAccount) {
						await onLogout();
					} else {
						await onLogoutStoredAccount(account);
					}
				}}
			/>
		)),
	);
}

export interface OpenAccountContextMenuOptions {
	account: Account;
	currentAccountId: string | null;
	hasMultipleAccounts: boolean;
	onSwitch: (userId: string) => void;
	onReLogin: (userId: string) => void;
	onLogout: () => Promise<void>;
	onLogoutStoredAccount: (account: Account) => Promise<void>;
}

export function openAccountContextMenu(
	event: React.MouseEvent<HTMLButtonElement>,
	{
		account,
		currentAccountId,
		hasMultipleAccounts,
		onSwitch,
		onReLogin,
		onLogout,
		onLogoutStoredAccount,
	}: OpenAccountContextMenuOptions,
): void {
	const isCurrent = account.userId === currentAccountId;

	ContextMenuActionCreators.openFromEvent(event, (props) => (
		<MenuGroup>
			{isCurrent ? (
				<MenuItem
					danger
					icon={<SignOutIcon size={18} />}
					onClick={() => {
						props.onClose();
						openSignOutConfirm({
							account,
							currentAccountId,
							hasMultipleAccounts,
							onLogout,
							onLogoutStoredAccount,
						});
					}}
				>
					<Trans>Sign out</Trans>
				</MenuItem>
			) : (
				<>
					{account.isValid === false ? (
						<MenuItem
							icon={<SignOutIcon size={18} />}
							onClick={() => {
								props.onClose();
								onReLogin(account.userId);
							}}
						>
							<Trans>Re-login</Trans>
						</MenuItem>
					) : (
						<MenuItem
							icon={<SignOutIcon size={18} />}
							onClick={() => {
								props.onClose();
								onSwitch(account.userId);
							}}
						>
							<Trans>Switch to this account</Trans>
						</MenuItem>
					)}
					<MenuItem
						danger
						icon={<SignOutIcon size={18} />}
						onClick={() => {
							props.onClose();
							openSignOutConfirm({
								account,
								currentAccountId,
								hasMultipleAccounts,
								onLogout,
								onLogoutStoredAccount,
							});
						}}
					>
						<Trans>Sign out</Trans>
					</MenuItem>
				</>
			)}
		</MenuGroup>
	));
}

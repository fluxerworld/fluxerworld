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

import styles from '@app/components/auth/InstanceSelector.module.css';
import {Input} from '@app/components/form/Input';
import {Button} from '@app/components/uikit/button/Button';
import {Spinner} from '@app/components/uikit/Spinner';
import AppStorage from '@app/lib/AppStorage';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {CaretDownIcon, CheckCircleIcon, GlobeIcon, TrashIcon, WarningCircleIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const RECENT_INSTANCES_KEY = 'federation_recent_instances';
const MAX_RECENT_INSTANCES = 5;

export type InstanceDiscoveryStatus = 'idle' | 'discovering' | 'success' | 'error';

export interface InstanceInfo {
	domain: string;
	name?: string;
	lastUsed: number;
}

interface InstanceSelectorProps {
	value: string;
	onChange: (value: string) => void;
	onInstanceDiscovered?: (domain: string) => void;
	onDiscoveryStatusChange?: (status: InstanceDiscoveryStatus) => void;
	disabled?: boolean;
	className?: string;
}

function loadRecentInstances(): Array<InstanceInfo> {
	const stored = AppStorage.getJSON<Array<InstanceInfo>>(RECENT_INSTANCES_KEY);
	if (!stored || !Array.isArray(stored)) {
		return [];
	}
	return stored.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_RECENT_INSTANCES);
}

function saveRecentInstance(domain: string, name?: string): void {
	const recent = loadRecentInstances();
	const normalizedDomain = domain.toLowerCase().trim();

	const existingIndex = recent.findIndex((inst) => inst.domain.toLowerCase() === normalizedDomain);
	if (existingIndex !== -1) {
		recent.splice(existingIndex, 1);
	}

	recent.unshift({
		domain: normalizedDomain,
		name,
		lastUsed: Date.now(),
	});

	AppStorage.setJSON(RECENT_INSTANCES_KEY, recent.slice(0, MAX_RECENT_INSTANCES));
}

function removeRecentInstance(domain: string): void {
	const recent = loadRecentInstances();
	const normalizedDomain = domain.toLowerCase().trim();
	const filtered = recent.filter((inst) => inst.domain.toLowerCase() !== normalizedDomain);
	AppStorage.setJSON(RECENT_INSTANCES_KEY, filtered);
}

export const InstanceSelector = observer(function InstanceSelector({
	value,
	onChange,
	onInstanceDiscovered,
	onDiscoveryStatusChange,
	disabled = false,
	className,
}: InstanceSelectorProps) {
	const {t} = useLingui();
	const [discoveryStatus, setDiscoveryStatus] = useState<InstanceDiscoveryStatus>('idle');
	const [discoveryError, setDiscoveryError] = useState<string | null>(null);
	const [recentInstances, setRecentInstances] = useState<Array<InstanceInfo>>(() => loadRecentInstances());
	const [showDropdown, setShowDropdown] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const discoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const updateDiscoveryStatus = useCallback(
		(status: InstanceDiscoveryStatus) => {
			setDiscoveryStatus(status);
			onDiscoveryStatusChange?.(status);
		},
		[onDiscoveryStatusChange],
	);

	const discoverInstance = useCallback(
		async (instanceUrl: string) => {
			if (!instanceUrl.trim()) {
				updateDiscoveryStatus('idle');
				setDiscoveryError(null);
				return;
			}

			updateDiscoveryStatus('discovering');
			setDiscoveryError(null);

			try {
				await RuntimeConfigStore.connectToEndpoint(instanceUrl);
				updateDiscoveryStatus('success');
				saveRecentInstance(instanceUrl);
				setRecentInstances(loadRecentInstances());
				onInstanceDiscovered?.(instanceUrl);
			} catch (error) {
				updateDiscoveryStatus('error');
				const errorMessage = error instanceof Error ? error.message : t`Failed to connect to instance`;
				setDiscoveryError(errorMessage);
			}
		},
		[onInstanceDiscovered, updateDiscoveryStatus, t],
	);

	const handleInputChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = event.target.value;
			onChange(newValue);
			updateDiscoveryStatus('idle');
			setDiscoveryError(null);

			if (discoveryTimeoutRef.current) {
				clearTimeout(discoveryTimeoutRef.current);
			}

			if (newValue.trim()) {
				discoveryTimeoutRef.current = setTimeout(() => {
					discoverInstance(newValue);
				}, 800);
			}
		},
		[onChange, discoverInstance, updateDiscoveryStatus],
	);

	const handleSelectRecent = useCallback(
		(instance: InstanceInfo) => {
			onChange(instance.domain);
			setShowDropdown(false);
			discoverInstance(instance.domain);
		},
		[onChange, discoverInstance],
	);

	const handleRemoveRecent = useCallback((event: React.MouseEvent, domain: string) => {
		event.stopPropagation();
		removeRecentInstance(domain);
		setRecentInstances(loadRecentInstances());
	}, []);

	const handleConnectClick = useCallback(() => {
		if (value.trim()) {
			discoverInstance(value);
		}
	}, [value, discoverInstance]);

	const handleDropdownToggle = useCallback(() => {
		if (recentInstances.length > 0 && !disabled) {
			setShowDropdown((prev) => !prev);
		}
	}, [recentInstances.length, disabled]);

	const handleInputFocus = useCallback(() => {
		if (recentInstances.length > 0 && !value.trim()) {
			setShowDropdown(true);
		}
	}, [recentInstances.length, value]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(event.target as Node)
			) {
				setShowDropdown(false);
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	useEffect(() => {
		return () => {
			if (discoveryTimeoutRef.current) {
				clearTimeout(discoveryTimeoutRef.current);
			}
		};
	}, []);

	const statusIcon = useMemo(() => {
		if (discoveryStatus === 'discovering') {
			return <Spinner size="small" className={styles.statusSpinner} />;
		}
		if (discoveryStatus === 'success') {
			return <CheckCircleIcon weight="fill" className={styles.statusSuccess} size={18} />;
		}
		if (discoveryStatus === 'error') {
			return <WarningCircleIcon weight="fill" className={styles.statusError} size={18} />;
		}
		return null;
	}, [discoveryStatus]);

	const placeholder = t`Enter instance URL (e.g. fluxer.app)`;

	return (
		<div className={clsx(styles.container, className)}>
			<div className={styles.inputContainer}>
				<Input
					ref={inputRef}
					value={value}
					onChange={handleInputChange}
					onFocus={handleInputFocus}
					placeholder={placeholder}
					disabled={disabled}
					leftIcon={<GlobeIcon size={18} weight="regular" />}
					rightElement={
						<div className={styles.inputActions}>
							{statusIcon}
							{recentInstances.length > 0 && (
								<button
									type="button"
									className={styles.dropdownToggle}
									onClick={handleDropdownToggle}
									disabled={disabled}
									aria-label={t`Show recent instances`}
								>
									<CaretDownIcon
										size={16}
										weight="bold"
										className={clsx(styles.caretIcon, showDropdown && styles.caretIconOpen)}
									/>
								</button>
							)}
						</div>
					}
					aria-label={t`Instance URL`}
					aria-describedby={discoveryError ? 'instance-error' : undefined}
				/>

				{showDropdown && recentInstances.length > 0 && (
					<div ref={dropdownRef} className={styles.dropdown}>
						<div className={styles.dropdownHeader}>
							<Trans>Recent instances</Trans>
						</div>
						<ul className={styles.dropdownList}>
							{recentInstances.map((instance) => (
								<li key={instance.domain}>
									<button type="button" className={styles.dropdownItem} onClick={() => handleSelectRecent(instance)}>
										<GlobeIcon size={16} weight="regular" className={styles.instanceIcon} />
										<span className={styles.instanceDomain}>{instance.domain}</span>
										{instance.name && <span className={styles.instanceName}>{instance.name}</span>}
										<button
											type="button"
											className={styles.removeButton}
											onClick={(e) => handleRemoveRecent(e, instance.domain)}
											aria-label={t`Remove ${instance.domain} from recent instances`}
										>
											<TrashIcon size={14} weight="regular" />
										</button>
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>

			{discoveryError && (
				<div id="instance-error" className={styles.errorMessage}>
					{discoveryError}
				</div>
			)}

			{discoveryStatus !== 'success' && value.trim() && (
				<Button
					onClick={handleConnectClick}
					disabled={disabled}
					submitting={discoveryStatus === 'discovering'}
					variant="secondary"
					small
					className={styles.connectButton}
				>
					<Trans>Connect</Trans>
				</Button>
			)}
		</div>
	);
});

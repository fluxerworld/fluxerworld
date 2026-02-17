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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UnsavedChangesActionCreators from '@app/actions/UnsavedChangesActionCreators';
import {Form} from '@app/components/form/Form';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {StatusSlate} from '@app/components/modals/shared/StatusSlate';
import ApplicationsTabStore from '@app/components/modals/tabs/applications_tab/ApplicationsTabStore';
import styles from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetail.module.css';
import type {ApplicationDetailFormValues} from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationDetailTypes';
import {ApplicationHeader} from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationHeader';
import {ApplicationInfoSection} from '@app/components/modals/tabs/applications_tab/application_detail/ApplicationInfoSection';
import {BotProfileSection} from '@app/components/modals/tabs/applications_tab/application_detail/BotProfileSection';
import {OAuthBuilderSection} from '@app/components/modals/tabs/applications_tab/application_detail/OAuthBuilderSection';
import {SecretsSection} from '@app/components/modals/tabs/applications_tab/application_detail/SecretsSection';
import {SectionCard} from '@app/components/modals/tabs/applications_tab/application_detail/SectionCard';
import {Button} from '@app/components/uikit/button/Button';
import {Endpoints} from '@app/Endpoints';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {useSudo} from '@app/hooks/useSudo';
import HttpClient from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import type {DeveloperApplication} from '@app/records/DeveloperApplicationRecord';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import {formatBotPermissionsQuery, getAllBotPermissions} from '@app/utils/PermissionUtils';
import {OAuth2Scopes} from '@fluxer/constants/src/OAuth2Constants';
import {PublicUserFlags} from '@fluxer/constants/src/UserConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {TrashIcon, WarningCircleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useId, useMemo, useState} from 'react';
import {useForm, useWatch} from 'react-hook-form';

const logger = new Logger('ApplicationDetail');

interface ApplicationDetailProps {
	applicationId: string;
	onBack: () => void;
	initialApplication?: DeveloperApplication | null;
}

const APPLICATIONS_TAB_ID = 'applications';
const AVAILABLE_SCOPES = OAuth2Scopes;
const isFriendlyFlagSet = (flags?: number): boolean =>
	!!flags && (flags & PublicUserFlags.FRIENDLY_BOT) === PublicUserFlags.FRIENDLY_BOT;

const isManualApprovalFlagSet = (flags?: number): boolean =>
	!!flags && (flags & PublicUserFlags.FRIENDLY_BOT_MANUAL_APPROVAL) === PublicUserFlags.FRIENDLY_BOT_MANUAL_APPROVAL;

export const ApplicationDetail: React.FC<ApplicationDetailProps> = observer(
	({applicationId, onBack, initialApplication}) => {
		const {t, i18n} = useLingui();
		const store = ApplicationsTabStore;

		const application = store.selectedApplication;
		const loading = store.isLoading && store.isDetailView;
		const error = store.error;
		const [idCopied, setIdCopied] = useState(false);
		const [previewAvatarUrl, setPreviewAvatarUrl] = useState<string | null>(null);
		const [hasClearedAvatar, setHasClearedAvatar] = useState(false);
		const [previewBannerUrl, setPreviewBannerUrl] = useState<string | null>(null);
		const [hasClearedBanner, setHasClearedBanner] = useState(false);
		const [isDeleting, setIsDeleting] = useState(false);
		const [initialValues, setInitialValues] = useState<ApplicationDetailFormValues | null>(null);
		const [clientSecret, setClientSecret] = useState<string | null>(null);
		const [botToken, setBotToken] = useState<string | null>(null);
		const [isRotating, setIsRotating] = useState<'client' | 'bot' | null>(null);
		const clientSecretInputId = useId();
		const botTokenInputId = useId();

		const sudo = useSudo();

		const form = useForm<ApplicationDetailFormValues>({
			defaultValues: {
				name: '',
				botPublic: true,
				botRequireCodeGrant: false,
				friendlyBot: false,
				botManualFriendRequestApproval: false,
				redirectUris: [],
				redirectUriInputs: [''],
				builderScopes: {} as Record<string, boolean>,
				builderPermissions: {} as Record<string, boolean>,
				username: '',
				avatar: null,
				bio: '',
				banner: null,
			},
		});

		const buildFormDefaults = useCallback((app: DeveloperApplication): ApplicationDetailFormValues => {
			const builderScopeMap = AVAILABLE_SCOPES.reduce<Record<string, boolean>>((acc, scope) => {
				acc[scope] = false;
				return acc;
			}, {});

			const redirectList = (app.redirect_uris ?? []).length > 0 ? app.redirect_uris : [''];

			return {
				name: app.name,
				redirectUris: app.redirect_uris ?? [],
				redirectUriInputs: redirectList,
				botPublic: app.bot_public,
				botRequireCodeGrant: app.bot_require_code_grant,
				friendlyBot: isFriendlyFlagSet(app.bot?.flags),
				botManualFriendRequestApproval: isManualApprovalFlagSet(app.bot?.flags),
				builderScopes: builderScopeMap,
				builderPermissions: {},
				username: app.bot?.username || '',
				avatar: null,
				bio: app.bot?.bio ?? '',
				banner: null,
			};
		}, []);

		useEffect(() => {
			if (application && application.id === applicationId) {
				const fetchedClientSecret = application.client_secret ?? null;
				const fetchedBotToken = application.bot?.token ?? null;
				setClientSecret(fetchedClientSecret);
				setBotToken(fetchedBotToken);

				const defaults = buildFormDefaults(application);
				form.reset(defaults);
				setInitialValues(defaults);

				setPreviewAvatarUrl(null);
				setHasClearedAvatar(false);
				setPreviewBannerUrl(null);
				setHasClearedBanner(false);
			}
		}, [application, applicationId, buildFormDefaults, form]);

		useEffect(() => {
			if (initialApplication && initialApplication.id === applicationId) {
				void store.navigateToDetail(applicationId, initialApplication);
			} else if (!store.selectedApplication || store.selectedAppId !== applicationId) {
				void store.navigateToDetail(applicationId);
			}
		}, [applicationId, initialApplication, store]);

		const formIsSubmitting = form.formState.isSubmitting;
		const watchedValues = useWatch<ApplicationDetailFormValues>({control: form.control});

		const hasFormChanges = useMemo(() => {
			if (!initialValues) return false;
			const currentValues =
				(watchedValues as ApplicationDetailFormValues | undefined) ?? ({} as ApplicationDetailFormValues);

			return (
				(currentValues.name ?? '') !== (initialValues.name ?? '') ||
				(currentValues.redirectUris ?? []).join(',') !== (initialValues.redirectUris ?? []).join(',') ||
				(currentValues.redirectUriInputs ?? []).join(',') !== (initialValues.redirectUriInputs ?? []).join(',') ||
				(currentValues.botPublic ?? true) !== (initialValues.botPublic ?? true) ||
				(currentValues.botRequireCodeGrant ?? false) !== (initialValues.botRequireCodeGrant ?? false) ||
				(currentValues.username ?? '') !== (initialValues.username ?? '') ||
				(currentValues.bio ?? '') !== (initialValues.bio ?? '') ||
				(currentValues.banner ?? '') !== (initialValues.banner ?? '') ||
				(currentValues.friendlyBot ?? false) !== (initialValues.friendlyBot ?? false) ||
				(currentValues.botManualFriendRequestApproval ?? false) !==
					(initialValues.botManualFriendRequestApproval ?? false)
			);
		}, [initialValues, watchedValues]);

		const hasUnsavedChanges = useMemo(() => {
			return Boolean(hasFormChanges || previewAvatarUrl || hasClearedAvatar || previewBannerUrl || hasClearedBanner);
		}, [hasFormChanges, previewAvatarUrl, hasClearedAvatar, previewBannerUrl, hasClearedBanner]);

		const onSubmit = useCallback(
			async (data: ApplicationDetailFormValues) => {
				if (!application) return;

				const normalizedName = data.name.trim();
				const redirectUris = (data.redirectUriInputs ?? []).map((u) => u.trim()).filter(Boolean);
				const dirtyFields = form.formState.dirtyFields;

				const buildApplicationPatch = () => {
					const changes: Record<string, unknown> = {};
					if (normalizedName !== application.name) {
						changes.name = normalizedName;
					}
					const initialRedirects = application.redirect_uris ?? [];
					if ((redirectUris ?? []).join(',') !== initialRedirects.join(',')) {
						changes.redirect_uris = redirectUris;
					}
					if ((data.botPublic ?? true) !== (application.bot_public ?? true)) {
						changes.bot_public = data.botPublic;
					}
					if ((data.botRequireCodeGrant ?? false) !== (application.bot_require_code_grant ?? false)) {
						changes.bot_require_code_grant = data.botRequireCodeGrant;
					}
					return changes;
				};

				const buildBotPatch = () => {
					if (!application.bot) return null;

					const botBody: Record<string, unknown> = {};
					const currentBot = application.bot;
					const avatarCleared = hasClearedAvatar;
					const bannerCleared = hasClearedBanner;

					if (dirtyFields.username && data.username && data.username !== currentBot.username) {
						botBody.username = data.username;
					}

					const shouldSendAvatar = dirtyFields.avatar || avatarCleared;
					if (shouldSendAvatar) {
						if (avatarCleared) {
							botBody.avatar = null;
						} else if (data.avatar) {
							botBody.avatar = data.avatar;
						}
					}

					const shouldSendBanner = dirtyFields.banner || bannerCleared;
					if (shouldSendBanner) {
						if (bannerCleared) {
							botBody.banner = null;
						} else if (data.banner) {
							botBody.banner = data.banner;
						}
					}

					if (dirtyFields.bio) {
						const trimmedBio = data.bio?.trim() ?? '';
						const currentBio = currentBot.bio ?? '';
						if (trimmedBio !== currentBio) {
							botBody.bio = trimmedBio.length > 0 ? trimmedBio : null;
						}
					}

					const desiredFriendly = Boolean(data.friendlyBot);
					const desiredManualApproval = Boolean(data.botManualFriendRequestApproval);
					const currentlyFriendly = isFriendlyFlagSet(currentBot.flags);
					const currentlyManualApproval = isManualApprovalFlagSet(currentBot.flags);
					const friendlyFlag = PublicUserFlags.FRIENDLY_BOT;
					const manualApprovalFlag = PublicUserFlags.FRIENDLY_BOT_MANUAL_APPROVAL;
					let updatedFlags = currentBot.flags ?? 0;

					if (desiredFriendly && !currentlyFriendly) {
						updatedFlags |= friendlyFlag;
					} else if (!desiredFriendly && currentlyFriendly) {
						updatedFlags &= ~friendlyFlag;
					}

					if (desiredManualApproval && !currentlyManualApproval) {
						updatedFlags |= manualApprovalFlag;
					} else if (!desiredManualApproval && currentlyManualApproval) {
						updatedFlags &= ~manualApprovalFlag;
					}

					if (updatedFlags !== (currentBot.flags ?? 0)) {
						botBody.bot_flags = updatedFlags;
					}

					return Object.keys(botBody).length > 0 ? botBody : null;
				};

				const appPatch = buildApplicationPatch();
				const botPatch = buildBotPatch();

				if (Object.keys(appPatch).length === 0 && !botPatch) {
					ToastActionCreators.createToast({type: 'info', children: t`No changes to save`});
					return;
				}

				try {
					if (Object.keys(appPatch).length > 0) {
						await HttpClient.patch(Endpoints.OAUTH_APPLICATION(applicationId), appPatch);
					}

					if (botPatch) {
						await HttpClient.patch(Endpoints.OAUTH_APPLICATION_BOT_PROFILE(applicationId), botPatch);
					}

					ToastActionCreators.createToast({type: 'success', children: t`Application updated successfully`});
					setPreviewAvatarUrl(null);
					setHasClearedAvatar(false);
					await store.fetchApplication(applicationId);
				} catch (err) {
					logger.error('Failed to update application', err);
					throw err;
				}
			},
			[application, applicationId, store, form.formState.dirtyFields, hasClearedAvatar, hasClearedBanner],
		);

		const {handleSubmit: handleSave} = useFormSubmit({
			form,
			onSubmit,
			defaultErrorField: 'name',
		});

		const handleReset = useCallback(() => {
			if (!application) return;

			const defaults = buildFormDefaults(application);
			form.reset(defaults, {keepDirty: false});
			setInitialValues(defaults);
			setPreviewAvatarUrl(null);
			setHasClearedAvatar(false);
			setPreviewBannerUrl(null);
			setHasClearedBanner(false);
		}, [application, buildFormDefaults, form]);

		useEffect(() => {
			UnsavedChangesActionCreators.setUnsavedChanges(APPLICATIONS_TAB_ID, hasUnsavedChanges);
		}, [hasUnsavedChanges]);

		useEffect(() => {
			UnsavedChangesActionCreators.setTabData(APPLICATIONS_TAB_ID, {
				onReset: handleReset,
				onSave: handleSave,
				isSubmitting: formIsSubmitting,
			});
		}, [handleReset, handleSave, formIsSubmitting]);

		useEffect(() => {
			return () => {
				UnsavedChangesActionCreators.clearUnsavedChanges(APPLICATIONS_TAB_ID);
			};
		}, []);

		const handleAvatarChange = useCallback(
			(base64: string) => {
				form.setValue('avatar', base64, {shouldDirty: true});
				setPreviewAvatarUrl(base64);
				setHasClearedAvatar(false);
				form.clearErrors('avatar');
			},
			[form],
		);

		const handleBannerChange = useCallback(
			(base64: string) => {
				form.setValue('banner', base64, {shouldDirty: true});
				setPreviewBannerUrl(base64);
				setHasClearedBanner(false);
				form.clearErrors('banner');
			},
			[form],
		);

		const handleBannerClear = useCallback(() => {
			form.setValue('banner', null, {shouldDirty: true});
			setPreviewBannerUrl(null);
			setHasClearedBanner(true);
		}, [form]);

		const handleAvatarClear = useCallback(() => {
			form.setValue('avatar', null, {shouldDirty: true});
			setPreviewAvatarUrl(null);
			setHasClearedAvatar(true);
		}, [form]);

		const handleCopyId = async () => {
			if (!application) return;
			try {
				await navigator.clipboard.writeText(application.id);
				setIdCopied(true);
				setTimeout(() => setIdCopied(false), 2000);
			} catch (err) {
				logger.error('Failed to copy ID', err);
			}
		};

		const handleDelete = () => {
			if (!application) return;
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Delete Application`}
						description={
							<div>
								<Trans>
									Are you sure you want to delete <strong>{application.name}</strong>?
								</Trans>
								<br />
								<br />
								<Trans>
									This action cannot be undone. All associated data, including the bot user, will be permanently
									deleted.
								</Trans>
							</div>
						}
						primaryText={t`Delete Application`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							try {
								setIsDeleting(true);
								await HttpClient.delete({url: Endpoints.OAUTH_APPLICATION(application.id), body: {}});
								onBack();
							} catch (err) {
								logger.error('Failed to delete application', err);
								ToastActionCreators.createToast({
									type: 'error',
									children: t`Failed to delete application. Please try again.`,
								});
								setIsDeleting(false);
							}
						}}
					/>
				)),
			);
		};

		const rotateSecret = async (type: 'client' | 'bot') => {
			if (!application) return;
			setIsRotating(type);
			try {
				const sudoPayload = await sudo.require();
				const endpoint =
					type === 'client'
						? Endpoints.OAUTH_APPLICATION_CLIENT_SECRET_RESET(application.id)
						: Endpoints.OAUTH_APPLICATION_BOT_TOKEN_RESET(application.id);
				const res = await HttpClient.post<{client_secret?: string; token?: string}>(endpoint, sudoPayload);
				if (type === 'client') {
					setClientSecret(res.body.client_secret ?? null);
				} else {
					setBotToken(res.body.token ?? null);
				}
				sudo.finalize();
				ToastActionCreators.createToast({
					type: 'success',
					children:
						type === 'client'
							? t`Client secret regenerated. Update any code that uses the old secret.`
							: t`Bot token regenerated. Update any code that uses the old token.`,
				});
			} catch (err) {
				logger.error('Failed to rotate secret', err);
				ToastActionCreators.createToast({
					type: 'error',
					children: t`Failed to rotate. Please try again.`,
				});
			} finally {
				setIsRotating(null);
			}
		};

		const addRedirectInput = () => {
			const current = form.getValues('redirectUriInputs') ?? [];
			form.setValue('redirectUriInputs', [...current, ''], {shouldDirty: true});
		};

		const removeRedirectInput = (index: number) => {
			const current = form.getValues('redirectUriInputs') ?? [];
			const next = current.filter((_, i) => i !== index);
			form.setValue('redirectUriInputs', next.length > 0 ? next : [''], {shouldDirty: true});
		};

		const updateRedirectInput = (index: number, value: string) => {
			const current = form.getValues('redirectUriInputs') ?? [];
			const next = [...current];
			next[index] = value;
			form.setValue('redirectUriInputs', next, {shouldDirty: true});
		};

		const builderScopes = useWatch({control: form.control, name: 'builderScopes'}) || {};
		const builderPermissions = useWatch({control: form.control, name: 'builderPermissions'}) || {};
		const builderRedirectUri = useWatch({control: form.control, name: 'builderRedirectUri'});
		const botRequireCodeGrant = useWatch({control: form.control, name: 'botRequireCodeGrant'}) ?? false;
		const redirectInputs = useWatch({control: form.control, name: 'redirectUriInputs'}) ?? [];
		const bannerValue = useWatch({control: form.control, name: 'banner'});

		const builderScopeList = useMemo(
			() =>
				Object.entries(builderScopes)
					.filter(([, enabled]) => enabled)
					.map(([scope]) => scope),
			[builderScopes],
		);

		const botPermissionsList = useMemo(() => getAllBotPermissions(i18n), [i18n]);

		const builderUrl = useMemo(() => {
			if (!application) return '';
			const authorizeUrl = new URL(Endpoints.OAUTH_AUTHORIZE, window.location.origin);
			authorizeUrl.searchParams.set('client_id', application.id);

			if (builderScopeList.length > 0) {
				authorizeUrl.searchParams.set('scope', builderScopeList.join(' '));
			}

			const isBotOnly = builderScopeList.length === 1 && builderScopeList[0] === 'bot';
			const requireRedirectUri = builderScopeList.length > 0 && (!isBotOnly || botRequireCodeGrant);

			const botPerms = Object.entries(builderPermissions)
				.filter(([, enabled]) => enabled)
				.map(([perm]) => perm);
			if (builderScopeList.includes('bot') && botPerms.length > 0) {
				authorizeUrl.searchParams.set('permissions', formatBotPermissionsQuery(botPerms));
			}

			const redirect = builderRedirectUri?.trim();
			if (requireRedirectUri && !redirect) {
				return '';
			}

			if (redirect) {
				authorizeUrl.searchParams.set('redirect_uri', redirect);
				authorizeUrl.searchParams.set('response_type', 'code');
			}

			if (builderScopeList.length === 0) {
				return '';
			}

			return authorizeUrl.toString();
		}, [application, builderScopeList, builderPermissions, builderRedirectUri, botRequireCodeGrant]);

		const redirectOptions = useMemo(() => {
			const normalized = Array.from(new Set((redirectInputs ?? []).map((u) => u.trim()).filter(Boolean)));
			const current = builderRedirectUri?.trim();
			if (current && !normalized.includes(current)) {
				normalized.push(current);
			}
			return normalized.map((url) => ({value: url, label: url}));
		}, [builderRedirectUri, redirectInputs]);

		const confirmRotate = (type: 'client' | 'bot') => {
			if (!application) return;
			const isClient = type === 'client';
			const description = isClient ? (
				<Trans>Regenerating will invalidate the current secret. Update any code that uses the old value.</Trans>
			) : (
				<Trans>Regenerating will invalidate the current token. Update any code that uses the old value.</Trans>
			);
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={isClient ? t`Regenerate client secret?` : t`Regenerate bot token?`}
						description={description}
						primaryText={t`Regenerate`}
						primaryVariant="danger-primary"
						onPrimary={() => rotateSecret(type)}
					/>
				)),
			);
		};

		const handleCopyBuilderUrl = useCallback(async () => {
			if (!builderUrl) return;
			await navigator.clipboard.writeText(builderUrl);
			ToastActionCreators.createToast({
				type: 'success',
				children: t`Copied URL to clipboard`,
			});
		}, [builderUrl]);

		if (loading) {
			return <div className={styles.loadingState} />;
		}

		if (error || !application) {
			return (
				<div className={styles.page}>
					<StatusSlate
						Icon={WarningCircleIcon}
						title={<Trans>We couldn't load this application</Trans>}
						description={<Trans>Please retry or go back to the applications list.</Trans>}
						fullHeight={true}
						actions={[
							{
								text: <Trans>Retry</Trans>,
								onClick: () => store.fetchApplication(applicationId),
							},
							{
								text: <Trans>Back to list</Trans>,
								onClick: onBack,
								variant: 'secondary',
							},
						]}
					/>
				</div>
			);
		}

		const avatarUrl = application.bot
			? AvatarUtils.getUserAvatarURL({id: application.bot.id, avatar: application.bot.avatar}, false)
			: null;
		const defaultAvatarUrl = application.bot
			? AvatarUtils.getUserAvatarURL({id: application.bot.id, avatar: null}, false)
			: null;

		const displayAvatarUrl = hasClearedAvatar ? defaultAvatarUrl : previewAvatarUrl || avatarUrl || defaultAvatarUrl;
		const hasAvatar = (!hasClearedAvatar && Boolean(application.bot?.avatar)) || Boolean(previewAvatarUrl);
		const displayBannerUrl =
			previewBannerUrl ||
			(hasClearedBanner
				? null
				: application.bot
					? AvatarUtils.getUserBannerURL({id: application.bot.id, banner: application.bot.banner}, true)
					: null);
		const hasBanner = Boolean(displayBannerUrl || bannerValue);

		return (
			<Form form={form} onSubmit={onSubmit}>
				<div className={styles.page}>
					<ApplicationHeader
						name={application.name}
						applicationId={application.id}
						onBack={onBack}
						onCopyId={handleCopyId}
						idCopied={idCopied}
					/>

					<div className={styles.detailGrid}>
						<div className={styles.columnStack}>
							<SecretsSection
								clientSecret={clientSecret}
								botToken={botToken}
								onRegenerateClientSecret={() => confirmRotate('client')}
								onRegenerateBotToken={() => confirmRotate('bot')}
								isRotatingClient={isRotating === 'client'}
								isRotatingBot={isRotating === 'bot'}
								hasBot={Boolean(application.bot)}
								clientSecretInputId={clientSecretInputId}
								botTokenInputId={botTokenInputId}
							/>
							<div className={styles.sectionSpacer} aria-hidden="true" />

							<ApplicationInfoSection
								form={form}
								redirectInputs={form.watch('redirectUriInputs') ?? []}
								onAddRedirect={addRedirectInput}
								onRemoveRedirect={removeRedirectInput}
								onUpdateRedirect={updateRedirectInput}
							/>

							{application.bot && (
								<>
									<div className={styles.sectionSpacer} aria-hidden="true" />
									<BotProfileSection
										application={application}
										form={form}
										displayAvatarUrl={displayAvatarUrl}
										hasAvatar={hasAvatar}
										hasClearedAvatar={hasClearedAvatar}
										onAvatarChange={handleAvatarChange}
										onAvatarClear={handleAvatarClear}
										onBannerChange={handleBannerChange}
										onBannerClear={handleBannerClear}
										displayBannerUrl={displayBannerUrl}
										hasBanner={hasBanner}
										hasClearedBanner={hasClearedBanner}
									/>
								</>
							)}
						</div>

						<div className={styles.columnStack}>
							<div className={styles.sectionSpacer} aria-hidden="true" />
							<div>
								<OAuthBuilderSection
									form={form}
									availableScopes={AVAILABLE_SCOPES}
									builderScopeList={builderScopeList}
									botPermissionsList={botPermissionsList}
									builderUrl={builderUrl}
									redirectOptions={redirectOptions}
									onCopyBuilderUrl={handleCopyBuilderUrl}
								/>
							</div>
						</div>
					</div>

					<div className={styles.sectionSpacer} aria-hidden="true" />

					<SectionCard
						tone="danger"
						title={<Trans>Danger Zone</Trans>}
						subtitle={<Trans>This cannot be undone. Removing the application also deletes its bot.</Trans>}
					>
						<div className={styles.dangerContent}>
							<p className={styles.helperText}>
								<Trans>Once deleted, the application and its credentials are permanently removed.</Trans>
							</p>
							<div className={styles.dangerActions}>
								<Button
									variant="danger-primary"
									onClick={handleDelete}
									submitting={isDeleting}
									leftIcon={<TrashIcon size={16} weight="fill" />}
									fitContent
								>
									<Trans>Delete Application</Trans>
								</Button>
							</div>
						</div>
					</SectionCard>
				</div>
			</Form>
		);
	},
);

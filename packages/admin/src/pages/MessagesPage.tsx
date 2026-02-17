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

import {type LookupMessageResponse, lookupMessage, lookupMessageByAttachment} from '@fluxer/admin/src/api/Messages';
import {Layout} from '@fluxer/admin/src/components/Layout';
import {EmptyState} from '@fluxer/admin/src/components/ui/EmptyState';
import {FormFieldGroup} from '@fluxer/admin/src/components/ui/Form/FormFieldGroup';
import {Input} from '@fluxer/admin/src/components/ui/Input';
import {HStack} from '@fluxer/admin/src/components/ui/Layout/HStack';
import {PageLayout} from '@fluxer/admin/src/components/ui/Layout/PageLayout';
import {VStack} from '@fluxer/admin/src/components/ui/Layout/VStack';
import {Caption, Heading, Text} from '@fluxer/admin/src/components/ui/Typography';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {CSRF_FORM_FIELD} from '@fluxer/constants/src/Cookies';
import type {Flash} from '@fluxer/hono/src/Flash';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {Button} from '@fluxer/ui/src/components/Button';
import {Card} from '@fluxer/ui/src/components/Card';
import {CsrfInput} from '@fluxer/ui/src/components/CsrfInput';
import {formatUserTag} from '@fluxer/ui/src/utils/FormatUser';
import type {FC} from 'hono/jsx';

interface MessagesPageProps {
	config: Config;
	session: Session;
	currentAdmin: UserAdminResponse | undefined;
	flash: Flash | undefined;
	adminAcls: Array<string>;
	lookupResult?: LookupMessageResponse | undefined;
	prefillChannelId?: string | undefined;
	assetVersion: string;
	csrfToken: string;
}

function hasPermission(acls: Array<string>, permission: string): boolean {
	return acls.includes(permission) || acls.includes('*');
}

const MessageList: FC<{config: Config; messages: LookupMessageResponse['messages']; showDelete: boolean}> = ({
	messages,
	showDelete,
}) => {
	return (
		<VStack gap={4}>
			{messages.map((msg) => (
				<Card padding="md" class="bg-neutral-50" data-message-id={msg.id} data-channel-id={msg.channel_id}>
					<HStack gap={4} align="start" justify="between">
						<VStack gap={2} class="min-w-0 flex-1">
							<HStack gap={2} align="center">
								<Text size="sm" weight="medium">
									{formatUserTag(msg.author_username, msg.author_discriminator)}
								</Text>
								<Text size="xs" color="muted">
									({msg.author_id})
								</Text>
								<Text size="xs" color="muted">
									{msg.timestamp}
								</Text>
							</HStack>
							{msg.content && (
								<Text size="sm" class="whitespace-pre-wrap break-words">
									{msg.content}
								</Text>
							)}
							{msg.attachments.length > 0 && (
								<VStack gap={1}>
									{msg.attachments.map((att) => (
										<Text size="xs" color="muted">
											<a href={att.url} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
												{att.filename}
											</a>
										</Text>
									))}
								</VStack>
							)}
						</VStack>
						{showDelete && (
							<Button
								type="button"
								variant="danger"
								size="small"
								class="delete-message-btn"
								data-channel-id={msg.channel_id}
								data-message-id={msg.id}
							>
								Delete
							</Button>
						)}
					</HStack>
					<Caption class="mt-2">
						Channel: {msg.channel_id} | Message: {msg.id}
					</Caption>
				</Card>
			))}
		</VStack>
	);
};

const LookupResult: FC<{config: Config; result: LookupMessageResponse}> = ({config, result}) => {
	return (
		<Card padding="md">
			<Heading level={3} class="mb-4">
				Lookup Result
			</Heading>
			<VStack gap={4} class="border-neutral-200 border-b pb-4">
				<HStack gap={1}>
					<Text size="sm" color="muted">
						Searched for:
					</Text>
					<Text size="sm">{result.message_id}</Text>
				</HStack>
			</VStack>
			{result.messages.length === 0 ? (
				<EmptyState variant="empty">No messages found.</EmptyState>
			) : (
				<MessageList config={config} messages={result.messages} showDelete={true} />
			)}
		</Card>
	);
};

const LookupMessageForm: FC<{config: Config; prefillChannelId: string | undefined; csrfToken: string}> = ({
	config,
	prefillChannelId,
	csrfToken,
}) => {
	return (
		<Card padding="md">
			<Heading level={3} class="mb-4">
				Lookup Message
			</Heading>
			<form method="post" action={`${config.basePath}/messages?action=lookup`}>
				<CsrfInput token={csrfToken} />
				<VStack gap={4}>
					<FormFieldGroup label="Channel ID" htmlFor="lookup-message-channel-id">
						<Input
							id="lookup-message-channel-id"
							type="text"
							name="channel_id"
							placeholder="123456789"
							required
							value={prefillChannelId}
						/>
					</FormFieldGroup>
					<FormFieldGroup label="Message ID" htmlFor="lookup-message-message-id">
						<Input id="lookup-message-message-id" type="text" name="message_id" placeholder="123456789" required />
					</FormFieldGroup>
					<FormFieldGroup label="Context Limit (messages before and after)" htmlFor="lookup-message-context-limit">
						<Input id="lookup-message-context-limit" type="number" name="context_limit" value="50" required />
					</FormFieldGroup>
					<Button type="submit" variant="primary">
						Lookup Message
					</Button>
				</VStack>
			</form>
		</Card>
	);
};

const LookupByAttachmentForm: FC<{config: Config; csrfToken: string}> = ({config, csrfToken}) => {
	return (
		<Card padding="md">
			<Heading level={3} class="mb-4">
				Lookup Message by Attachment
			</Heading>
			<form method="post" action={`${config.basePath}/messages?action=lookup-by-attachment`}>
				<CsrfInput token={csrfToken} />
				<VStack gap={4}>
					<FormFieldGroup label="Channel ID" htmlFor="lookup-by-attachment-channel-id">
						<Input
							id="lookup-by-attachment-channel-id"
							type="text"
							name="channel_id"
							placeholder="123456789"
							required
						/>
					</FormFieldGroup>
					<FormFieldGroup label="Attachment ID" htmlFor="lookup-by-attachment-attachment-id">
						<Input
							id="lookup-by-attachment-attachment-id"
							type="text"
							name="attachment_id"
							placeholder="123456789"
							required
						/>
					</FormFieldGroup>
					<FormFieldGroup label="Filename" htmlFor="lookup-by-attachment-filename">
						<Input id="lookup-by-attachment-filename" type="text" name="filename" placeholder="image.png" required />
					</FormFieldGroup>
					<FormFieldGroup
						label="Context Limit (messages before and after)"
						htmlFor="lookup-by-attachment-context-limit"
					>
						<Input id="lookup-by-attachment-context-limit" type="number" name="context_limit" value="50" required />
					</FormFieldGroup>
					<Button type="submit" variant="primary">
						Lookup by Attachment
					</Button>
				</VStack>
			</form>
		</Card>
	);
};

const DeleteMessageForm: FC<{config: Config; csrfToken: string}> = ({config, csrfToken}) => {
	return (
		<Card padding="md">
			<Heading level={3} class="mb-4">
				Delete Message
			</Heading>
			<form
				method="post"
				action={`${config.basePath}/messages?action=delete`}
				onsubmit="return confirm('Are you sure you want to delete this message?')"
			>
				<CsrfInput token={csrfToken} />
				<VStack gap={4}>
					<FormFieldGroup label="Channel ID" htmlFor="delete-message-channel-id">
						<Input id="delete-message-channel-id" type="text" name="channel_id" placeholder="123456789" required />
					</FormFieldGroup>
					<FormFieldGroup label="Message ID" htmlFor="delete-message-message-id">
						<Input id="delete-message-message-id" type="text" name="message_id" placeholder="123456789" required />
					</FormFieldGroup>
					<FormFieldGroup label="Audit Log Reason (optional)" htmlFor="delete-message-audit-log-reason">
						<Input
							id="delete-message-audit-log-reason"
							type="text"
							name="audit_log_reason"
							placeholder="Reason for deletion"
						/>
					</FormFieldGroup>
					<Button type="submit" variant="danger">
						Delete Message
					</Button>
				</VStack>
			</form>
		</Card>
	);
};

function createDeletionScript(csrfToken: string): string {
	return `
document.addEventListener('click', async function(e) {
	if (!e.target.classList.contains('delete-message-btn')) return;

	const btn = e.target;
	const channelId = btn.dataset.channelId;
	const messageId = btn.dataset.messageId;
	const csrfToken = ${JSON.stringify(csrfToken)};

	if (!confirm('Are you sure you want to delete this message?')) return;

	btn.disabled = true;
	btn.textContent = 'Deleting...';

	try {
		const form = new FormData();
		form.append('channel_id', channelId);
		form.append('message_id', messageId);
		form.append('${CSRF_FORM_FIELD}', csrfToken);

		const response = await fetch(window.location.pathname + '?action=delete', {
			method: 'POST',
			body: form
		});

		const result = await response.json();
		if (result.success) {
			const messageDiv = btn.closest('[data-message-id]');
			if (messageDiv) {
				messageDiv.style.opacity = '0.5';
				messageDiv.style.pointerEvents = 'none';
			}
			btn.textContent = 'Deleted';
		} else {
			btn.textContent = 'Failed';
			btn.disabled = false;
		}
	} catch (err) {
		btn.textContent = 'Error';
		btn.disabled = false;
	}
});
`;
}

export async function MessagesPage({
	config,
	session,
	currentAdmin,
	flash,
	adminAcls,
	lookupResult,
	prefillChannelId,
	assetVersion,
	csrfToken,
}: MessagesPageProps) {
	return (
		<Layout
			csrfToken={csrfToken}
			title="Message Tools"
			activePage="message-tools"
			config={config}
			session={session}
			currentAdmin={currentAdmin}
			flash={flash}
			assetVersion={assetVersion}
			extraScripts={createDeletionScript(csrfToken)}
		>
			<PageLayout maxWidth="7xl">
				<VStack gap={6}>
					<Heading level={1}>Message Tools</Heading>

					{lookupResult && <LookupResult config={config} result={lookupResult} />}

					{hasPermission(adminAcls, 'message:lookup') && (
						<LookupMessageForm config={config} prefillChannelId={prefillChannelId} csrfToken={csrfToken} />
					)}

					{hasPermission(adminAcls, 'message:lookup') && (
						<LookupByAttachmentForm config={config} csrfToken={csrfToken} />
					)}

					{hasPermission(adminAcls, 'message:delete') && <DeleteMessageForm config={config} csrfToken={csrfToken} />}
				</VStack>
			</PageLayout>
		</Layout>
	);
}

export async function handleMessagesGet(
	config: Config,
	session: Session,
	_currentAdmin: UserAdminResponse | undefined,
	_flash: Flash | undefined,
	_adminAcls: Array<string>,
	_assetVersion: string,
	query: Record<string, string>,
): Promise<{lookupResult?: LookupMessageResponse; prefillChannelId: string | undefined}> {
	const channelId = query['channel_id'];
	const messageId = query['message_id'];
	const attachmentId = query['attachment_id'];
	const filename = query['filename'];
	const contextLimit = parseInt(query['context_limit'] || '50', 10) || 50;

	if (channelId && attachmentId && filename) {
		const result = await lookupMessageByAttachment(config, session, channelId, attachmentId, filename, contextLimit);
		if (result.ok) {
			return {lookupResult: result.data, prefillChannelId: channelId};
		}
		return {prefillChannelId: channelId};
	}

	if (channelId && messageId) {
		const result = await lookupMessage(config, session, channelId, messageId, contextLimit);
		if (result.ok) {
			return {lookupResult: result.data, prefillChannelId: channelId};
		}
		return {prefillChannelId: channelId};
	}

	return {prefillChannelId: channelId};
}

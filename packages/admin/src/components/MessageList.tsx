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

import {PaperclipIcon} from '@fluxer/admin/src/components/Icons';
import {CSRF_FORM_FIELD} from '@fluxer/constants/src/Cookies';
import {formatUserTag} from '@fluxer/ui/src/utils/FormatUser';
import type {FC} from 'hono/jsx';

interface Attachment {
	url: string;
	filename: string;
}

export interface Message {
	id: string;
	content: string;
	timestamp: string;
	author_id: string;
	author_username: string;
	author_discriminator: string;
	channel_id: string;
	guild_id?: string | null;
	attachments: Array<Attachment>;
}

interface MessageRowProps {
	basePath: string;
	message: Message;
	includeDeleteButton: boolean;
}

function buildMessageLookupHref(basePath: string, channelId: string, messageId: string): string {
	return `${basePath}/messages?channel_id=${channelId}&message_id=${messageId}&context_limit=50`;
}

const MessageRow: FC<MessageRowProps> = ({basePath, message, includeDeleteButton}) => (
	<div
		class="group flex items-start gap-3 px-4 py-2 transition-colors hover:bg-neutral-50"
		data-message-id={message.id}
	>
		<div class="flex-shrink-0 pt-0.5">
			<a
				href={`${basePath}/users/${message.author_id}`}
				class="cursor-pointer text-neutral-900 text-xs hover:underline"
				title={message.author_id}
			>
				{formatUserTag(message.author_username, message.author_discriminator)}
			</a>
			<div class="text-neutral-500 text-xs">{message.timestamp}</div>
		</div>
		<div class="message-content min-w-0 flex-1">
			<div class="whitespace-pre-wrap break-words text-neutral-900 text-sm">{message.content}</div>
			{message.attachments.length > 0 && (
				<div class="mt-2 space-y-1">
					{message.attachments.map((att) => (
						<div class="flex items-center gap-1 text-xs">
							<PaperclipIcon color="text-neutral-500" />
							<a href={att.url} target="_blank" class="text-blue-600 hover:underline">
								{att.filename}
							</a>
						</div>
					))}
				</div>
			)}
			<div class="mt-1 flex flex-wrap items-center gap-2 text-neutral-400 text-xs">
				<span>ID: {message.id}</span>
				{message.channel_id && (
					<>
						<span>|</span>
						<a
							href={buildMessageLookupHref(basePath, message.channel_id, message.id)}
							class="text-neutral-500 hover:text-neutral-700 hover:underline"
						>
							Channel: {message.channel_id}
						</a>
					</>
				)}
				{message.guild_id && (
					<>
						<span>|</span>
						<a
							href={`${basePath}/guilds/${message.guild_id}`}
							class="text-neutral-500 hover:text-neutral-700 hover:underline"
						>
							Guild: {message.guild_id}
						</a>
					</>
				)}
			</div>
		</div>
		{includeDeleteButton && message.channel_id && (
			<div class="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
				<button
					type="button"
					class="rounded px-2 py-1 text-red-600 text-xs transition-colors hover:bg-red-50 hover:text-red-700"
					title="Delete message"
					onclick={`deleteMessage('${message.channel_id}', '${message.id}', this)`}
				>
					Delete
				</button>
			</div>
		)}
	</div>
);

export function MessageList({
	basePath,
	messages,
	includeDeleteButton,
}: {
	basePath: string;
	messages: Array<Message>;
	includeDeleteButton: boolean;
}) {
	return (
		<div class="space-y-1">
			{messages.map((message) => (
				<MessageRow basePath={basePath} message={message} includeDeleteButton={includeDeleteButton} />
			))}
		</div>
	);
}

export function createMessageDeletionScriptBody(csrfToken: string): string {
	return `
function deleteMessage(channelId, messageId, button) {
  const csrfToken = ${JSON.stringify(csrfToken)};
  if (!confirm('Are you sure you want to delete this message?')) {
    return;
  }

  const formData = new FormData();
  formData.append('channel_id', channelId);
  formData.append('message_id', messageId);
  formData.append('${CSRF_FORM_FIELD}', csrfToken);

  button.disabled = true;
  button.textContent = 'Deleting...';

  const basePath = document.documentElement.dataset.basePath || '';
  fetch(basePath + '/messages?action=delete', {
    method: 'POST',
    body: formData
  })
  .then(async response => {
    if (response.ok) {
      const messageRow = button.closest('[data-message-id]');
      if (messageRow) {
        messageRow.style.opacity = '0.5';
        messageRow.style.pointerEvents = 'none';
        const messageContent = messageRow.querySelector('.message-content');
        if (messageContent) {
          messageContent.style.textDecoration = 'line-through';
        }
      }
      const buttonContainer = button.parentElement;
      const deletedBadge = document.createElement('span');
      deletedBadge.className = 'px-2 py-1 bg-red-100 text-red-800 text-xs rounded opacity-100';
      deletedBadge.textContent = 'DELETED';
      button.replaceWith(deletedBadge);
      if (buttonContainer) {
        buttonContainer.style.opacity = '1';
      }
    } else {
      button.disabled = false;
      button.textContent = 'Delete';
      let errorMessage = 'Failed to delete message';
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {}
      alert(errorMessage);
    }
  })
  .catch(error => {
    console.error('Error:', error);
    button.disabled = false;
    button.textContent = 'Delete';
    alert('Error deleting message: ' + (error.message || 'Unknown error'));
  });
}
`;
}

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

import MediaEngineFacade from '@app/stores/voice/MediaEngineFacade';
import type {ElectronAPI} from '@app/types/ElectronTypes';
import {Buffer} from 'buffer';

type MediaEngineStoreInstance = typeof MediaEngineFacade;
type NodeBufferConstructor = typeof Buffer;

declare global {
	interface FilePickerAcceptType {
		description?: string;
		accept: Record<string, Array<string>>;
	}

	interface SaveFilePickerOptions {
		suggestedName?: string;
		excludeAcceptAllOption?: boolean;
		id?: string;
		types?: Array<FilePickerAcceptType>;
	}

	interface CompressionStream extends TransformStream<Uint8Array, Uint8Array> {}
	declare var CompressionStream: {
		prototype: CompressionStream;
		new (format: 'deflate' | 'gzip'): CompressionStream;
	};

	interface DecompressionStream extends TransformStream<Uint8Array, Uint8Array> {}
	declare var DecompressionStream: {
		prototype: DecompressionStream;
		new (format: 'deflate' | 'gzip'): DecompressionStream;
	};

	interface ImportMetaEnv {
		readonly MODE: 'development' | 'production' | 'test';
		readonly DEV: boolean;
		readonly PROD: boolean;
		readonly PUBLIC_BUILD_NUMBER?: string;
		readonly PUBLIC_BUILD_TIMESTAMP?: string;
		readonly PUBLIC_RELEASE_CHANNEL?: 'stable' | 'canary' | 'nightly';
		readonly PUBLIC_BUILD_SHA?: string;
		readonly PUBLIC_BOOTSTRAP_API_ENDPOINT?: string;
		readonly PUBLIC_BOOTSTRAP_API_PUBLIC_ENDPOINT?: string;
		readonly PUBLIC_RELAY_DIRECTORY_URL?: string;
		readonly PUBLIC_RELAY_MODE_ENABLED?: string;
	}

	interface ImportMetaHot {
		readonly data: Record<string, unknown>;
		accept(deps?: string | ReadonlyArray<string> | (() => void), callback?: () => void): void;
		dispose(callback: (data: Record<string, unknown>) => void): void;
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv;
		readonly hot?: ImportMetaHot;
	}

	interface Navigator {
		userAgentData?: {
			platform?: string;
			mobile?: boolean;
			brands?: Array<{brand: string; version: string}>;
		};
	}

	interface Window {
		__notificationStoreCleanup?: () => void;
		_mediaEngineStore?: MediaEngineStoreInstance;
		electron?: ElectronAPI;
		MSStream?: unknown;
		webkitAudioContext?: typeof AudioContext;
		styleMedia: StyleMedia;
		showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
	}

	interface GlobalThis {
		Buffer?: NodeBufferConstructor;
	}
}

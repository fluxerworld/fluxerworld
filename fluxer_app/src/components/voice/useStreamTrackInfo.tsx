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

import {isTrackReference, type TrackReferenceOrPlaceholder} from '@livekit/components-react';
import {Track} from 'livekit-client';
import {useEffect, useState} from 'react';

const POLL_INTERVAL_MS = 2000;

export interface StreamTrackInfo {
	width: number;
	height: number;
	fps: number;
}

export function useStreamTrackInfo(trackRef: TrackReferenceOrPlaceholder | null): StreamTrackInfo | null {
	const [info, setInfo] = useState<StreamTrackInfo | null>(null);

	useEffect(() => {
		if (!trackRef || !isTrackReference(trackRef)) {
			setInfo(null);
			return;
		}

		if (trackRef.source !== Track.Source.ScreenShare) {
			setInfo(null);
			return;
		}

		function update() {
			if (!trackRef || !isTrackReference(trackRef)) return;

			const dims = trackRef.publication?.dimensions;
			const mediaTrack = trackRef.publication?.track?.mediaStreamTrack;
			const settings = mediaTrack?.getSettings();

			if (dims?.width && dims?.height) {
				setInfo({
					width: dims.width,
					height: dims.height,
					fps: Math.round(settings?.frameRate ?? 0),
				});
			}
		}

		update();
		const interval = setInterval(update, POLL_INTERVAL_MS);
		return () => clearInterval(interval);
	}, [trackRef]);

	return info;
}

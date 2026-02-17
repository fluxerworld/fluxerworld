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

import type {FunctionComponent, SVGProps} from 'react';
import type {Messages} from '@lingui/core';

declare module '*.po' {
	export const messages: Messages;
}

declare module '*.svg' {
	const url: string;
	export default url;
}

declare module '*.svg?react' {
	const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>;
	export default ReactComponent;
}

declare module '*.mp4' {
	const url: string;
	export default url;
}

declare module '*.webm' {
	const url: string;
	export default url;
}

declare module '*.png' {
	const url: string;
	export default url;
}

declare module '*.jpg' {
	const url: string;
	export default url;
}

declare module '*.jpeg' {
	const url: string;
	export default url;
}

declare module '*.gif' {
	const url: string;
	export default url;
}

declare module '*.webp' {
	const url: string;
	export default url;
}

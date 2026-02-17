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

/*
 * Note: The @phosphor-icons/react types are patched via pnpm patch
 * at /patches/@phosphor-icons__react@2.1.10.patch
 *
 * This is needed due to a React 19 + TypeScript 5.9 compatibility issue.
 * The library's IconProps extends ComponentPropsWithoutRef<"svg"> which
 * should include className, but the type inheritance chain is not
 * correctly resolved. The patch explicitly adds commonly used SVG props
 * (className, style, width, height, etc.) to IconProps.
 *
 * TODO: Remove the patch when the library updates for React 19 compatibility.
 */

export {};

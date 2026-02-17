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

import {PageContainer} from '@fluxer/admin/src/components/ui/Layout/PageContainer';
import {PageHeader} from '@fluxer/admin/src/components/ui/Layout/PageHeader';
import type {Child, PropsWithChildren} from 'hono/jsx';

export interface SearchListPageLayoutProps {
	title: string;
	description?: string;
	actions?: Child;
	searchForm: Child;
}

export function SearchListPageLayout({
	title,
	description,
	actions,
	searchForm,
	children,
}: PropsWithChildren<SearchListPageLayoutProps>) {
	return (
		<PageContainer>
			<PageHeader title={title} description={description} actions={actions} />
			{searchForm}
			{children}
		</PageContainer>
	);
}

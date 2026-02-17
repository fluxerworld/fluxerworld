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

import * as QuickSwitcherActionCreators from '@app/actions/QuickSwitcherActionCreators';
import {QuickSwitcherBottomSheet} from '@app/components/bottomsheets/QuickSwitcherBottomSheet';
import {Modals} from '@app/components/modals/Modals';
import {ContextMenu} from '@app/components/uikit/context_menu/ContextMenu';
import {Popouts} from '@app/components/uikit/popout/Popouts';
import {Toasts} from '@app/components/uikit/toast/Toasts';
import {PiPOverlay} from '@app/components/voice/PiPOverlay';
import LayerManager from '@app/stores/LayerManager';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import {handleContextMenu} from '@app/utils/ContextMenuUtils';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';

const GlobalOverlays: React.FC = observer(() => {
	const isMobile = MobileLayoutStore.isMobileLayout();
	const quickSwitcherOpen = QuickSwitcherStore.isOpen;

	useEffect(() => {
		LayerManager.init();

		document.addEventListener('contextmenu', handleContextMenu, false);
		return () => {
			document.removeEventListener('contextmenu', handleContextMenu, false);
		};
	}, []);

	return (
		<>
			<Modals />
			<Popouts />
			<ContextMenu />
			<Toasts />
			<PiPOverlay />
			{isMobile && <QuickSwitcherBottomSheet isOpen={quickSwitcherOpen} onClose={QuickSwitcherActionCreators.hide} />}
		</>
	);
});

export default GlobalOverlays;

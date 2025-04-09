import { Container, Element, Label } from 'pcui';

import { Events } from '../events';
import { localize } from './localization';
import { MenuPanel } from './menu-panel';
import { initializeFirebaseStorage } from '../firebase/storage';
import arrowSvg from './svg/arrow.svg';
import collapseSvg from './svg/collapse.svg';
import selectDelete from './svg/delete.svg';
import sceneExport from './svg/export.svg';
import sceneImport from './svg/import.svg';
import sceneNew from './svg/new.svg';
import sceneOpen from './svg/open.svg';
import scenePublish from './svg/publish.svg';
import sceneSave from './svg/save.svg';
import selectAll from './svg/select-all.svg';
import selectDuplicate from './svg/select-duplicate.svg';
import selectInverse from './svg/select-inverse.svg';
import selectLock from './svg/select-lock.svg';
import selectNone from './svg/select-none.svg';
import selectSeparate from './svg/select-separate.svg';
import selectUnlock from './svg/select-unlock.svg';

const createSvg = (svgString: string) => {
    const decodedStr = decodeURIComponent(svgString.substring('data:image/svg+xml,'.length));
    return new Element({
        dom: new DOMParser().parseFromString(decodedStr, 'image/svg+xml').documentElement
    });
};

class Menu extends Container {
    constructor(events: Events, args = {}) {
        args = {
            ...args,
            id: 'menu'
        };

        super(args);

        const menubar = new Container({
            id: 'menu-bar'
        });

        menubar.dom.addEventListener('pointerdown', (event: any) => {
            event.stopPropagation();
        });

        const scene = new Label({
            text: localize('file'),
            class: 'menu-option'
        });

        const selection = new Label({
            text: localize('select'),
            class: 'menu-option'
        });

        const help = new Label({
            text: localize('help'),
            class: 'menu-option'
        });

        const returnToStorySplat = new Label({
            text: 'Save & Return to StorySplat',
            class: 'menu-option-storysplat'
        });

        const returnWithoutSaving = new Label({
            text: 'Exit',
            class: 'menu-option-danger' // Assign primary class here
        });
        // Add the danger class separately
        returnWithoutSaving.dom.classList.add('menu-option-danger');
        // Remove direct color style, rely on CSS class

        const toggleCollapsed = () => {
            document.body.classList.toggle('collapsed');
        };

        // collapse menu on mobile
        if (document.body.clientWidth < 600) {
            toggleCollapsed();
        }

        const collapse = createSvg(collapseSvg);
        collapse.dom.classList.add('menu-icon');
        collapse.dom.setAttribute('id', 'menu-collapse');
        collapse.dom.addEventListener('click', toggleCollapsed);

        const arrow = createSvg(arrowSvg);
        arrow.dom.classList.add('menu-icon');
        arrow.dom.setAttribute('id', 'menu-arrow');
        arrow.dom.addEventListener('click', toggleCollapsed);

        const buttonsContainer = new Container({
            id: 'menu-options-container'
        });

        returnToStorySplat.dom.addEventListener('pointerdown', async (event: PointerEvent) => {
            event.stopPropagation();
            try {
                const filename = events.invoke('doc.name');
                if (!filename) {
                    throw new Error('No filename available');
                }

                // Use the saveAndReturn export type which will handle the upload and return
                await events.invoke('scene.export', 'splat', filename, 'saveAndReturn', true);
            } catch (error) {
                console.error('Error saving and returning to StorySplat:', error);
                events.invoke('showPopup', {
                    type: 'error',
                    header: 'Error',
                    message: 'Failed to save and upload the file. Please try again.'
                });
            }
        });

        returnWithoutSaving.dom.addEventListener('pointerdown', (event: PointerEvent) => {
            event.stopPropagation();
            // Send a message to the parent window (StorySplat) to close the editor
            window.parent.postMessage({ type: 'closeEditor' }, window.location.origin);
        });

        buttonsContainer.append(scene);
        buttonsContainer.append(selection);
        buttonsContainer.append(help);
        buttonsContainer.append(collapse);
        buttonsContainer.append(arrow);

        const topContainer = new Container({
            id: 'menu-top-container'
        });
        
        // Add a placeholder element to maintain layout
        const placeholderIcon = new Element({
            dom: document.createElement('div')
        });
        placeholderIcon.dom.setAttribute('id', 'app-icon');
        placeholderIcon.dom.style.width = '54px';
        placeholderIcon.dom.style.height = '50px';
        
        topContainer.append(placeholderIcon);
        topContainer.append(buttonsContainer);

        // Create a container for the return buttons
        const returnButtonsContainer = new Container({
            id: 'menu-return-buttons-container'
        });
        returnButtonsContainer.dom.style.display = 'flex'; // Arrange buttons inline
        returnButtonsContainer.dom.style.alignItems = 'center'; // Vertically align items

        // Add buttons to the inline container
        returnButtonsContainer.append(returnToStorySplat); // Save & Return on the left
        returnButtonsContainer.append(returnWithoutSaving); // Return w/o Saving on the right

        menubar.append(topContainer);
        menubar.append(returnButtonsContainer); // Add the container with both buttons


        const exportMenuPanel = new MenuPanel([{
            text: localize('file.export.ply'),
            icon: createSvg(sceneExport),
            isEnabled: () => !events.invoke('scene.empty'),
            onSelect: () => events.invoke('scene.export', 'ply')
        }, {
            text: localize('file.export.compressed-ply'),
            icon: createSvg(sceneExport),
            isEnabled: () => !events.invoke('scene.empty'),
            onSelect: () => events.invoke('scene.export', 'compressed-ply')
        }, {
            text: localize('file.export.splat'),
            icon: createSvg(sceneExport),
            isEnabled: () => !events.invoke('scene.empty'),
            onSelect: () => events.invoke('scene.export', 'splat')
        }, {
            // separator
        }, {
            text: localize('file.export.viewer'),
            icon: createSvg(sceneExport),
            isEnabled: () => !events.invoke('scene.empty'),
            onSelect: () => events.invoke('scene.export', 'viewer')
        }]);

        const sceneMenuPanel = new MenuPanel([{
            text: localize('file.new'),
            icon: createSvg(sceneNew),
            isEnabled: () => !events.invoke('scene.empty'),
            onSelect: () => events.invoke('doc.new')
        }, {
            text: localize('file.open'),
            icon: createSvg(sceneOpen),
            onSelect: async () => {
                await events.invoke('doc.open');
            }
        }, {
            // separator
        }, {
            text: localize('file.save'),
            icon: createSvg(sceneSave),
            isEnabled: () => events.invoke('doc.name'),
            onSelect: async () => await events.invoke('doc.save')
        }, {
            text: localize('file.save-as'),
            icon: createSvg(sceneSave),
            isEnabled: () => !events.invoke('scene.empty'),
            onSelect: async () => await events.invoke('doc.saveAs')
        }, {
            text: localize('file.save-screenshot'),
            icon: createSvg(sceneExport),
            isEnabled: () => true,
            onSelect: () => events.invoke('scene.saveScreenshot')
        }, {
            // separator
        }, {
            text: localize('file.import'),
            icon: createSvg(sceneImport),
            onSelect: async () => {
                await events.invoke('scene.import');
            }
        }, {
            text: localize('file.export'),
            icon: createSvg(sceneExport),
            subMenu: exportMenuPanel
        }, {
            text: localize('file.publish'),
            icon: createSvg(scenePublish),
            isEnabled: () => !events.invoke('scene.empty'),
            isVisible: () => events.invoke('app.publish'),
            onSelect: () => events.invoke('scene.publish')
        }]);

        const selectionMenuPanel = new MenuPanel([{
            text: localize('select.all'),
            icon: createSvg(selectAll),
            extra: 'Ctrl + A',
            onSelect: () => events.fire('select.all')
        }, {
            text: localize('select.none'),
            icon: createSvg(selectNone),
            extra: 'Shift + A',
            onSelect: () => events.fire('select.none')
        }, {
            text: localize('select.invert'),
            icon: createSvg(selectInverse),
            extra: 'Ctrl + I',
            onSelect: () => events.fire('select.invert')
        }, {
            // separator
        }, {
            text: localize('select.lock'),
            icon: createSvg(selectLock),
            extra: 'H',
            isEnabled: () => events.invoke('selection.splats'),
            onSelect: () => events.fire('select.hide')
        }, {
            text: localize('select.unlock'),
            icon: createSvg(selectUnlock),
            extra: 'U',
            onSelect: () => events.fire('select.unhide')
        }, {
            text: localize('select.delete'),
            icon: createSvg(selectDelete),
            extra: 'Delete',
            isEnabled: () => events.invoke('selection.splats'),
            onSelect: () => events.fire('select.delete')
        }, {
            text: localize('select.reset'),
            onSelect: () => events.fire('scene.reset')
        }, {
            // separator
        }, {
            text: localize('select.duplicate'),
            icon: createSvg(selectDuplicate),
            isEnabled: () => events.invoke('selection.splats'),
            onSelect: () => events.fire('select.duplicate')
        }, {
            text: localize('select.separate'),
            icon: createSvg(selectSeparate),
            isEnabled: () => events.invoke('selection.splats'),
            onSelect: () => events.fire('select.separate')
        }]);

        const helpMenuPanel = new MenuPanel([{
            text: localize('help.shortcuts'),
            icon: 'E136',
            onSelect: () => events.fire('show.shortcuts')
        }, {
            text: localize('help.user-guide'),
            icon: 'E232',
            onSelect: () => window.open('https://github.com/playcanvas/supersplat/wiki', '_blank').focus()
        }, {
            text: localize('help.log-issue'),
            icon: 'E336',
            onSelect: () => window.open('https://github.com/playcanvas/supersplat/issues', '_blank').focus()
        }, {
            text: localize('help.github-repo'),
            icon: 'E259',
            onSelect: () => window.open('https://github.com/playcanvas/supersplat', '_blank').focus()
        }, {
            // separator
        }, {
            text: localize('help.basics-video'),
            icon: 'E261',
            onSelect: () => window.open('https://youtu.be/MwzaEM2I55I', '_blank').focus()
        }, {
            // separator
        }, {
            text: localize('help.discord'),
            icon: 'E233',
            onSelect: () => window.open('https://discord.gg/T3pnhRTTAY', '_blank').focus()
        }, {
            text: localize('help.forum'),
            icon: 'E432',
            onSelect: () => window.open('https://forum.playcanvas.com', '_blank').focus()
        }, {
            // separator
        }, {
            text: localize('help.about'),
            icon: 'E138',
            onSelect: () => events.invoke('show.about')
        }]);

        this.append(menubar);
        this.append(sceneMenuPanel);
        this.append(exportMenuPanel);
        this.append(selectionMenuPanel);
        this.append(helpMenuPanel);

        const options: { dom: HTMLElement, menuPanel: MenuPanel }[] = [{
            dom: scene.dom,
            menuPanel: sceneMenuPanel
        }, {
            dom: selection.dom,
            menuPanel: selectionMenuPanel
        }, {
            dom: help.dom,
            menuPanel: helpMenuPanel
        }];

        options.forEach((option) => {
            const activate = () => {
                option.menuPanel.position(option.dom, 'bottom', 2);
                options.forEach((opt) => {
                    opt.menuPanel.hidden = opt !== option;
                });
            };

            option.dom.addEventListener('pointerdown', (event: PointerEvent) => {
                if (!option.menuPanel.hidden) {
                    option.menuPanel.hidden = true;
                } else {
                    activate();
                }
            });

            option.dom.addEventListener('pointerenter', (event: PointerEvent) => {
                if (!options.every(opt => opt.menuPanel.hidden)) {
                    activate();
                }
            });
        });

        const checkEvent = (event: PointerEvent) => {
            if (!this.dom.contains(event.target as Node)) {
                options.forEach((opt) => {
                    opt.menuPanel.hidden = true;
                });
            }
        };

        window.addEventListener('pointerdown', checkEvent, true);
        window.addEventListener('pointerup', checkEvent, true);
    }
}

export { Menu };

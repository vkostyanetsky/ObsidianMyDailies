import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";

import type ToolboxPlugin from "../main";
import { FolderSuggest } from "./folder-suggest";

/** The settings of the plugin, as they are shown in the Obsidian preferences. */
export class ToolboxSettingTab extends PluginSettingTab {
	private readonly plugin: ToolboxPlugin;

	constructor(app: App, plugin: ToolboxPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName("Image folders")
			.setDesc(
				"Folders whose notes the renaming applies to, subfolders included. " +
					"Blank rows are ignored.",
			)
			.setHeading();

		this.displayFolders();

		new Setting(this.containerEl)
			.setName("Rename images when the vault is opened")
			.setDesc(
				"Go through the notes of these folders once, right after the vault has been " +
					"read in, and rename the images that are out of place. Notes are never " +
					"touched while they are being written; to go through the folders at any " +
					"other moment, run the command.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoRenameImages).onChange(async (value) => {
					this.plugin.settings.autoRenameImages = value;

					// Switching this on never starts a run of its own: notes are
					// picked up as they are written from here on, and the folders
					// are gone through when the vault is opened the next time.
					await this.plugin.saveSettings();
				}),
			);
	}

	/** One row per folder, plus the button that adds another one. */
	private displayFolders(): void {
		this.plugin.settings.imageFolders.forEach((folder, index) => {
			new Setting(this.containerEl)
				.setClass("toolbox-folder-row")
				.addSearch((search) => {
					const save = async (value: string): Promise<void> => {
						this.plugin.settings.imageFolders[index] = value;
						await this.plugin.saveSettings();
					};

					search.inputEl.setAttribute("aria-label", "Image folder");
					search
						.setPlaceholder("Folder in the vault")
						.setValue(folder)
						.onChange((value) => {
							void save(value);
						});

					new FolderSuggest(this.app, search.inputEl, (path) => {
						void save(path);
					});
				})
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Remove folder")
						.onClick(async () => {
							this.plugin.settings.imageFolders.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						}),
				);
		});

		new Setting(this.containerEl).setClass("toolbox-folder-add").addButton((button) =>
			button
				.setButtonText("Add folder")
				.setTooltip("Add a folder to the list")
				.onClick(async () => {
					this.plugin.settings.imageFolders.push("");
					await this.plugin.saveSettings();
					this.display();
				}),
		);
	}
}

import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";

import type ToolboxPlugin from "../main";
import { NUTRIENTS } from "../nutrition/totals";
import type { Nutrient } from "../nutrition/totals";
import { DEFAULT_NUTRITION_PROPERTIES, normalizeProperty } from "./settings";
import { FolderSuggest } from "./folder-suggest";

/** How each nutrient is named in the settings. */
const NUTRIENT_NAMES: Record<Nutrient, string> = {
	calories: "Calories",
	protein: "Protein",
	fat: "Fat",
	carbs: "Carbohydrates",
	water: "Water",
};

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

		this.displayNutrition();
	}

	/** The folders, the properties and the run of the nutrition sums. */
	private displayNutrition(): void {
		new Setting(this.containerEl)
			.setName("Nutrition")
			.setDesc(
				"Adds up what the eating records of a day state and writes the totals into " +
					"the daily note of that day. Without a records folder nothing is summed up.",
			)
			.setHeading();

		this.displayFolder(
			"Nutrition records folder",
			"Folder the eating records are kept in, subfolders included. Every note in it " +
				"that carries a day, a product link and an amount is counted.",
			() => this.plugin.settings.nutritionRecordsFolder,
			(value) => {
				this.plugin.settings.nutritionRecordsFolder = value;
			},
		);

		this.displayFolder(
			"Daily notes folder",
			"Folder the daily notes are kept in. Left empty, the folder of the core Daily " +
				"notes plugin is used. Only the notes named after a day, such as 2026-08-28, " +
				"are ever written to.",
			() => this.plugin.settings.dailyNotesFolder,
			(value) => {
				this.plugin.settings.dailyNotesFolder = value;
			},
		);

		new Setting(this.containerEl)
			.setName("Properties of the daily note")
			.setDesc("The properties the totals of a day are written to. A blank one is reset.")
			.setHeading();

		for (const nutrient of NUTRIENTS) {
			this.displayProperty(nutrient);
		}

		new Setting(this.containerEl)
			.setName("Recalculate nutrition when the vault is opened")
			.setDesc(
				"Go through every daily note once, right after the vault has been read in, " +
					"and write the totals of the days that came out different. Nothing is " +
					"watched afterwards; to work the totals out at any other moment, run one " +
					"of the two commands.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoUpdateNutrition).onChange(async (value) => {
					this.plugin.settings.autoUpdateNutrition = value;

					// Switching this on never starts a run of its own either.
					await this.plugin.saveSettings();
				}),
			);
	}

	/** One folder of the vault, picked by hand or from the suggestions. */
	private displayFolder(
		name: string,
		description: string,
		read: () => string,
		write: (value: string) => void,
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addSearch((search) => {
				const save = async (value: string): Promise<void> => {
					write(value);
					await this.plugin.saveSettings();
				};

				search.inputEl.setAttribute("aria-label", name);
				search
					.setPlaceholder("Folder in the vault")
					.setValue(read())
					.onChange((value) => {
						void save(value);
					});

				new FolderSuggest(this.app, search.inputEl, (path) => {
					void save(path);
				});
			});
	}

	/** The property one nutrient ends up in. */
	private displayProperty(nutrient: Nutrient): void {
		const fallback = DEFAULT_NUTRITION_PROPERTIES[nutrient];

		new Setting(this.containerEl).setName(NUTRIENT_NAMES[nutrient]).addText((text) =>
			text
				.setPlaceholder(fallback)
				.setValue(this.plugin.settings.nutritionProperties[nutrient])
				.onChange(async (value) => {
					// A property that names nothing would have no line to write to,
					// so the default steps in until something is typed again.
					this.plugin.settings.nutritionProperties[nutrient] = normalizeProperty(
						value,
						fallback,
					);
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

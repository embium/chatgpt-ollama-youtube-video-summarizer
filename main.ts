import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { YoutubeVideoSummaryModal } from "src/Modals/YoutubeVideoSummaryModal";
import {
	PluginSettings,
	DEFAULT_SETTINGS,
	DEFAULT_TEMPLATE,
	DEFAULT_SUMMARY_SIZE,
	MAX_SUMMARY_SIZE,
	PROVIDER_CHOICES,
	OPEN_AI_MODEL_CHOICES,
	DEFAULT_OPEN_AI_MODEL,
	OPEN_AI_MODELS_MAX_TOKEN_SIZES,
	DEFAULT_OLLAMA_MAX_TOKEN_SIZE,
	DEFAULT_DATE_FORMAT,
} from "settings";
import { OllamaClient } from "src/Ollama/OllamaClient";

export default class MyPlugin extends Plugin {
	public settings: PluginSettings;

	async onload() {
		await this.loadSettings();
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: "generate-video-summary",
			name: "Generate video summary",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const openAiApiKey = this.settings.openAIApiKey;

				if (
					this.settings.provider == "OpenAI" &&
					(openAiApiKey == undefined || openAiApiKey == "")
				) {
					new Notice(
						"OpenAI Api key is not added. Please, go to the settings and add it."
					);
				} else if (
					this.settings.provider == "Ollama" &&
					this.settings.ollamaModel == ""
				) {
					new Notice(
						"Ollama model is not selected. Please, go to the settings."
					);
				} else {
					new YoutubeVideoSummaryModal(
						this.app,
						editor,
						this.settings
					).open();
				}
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			Object.assign(DEFAULT_SETTINGS, (await this.loadData()) ?? {})
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Update plugin settings. */
	async updateSettings(settings: Partial<PluginSettings>) {
		Object.assign(this.settings, settings);
		await this.saveData(this.settings);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Provider")
			.setDesc("Choose the provider to use (OpenAI, Ollama)")
			.addDropdown((dropdown) => {
				// Explicitly define the accumulator type in the reduce function
				const options = PROVIDER_CHOICES.reduce<Record<string, string>>(
					(acc, model) => {
						acc[model] = model; // Set both key and value to the model string
						return acc;
					},
					{}
				);

				const provider = this.plugin.settings.provider;
				dropdown
					.addOptions(options)
					.setValue(provider)
					.onChange(async (value) => {
						await this.plugin.updateSettings({
							provider: value,
						});
						if (provider == "OpenAI") {
							await this.plugin.updateSettings({
								maxTokenSize:
									OPEN_AI_MODELS_MAX_TOKEN_SIZES[
										value as keyof typeof OPEN_AI_MODELS_MAX_TOKEN_SIZES
									],
							});
						} else {
							await this.plugin.updateSettings({
								maxTokenSize:
									this.plugin.settings.maxTokenSize ??
									DEFAULT_OLLAMA_MAX_TOKEN_SIZE,
							});
						}
					});
			});

		new Setting(containerEl)
			.setName("OpenAI key")
			.setDesc(
				"Enter your OpenAI API Key to be able to generate summaries from transcripts."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.openAIApiKey)
					.onChange(async (value) => {
						await this.plugin.updateSettings({
							openAIApiKey: value,
						});
					})
			);

		new Setting(containerEl)
			.setName("OpenAI Model")
			.setDesc("Choose the OpenAI model to use.")
			.addDropdown((dropdown) => {
				// Explicitly define the accumulator type in the reduce function
				const options = OPEN_AI_MODEL_CHOICES.reduce<
					Record<string, string>
				>((acc, model) => {
					acc[model] = model; // Set both key and value to the model string
					return acc;
				}, {});

				dropdown
					.addOptions(options)
					.setValue(this.plugin.settings.openAIModel)
					.onChange(async (value) => {
						await this.plugin.updateSettings({
							openAIModel: value,
						});
						await this.plugin.updateSettings({
							maxTokenSize:
								OPEN_AI_MODELS_MAX_TOKEN_SIZES[
									value as keyof typeof OPEN_AI_MODELS_MAX_TOKEN_SIZES
								],
						});
					});
			});

		new Setting(containerEl)
			.setName("Ollama URL")
			.setDesc("Default is http://localhost:11434")
			.addText((text) =>
				text
					.setPlaceholder("3")
					.setValue("" + this.plugin.settings.ollamaUrl)
					.onChange(async (value) => {
						const parsed = value.trim();
						await this.plugin.updateSettings({
							ollamaUrl: parsed,
						});
					})
			);

		const ollamaDefaultModel = new Setting(containerEl)
			.setName("Default Ollama model")
			.setDesc("Name of the default Ollama model to use in prompts");
		if (this.plugin.settings.ollamaUrl) {
			OllamaClient.getModels(this.plugin.settings.ollamaUrl)
				.then((models) => {
					ollamaDefaultModel
						.addDropdown((dropdown) =>
							dropdown
								.addOptions(models)
								.setValue(
									String(this.plugin.settings.ollamaModel)
								)
								.onChange(async (value) => {
									this.plugin.settings.ollamaModel = value;
									await this.plugin.updateSettings({
										ollamaModel: value,
									});
								})
						)
						.addButton((button) =>
							button.setIcon("refresh-cw").onClick(async () => {
								this.display();
							})
						);
				})
				.catch(() => {
					ollamaDefaultModel.descEl.innerHTML = `Get the models from <a href="https://ollama.ai/library">Ollama library</a> or check that Ollama URL is correct.`;
					ollamaDefaultModel.addButton((button) =>
						button.setIcon("refresh-cw").onClick(async () => {
							this.display();
						})
					);
				});
		}

		new Setting(containerEl)
			.setName("Ollama Default Max Token Size")
			.setDesc(
				"Maximum number of tokens for Ollama. The default value is 4098."
			)
			.addText((text) =>
				text
					.setPlaceholder("3")
					.setValue("" + this.plugin.settings.maxTokenSize)
					.onChange(async (value) => {
						const parsed = parseInt(value);
						if (isNaN(parsed)) return;
						await this.plugin.updateSettings({
							maxTokenSize: parsed,
						});
					})
			);
		new Setting(containerEl)
			.setName("Minimum Summary Size")
			.setDesc(
				"Minimum number of key points per video chunk to include in the generated summary. Note: The plugin divides long videos into chunks, extracts key points from each, and then combines them for the final summary."
			)
			.addText((text) =>
				text
					.setPlaceholder("3")
					.setValue("" + this.plugin.settings.summarySize)
					.onChange(async (value) => {
						let parsed = parseInt(value);
						if (isNaN(parsed)) return;
						parsed =
							parsed > MAX_SUMMARY_SIZE
								? MAX_SUMMARY_SIZE
								: parsed < DEFAULT_SUMMARY_SIZE
								? DEFAULT_SUMMARY_SIZE
								: parsed;
						await this.plugin.updateSettings({
							summarySize: parsed,
						});
					})
			);
		new Setting(containerEl)
			.setName("Template format")
			.setDesc(
				"Enter format of template to be used when inserting summary.  Supported fields are {{Date}}, {{Title}}, {{ImageURL}}, {{Description}}, and {{VideoUrl}}."
			)
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_TEMPLATE)
					.setValue(this.plugin.settings.templateFormat)
					.onChange(async (value) => {
						await this.plugin.updateSettings({
							templateFormat: value,
						});
					})
			);
		new Setting(containerEl)
			.setName("Date format")
			.setDesc("The default date format.")
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_DATE_FORMAT)
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						await this.plugin.updateSettings({ dateFormat: value });
					})
			);
		new Setting(containerEl)
			.setName("Reset defaults")
			.setDesc(
				`This will reset to the default settings (without removing your API key).
				The settings panel will be closed after pressing.
				`
			)
			.addButton((cb) => {
				cb.setWarning()
					.setButtonText("Reset defaults")
					.onClick(() => {
						this.plugin.settings.summarySize = DEFAULT_SUMMARY_SIZE;
						this.plugin.settings.templateFormat = DEFAULT_TEMPLATE;
						this.plugin.settings.dateFormat = DEFAULT_DATE_FORMAT;
						this.plugin.settings.openAIModel =
							OPEN_AI_MODEL_CHOICES[0];
						this.plugin.settings.maxTokenSize =
							OPEN_AI_MODELS_MAX_TOKEN_SIZES[
								DEFAULT_OPEN_AI_MODEL as keyof typeof OPEN_AI_MODELS_MAX_TOKEN_SIZES
							];
						this.plugin.saveSettings();
						this.plugin.unload();
						this.plugin.load();
					});
			});
	}
}

import { requestUrl } from "obsidian";
import { PluginSettings } from "settings";

export class OllamaClient {
	settings: PluginSettings;
	baseUrl: string;
	model: string;
	tokenSize: number;

	constructor(settings: PluginSettings) {
		this.settings = settings;
		this.model = this.settings.ollamaModel;
		this.baseUrl = this.settings.ollamaUrl;
		this.tokenSize = this.settings.maxTokenSize;
	}

	async process(prompt: string): Promise<string> {
		const requestBody = {
			prompt: prompt,
			model: this.model,
			options: {
				num_ctx: this.tokenSize,
			},
			stream: false,
		};

		const url = `${this.baseUrl}/api/generate`;

		return requestUrl({
			url,
			method: "POST",
			body: JSON.stringify(requestBody),
		}).then(({ json }) => {
			return json.response;
		});
	}

	static async getModels(baseUrl: string) {
		const { json } = await requestUrl({
			url: `${baseUrl}/api/tags`,
		});

		if (!json.models || json.models.length === 0) {
			return Promise.reject();
		}
		return json.models.reduce((acc: any, el: any) => {
			const name = el.name.replace(":latest", "");
			acc[name] = name;
			return acc;
		}, {});
	}
}

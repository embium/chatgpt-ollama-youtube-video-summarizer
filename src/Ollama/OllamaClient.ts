import { requestUrl } from "obsidian";

export class OllamaClient {
	static async process(
		text: string,
		baseUrl: string,
		model: string
	): Promise<string> {
		const requestBody = {
			prompt: text,
			model: model,
			stream: false,
		};

		const url = `${baseUrl}/api/generate`;

		return requestUrl({
			url,
			method: "POST",
			body: JSON.stringify(requestBody),
		}).then(({ json }) => {
			return json.response;
		});
	}

	static async getModels(ollamaUrl: string) {
		const { json } = await requestUrl({
			url: `${ollamaUrl}/api/tags`,
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

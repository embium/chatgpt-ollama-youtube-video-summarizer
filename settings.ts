/** Constants */
export const YOUTUBE_BASE_URL = "youtube.com";
export const DEFAULT_TEMPLATE =
	"---\ndate: {{Date}}\n---\n# {{Title}}\n![]({{ImageURL}})\n## Description:\n{{Description}}\n-> [Youtube video Link]({{VideoUrl}})\n\n## Summary:\n";
export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
export const DEFAULT_SUMMARY_SIZE = 3;
export const MAX_SUMMARY_SIZE = 20;
export const PROVIDER_CHOICES = ["OpenAI", "Ollama"];
export const OPEN_AI_MODEL_CHOICES = [
	"gpt-3.5-turbo",
	"gpt-4",
	"gpt-4-0125-preview",
	"gpt-4-turbo-preview",
	"gpt-4-1106-preview",
	"gpt-4-vision-preview",
	"gpt-4-0613",
	"gpt-4-32k",
	"gpt-4-32k-0613",
	"gpt-3.5-turbo-1106",
	"gpt-3.5-turbo-16k",
	"gpt-3.5-turbo-instruct",
	"gpt-3.5-turbo-0613",
	"gpt-3.5-turbo-16k-0613",
	"gpt-3.5-turbo-0301",
];
export const OPEN_AI_MODELS_MAX_TOKEN_SIZES = {
	"gpt-3.5-turbo": 4096,
	"gpt-4": 8192,
	"gpt-4-0125-preview": 128000,
	"gpt-4-turbo-preview": 128000,
	"gpt-4-1106-preview": 128000,
	"gpt-4-vision-preview": 128000,
	"gpt-4-0613": 8192,
	"gpt-4-32k": 32768,
	"gpt-4-32k-0613": 32768,
	"gpt-3.5-turbo-1106": 16385,
	"gpt-3.5-turbo-16k": 16384,
	"gpt-3.5-turbo-instruct": 4096,
	"gpt-3.5-turbo-0613": 4096,
	"gpt-3.5-turbo-16k-0613": 16384,
	"gpt-3.5-turbo-0301": 4096,
};
export const DEFAULT_PROVIDER = PROVIDER_CHOICES[0];
export const DEFAULT_OLLAMA_MAX_TOKEN_SIZE = 4098;
export const DEFAULT_TEMPERATURE = 0.8;
export const DEFAULT_OPEN_AI_MODEL = OPEN_AI_MODEL_CHOICES[0];
export const DEFAULT_OPEN_AI_TOKEN_SIZE =
	OPEN_AI_MODELS_MAX_TOKEN_SIZES[
		DEFAULT_OPEN_AI_MODEL as keyof typeof OPEN_AI_MODELS_MAX_TOKEN_SIZES
	];

export interface PluginSettings {
	/** Provider */
	provider: string;

	/** Open AI Key */
	openAIApiKey: string;

	/** Open AI Model */
	openAIModel: string;

	/** Ollama Url */
	ollamaUrl: string;

	/** Ollama Models */
	ollamaModels: Record<string, string>;

	/** Ollama Model */
	ollamaModel: string;

	/** Max Token Size in a Request */
	maxTokenSize: number;

	/** Temprature */
	temperature: number;

	/** Minimum Summary Lines */
	summarySize: number;

	/** Template Format */
	templateFormat: string;

	/** Date Format */
	dateFormat: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	provider: DEFAULT_PROVIDER,
	openAIApiKey: "",
	openAIModel: DEFAULT_OPEN_AI_MODEL,
	ollamaUrl: "http://localhost:11434",
	ollamaModels: {},
	ollamaModel: "No Model",
	maxTokenSize: DEFAULT_OLLAMA_MAX_TOKEN_SIZE,
	temperature: DEFAULT_TEMPERATURE,
	summarySize: DEFAULT_SUMMARY_SIZE,
	templateFormat: DEFAULT_TEMPLATE,
	dateFormat: DEFAULT_DATE_FORMAT,
};

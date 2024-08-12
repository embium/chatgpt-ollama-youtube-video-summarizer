import { PluginSettings } from "settings";
import { OllamaClient } from "./Ollama/OllamaClient";
import { OpenAIClient } from "./OpenAi/OpenAiClient";
import { YoutubeMetadataParser } from "./YoutubeMetadataParser/YoutubeVideoMetadataParser";
import { YoutubeTranscript } from "./YoutubeTranscript";

export class TranscriptSummarizer {
	constructor(
		private openAiClient: OpenAIClient,
		private ollamaClient: OllamaClient,
		private settings: PluginSettings
	) {}

	async getSummaryFromUrl(url: string): Promise<string> {
		const youtubeMetadata = await new YoutubeMetadataParser(
			this.settings
		).getVideoNote(url);

		const transcriptList = await YoutubeTranscript.fetchTranscript(url);
		const transcript = transcriptList
			.map((transcript) => transcript.text)
			.join(" ");
		const words = transcript.split(" ");

		const keyPointPromises = [];
		const maxTokenSize = this.settings.maxTokenSize ?? 4096;

		for (let i = 0; i < words.length; i += maxTokenSize) {
			const transcriptChunk = words.slice(i, i + maxTokenSize).join(" ");
			keyPointPromises.push(this.rewriteTranscript(transcriptChunk));
		}

		const keyPoints = await Promise.all(keyPointPromises);
		const response = await this.summarize(keyPoints.join("\n\n"));
		return youtubeMetadata.content + "\n" + response;
	}

	async rewriteTranscript(transcript: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(
				this.constructRewritePrompt() + transcript
			);
		} else {
			return this.ollamaClient.process(
				this.constructRewritePrompt() + transcript
			);
		}
	}

	async summarize(transcript: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(
				this.constructSummarizePrompt() + transcript
			);
		} else {
			return this.ollamaClient.process(
				this.constructSummarizePrompt() + transcript
			);
		}
	}

	constructRewritePrompt() {
		const prompt = `You will be given a portion of a YouTube transcript. Your task is to rewrite it for clarity and conciseness while preserving the original meaning. Ensure that the language is smooth and natural, and maintain the speaker's intended message. A chunk of the transcipt begins now:\n`;
		return prompt;
	}

	constructSummarizePrompt() {
		const prompt = `As an expert in this transcript's subject matter, provide:

### Summary

- Based on the combined transcript, write a concise summary that captures the main points and purpose of the video. Keep it under 150 words.

### Transcript

- Maintain an objective tone and refer to the speaker as "the speaker" throughout your response.
- Enhance the combined transcript by adding clarifications, examples, or additional explanations where necessary.
- Ensure the enhancements add value and make the content more accessible to the audience.
- Begin each section directly with the content. Do not include any introductory phrases such as "Here's a rewritten transcript..." or "In this section...". Start immediately with the relevant information.
- Identify any math expressions, formulas and equations with $ or $$. Be consistent and err on the side of formatting potential math.

### Key Concepts

- Extract the key points from the following transcript. List them in bullet points and ensure each point is clear and concise. 

### Analogies

- Identify the central points in the transcript and create analogies that simplify these concepts for a broader audience. Ensure the analogies are relatable and easy to understand. 

### Notes

- Create 10 bullet points, each with an appropriate emoji, summarizing key moments or important points from the transcript.

Here are several rewritten segments of a YouTube transcript. Your task is to combine them into a single, coherent document. Ensure the flow between segments is smooth, and the narrative remains clear and engaging. Here are the segments:\n`;
		return prompt;
	}
}

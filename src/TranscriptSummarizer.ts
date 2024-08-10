import { OpenAIClient } from "./OpenAi/OpenAiClient";
import { YoutubeMetadataParser } from "./YoutubeMetadataParser/YoutubeVideoMetadataParser";
import { PluginSettings } from "settings";
import { OllamaClient } from "src/Ollama/OllamaClient";
import { YoutubeTranscript } from "./YoutubeTranscript";
import { Notice } from "obsidian";

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
		let startIndex = 0;

		const keyPointPromises = [];

		const maxIndex = Math.ceil(
			(words.length - 1) / this.settings.maxTokenSize
		);
		// Split the transcript into smaller pieces if necessary.
		for (let i = 1; i <= maxIndex; i++) {
			const endIndex =
				startIndex + this.settings.maxTokenSize > words.length
					? words.length - 1
					: startIndex + this.settings.maxTokenSize;
			const transcriptChunk = words.slice(startIndex, endIndex).join(" ");
			startIndex = endIndex;
			keyPointPromises.push(
				this.getKeyPointsFromTranscript(transcriptChunk)
			);
		}

		const keyPoints = await Promise.all(keyPointPromises);
		let response = keyPoints.join("\n\n");
		if (maxIndex > 1) {
			response = await this.ollamaClient.process(
				this.constructRewritePrompt() + response
			);
		}
		return youtubeMetadata.content + "\n" + response;
	}

	async getKeyPointsFromTranscript(transcript: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(
				this.constructSummarizePrompt() + transcript
			);
		} else {
			return this.ollamaClient.process(
				this.constructSummarizePrompt() + transcript
			);
			// this.ollamaClient.process("Remove ")
		}
	}

	constructSummarizePrompt() {
		const prompt = `You are a specialized content summarizer. Your task is to create a flowing summary of information chunks, treating every chunk as if it's from the middle of a continuous explanation. Begin your summary now:\n`;
		console.debug("prompt", prompt);
		return prompt;
	}

	constructRewritePrompt() {
		const prompt = `Rewrite this summary while retaining all original information, while getting rid of redundant information. Ensure that the additional information is relevant and supports the main points of the original summary. Add definitions or explanations of technical terms as needed. Begin your rewrite now:\n`;
		return prompt;
	}
}

import { OpenAIClient } from "./OpenAi/OpenAiClient";
import { YoutubeMetadataParser } from "./YoutubeMetadataParser/YoutubeVideoMetadataParser";
import { PluginSettings } from "settings";
import { OllamaClient } from "src/Ollama/OllamaClient";
import { YoutubeTranscript } from "./YoutubeTranscript";

export class TranscriptSummarizer {
	constructor(
		private openAiClient: OpenAIClient,
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

		// Split the transcript into smaller pieces if necessary.
		while (startIndex < words.length - 1) {
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
		return youtubeMetadata.content + "\n" + keyPoints.join("\n");
	}

	async getKeyPointsFromTranscript(transcript: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(this.constructPrompt() + transcript);
		} else {
			return OllamaClient.process(
				this.constructPrompt() + transcript,
				this.settings.ollamaUrl,
				this.settings.ollamaModel
			);
		}
	}

	constructPrompt() {
		let numberOfKeyPoints = this.settings.summarySize;
		if (numberOfKeyPoints == 0) numberOfKeyPoints = 3;
		const prompt = `Below is a transcript of a Youtube video. Can you give me ${numberOfKeyPoints} key points and return the results as an unordered markdown list? \n --- \n`;
		console.debug("prompt", prompt);
		return prompt;
	}
}

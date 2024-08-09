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

		const maxIndex = Math.ceil(words.length / this.settings.maxTokenSize);
		// Split the transcript into smaller pieces if necessary.
		for (let i = 1; i < maxIndex; i++) {
			const endIndex =
				startIndex + this.settings.maxTokenSize > words.length
					? words.length - 1
					: startIndex + this.settings.maxTokenSize;
			const transcriptChunk = words.slice(startIndex, endIndex).join(" ");
			startIndex = endIndex;

			keyPointPromises.push(
				this.getKeyPointsFromTranscript(
					`Chunk ${i}:\n\n` + transcriptChunk
				)
			);
		}

		const keyPoints = await Promise.all(keyPointPromises);
		return youtubeMetadata.content + "\n" + keyPoints.join("\n\n");
	}

	async getKeyPointsFromTranscript(transcript: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(
				this.constructPrompt() + "\nUse the text below:\n" + transcript
			);
		} else {
			return this.ollamaClient.process(
				this.constructPrompt(),
				transcript
			);
		}
	}

	constructPrompt() {
		const prompt = `Please process the following transcript in chunks. Each chunk will be labeled with a number (e.g. Chunk 1, Chunk 2, etc.). You have been tasked with creating a concise summary of a YouTube video using its transcription to supply notes to someone learning about the topic in the video. You are to act like an expert in the subject the transcription is written about. Summarize the main points of this YouTube transcript. Ignore any introductory phrases or disclaimers.`;
		console.debug("prompt", prompt);
		return prompt;
	}
}

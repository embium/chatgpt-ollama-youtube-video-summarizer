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
		return youtubeMetadata.content + "\n" + keyPoints.join("\n\n");
	}

	async getKeyPointsFromTranscript(transcript: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(this.constructPrompt() + transcript);
		} else {
			return this.ollamaClient.process(
				this.constructPrompt() + transcript
			);
		}
	}

	constructPrompt() {
		const prompt = `You are an expert summarizer of educational content, specifically tasked with creating concise notes from video transcripts. The following text is a chunk of a larger transcript from a YouTube video. It is part of an ongoing series of chunks, so treat it as a continuation of previous information without restating introductions or conclusions.

Your task:
1. Summarize the key points and concepts presented in this chunk of the transcript.
2. Do not provide any introductory phrases, disclaimers, or concluding remarks.
3. Focus solely on the content provided in the current chunk.
4. Do not ask for further information or offer to facilitate discussions.
5. Assume that this is part of a larger context, even if it seems incomplete.

Please process the following transcript chunk:\n"`;
		console.debug("prompt", prompt);
		return prompt;
	}
}

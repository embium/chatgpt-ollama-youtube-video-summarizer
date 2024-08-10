import { OpenAIClient } from "./OpenAi/OpenAiClient";
import { YoutubeMetadataParser } from "./YoutubeMetadataParser/YoutubeVideoMetadataParser";
import { PluginSettings } from "settings";
import { OllamaClient } from "src/Ollama/OllamaClient";
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
		const response = await this.rewriteSummary(keyPoints.join("\n\n"));
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
		}
	}

	async rewriteSummary(summary: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(
				this.constructRewritePrompt() + summary
			);
		} else {
			return this.ollamaClient.process(
				this.constructRewritePrompt() + summary
			);
		}
	}

	constructSummarizePrompt() {
		const prompt = `You are a specialized content summarizer. Your task is to create a flowing summary of information chunks, treating every chunk as if it's from the middle of a continuous explanation. Begin your summary now:\n`;
		console.debug("prompt", prompt);
		return prompt;
	}

	constructRewritePrompt() {
		const prompt = `Your output should use the following template:
### Summary

### Paraphrase

### Analogy

### Notes

- [Emoji] Bulletpoint

You have been tasked with creating a flowing summary of information. You are to act like an expert in the subject the transcription is written about.

Make a summary of the transcript. Use keywords from the transcript. Don't explain them. Keywords will be explained later.

Additionally, provide a paraphrased version of the transcript. This should retain most of the original information from the transcript but present it in a more direct and concise manner. It should be longer than the summary but shorter than the original transcript.

Create a short complex analogy to give context and/or analogy from day-to-day life from the transcript.

Create 10 bullet points (each with an appropriate emoji) that summarize the key points or important moments from the video's transcript that's relevant to the paraphrase.

In addition to the bullet points, extract the most important keywords and any complex words not known to the average reader as well as any acronyms mentioned. For each keyword and complex word, provide definitions based on its occurrence in the transcription.

You are also a transcription AI and you have been provided with a text that may contain mentions of sponsorships or brand names. Your task is to write what you have been said to do while avoiding any mention of sponsorships or brand names.

Begin your rewrite now:\n`;
		return prompt;
	}
}

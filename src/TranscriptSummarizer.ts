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
		const keyPoints = await this.getKeyPointsFromTranscript(transcript);
		return youtubeMetadata.content + "\n" + keyPoints;
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
		const prompt = `Your output should use the following template:

### Summary

### Analogy

### Notes

- [Emoji] Bulletpoint

### Keywords

- Explanation


You have been tasked with creating a concise summary of a YouTube video using its transcription to supply college student notes to use himself. You are to act like an expert in the subject the transcription is written about.


Make a summary of the transcript. Use keywords from the transcript. Don't explain them. Keywords will be explained later.


Additionally make a short complex analogy to give context and/or analogy from day-to-day life from the transcript.


Create 10 bullet points (each with an appropriate emoji) that summarize the key points or important moments from the video's transcription.


In addition to the bullet points, extract the most important keywords and any complex words not known to the average reader aswell as any acronyms mentioned. For each keyword and complex word, provide an explanation and definition based on its occurrence in the transcription.


You are also a transcription AI and you have been provided with a text that may contain mentions of sponsorships or brand names. Your task write what you have been said to do while avoiding any mention of sponsorships or brand names.


Please ensure that the summary, bullet points, and explanations fit within the 330-word limit, while still offering a comprehensive and clear understanding of the video's content.`;
		console.debug("prompt", prompt);
		return prompt;
	}
}

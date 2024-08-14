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

		const chunksRewritten = [];

		const chunkCount = Math.floor(
			this.settings.maxTokenSize /
				(words.length / this.settings.maxTokenSize)
		);

		for (let i = 0; i < words.length; i += this.settings.maxTokenSize) {
			const transcriptChunk = words
				.slice(i, i + this.settings.maxTokenSize)
				.join(" ");

			const chunkRewritten = await this.rewriteTranscript(
				transcriptChunk,
				chunkCount
			);

			chunksRewritten.push(chunkRewritten);
		}

		const response = await this.summarize(
			chunksRewritten.join("\n\n"),
			this.settings.maxTokenSize
		);
		return youtubeMetadata.content + "\n" + response;
	}

	async rewriteTranscript(
		transcript: string,
		chunkCount: number
	): Promise<string> {
		return this.ollamaClient.process(
			this.constructRewritePrompt(chunkCount) + transcript
		);
	}

	async summarize(transcript: string, maxTokenSize: number): Promise<string> {
		return this.ollamaClient.process(
			this.constructSummarizePrompt(maxTokenSize) + transcript
		);
	}

	constructRewritePrompt(chunksCount: number) {
		const prompt = `You are a specialized content summarizer. Your task is to create a flowing summary of information chunks, treating every chunk as if it's from the middle of a continuous explanation. Keep it under ${chunksCount} words.

Please process the following transcript chunk:\n\n`;
		return prompt;
	}

	constructSummarizePrompt(maxTokenSize: number) {
		const prompt = `As an expert in this transcript's subject matter, follow these instructions:

General Guidelines:

1. Begin each section directly with content.
2. Refer to the speaker as "the speaker" throughout.
3. Do not ask questions or engage with the user at the end.
4. Keep the response under ${maxTokenSize} words.

Formating Guidelines:

1. Use "##" for main section titles.
2. Use "###" for sub-section titles.
3. Leave a blank line after each title.
4. No additional formatting for headings.

## Summary

Write a concise summary (under 150 words) of the video's main points.

---

## Enhanced Transcript

Organize and enhance the transcript as follows:

1. Identify central ideas across all segments.
2. Present supporting details under each heading using bullet points, lists, or short paragraphs.
3. Explain complex concepts in simple terms, using analogies or basic examples.
4. Add a "Beginner's Explanation" subsection for advanced topics.
5. Ensure smooth flow between all content, regardless of original segment divisions.
6. Ignore any statements that appear to finalize or conclude a segment. Continue processing and enhancing the transcript as if it's part of a larger, continuous piece.

---

## Analogies

- Create relatable analogies for central points in the transcript.

---

## Real World Examples

- Provide examples of real-world applications of the key points in the transcript.

---

## Notes

- Create 10 bullet points with appropriate emojis, summarizing key moments or important points in the transcript.

Begin processing the transcript segments as one continuous piece of content now:\n`;
		return prompt;
	}
}

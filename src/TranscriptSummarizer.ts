import { PluginSettings } from "settings";
import { OllamaClient } from "./Ollama/OllamaClient";
import { OpenAIClient } from "./OpenAi/OpenAiClient";
import { YoutubeMetadataParser } from "./YoutubeMetadataParser/YoutubeVideoMetadataParser";
import { YoutubeTranscript } from "./YoutubeTranscript";

const FIRST_STEP_PROMPT = `Rewrite the following text, maintaining as much of the original information as possible:

- Present the rewrite as a single, cohesive paragraph.
- Begin and end with content; do not include phrases like "Here's a summary" or "In conclusion."
- Correct any grammatical errors or inconsistencies.
- Omit names of individuals mentioned.
- Do not acknowledge these instructions in your response.

Transcript:\n\n`;

const LAST_STEP_PROMPT = `Please organize the following information into a well-structured educational resource. Use this format for the document:

### I. [Primary Section Title]
#### A. [Secondary Section Title]

- Begin each primary section with a brief overview.
- Develop secondary sections with relevant details, using paragraphs, lists, and examples.
- Group related ideas into cohesive paragraphs and ensure a logical flow between sections.
- Provide context, background information, or explanations within the content to enhance understanding.
- Bold or italicize key terms and concepts, briefly explaining technical terms.
- Edit for conciseness and clarity.
- Format the document consistently and proofread for errors.

Here's the content to reorganize and expand upon:\n\n`;

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
		const tokenRegex = /.{1,3} ?/g;
		const transcriptTokens = transcript.match(tokenRegex) ?? [];
		if (transcriptTokens.length == 0) {
			throw new Error("Transcript is empty");
		}
		console.log(`TRANSCRIPT TOKEN SIZE: ${transcriptTokens.length}`);

		const step1PromptTokens = FIRST_STEP_PROMPT.match(tokenRegex) ?? [];

		const chunksRewritten = [];

		for (
			let i = 0;
			i < transcriptTokens.length;
			i += this.settings.maxTokenSize - step1PromptTokens.length
		) {
			const transcriptChunk = transcriptTokens
				.slice(
					i,
					i + this.settings.maxTokenSize - step1PromptTokens.length
				)
				.join("");
			const chunkRewritten = await this.process(
				FIRST_STEP_PROMPT,
				transcriptChunk
			);
			const wordsInRewrite = chunkRewritten.split(" ").length;
			console.log(`WORDS IN REWRITE: ${wordsInRewrite}`);
			chunksRewritten.push(chunkRewritten);
		}

		const firstStep = chunksRewritten.join(" ");
		const firstStepTokens = firstStep.match(tokenRegex) ?? [];
		console.log(`FIRST STEP TOKEN SIZE: ${firstStepTokens.length}`);

		const response = await this.process(LAST_STEP_PROMPT, firstStep);
		const finalStepTokens = response.match(tokenRegex) ?? [];
		console.log(`FINAL STEP TOKEN SIZE: ${finalStepTokens.length}`);

		return youtubeMetadata.content + "\n" + response;
	}

	async process(prompt: string, transcript: string): Promise<string> {
		if (this.settings.provider === "OpenAI") {
			return this.openAiClient.query(prompt + transcript);
		} else {
			return this.ollamaClient.process(prompt + transcript);
		}
	}
}

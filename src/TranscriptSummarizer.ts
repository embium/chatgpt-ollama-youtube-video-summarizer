import { PluginSettings } from "settings";
import { OllamaClient } from "./Ollama/OllamaClient";
import { OpenAIClient } from "./OpenAi/OpenAiClient";
import { YoutubeMetadataParser } from "./YoutubeMetadataParser/YoutubeVideoMetadataParser";
import { YoutubeTranscript } from "./YoutubeTranscript";

const STEP_1_PROMPT = `Follow these instructions:
- Rewrite the transcript, significantly shortening each section while retaining all topics, subtopics, and key points.
- Begin directly with content.
- Do not ask questions or engage with the user at the end.
- Output the entire rewrite as a single, continuous paragraph without any headers, section breaks, or special formatting.
- Use exactly 100 words total.
- Leave out any names, titles, or other information that might not be relevant.
- Exclude any introductory or concluding sections or statements. Focus only on the main content and key points of each section.
- Ensure smooth flow between all content, regardless of original segment divisions.
- Retaine specific examples, stories, or case studies that illustrate main points, even if in abbreviated form.
- Combine all content into a single, cohesive paragraph without any line breaks or section divisions.

Begin processing the transcript now:\n`;

const STEP_2_PROMPT = `Prompt for Processing YouTube Video Transcripts:

1. Analyze the entire video transcript thoroughly. 

2. Create a hierarchical structure:
   - Structure content into main sections (I, II, III, etc.) and subsections (A, B, C, etc.).
   - Use descriptive headings: "### I. [Main Section Title]" and "#### I.A. [Subsection Title]".
   - Do not use any additional formatting, such as bolding, italics, or underlining, for the section titles. 
   - Include at least one subsection for each main section.

3. For each main section:
   - Immediately at the beginning of the main section (I, II, III), provide a 2-3 sentence beginner-friendly summary of that section.
   - Include relevant subsections with a mix of paragraphs, bullet points, and numbered lists.
   - Conclude each main section with at least one relatable analogy or metaphor as a subsection.

4. Expand the content where necessary, integrating your own expert knowledge and insights.

5. Create a comprehensive bullet-point glossary of important terms, concepts, and names mentioned in the transcript.

6. Review your work:
   - Ensure all sections are complete and properly structured.
   - Confirm you've included summaries, subsections, and analogies for each main section.
   - Remove any redundancies.
   - Do not include this review in the final output.

Begin the transcript processing directly, without any user engagement or questions at the start or end. Ensure all sections are fully completed before concluding.

Process the transcript now:\n`;

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
		const transcriptTokens = transcript.match(/.{1,3}/g);
		if (transcriptTokens === null) {
			throw new Error("Transcript has no tokens");
		}
		const promptTokens = STEP_1_PROMPT.match(/.{1,3}/g);
		if (promptTokens === null) {
			throw new Error("Transcript has no tokens");
		}

		console.log(`TRANSCRIPT TOKEN SIZE: ${transcriptTokens.length}`);

		const chunksRewritten = [];

		for (
			let i = 0;
			i < transcriptTokens.length;
			i += this.settings.maxTokenSize
		) {
			const transcriptChunk = transcriptTokens
				.slice(i, i + this.settings.maxTokenSize - promptTokens.length)
				.join("");

			const chunkRewritten = await this.rewriteTranscript(
				transcriptChunk
			);
			chunksRewritten.push(chunkRewritten);
		}

		const prepareForNextStep = chunksRewritten.join("");
		console.log(`STEP 1 PREPARED: ${prepareForNextStep.split(" ").length}`);

		const response = await this.summarize(prepareForNextStep);

		return youtubeMetadata.content + "\n" + response;
	}

	async rewriteTranscript(transcript: string): Promise<string> {
		if (this.settings.provider === "OpenAI") {
			return this.openAiClient.query(STEP_1_PROMPT + transcript);
		} else {
			return this.ollamaClient.process(STEP_1_PROMPT + transcript);
		}
	}

	async summarize(transcript: string): Promise<string> {
		if (this.settings.provider === "OpenAI") {
			return this.openAiClient.query(STEP_2_PROMPT + transcript);
		} else {
			return this.ollamaClient.process(STEP_2_PROMPT + transcript);
		}
	}
}

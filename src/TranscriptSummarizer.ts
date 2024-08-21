import { PluginSettings } from "settings";
import { OllamaClient } from "./Ollama/OllamaClient";
import { OpenAIClient } from "./OpenAi/OpenAiClient";
import { YoutubeMetadataParser } from "./YoutubeMetadataParser/YoutubeVideoMetadataParser";
import { YoutubeTranscript } from "./YoutubeTranscript";

const STEP_1_PROMPT = `Follow these instructions to rewrite a chunk of a YouTube video transcript:
- You may use up to 100 words. Do not exceed this limit under any circumstances.
- Begin the transcript processing immediately without any introductory text.
- Output the entire rewrite as a single, continuous paragraph without headers, breaks, or special formatting.
- Focus solely on the main content and key points, excluding introductions, conclusions, and irrelevant information such as names or titles.
- Ensure smooth flow between all content, disregarding original segment divisions.
- Retain specific examples, stories, or case studies that illustrate main points, even if abbreviated.
- Significantly shorten each section while preserving all topics, subtopics, and key points.
- If the provided transcript is too short (less than 10 words) or incomplete, stop processing immediately.

Begin processing the transcript now:\n`;

const STEP_2_PROMPT = `As an expert in the subject matter of this transcript, please follow these instructions:

1. Analyze the entire video transcript thoroughly, ensuring close adherence to its content and structure.

2. Create a hierarchical structure:
   - Structure content into main sections (I, II, III, etc.) and subsections (A, B, C, etc.).
   - Use descriptive headings exactly as shown: "### I. [Main Section Title]" and "#### I.A. [Subsection Title]".
   - Do not use any additional formatting, such as bolding, italics, or underlining, for the section titles. 
   - Include at least one subsection for each main section, covering all major points from the transcript.

3. For each main section:
   - Immediately at the beginning of the main section (I, II, III), provide a 3-4 sentence beginner-friendly summary of that section.
   - Include relevant subsections with detailed explanations, examples, and where appropriate, direct quotes from the transcript.
   - Use a mix of paragraphs, bullet points, and numbered lists to present information clearly.
   - Conclude each main section with at least one relatable analogy or metaphor as a subsection.

4. Expand the content where necessary:
   - Integrate your own expert knowledge to provide context and deeper understanding.
   - Explain complex concepts in simple terms, providing examples where possible.
   - Include any relevant background information that helps clarify the topics discussed.

5. Create a bullet-point glossary:
   - Include all important terms, concepts, and names mentioned in the transcript.
   - Provide clear, concise definitions for each entry.
   - Ensure the glossary covers both basic and advanced concepts discussed.

6. Review your work:
   - Ensure all sections are complete, properly structured, and reflect the depth of the original transcript.
   - Confirm you've included summaries, detailed subsections, and analogies for each main section.
   - Verify that all key points from the transcript are covered and fully explained.
   - Remove any redundancies or information not relevant to the transcript's content.
   - Do not include any disclaimers or notes about the completeness of the content.

8. Strictly adhere to the content of the original transcript:
   - Do not mention topics or promise explanations that are not actually covered in the transcript.
   - If a topic is mentioned in the transcript but not elaborated on, note this briefly without promising further explanation.

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

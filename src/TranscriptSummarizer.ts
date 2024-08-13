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

		const rewrittenChunks = [];
		const maxTokenSize = this.settings.maxTokenSize ?? 4096;

		for (let i = 0; i < words.length; i += maxTokenSize) {
			const transcriptChunk = words.slice(i, i + maxTokenSize).join(" ");
			const rewrittenChunk = await this.rewriteTranscript(
				transcriptChunk
			);
			rewrittenChunks.push(rewrittenChunk);
		}

		const response = await this.summarize(rewrittenChunks.join("\n\n"));
		return youtubeMetadata.content + "\n" + response;
	}

	async rewriteTranscript(transcript: string): Promise<string> {
		if (this.settings.provider == "OpenAI") {
			return this.openAiClient.query(
				this.constructRewritePrompt() + transcript
			);
		} else {
			return this.ollamaClient.process(
				this.constructRewritePrompt() + transcript
			);
		}
	}

	async summarize(transcript: string): Promise<string> {
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

	constructRewritePrompt() {
		const prompt = `Your task is to rewrite the following portion of a YouTube transcript for clarity and conciseness. Focus on delivering the core message with as few words as possible while preserving the original meaning. Remove any redundant or unnecessary information, and streamline the language to be clear and direct.
    
    A chunk of the transcipt begins now:\n`;
		return prompt;
	}

	constructSummarizePrompt() {
		const prompt = `As an expert in this transcript's subject matter, provide:

**Formatting Guidelines:**

1. **Ensure there is a blank line immediately after each heading.**
2. Use "##" (H2) for the main title of each major section.
3. Use "####" (H4) for subsections within each major section.
4. Do not add any additional formatting to headings (no bold, italics, or other Markdown syntax).

---

## Summary

- Based on the combined transcript, write a concise summary that captures the main points and purpose of the video. **Keep it under 150 words.**

---

## Enhanced Transcript

1. **Organize the transcript into sections:**
   - **Identify the central idea or key point** in each part of the transcript.
   - **Create a heading** (use "####" for H4 headings) for each central idea or key point. **Make sure to clearly separate these sections.**

2. **Enhance the content:**
   - Under each heading, **present the supporting details** concisely using bullet points, numbered lists, or short paragraphs. **Ensure each section is distinct and logically organized.**
   - **For each complex concept, term, or idea:** 
     - Provide a basic, simplified explanation as if explaining to someone with little to no prior knowledge. 
     - Use analogies, simple language, or basic examples that make the concept easier to understand.

3. **Simplification for New Learners:**
   - **For any advanced or technical information, add a "Beginner's Explanation" subsection** where you break down the concept further.
   - Explain it in basic terms and provide simple analogies or examples that a new learner could easily grasp.

4. **Focus and Clarity:**
   - Ensure that the enhancements add value and make the content more accessible to the audience.
   - **Begin each section directly with the content.**

5. **Maintain an Objective Tone:**
   - **Refer to the speaker as 'the speaker' throughout your response.**

6. **Final Task:**
   - After enhancing the transcript and adding headings, **combine the rewritten segments of the transcript into a single, coherent document.** Ensure the flow between segments is smooth, and the narrative remains clear and engaging. **Pay close attention to following all instructions above, including sectioning, formatting, and tone.**

---

## Key Concepts

- **Extract the key points from the following transcript.** List them in bullet points and ensure each point is clear and concise.

---

## Analogies

- **Identify the central points in the transcript** and create analogies that simplify these concepts for a broader audience. **Ensure the analogies are relatable and easy to understand.**

---

## Notes

- **Create 10 bullet points, each with an appropriate emoji,** summarizing key moments or important points from the transcript.

---

Important: Do not include any introductory phrases such as 'Here's a rewritten transcript...' or 'In this section...'. Start immediately with the relevant information.

**Pay close attention to following all instructions above.**

Here are the segments:\n`;
		return prompt;
	}
}

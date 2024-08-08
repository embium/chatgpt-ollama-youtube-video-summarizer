import { requestUrl } from "obsidian";

const RE_YOUTUBE =
	/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
const RE_XML_TRANSCRIPT =
	/<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
class YoutubeTranscriptError extends Error {
	constructor(message: string) {
		super(`[YoutubeTranscript] 🚨 ${message}`);
	}
}
class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
	constructor() {
		super(
			"YouTube is receiving too many requests from this IP and now requires solving a captcha to continue"
		);
	}
}
class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
	constructor(videoId: string) {
		super(`The video is no longer available (${videoId})`);
	}
}
class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
	constructor(videoId: string) {
		super(`Transcript is disabled on this video (${videoId})`);
	}
}
class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
	constructor(videoId: string) {
		super(`No transcripts are available for this video (${videoId})`);
	}
}

export class YoutubeTranscript {
	/**
	 * Fetch transcript from YTB Video
	 * @param videoId Video url or video identifier
	 * @param config Get transcript in a specific language ISO
	 */
	static async fetchTranscript(videoId: string) {
		let _a;
		const identifier = this.retrieveVideoId(videoId);
		const videoPageResponse = await requestUrl(
			`https://www.youtube.com/watch?v=${identifier}`
		);
		const videoPageBody = videoPageResponse.text;
		const splittedHTML = videoPageBody.split('"captions":');
		if (splittedHTML.length <= 1) {
			if (videoPageBody.includes('class="g-recaptcha"')) {
				throw new YoutubeTranscriptTooManyRequestError();
			}
			if (!videoPageBody.includes('"playabilityStatus":')) {
				throw new YoutubeTranscriptVideoUnavailableError(videoId);
			}
			throw new YoutubeTranscriptDisabledError(videoId);
		}
		const captions =
			(_a = (() => {
				try {
					return JSON.parse(
						splittedHTML[1]
							.split(',"videoDetails')[0]
							.replace("\n", "")
					);
				} catch (e) {
					return undefined;
				}
			})()) === null || _a === void 0
				? void 0
				: _a["playerCaptionsTracklistRenderer"];
		if (!captions) {
			throw new YoutubeTranscriptDisabledError(videoId);
		}
		if (!("captionTracks" in captions)) {
			throw new YoutubeTranscriptNotAvailableError(videoId);
		}
		const transcriptURL = captions.captionTracks[0].baseUrl;
		const transcriptResponse = await requestUrl(transcriptURL);
		if (!transcriptResponse.text) {
			throw new YoutubeTranscriptNotAvailableError(videoId);
		}
		const transcriptBody = await transcriptResponse.text;
		const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
		return results.map((result) => {
			return {
				text: result[3],
				duration: parseFloat(result[2]),
				offset: parseFloat(result[1]),
			};
		});
	}
	/**
	 * Retrieve video id from url or string
	 * @param videoId video url or video id
	 */
	static retrieveVideoId(videoId: string) {
		if (videoId.length === 11) {
			return videoId;
		}
		const matchId = videoId.match(RE_YOUTUBE);
		if (matchId && matchId.length) {
			return matchId[1];
		}
		throw new YoutubeTranscriptError(
			"Impossible to retrieve Youtube video ID."
		);
	}
}

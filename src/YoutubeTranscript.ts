import { requestUrl } from "obsidian";

const RE_YOUTUBE =
	/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";
const RE_XML_TRANSCRIPT =
	/<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

export class YoutubeTranscriptError extends Error {
	constructor(message) {
		super(`[YoutubeTranscript] 🚨 ${message}`);
	}
}

export class YoutubeTranscriptTooManyRequestError extends YoutubeTranscriptError {
	constructor() {
		super(
			"YouTube is receiving too many requests from this IP and now requires solving a captcha to continue"
		);
	}
}

export class YoutubeTranscriptVideoUnavailableError extends YoutubeTranscriptError {
	constructor(videoId: string) {
		super(`The video is no longer available (${videoId})`);
	}
}

export class YoutubeTranscriptDisabledError extends YoutubeTranscriptError {
	constructor(videoId: string) {
		super(`Transcript is disabled on this video (${videoId})`);
	}
}

export class YoutubeTranscriptNotAvailableError extends YoutubeTranscriptError {
	constructor(videoId: string) {
		super(`No transcripts are available for this video (${videoId})`);
	}
}

export class YoutubeTranscriptNotAvailableLanguageError extends YoutubeTranscriptError {
	constructor(lang: string, availableLangs: string[], videoId: string) {
		super(
			`No transcripts are available in ${lang} this video (${videoId}). Available languages: ${availableLangs.join(
				", "
			)}`
		);
	}
}

export interface TranscriptConfig {
	lang?: string;
}
export interface TranscriptResponse {
	text: string;
	duration: number;
	offset: number;
	lang?: string;
}

/**
 * Class to retrieve transcript if exist
 */
export class YoutubeTranscript {
	/**
	 * Fetch transcript from YTB Video
	 * @param videoId Video url or video identifier
	 * @param config Get transcript in a specific language ISO
	 */
	public static async fetchTranscript(
		videoId: string
	): Promise<TranscriptResponse[]> {
		const identifier = this.retrieveVideoId(videoId);
		const lang = "en";
		const videoPageResponse = await requestUrl({
			url: `https://www.youtube.com/watch?v=${identifier}`,
			headers: {
				"Accept-Language": lang,
				"User-Agent": USER_AGENT,
			},
		});
		const videoPageBody = await videoPageResponse.text;

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

		const captions = (() => {
			try {
				return JSON.parse(
					splittedHTML[1].split(',"videoDetails')[0].replace("\n", "")
				);
			} catch (e) {
				return undefined;
			}
		})()?.["playerCaptionsTracklistRenderer"];

		if (!captions) {
			throw new YoutubeTranscriptDisabledError(videoId);
		}

		if (!("captionTracks" in captions)) {
			throw new YoutubeTranscriptNotAvailableError(videoId);
		}

		if (
			!captions.captionTracks.some((track) => track.languageCode === lang)
		) {
			throw new YoutubeTranscriptNotAvailableLanguageError(
				lang,
				captions.captionTracks.map((track) => track.languageCode),
				videoId
			);
		}

		const transcriptURL = captions.captionTracks.find(
			(track) => track.languageCode === lang
		).baseUrl;

		const transcriptResponse = await fetch(transcriptURL, {
			headers: {
				"Accept-Language": lang,
				"User-Agent": USER_AGENT,
			},
		});
		if (!transcriptResponse.ok) {
			throw new YoutubeTranscriptNotAvailableError(videoId);
		}
		const transcriptBody = await transcriptResponse.text();
		const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
		return results.map((result) => ({
			text: result[3],
			duration: parseFloat(result[2]),
			offset: parseFloat(result[1]),
			lang: lang ?? captions.captionTracks[0].languageCode,
		}));
	}

	/**
	 * Retrieve video id from url or string
	 * @param videoId video url or video id
	 */
	private static retrieveVideoId(videoId: string) {
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

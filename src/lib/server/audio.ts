/**
 * Container sniffing and duration validation for uploaded voice replies.
 *
 * MIME types come from the client and prove nothing. Only RIFF/WAVE and
 * MPEG audio are accepted — the two containers the browser recorder and common
 * uploads produce, both of which can be parsed without extra native tooling.
 *
 * All reads are bounded by the caller's byte cap; the MP3 walk stops as soon
 * as the clip is known to exceed the maximum duration.
 */

export const MAX_AUDIO_SEC = 30;
const MIN_AUDIO_SEC = 0.2;

export type AudioFormat = "wav" | "mp3";

export interface AudioProbe {
  format: AudioFormat;
  durationSec: number;
  mime: string;
}

export class AudioValidationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 422) {
    super(message);
    this.name = "AudioValidationError";
    this.code = code;
    this.status = status;
  }
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(bytes[offset + i] ?? 0);
  return out;
}

function u32le(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) +
      (bytes[offset + 1] ?? 0) * 0x100 +
      (bytes[offset + 2] ?? 0) * 0x10000 +
      (bytes[offset + 3] ?? 0) * 0x1000000) >>>
    0
  );
}

function u16le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) + (bytes[offset + 1] ?? 0) * 0x100;
}

function checkDuration(durationSec: number): void {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new AudioValidationError("INVALID_AUDIO", "The audio file could not be read.", 400);
  }
  if (durationSec < MIN_AUDIO_SEC) {
    throw new AudioValidationError("AUDIO_TOO_SHORT", "The recording is too short.", 422);
  }
  if (durationSec > MAX_AUDIO_SEC) {
    throw new AudioValidationError(
      "AUDIO_TOO_LONG",
      `Recordings must be ${MAX_AUDIO_SEC} seconds or shorter.`,
      422,
    );
  }
}

function probeWav(bytes: Uint8Array): AudioProbe {
  let offset = 12;
  let byteRate = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const id = ascii(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const body = offset + 8;
    if (id === "fmt " && size >= 16 && body + 16 <= bytes.length) {
      channels = u16le(bytes, body + 2);
      sampleRate = u32le(bytes, body + 4);
      byteRate = u32le(bytes, body + 8);
      bitsPerSample = u16le(bytes, body + 14);
    } else if (id === "data") {
      // Streamed WAVs sometimes leave 0xFFFFFFFF here; never trust it past EOF.
      dataSize = Math.min(size, Math.max(0, bytes.length - body));
      break;
    }
    // Chunks are word-aligned.
    offset = body + size + (size % 2);
    if (size > bytes.byteLength) break;
  }

  if (dataSize === 0 || channels === 0 || sampleRate === 0) {
    throw new AudioValidationError("INVALID_AUDIO", "The WAV file is missing audio data.", 400);
  }
  if (channels > 2 || sampleRate < 8_000 || sampleRate > 192_000) {
    throw new AudioValidationError(
      "UNSUPPORTED_AUDIO",
      "Use a mono or stereo WAV between 8 kHz and 192 kHz.",
      415,
    );
  }
  if (bitsPerSample !== 0 && bitsPerSample % 8 !== 0) {
    throw new AudioValidationError("UNSUPPORTED_AUDIO", "Unsupported WAV sample format.", 415);
  }

  const derivedRate =
    byteRate > 0 ? byteRate : (sampleRate * Math.max(1, channels) * Math.max(8, bitsPerSample)) / 8;
  if (!Number.isFinite(derivedRate) || derivedRate <= 0) {
    throw new AudioValidationError("INVALID_AUDIO", "The WAV file has an invalid header.", 400);
  }
  return { format: "wav", durationSec: dataSize / derivedRate, mime: "audio/wav" };
}

const MP3_BITRATES = [
  // MPEG 1, Layer III
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  // MPEG 2/2.5, Layer III
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
];
const MP3_RATES = [44_100, 48_000, 32_000];

function mp3Frame(bytes: Uint8Array, offset: number): { length: number; duration: number } | null {
  if (offset + 4 > bytes.length) return null;
  if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null;

  const versionBits = (bytes[offset + 1] >> 3) & 0x03; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
  const layerBits = (bytes[offset + 1] >> 1) & 0x03; // 1 = Layer III
  if (versionBits === 1 || layerBits === 0) return null;

  const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;
  const rateIndex = (bytes[offset + 2] >> 2) & 0x03;
  const padding = (bytes[offset + 2] >> 1) & 0x01;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;

  const mpeg1 = versionBits === 3;
  const bitrate = (mpeg1 ? MP3_BITRATES[0] : MP3_BITRATES[1])[bitrateIndex] * 1000;
  const sampleRate = mpeg1
    ? MP3_RATES[rateIndex]
    : MP3_RATES[rateIndex] * (versionBits === 2 ? 0.5 : 0.25);
  const samplesPerFrame = mpeg1 ? 1152 : 576;
  const length = Math.floor((samplesPerFrame / 8) * (bitrate / sampleRate)) + padding;
  if (length < 4) return null;

  return { length, duration: samplesPerFrame / sampleRate };
}

function probeMp3(bytes: Uint8Array): AudioProbe {
  let offset = 0;
  if (bytes.length >= 10 && ascii(bytes, 0, 3) === "ID3") {
    const size =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    offset = 10 + size;
  }

  // Find the first valid frame within a short search window.
  let first = -1;
  for (let i = offset; i < Math.min(bytes.length - 4, offset + 4_096); i += 1) {
    if (mp3Frame(bytes, i)) {
      first = i;
      break;
    }
  }
  if (first < 0) {
    throw new AudioValidationError(
      "INVALID_AUDIO",
      "The MP3 file has no readable audio frames.",
      400,
    );
  }

  let duration = 0;
  let cursor = first;
  while (cursor + 4 <= bytes.length) {
    const frame = mp3Frame(bytes, cursor);
    if (!frame) break;
    duration += frame.duration;
    cursor += frame.length;
    if (duration > MAX_AUDIO_SEC + 1) break; // already too long; stop walking
  }

  return { format: "mp3", durationSec: duration, mime: "audio/mpeg" };
}

/** Sniff the container, validate its header, and enforce the duration bounds. */
export function probeAudio(bytes: Uint8Array): AudioProbe {
  if (bytes.byteLength < 12) {
    throw new AudioValidationError("INVALID_AUDIO", "The audio file is empty or truncated.", 400);
  }

  let probe: AudioProbe;
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    probe = probeWav(bytes);
  } else if (
    ascii(bytes, 0, 4) === "fLaC" ||
    ascii(bytes, 0, 4) === "OggS" ||
    (ascii(bytes, 4, 4) === "ftyp" && ascii(bytes, 8, 3) === "M4A")
  ) {
    throw new AudioValidationError(
      "UNSUPPORTED_AUDIO",
      "Use a WAV or MP3 recording. Other containers are not accepted.",
      415,
    );
  } else {
    probe = probeMp3(bytes);
  }

  checkDuration(probe.durationSec);
  return probe;
}

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AudioValidationError,
  MAX_AUDIO_SEC,
  probeAudio,
} from "../../src/lib/server/audio";

function wav(seconds: number, sampleRate = 16_000, channels = 1, bits = 16): Uint8Array {
  const dataSize = Math.round((seconds * sampleRate * channels * bits) / 8);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  buffer.writeUInt16LE((channels * bits) / 8, 32);
  buffer.writeUInt16LE(bits, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return new Uint8Array(buffer);
}

function mp3Frames(count: number): Uint8Array {
  // MPEG-1 Layer III, 128 kbps, 44.1 kHz, no CRC, no padding → 417-byte frame.
  const frameLength = 417;
  const bytes = new Uint8Array(frameLength * count);
  for (let i = 0; i < count; i += 1) {
    const offset = i * frameLength;
    bytes[offset] = 0xff;
    bytes[offset + 1] = 0xfb;
    bytes[offset + 2] = 0x90;
    bytes[offset + 3] = 0x00;
  }
  return bytes;
}

function rejects(bytes: Uint8Array, code: string) {
  assert.throws(
    () => probeAudio(bytes),
    (error: unknown) => error instanceof AudioValidationError && error.code === code
  );
}

test("accepts a valid 16 kHz mono WAV and reports its duration", () => {
  const probe = probeAudio(wav(2));
  assert.equal(probe.format, "wav");
  assert.equal(probe.mime, "audio/wav");
  assert.ok(Math.abs(probe.durationSec - 2) < 0.001);
});

test("accepts a valid MP3 frame chain", () => {
  const probe = probeAudio(mp3Frames(20));
  assert.equal(probe.format, "mp3");
  assert.ok(probe.durationSec > 0.4 && probe.durationSec < 0.7);
});

test("rejects audio longer than the provider limit", () => {
  rejects(wav(MAX_AUDIO_SEC + 2, 8_000), "AUDIO_TOO_LONG");
});

test("rejects clips that are too short", () => {
  rejects(wav(0.05, 16_000), "AUDIO_TOO_SHORT");
});

test("rejects random bytes with a fake audio MIME", () => {
  rejects(new Uint8Array(256).fill(0x41), "INVALID_AUDIO");
});

test("rejects truncated WAV headers", () => {
  rejects(wav(1).slice(0, 24), "INVALID_AUDIO");
});

test("rejects non-WAV containers instead of forwarding them", () => {
  const ogg = new Uint8Array(64);
  ogg.set([0x4f, 0x67, 0x67, 0x53]); // OggS
  rejects(ogg, "UNSUPPORTED_AUDIO");
});

test("rejects WAV files with impossible channel counts", () => {
  rejects(wav(1, 16_000, 9), "UNSUPPORTED_AUDIO");
});

test("rejects an empty buffer", () => {
  rejects(new Uint8Array(0), "INVALID_AUDIO");
});

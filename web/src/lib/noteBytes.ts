export const NOTE_BYTE_LIMIT = 280;

const encoder = new TextEncoder();

// Solidity enforces UTF-8 bytes, not JavaScript's UTF-16 character count.
export function getNoteByteLength(note: string) {
	return encoder.encode(note).byteLength;
}

export function isNoteWithinLimit(note: string) {
	return getNoteByteLength(note) <= NOTE_BYTE_LIMIT;
}

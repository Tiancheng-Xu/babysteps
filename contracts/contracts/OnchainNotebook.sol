// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract OnchainNotebook {
    uint256 private constant MAX_NOTE_BYTES = 280;
    mapping(address author => string note) private notes;

    error NoteTooLong(uint256 actualLength, uint256 maximumLength);

    event NoteUpdated(address indexed author, string note);
    event NoteCleared(address indexed author);

    function getNote(address author) external view returns (string memory) {
        return notes[author];
    }

    function setNote(string calldata note) external {
        uint256 noteLength = bytes(note).length;
        // Solidity bytes length is UTF-8 byte length, matching the frontend TextEncoder.
        if (noteLength > MAX_NOTE_BYTES) {
            revert NoteTooLong(noteLength, MAX_NOTE_BYTES);
        }

        notes[msg.sender] = note;
        emit NoteUpdated(msg.sender, note);
    }

    function clearNote() external {
        delete notes[msg.sender];
        emit NoteCleared(msg.sender);
    }
}

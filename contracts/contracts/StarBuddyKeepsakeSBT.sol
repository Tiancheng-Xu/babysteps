// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC5192} from "./interfaces/IERC5192.sol";

contract StarBuddyKeepsakeSBT is
    ERC721Enumerable,
    ERC721URIStorage,
    AccessControl,
    IERC5192
{
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    uint8 public constant SERIES_COUNT = 4;
    uint8 public constant RARITY_COUNT = 4;

    struct Keepsake {
        uint8 series;
        uint8 rarity;
    }

    uint256 public nextTokenId = 1;
    string private metadataBaseUri;
    mapping(uint256 tokenId => Keepsake keepsake) private keepsakes;

    error Soulbound();
    error InvalidKeepsakeSeries(uint8 series);
    error InvalidKeepsakeRarity(uint8 rarity);
    error KeepsakeOwnerMismatch(
        uint256 tokenId,
        address expectedOwner,
        address actualOwner
    );

    event KeepsakeMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        uint8 series,
        uint8 rarity
    );
    event KeepsakeBurned(
        uint256 indexed tokenId,
        address indexed owner,
        uint8 series,
        uint8 rarity
    );

    constructor(
        address admin,
        string memory baseUri
    ) ERC721("StarBuddy Keepsake", "STAR-BUDDY") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        metadataBaseUri = baseUri;
    }

    function mint(
        address recipient,
        uint8 series,
        uint8 rarity
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        if (series >= SERIES_COUNT) revert InvalidKeepsakeSeries(series);
        if (rarity >= RARITY_COUNT) revert InvalidKeepsakeRarity(rarity);

        tokenId = nextTokenId;
        nextTokenId = tokenId + 1;
        keepsakes[tokenId] = Keepsake({series: series, rarity: rarity});
        _safeMint(recipient, tokenId);

        emit Locked(tokenId);
        emit KeepsakeMinted(tokenId, recipient, series, rarity);
    }

    function burnFrom(
        address expectedOwner,
        uint256 tokenId
    ) external onlyRole(BURNER_ROLE) {
        address actualOwner = ownerOf(tokenId);
        if (actualOwner != expectedOwner) {
            revert KeepsakeOwnerMismatch(
                tokenId,
                expectedOwner,
                actualOwner
            );
        }

        Keepsake memory keepsake = keepsakes[tokenId];
        delete keepsakes[tokenId];
        _burn(tokenId);
        emit KeepsakeBurned(
            tokenId,
            expectedOwner,
            keepsake.series,
            keepsake.rarity
        );
    }

    function getKeepsake(
        uint256 tokenId
    ) external view returns (uint8 series, uint8 rarity) {
        _requireOwned(tokenId);
        Keepsake memory keepsake = keepsakes[tokenId];
        return (keepsake.series, keepsake.rarity);
    }

    function tokensOfOwner(
        address owner
    ) external view returns (uint256[] memory tokenIds) {
        uint256 balance = balanceOf(owner);
        tokenIds = new uint256[](balance);
        for (uint256 index = 0; index < balance; index++) {
            tokenIds[index] = tokenOfOwnerByIndex(owner, index);
        }
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        _requireOwned(tokenId);
        Keepsake memory keepsake = keepsakes[tokenId];
        return
            string.concat(
                metadataBaseUri,
                uint256(keepsake.series).toString(),
                "-",
                uint256(keepsake.rarity).toString(),
                ".json"
            );
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    function setApprovalForAll(
        address,
        bool
    ) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721Enumerable, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return
            interfaceId == type(IERC5192).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721, ERC721Enumerable)
        returns (address previousOwner)
    {
        previousOwner = _ownerOf(tokenId);
        if (previousOwner != address(0) && to != address(0)) {
            revert Soulbound();
        }
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC5192} from "./interfaces/IERC5192.sol";

contract GrowthCertificateSBT is ERC721URIStorage, AccessControl, IERC5192 {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public nextTokenId = 1;
    mapping(uint256 purchaseId => uint256 tokenId) public tokenForPurchase;

    error Soulbound();
    error CertificateConflict(uint256 purchaseId, uint256 tokenId);

    constructor(address admin)
        ERC721("BabySteps Growth Certificate", "BABY-CERT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mintForPurchase(
        address recipient,
        uint256 purchaseId,
        string calldata metadataUri
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        tokenId = tokenForPurchase[purchaseId];
        if (tokenId != 0) {
            if (
                _ownerOf(tokenId) != recipient ||
                keccak256(bytes(tokenURI(tokenId))) !=
                keccak256(bytes(metadataUri))
            ) {
                revert CertificateConflict(purchaseId, tokenId);
            }
            return tokenId;
        }

        tokenId = nextTokenId;
        nextTokenId = tokenId + 1;
        tokenForPurchase[purchaseId] = tokenId;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataUri);
        emit Locked(tokenId);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
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
    ) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return
            interfaceId == type(IERC5192).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address previousOwner) {
        previousOwner = _ownerOf(tokenId);
        if (previousOwner != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }
}

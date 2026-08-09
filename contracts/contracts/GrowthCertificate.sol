// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract GrowthCertificate is ERC721URIStorage, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public nextTokenId = 1;
    mapping(uint256 purchaseId => uint256 tokenId) public tokenForPurchase;

    error CertificateAlreadyMinted(uint256 purchaseId, uint256 tokenId);

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
        uint256 existingTokenId = tokenForPurchase[purchaseId];
        if (existingTokenId != 0) {
            revert CertificateAlreadyMinted(purchaseId, existingTokenId);
        }

        tokenId = nextTokenId;
        nextTokenId = tokenId + 1;
        tokenForPurchase[purchaseId] = tokenId;

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, metadataUri);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

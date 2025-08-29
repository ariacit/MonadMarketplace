// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
/**
 * @title NFT Contract
 * @dev ERC721 NFT contract with minting functionality and metadata URI support
 */
contract NFT is ERC721, ERC721URIStorage, Ownable {
    
    uint256 private _tokenIdCounter;
    
    // Mapping to track if an address is approved to mint
    mapping(address => bool) public approvedMinters;
    
    // Events
    event NFTMinted(uint256 indexed tokenId, address indexed to, string tokenURI);
    event MinterApproved(address indexed minter);
    event MinterRevoked(address indexed minter);
    
    constructor() ERC721("MonadNFT", "MNFT") Ownable(msg.sender) {
        // Start token IDs from 1
        _tokenIdCounter = 1;
    }
    
    /**
     * @dev Mint a new NFT with metadata URI
     * @param to Address to mint the NFT to
     * @param uri Metadata URI for the NFT
     * @return tokenId The ID of the newly minted token
     */
    function mint(address to, string memory uri) public returns (uint256) {
        require(
            owner() == _msgSender() || approvedMinters[_msgSender()], 
            "NFT: caller is not owner or approved minter"
        );
        require(to != address(0), "NFT: cannot mint to zero address");
        require(bytes(uri).length > 0, "NFT: tokenURI cannot be empty");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit NFTMinted(tokenId, to, uri);
        
        return tokenId;
    }
    
    /**
     * @dev Approve an address to mint NFTs
     * @param minter Address to approve for minting
     */
    function approveMinter(address minter) external onlyOwner {
        require(minter != address(0), "NFT: cannot approve zero address");
        approvedMinters[minter] = true;
        emit MinterApproved(minter);
    }
    
    /**
     * @dev Revoke minting approval for an address
     * @param minter Address to revoke minting approval
     */
    function revokeMinter(address minter) external onlyOwner {
        approvedMinters[minter] = false;
        emit MinterRevoked(minter);
    }
    
    /**
     * @dev Get the current token ID counter
     * @return Current token ID that will be used for next mint
     */
    function getCurrentTokenId() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev Get total number of minted tokens
     * @return Total supply of tokens
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter - 1;
    }
    
    /**
     * @dev Check if a token exists
     * @param tokenId Token ID to check
     * @return bool indicating if token exists
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    // Override required functions for ERC721URIStorage
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

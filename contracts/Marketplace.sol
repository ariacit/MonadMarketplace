// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title NFT Marketplace
 * @dev Marketplace contract for buying and selling NFTs with a 2.5% fee system
 */
contract Marketplace is ReentrancyGuard, Ownable, IERC721Receiver {
    
    // Marketplace fee percentage (2.5% = 250 basis points)
    uint256 public constant MARKETPLACE_FEE = 250; // 2.5%
    uint256 public constant FEE_DENOMINATOR = 10000; // 100%
    
    // Struct to represent a marketplace listing
    struct Listing {
        uint256 tokenId;
        address nftContract;
        address seller;
        uint256 price;
        bool active;
    }
    
    // Mapping from listing ID to Listing
    mapping(uint256 => Listing) public listings;
    
    // Counter for listing IDs
    uint256 private _listingIdCounter;
    
    // Mapping to track earnings that can be withdrawn
    mapping(address => uint256) public withdrawableEarnings;
    
    // Total fees collected by the marketplace
    uint256 public totalFeesCollected;
    
    // Events
    event ItemListed(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed nftContract,
        address seller,
        uint256 price
    );
    
    event ItemSold(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed nftContract,
        address seller,
        address buyer,
        uint256 price,
        uint256 fee
    );
    
    event ItemDelisted(
        uint256 indexed listingId,
        uint256 indexed tokenId,
        address indexed nftContract,
        address seller
    );
    
    event EarningsWithdrawn(address indexed seller, uint256 amount);
    event FeesWithdrawn(address indexed owner, uint256 amount);
    
    constructor() {
        _listingIdCounter = 1; // Start listing IDs from 1
    }
    
    /**
     * @dev List an NFT for sale in the marketplace
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID to list
     * @param price Price in wei to list the NFT for
     * @return listingId The ID of the created listing
     */
    function listItem(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external nonReentrant returns (uint256) {
        require(nftContract != address(0), "Marketplace: invalid NFT contract");
        require(price > 0, "Marketplace: price must be greater than 0");
        
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Marketplace: not token owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace: not approved to transfer token"
        );
        
        uint256 listingId = _listingIdCounter;
        _listingIdCounter++;
        
        listings[listingId] = Listing({
            tokenId: tokenId,
            nftContract: nftContract,
            seller: msg.sender,
            price: price,
            active: true
        });
        
        emit ItemListed(listingId, tokenId, nftContract, msg.sender, price);
        
        return listingId;
    }
    
    /**
     * @dev Buy an NFT from the marketplace
     * @param listingId ID of the listing to purchase
     */
    function buyItem(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        
        require(listing.active, "Marketplace: listing not active");
        require(msg.value >= listing.price, "Marketplace: insufficient payment");
        require(msg.sender != listing.seller, "Marketplace: cannot buy own item");
        
        IERC721 nft = IERC721(listing.nftContract);
        require(nft.ownerOf(listing.tokenId) == listing.seller, "Marketplace: seller no longer owns token");
        
        // Calculate marketplace fee
        uint256 fee = (listing.price * MARKETPLACE_FEE) / FEE_DENOMINATOR;
        uint256 sellerEarnings = listing.price - fee;
        
        // Mark listing as inactive
        listing.active = false;
        
        // Add earnings to seller's withdrawable balance
        withdrawableEarnings[listing.seller] += sellerEarnings;
        
        // Add fee to total collected fees
        totalFeesCollected += fee;
        
        // Transfer NFT to buyer
        nft.safeTransferFrom(listing.seller, msg.sender, listing.tokenId);
        
        // Refund excess payment
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }
        
        emit ItemSold(
            listingId,
            listing.tokenId,
            listing.nftContract,
            listing.seller,
            msg.sender,
            listing.price,
            fee
        );
    }
    
    /**
     * @dev Remove a listing from the marketplace
     * @param listingId ID of the listing to remove
     */
    function delistItem(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        
        require(listing.active, "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not the seller");
        
        listing.active = false;
        
        emit ItemDelisted(listingId, listing.tokenId, listing.nftContract, listing.seller);
    }
    
    /**
     * @dev Withdraw earnings from sales
     */
    function withdrawEarnings() external nonReentrant {
        uint256 earnings = withdrawableEarnings[msg.sender];
        require(earnings > 0, "Marketplace: no earnings to withdraw");
        
        withdrawableEarnings[msg.sender] = 0;
        
        payable(msg.sender).transfer(earnings);
        
        emit EarningsWithdrawn(msg.sender, earnings);
    }
    
    /**
     * @dev Withdraw collected marketplace fees (only owner)
     */
    function withdrawFees() external onlyOwner nonReentrant {
        require(totalFeesCollected > 0, "Marketplace: no fees to withdraw");
        
        uint256 fees = totalFeesCollected;
        totalFeesCollected = 0;
        
        payable(owner()).transfer(fees);
        
        emit FeesWithdrawn(owner(), fees);
    }
    
    /**
     * @dev Get listing details
     * @param listingId ID of the listing
     * @return Listing details
     */
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
    
    /**
     * @dev Get current listing ID counter
     * @return Current listing ID counter
     */
    function getCurrentListingId() external view returns (uint256) {
        return _listingIdCounter;
    }
    
    /**
     * @dev Get total number of listings created
     * @return Total listings count
     */
    function getTotalListings() external view returns (uint256) {
        return _listingIdCounter - 1;
    }
    
    /**
     * @dev Update listing price
     * @param listingId ID of the listing to update
     * @param newPrice New price for the listing
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        Listing storage listing = listings[listingId];
        
        require(listing.active, "Marketplace: listing not active");
        require(listing.seller == msg.sender, "Marketplace: not the seller");
        require(newPrice > 0, "Marketplace: price must be greater than 0");
        
        listing.price = newPrice;
        
        emit ItemListed(listingId, listing.tokenId, listing.nftContract, listing.seller, newPrice);
    }
    
    /**
     * @dev Handle the receipt of an NFT
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }
    
    /**
     * @dev Emergency function to withdraw stuck ETH (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}

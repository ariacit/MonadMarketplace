// Contract addresses (update these after deployment)
const NFT_CONTRACT_ADDRESS = "0x..."; // Replace with deployed NFT contract address
const MARKETPLACE_CONTRACT_ADDRESS = "0x..."; // Replace with deployed Marketplace contract address

// Monad Testnet configuration
const MONAD_TESTNET = {
    chainId: '0x279F', // 10143 in hex
    chainName: 'Monad Testnet',
    nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: ['https://testnet-rpc.monad.xyz'],
    blockExplorerUrls: ['https://testnet-explorer.monad.xyz']
};

// Contract ABIs (simplified versions)
const NFT_ABI = [
    "function mint(address to, string memory tokenURI) public returns (uint256)",
    "function ownerOf(uint256 tokenId) public view returns (address)",
    "function tokenURI(uint256 tokenId) public view returns (string memory)",
    "function approve(address to, uint256 tokenId) public",
    "function setApprovalForAll(address operator, bool approved) public",
    "function isApprovedForAll(address owner, address operator) public view returns (bool)",
    "function getApproved(uint256 tokenId) public view returns (address)",
    "function balanceOf(address owner) public view returns (uint256)",
    "function totalSupply() public view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const MARKETPLACE_ABI = [
    "function listItem(address nftContract, uint256 tokenId, uint256 price) public returns (uint256)",
    "function buyItem(uint256 listingId) public payable",
    "function delistItem(uint256 listingId) public",
    "function withdrawEarnings() public",
    "function getListing(uint256 listingId) public view returns (tuple(uint256 tokenId, address nftContract, address seller, uint256 price, bool active))",
    "function withdrawableEarnings(address) public view returns (uint256)",
    "function getCurrentListingId() public view returns (uint256)",
    "function MARKETPLACE_FEE() public view returns (uint256)",
    "event ItemListed(uint256 indexed listingId, uint256 indexed tokenId, address indexed nftContract, address seller, uint256 price)",
    "event ItemSold(uint256 indexed listingId, uint256 indexed tokenId, address indexed nftContract, address seller, address buyer, uint256 price, uint256 fee)"
];

// Global variables
let provider = null;
let signer = null;
let nftContract = null;
let marketplaceContract = null;
let userAddress = null;
let currentListings = [];
let userNFTs = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

// Initialize application
async function initializeApp() {
    // Check if MetaMask is installed
    if (typeof window.ethereum === 'undefined') {
        showToast('Please install MetaMask to use this application', 'error');
        return;
    }

    // Check if already connected
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
        await connectWallet();
    }

    // Listen for account changes
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('connectWallet').addEventListener('click', connectWallet);
    
    // Mint NFT
    document.getElementById('mintNFT').addEventListener('click', mintNFT);
    document.getElementById('tokenURI').addEventListener('input', previewNFT);
    
    // Marketplace
    document.getElementById('searchInput').addEventListener('input', searchListings);
    
    // My NFTs
    document.getElementById('withdrawEarnings').addEventListener('click', withdrawEarnings);
    
    // Listing modal
    document.getElementById('confirmListing').addEventListener('click', confirmListing);
}

// Connect wallet function
async function connectWallet() {
    try {
        showLoading('Connecting to wallet...');
        
        // Request account access
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        if (accounts.length === 0) {
            throw new Error('No accounts found');
        }
        
        // Initialize provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = accounts[0];
        
        // Check and switch to Monad Testnet
        await ensureMonadTestnet();
        
        // Initialize contracts
        initializeContracts();
        
        // Update UI
        updateWalletUI();
        await updateWalletBalance();
        
        // Load data
        await Promise.all([
            loadMarketplaceItems(),
            loadUserNFTs(),
            loadUserEarnings()
        ]);
        
        showToast('Wallet connected successfully!', 'success');
        hideLoading();
        
    } catch (error) {
        console.error('Wallet connection error:', error);
        showToast(`Failed to connect wallet: ${error.message}`, 'error');
        hideLoading();
    }
}

// Ensure we're on Monad Testnet
async function ensureMonadTestnet() {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    
    if (chainId !== MONAD_TESTNET.chainId) {
        try {
            // Try to switch to Monad Testnet
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: MONAD_TESTNET.chainId }],
            });
        } catch (switchError) {
            // If network doesn't exist, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [MONAD_TESTNET],
                    });
                } catch (addError) {
                    throw new Error('Failed to add Monad Testnet to MetaMask');
                }
            } else {
                throw new Error('Failed to switch to Monad Testnet');
            }
        }
    }
}

// Initialize contracts
function initializeContracts() {
    if (NFT_CONTRACT_ADDRESS === "0x..." || MARKETPLACE_CONTRACT_ADDRESS === "0x...") {
        showToast('Please update contract addresses in app.js after deployment', 'warning');
        return;
    }
    
    nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
    marketplaceContract = new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, MARKETPLACE_ABI, signer);
}

// Update wallet UI
function updateWalletUI() {
    const connectButton = document.getElementById('connectWallet');
    const walletStatus = document.getElementById('walletStatus');
    const walletAddress = document.getElementById('walletAddress');
    
    if (userAddress) {
        connectButton.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
        connectButton.disabled = true;
        walletStatus.classList.remove('hidden');
        walletAddress.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
    } else {
        connectButton.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet';
        connectButton.disabled = false;
        walletStatus.classList.add('hidden');
    }
}

// Update wallet balance
async function updateWalletBalance() {
    if (!provider || !userAddress) return;
    
    try {
        const balance = await provider.getBalance(userAddress);
        const balanceInEth = ethers.utils.formatEther(balance);
        document.getElementById('walletBalance').textContent = `${parseFloat(balanceInEth).toFixed(4)} ETH`;
    } catch (error) {
        console.error('Error fetching balance:', error);
    }
}

// Mint NFT function
async function mintNFT() {
    if (!nftContract) {
        showToast('Please connect your wallet first', 'error');
        return;
    }
    
    const tokenURI = document.getElementById('tokenURI').value.trim();
    
    if (!tokenURI) {
        showToast('Please enter a metadata URI', 'error');
        return;
    }
    
    try {
        showLoading('Minting NFT...');
        
        const tx = await nftContract.mint(userAddress, tokenURI);
        
        showLoading('Waiting for transaction confirmation...');
        const receipt = await tx.wait();
        
        // Extract token ID from the Transfer event
        const transferEvent = receipt.events.find(event => event.event === 'Transfer');
        const tokenId = transferEvent.args.tokenId.toString();
        
        showToast(`NFT minted successfully! Token ID: ${tokenId}`, 'success');
        
        // Clear form and reload data
        document.getElementById('tokenURI').value = '';
        document.getElementById('previewContent').innerHTML = `
            <i class="fas fa-image preview-icon"></i>
            <p>Enter a metadata URI to preview your NFT</p>
        `;
        
        await Promise.all([
            loadUserNFTs(),
            updateWalletBalance()
        ]);
        
        hideLoading();
        
    } catch (error) {
        console.error('Minting error:', error);
        showToast(`Failed to mint NFT: ${error.message}`, 'error');
        hideLoading();
    }
}

// Preview NFT metadata
async function previewNFT() {
    const tokenURI = document.getElementById('tokenURI').value.trim();
    const previewContent = document.getElementById('previewContent');
    
    if (!tokenURI) {
        previewContent.innerHTML = `
            <i class="fas fa-image preview-icon"></i>
            <p>Enter a metadata URI to preview your NFT</p>
        `;
        return;
    }
    
    try {
        const response = await fetch(tokenURI);
        const metadata = await response.json();
        
        previewContent.innerHTML = `
            <img src="${metadata.image || ''}" alt="${metadata.name || 'NFT'}" 
                 style="max-width: 100%; border-radius: 0.5rem; margin-bottom: 1rem;"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="display: none;">
                <i class="fas fa-image preview-icon"></i>
            </div>
            <h4 style="margin-bottom: 0.5rem;">${metadata.name || 'Untitled NFT'}</h4>
            <p style="color: var(--text-secondary); margin: 0;">${metadata.description || 'No description available'}</p>
        `;
    } catch (error) {
        previewContent.innerHTML = `
            <i class="fas fa-exclamation-triangle preview-icon" style="color: var(--warning-color);"></i>
            <p style="color: var(--warning-color);">Failed to load metadata preview</p>
        `;
    }
}

// Load marketplace items
async function loadMarketplaceItems() {
    if (!marketplaceContract || !nftContract) return;
    
    try {
        const marketplaceGrid = document.getElementById('marketplaceItems');
        marketplaceGrid.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading marketplace items...</p>
            </div>
        `;
        
        const currentListingId = await marketplaceContract.getCurrentListingId();
        const listings = [];
        
        // Load all active listings
        for (let i = 1; i < currentListingId; i++) {
            try {
                const listing = await marketplaceContract.getListing(i);
                if (listing.active) {
                    listings.push({
                        id: i,
                        tokenId: listing.tokenId.toString(),
                        nftContract: listing.nftContract,
                        seller: listing.seller,
                        price: listing.price,
                        active: listing.active
                    });
                }
            } catch (error) {
                console.error(`Error loading listing ${i}:`, error);
            }
        }
        
        currentListings = listings;
        displayMarketplaceItems(listings);
        
    } catch (error) {
        console.error('Error loading marketplace items:', error);
        document.getElementById('marketplaceItems').innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load marketplace items</p>
            </div>
        `;
    }
}

// Display marketplace items
async function displayMarketplaceItems(listings) {
    const marketplaceGrid = document.getElementById('marketplaceItems');
    
    if (listings.length === 0) {
        marketplaceGrid.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-store"></i>
                <p>No items available in the marketplace</p>
            </div>
        `;
        return;
    }
    
    let itemsHTML = '';
    
    for (const listing of listings) {
        try {
            // Get NFT metadata
            const tokenURI = await nftContract.tokenURI(listing.tokenId);
            let metadata = { name: `NFT #${listing.tokenId}`, description: '', image: '' };
            
            try {
                const response = await fetch(tokenURI);
                metadata = await response.json();
            } catch (error) {
                console.error('Error fetching metadata:', error);
            }
            
            const priceInEth = ethers.utils.formatEther(listing.price);
            const isOwnItem = listing.seller.toLowerCase() === userAddress?.toLowerCase();
            
            itemsHTML += `
                <div class="nft-card" data-listing-id="${listing.id}">
                    <div class="nft-image">
                        ${metadata.image ? 
                            `<img src="${metadata.image}" alt="${metadata.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                            '<i class="fas fa-image"></i>'
                        }
                    </div>
                    <div class="nft-info">
                        <h3 class="nft-title">${metadata.name || `NFT #${listing.tokenId}`}</h3>
                        <p class="nft-description">${metadata.description || 'No description available'}</p>
                        <div class="nft-price">
                            <span class="price-value">${priceInEth} ETH</span>
                            <span class="price-label">Price</span>
                        </div>
                        <div class="nft-actions">
                            ${isOwnItem ? 
                                `<button class="btn btn-secondary btn-sm" onclick="delistItem(${listing.id})">
                                    <i class="fas fa-times"></i> Delist
                                </button>` :
                                `<button class="btn btn-primary btn-sm" onclick="buyItem(${listing.id}, '${listing.price}')">
                                    <i class="fas fa-shopping-cart"></i> Buy Now
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(`Error rendering listing ${listing.id}:`, error);
        }
    }
    
    marketplaceGrid.innerHTML = itemsHTML;
}

// Buy item from marketplace
async function buyItem(listingId, price) {
    if (!marketplaceContract) {
        showToast('Please connect your wallet first', 'error');
        return;
    }
    
    try {
        showLoading('Processing purchase...');
        
        const tx = await marketplaceContract.buyItem(listingId, {
            value: price
        });
        
        showLoading('Waiting for transaction confirmation...');
        await tx.wait();
        
        showToast('NFT purchased successfully!', 'success');
        
        // Reload data
        await Promise.all([
            loadMarketplaceItems(),
            loadUserNFTs(),
            updateWalletBalance()
        ]);
        
        hideLoading();
        
    } catch (error) {
        console.error('Purchase error:', error);
        showToast(`Failed to purchase NFT: ${error.message}`, 'error');
        hideLoading();
    }
}

// Delist item from marketplace
async function delistItem(listingId) {
    if (!marketplaceContract) {
        showToast('Please connect your wallet first', 'error');
        return;
    }
    
    try {
        showLoading('Delisting item...');
        
        const tx = await marketplaceContract.delistItem(listingId);
        
        showLoading('Waiting for transaction confirmation...');
        await tx.wait();
        
        showToast('Item delisted successfully!', 'success');
        
        // Reload marketplace
        await loadMarketplaceItems();
        
        hideLoading();
        
    } catch (error) {
        console.error('Delisting error:', error);
        showToast(`Failed to delist item: ${error.message}`, 'error');
        hideLoading();
    }
}

// Load user NFTs
async function loadUserNFTs() {
    if (!nftContract || !userAddress) return;
    
    try {
        const myNFTsGrid = document.getElementById('myNFTs');
        myNFTsGrid.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading your NFTs...</p>
            </div>
        `;
        
        // Get user's NFT balance
        const balance = await nftContract.balanceOf(userAddress);
        const totalSupply = await nftContract.totalSupply();
        
        const ownedNFTs = [];
        
        // Check each token to see if user owns it
        for (let tokenId = 1; tokenId <= totalSupply; tokenId++) {
            try {
                const owner = await nftContract.ownerOf(tokenId);
                if (owner.toLowerCase() === userAddress.toLowerCase()) {
                    ownedNFTs.push(tokenId);
                }
            } catch (error) {
                // Token might not exist or be burned
                continue;
            }
        }
        
        userNFTs = ownedNFTs;
        
        // Update stats
        document.getElementById('totalNFTs').textContent = ownedNFTs.length;
        
        await displayUserNFTs(ownedNFTs);
        
    } catch (error) {
        console.error('Error loading user NFTs:', error);
        document.getElementById('myNFTs').innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load your NFTs</p>
            </div>
        `;
    }
}

// Display user NFTs
async function displayUserNFTs(tokenIds) {
    const myNFTsGrid = document.getElementById('myNFTs');
    
    if (tokenIds.length === 0) {
        myNFTsGrid.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-images"></i>
                <p>You don't own any NFTs yet</p>
            </div>
        `;
        return;
    }
    
    let itemsHTML = '';
    
    for (const tokenId of tokenIds) {
        try {
            // Get NFT metadata
            const tokenURI = await nftContract.tokenURI(tokenId);
            let metadata = { name: `NFT #${tokenId}`, description: '', image: '' };
            
            try {
                const response = await fetch(tokenURI);
                metadata = await response.json();
            } catch (error) {
                console.error('Error fetching metadata:', error);
            }
            
            // Check if NFT is listed
            const isListed = currentListings.some(listing => 
                listing.tokenId === tokenId.toString() && 
                listing.seller.toLowerCase() === userAddress.toLowerCase()
            );
            
            itemsHTML += `
                <div class="nft-card">
                    <div class="nft-image">
                        ${metadata.image ? 
                            `<img src="${metadata.image}" alt="${metadata.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                            '<i class="fas fa-image"></i>'
                        }
                    </div>
                    <div class="nft-info">
                        <h3 class="nft-title">${metadata.name || `NFT #${tokenId}`}</h3>
                        <p class="nft-description">${metadata.description || 'No description available'}</p>
                        <div class="nft-actions">
                            ${isListed ? 
                                '<span class="text-muted"><i class="fas fa-tag"></i> Listed for sale</span>' :
                                `<button class="btn btn-primary btn-sm" onclick="openListingModal(${tokenId}, '${metadata.name}', '${metadata.description}', '${metadata.image}')">
                                    <i class="fas fa-tag"></i> List for Sale
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(`Error rendering NFT ${tokenId}:`, error);
        }
    }
    
    myNFTsGrid.innerHTML = itemsHTML;
}

// Open listing modal
function openListingModal(tokenId, name, description, image) {
    const modal = document.getElementById('listingModal');
    const nftImage = document.getElementById('listingNFTImage');
    const nftName = document.getElementById('listingNFTName');
    const nftDescription = document.getElementById('listingNFTDescription');
    
    nftImage.src = image || '';
    nftImage.style.display = image ? 'block' : 'none';
    nftName.textContent = name || `NFT #${tokenId}`;
    nftDescription.textContent = description || 'No description available';
    
    // Store token ID for later use
    modal.dataset.tokenId = tokenId;
    
    modal.classList.remove('hidden');
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    
    // Clear form if it's the listing modal
    if (modalId === 'listingModal') {
        document.getElementById('listingPrice').value = '';
    }
}

// Confirm listing
async function confirmListing() {
    const modal = document.getElementById('listingModal');
    const tokenId = modal.dataset.tokenId;
    const price = document.getElementById('listingPrice').value;
    
    if (!price || parseFloat(price) <= 0) {
        showToast('Please enter a valid price', 'error');
        return;
    }
    
    if (!nftContract || !marketplaceContract) {
        showToast('Please connect your wallet first', 'error');
        return;
    }
    
    try {
        showLoading('Listing NFT for sale...');
        closeModal('listingModal');
        
        // First, approve the marketplace to transfer the NFT
        const isApproved = await nftContract.isApprovedForAll(userAddress, MARKETPLACE_CONTRACT_ADDRESS);
        
        if (!isApproved) {
            showLoading('Approving marketplace access...');
            const approveTx = await nftContract.setApprovalForAll(MARKETPLACE_CONTRACT_ADDRESS, true);
            await approveTx.wait();
        }
        
        // List the item
        showLoading('Creating marketplace listing...');
        const priceInWei = ethers.utils.parseEther(price);
        const tx = await marketplaceContract.listItem(NFT_CONTRACT_ADDRESS, tokenId, priceInWei);
        
        showLoading('Waiting for transaction confirmation...');
        await tx.wait();
        
        showToast('NFT listed successfully!', 'success');
        
        // Reload data
        await Promise.all([
            loadMarketplaceItems(),
            loadUserNFTs()
        ]);
        
        hideLoading();
        
    } catch (error) {
        console.error('Listing error:', error);
        showToast(`Failed to list NFT: ${error.message}`, 'error');
        hideLoading();
    }
}

// Load user earnings
async function loadUserEarnings() {
    if (!marketplaceContract || !userAddress) return;
    
    try {
        const earnings = await marketplaceContract.withdrawableEarnings(userAddress);
        const earningsInEth = ethers.utils.formatEther(earnings);
        
        document.getElementById('withdrawableEarnings').textContent = `${parseFloat(earningsInEth).toFixed(4)} ETH`;
        document.getElementById('totalEarnings').textContent = `${parseFloat(earningsInEth).toFixed(4)} ETH`;
        
        // Enable/disable withdraw button
        const withdrawButton = document.getElementById('withdrawEarnings');
        withdrawButton.disabled = parseFloat(earningsInEth) === 0;
        
    } catch (error) {
        console.error('Error loading earnings:', error);
    }
}

// Withdraw earnings
async function withdrawEarnings() {
    if (!marketplaceContract) {
        showToast('Please connect your wallet first', 'error');
        return;
    }
    
    try {
        showLoading('Withdrawing earnings...');
        
        const tx = await marketplaceContract.withdrawEarnings();
        
        showLoading('Waiting for transaction confirmation...');
        await tx.wait();
        
        showToast('Earnings withdrawn successfully!', 'success');
        
        // Reload data
        await Promise.all([
            loadUserEarnings(),
            updateWalletBalance()
        ]);
        
        hideLoading();
        
    } catch (error) {
        console.error('Withdrawal error:', error);
        showToast(`Failed to withdraw earnings: ${error.message}`, 'error');
        hideLoading();
    }
}

// Filter marketplace listings
function filterListings(filterType) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    let filteredListings = [...currentListings];
    
    switch (filterType) {
        case 'low-to-high':
            filteredListings.sort((a, b) => parseFloat(ethers.utils.formatEther(a.price)) - parseFloat(ethers.utils.formatEther(b.price)));
            break;
        case 'high-to-low':
            filteredListings.sort((a, b) => parseFloat(ethers.utils.formatEther(b.price)) - parseFloat(ethers.utils.formatEther(a.price)));
            break;
        default:
            // 'all' - no sorting needed
            break;
    }
    
    displayMarketplaceItems(filteredListings);
}

// Search listings
function searchListings() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        displayMarketplaceItems(currentListings);
        return;
    }
    
    const filteredListings = currentListings.filter(listing => 
        listing.tokenId.includes(searchTerm) ||
        listing.seller.toLowerCase().includes(searchTerm)
    );
    
    displayMarketplaceItems(filteredListings);
}

// Navigation functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(`${sectionName}-section`).classList.add('active');
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // If we have data and switching to a section, refresh it
    if (userAddress) {
        switch (sectionName) {
            case 'marketplace':
                loadMarketplaceItems();
                break;
            case 'my-nfts':
                loadUserNFTs();
                loadUserEarnings();
                break;
        }
    }
}

// Utility functions
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    text.textContent = message;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    let icon = 'fas fa-info-circle';
    switch (type) {
        case 'success':
            icon = 'fas fa-check-circle';
            break;
        case 'error':
            icon = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            icon = 'fas fa-exclamation-triangle';
            break;
    }
    
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

// Event handlers for MetaMask
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected
        userAddress = null;
        provider = null;
        signer = null;
        nftContract = null;
        marketplaceContract = null;
        updateWalletUI();
        showToast('Wallet disconnected', 'warning');
    } else if (accounts[0] !== userAddress) {
        // User changed account
        connectWallet();
    }
}

function handleChainChanged(chainId) {
    // Reload the page when chain changes
    window.location.reload();
}

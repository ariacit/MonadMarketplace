# MonadNFT Marketplace

## Overview

MonadNFT Marketplace is a complete NFT marketplace built for the Monad Testnet. The project features a two-tier architecture with smart contracts developed using Hardhat and a vanilla JavaScript frontend. Users can mint NFTs, list them for sale, and purchase from others with a 2.5% marketplace fee structure.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Smart Contract Layer
- **ERC721 NFT Contract**: Standard NFT implementation using OpenZeppelin contracts for minting NFTs with metadata URI support
- **Marketplace Contract**: Handles listing, buying, and managing NFT sales with automated fee collection
- **Fee Structure**: 2.5% marketplace fee automatically collected on each sale
- **Earnings Management**: Separate withdrawal system for sellers to claim their earnings
- **Gas Optimization**: Solidity compiler optimizations enabled with 200 runs for cost efficiency

### Frontend Architecture
- **Vanilla JavaScript**: No framework dependencies for lightweight, fast loading
- **Web3 Integration**: Ethers.js v5 for blockchain interactions and wallet connectivity
- **Responsive Design**: CSS Grid and Flexbox for mobile-first responsive layouts
- **Component-based Structure**: Modular JavaScript functions for different marketplace sections
- **State Management**: Global variables for contract instances and user session data

### Network Configuration
- **Primary Network**: Monad Testnet (Chain ID: 10143)
- **RPC Endpoint**: Custom Monad testnet RPC for blockchain communication
- **Auto Network Switching**: Automatic MetaMask network configuration and switching
- **Fallback Support**: Hardhat local network for development and testing

### Contract Interaction Pattern
- **Contract Factories**: Hardhat ethers integration for deployment and interaction
- **ABI Management**: Simplified contract ABIs embedded in frontend for essential functions
- **Event Listening**: Smart contract event monitoring for real-time marketplace updates
- **Error Handling**: Comprehensive error handling for blockchain transaction failures

### Security Considerations
- **Input Validation**: Client-side validation before blockchain transactions
- **Approval Management**: ERC721 approval patterns for marketplace interactions
- **Private Key Management**: Environment variable configuration for sensitive data
- **CORS Headers**: Security headers configured in Vercel deployment settings

## External Dependencies

### Blockchain Infrastructure
- **Monad Testnet**: Primary blockchain network for smart contract deployment
- **MetaMask**: Required browser extension for wallet connectivity and transaction signing
- **Ethers.js**: Web3 library for blockchain interactions and contract communication

### Development Tools
- **Hardhat**: Ethereum development environment for smart contract compilation, testing, and deployment
- **OpenZeppelin Contracts**: Audited smart contract library for ERC721 implementation
- **Node.js**: Runtime environment for development tooling and package management

### Frontend Dependencies
- **Font Awesome**: Icon library for user interface elements
- **Ethers.js CDN**: Browser-compatible version for frontend blockchain interactions

### Deployment Platform
- **Vercel**: Static site hosting with custom routing and security headers
- **Vercel Static Builder**: Build system for frontend deployment optimization

### Development Environment
- **dotenv**: Environment variable management for sensitive configuration
- **NPM**: Package manager for dependency management and script execution
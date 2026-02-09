# SmartFolio

<div align="center">

![SmartFolio Icon](src/assets/icon128.png)

**PRIVATE · UNIFIED · SMART**

A powerful crypto portfolio tracker extension with CEX/DEX balance aggregation, privacy-focused design, and AI-powered insights.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Discord](https://img.shields.io/discord/YOUR_DISCORD_ID?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/wJrRrP2Q)

[**Privacy Policy**](https://cryptorabit.notion.site/SmartFolio-Private-Policy-2f943793fe6c80b79c09ec2b8ea2cf30) • [**Discord Community**](https://discord.gg/wJrRrP2Q) • [**Chrome Web Store**](#)

</div>

## ✨ Features

### 🔒 Privacy-First Design
- **Local-only Storage**: All your data stays on your device
- **End-to-End Encryption**: Sensitive API keys and credentials are AES-encrypted
- **No Server**: No backend servers, no data collection, no tracking
- **Password Protection**: Master password to secure your portfolio

### 💰 Comprehensive Portfolio Tracking
- **Multi-Chain Support**: Ethereum, Bitcoin, Solana, and more
- **CEX Integration**: Binance, OKX, Bybit, Bitget, Backpack
- **Real-time Balances**: Auto-refresh every 30 minutes
- **Historical Tracking**: Track portfolio value over time

### 🤖 AI-Powered Insights
- **Portfolio Analysis**: AI-driven risk assessment and recommendations
- **OCR Support**: Extract wallet addresses from screenshots
- **Multi-Provider**: OpenRouter, SiliconFlow, Gemini support
- **Smart Suggestions**: Rebalancing and allocation advice

### 📊 Rich Visualization
- **Interactive Charts**: Portfolio distribution, trends, and history
- **Balance Overview**: Quick view in popup extension
- **Share Cards**: Generate beautiful portfolio snapshots
- **Multi-language**: English and Chinese (中文) support

## 🚀 Installation

### From Chrome Web Store
*Coming soon...*

### Manual Installation (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/0xRabit/SmartFolio.git
   cd SmartFolio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## 📖 Usage

### Initial Setup

1. **Set Master Password**
   - Click the extension icon
   - Set a strong master password
   - This encrypts your sensitive data

2. **Add Wallets**
   - Open Dashboard
   - Go to "Wallet Settings"
   - Add wallet addresses manually or via CSV upload

3. **Configure API Keys** (Optional)
   - **Etherscan**: For EVM balance queries
   - **Solana RPC**: For Solana balance queries
   - **AI Provider**: For portfolio analysis features

4. **Add CEX Accounts** (Optional)
   - Select exchange (Binance, OKX, etc.)
   - Enter API Key and Secret
   - Test connection
   - Click "Add CEX Account"

### Security Best Practices

- ✅ Use a **strong master password** (8+ chars, mixed case, numbers, symbols)
- ✅ Store API keys with **read-only permissions**
- ✅ Never share your master password
- ✅ Regular backups of your wallet CSV
- ❌ Do not use trading permissions for CEX API keys

## 🔐 Privacy & Security

SmartFolio is built with privacy as a core principle:

- **Local Storage**: All data stored locally using Chrome's storage API
- **Encrypted Fields**: AI API keys, CEX secrets encrypted with AES-256
- **No Backend**: No servers, no data transmission to third parties
- **Open Source**: Fully auditable code
- **Session Management**: Automatic password timeout for security

**Read our full [Privacy Policy](https://cryptorabit.notion.site/SmartFolio-Private-Policy-2f943793fe6c80b79c09ec2b8ea2cf30)**

## 🛠️ Development

### Project Structure

```
SmartFolio/
├── src/
│   ├── dashboard/        # Main dashboard UI
│   ├── popup/            # Extension popup UI
│   ├── background/       # Service worker
│   ├── utils/            # Shared utilities
│   │   ├── encryption.js     # AES encryption
│   │   ├── password_manager.js
│   │   ├── cex_api.js        # CEX integrations
│   │   └── chain_api.js      # Blockchain APIs
│   ├── assets/           # Icons and resources
│   └── config/           # Configuration files
├── scripts/              # Build scripts
└── manifest.json         # Extension manifest
```

### Build Commands

```bash
# Development build (with source maps)
npm run dev

# Production build
npm run build

# Release build (removes extension key for Chrome Web Store)
npm run build:release
```

### Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Charts**: Chart.js
- **Encryption**: CryptoJS (AES-256)
- **Build**: Webpack 5
- **APIs**: Etherscan, CoinGecko, CEX REST APIs

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Update README if adding new features

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌐 Links

- **GitHub**: [https://github.com/0xRabit/SmartFolio](https://github.com/0xRabit/SmartFolio)
- **Discord**: [https://discord.gg/wJrRrP2Q](https://discord.gg/wJrRrP2Q)
- **Privacy Policy**: [https://cryptorabit.notion.site/SmartFolio-Private-Policy-2f943793fe6c80b79c09ec2b8ea2cf30](https://cryptorabit.notion.site/SmartFolio-Private-Policy-2f943793fe6c80b79c09ec2b8ea2cf30)
- **Twitter/X**: [@0xRabit](https://x.com/0xRabit)

## 💬 Support

- Join our [Discord community](https://discord.gg/wJrRrP2Q)
- Report bugs via [GitHub Issues](https://github.com/0xRabit/SmartFolio/issues)
- Follow updates on [Twitter/X](https://x.com/0xRabit)

## ⚠️ Disclaimer

This software is provided "as is", without warranty of any kind. Users are responsible for:
- Securing their master password
- Verifying wallet addresses
- Managing API key permissions
- Ensuring data backups

SmartFolio is a portfolio management tool, not financial advice.

---

<div align="center">

**Made with ❤️ by the crypto community**

If you find SmartFolio useful, give us a ⭐️ on GitHub!

</div>

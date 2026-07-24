# ⚡ NamiVolt

<div align="center">

**A private Telegram bot that connects to Revolut's Open Banking API to check account balances**

[![GitHub Issues](https://img.shields.io/github/issues/KaizokuDigital/NamiVolt)](https://github.com/KaizokuDigital/NamiVolt/issues)
[![Cloudflare Workers](https://img.shields.io/badge/deployed%20on-Cloudflare%20Workers-orange)](https://workers.cloudflare.com/)
</div>

---

## 📖 Overview

NamiVolt is a lightweight, serverless Telegram bot deployed on Cloudflare Workers that provides instant access to your Revolut account balance through a simple command interface. Built with security and privacy in mind, the bot restricts access to authorized users only.

### 🏦 Account Type Support

NamiVolt can be implemented in two ways depending on your account type:

#### **Version 1: Business Accounts (Direct Integration)**
- ✅ Direct integration with Revolut Open Banking API
- ✅ No intermediary services required
- ✅ Simpler architecture
- ⚠️ Requires Revolut Business account

#### **Version 2: Personal Accounts (via TrueLayer)**
- ✅ Works with personal Revolut accounts
- ✅ Uses TrueLayer as Open Banking aggregator
- ✅ Access to multiple banks (not just Revolut)
- ⚠️ Requires TrueLayer account and API setup
- ⚠️ Additional API layer in the architecture

> 💡 **Note**: Revolut's Open Banking API is primarily designed for business accounts. For personal accounts, you'll need to use an Open Banking aggregator like [TrueLayer](https://truelayer.com/), [Plaid](https://plaid.com/), or [Yapily](https://www.yapily.com/) that supports Revolut as a connected bank.

## ✨ Features

- 💬 **Simple Command Interface** - Check your balance with a single `/balance` command
- ⚡ **Instant Response** - Webhook-based architecture for real-time updates
- 🔒 **Private & Secure** - Whitelist-based access control for authorized users only
- 🌍 **Global Edge Deployment** - Runs on Cloudflare's edge network for low latency worldwide
- 🔄 **Auto Token Refresh** - Automatically manages OAuth token lifecycle
- 💰 **Balance Display** - Shows account name, available balance, currency, and timestamp

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Cloudflare Workers (Edge) |
| **Language** | TypeScript |
| **Telegram API** | Webhook mode |
| **Banking API** | Revolut Open Banking API |
| **Authentication** | OAuth 2.0 |
| **Storage** | Cloudflare Workers KV |
| **Deployment** | Wrangler CLI (Cloudflare's official deployment tool) |

## 📋 Prerequisites

> 🚧 **Work in Progress** - The project is currently in planning phase. Prerequisites will be finalized once implementation begins.

### Version 1: Business Account Setup

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works fine)
- A [Telegram account](https://telegram.org/)
- A [Revolut Business account](https://business.revolut.com/) with API access
- Node.js 24+ and pnpm installed locally
- Git for version control

### Version 2: Personal Account Setup (TrueLayer)

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works fine)
- A [Telegram account](https://telegram.org/)
- A personal Revolut account
- A [TrueLayer account](https://truelayer.com/) with API access
- Node.js 24+ and pnpm installed locally
- Git for version control

## 🚀 Quick Start

> 🚧 **Work in Progress** - Setup instructions are tentative and will be updated as development progresses. The project structure and configuration files do not exist yet.

### 1. Clone the Repository

```bash
git clone https://github.com/KaizokuDigital/NamiVolt.git
cd NamiVolt
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Copy `.dev.vars.example` to `.dev.vars` and fill in real values for local development (`.dev.vars` is gitignored and never committed):

```bash
cp .dev.vars.example .dev.vars
```

For production, set the same values as Wrangler secrets. Note that `AUTHORIZED_USER_IDS` is treated as a secret here rather than non-sensitive `wrangler.toml [vars]` config, since this repo is public and committing real Telegram user IDs would publish them:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put AUTHORIZED_USER_IDS
```

Revolut/TrueLayer credentials (`REVOLUT_CLIENT_ID`, `REVOLUT_CLIENT_SECRET`, `REVOLUT_ACCOUNT_ID`, `TRUELAYER_CLIENT_ID`, `TRUELAYER_CLIENT_SECRET`) are set the same way once the corresponding OAuth integration is implemented.

The KV namespace binding lives in `wrangler.toml` (non-secret — it's just a resource id, not a credential):

```toml
name = "namivolt"
main = "src/index.ts"
compatibility_date = "2026-07-24"

[[kv_namespaces]]
binding = "NAMIVOLT_KV"
id = "your_kv_namespace_id"
```

If setting up your own deployment, create your own namespace with `wrangler kv namespace create NAMIVOLT_KV` and swap in the resulting id.

### 4. Create Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` command and follow the prompts
3. Save the bot token for configuration
4. Find your Telegram User ID using [@userinfobot](https://t.me/userinfobot)

### 5. Register with Revolut / TrueLayer

#### For Version 1 (Business Accounts):
1. Go to [Revolut Developer Portal](https://developer.revolut.com/)
2. Create a new application
3. Configure OAuth redirect URI
4. Obtain Client ID and Client Secret
5. Complete the OAuth flow to get initial tokens

#### For Version 2 (Personal Accounts via TrueLayer):
1. Go to [TrueLayer Console](https://console.truelayer.com/)
2. Create a new application
3. Configure OAuth redirect URI
4. Obtain Client ID and Client Secret
5. Connect your Revolut account through TrueLayer's flow
6. Complete the OAuth flow to get initial tokens

### 6. Deploy

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Set webhook URL with Telegram
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-worker.workers.dev"
```

## 💬 Bot Commands

| Command | Description | Access |
|---------|-------------|--------|
| `/start` | Welcome message and usage instructions | All users |
| `/help` | Display available commands and how to use them | All users |
| `/balance` | Check your Revolut account balance | Authorized users only |

## 📐 Architecture

### Version 1: Business Accounts (Direct)
```
User (Telegram App)
    ↓
Telegram Bot API
    ↓
Cloudflare Worker (Webhook)
    ↓
    ├─→ User Authentication (Whitelist Check)
    ├─→ Revolut API (Balance Endpoint)
    └─→ Workers KV (Token Storage)
    ↓
Response to User
```

### Version 2: Personal Accounts (via TrueLayer)
```
User (Telegram App)
    ↓
Telegram Bot API
    ↓
Cloudflare Worker (Webhook)
    ↓
    ├─→ User Authentication (Whitelist Check)
    ├─→ TrueLayer API
    │       ↓
    │   Revolut Account (via Open Banking)
    └─→ Workers KV (Token Storage)
    ↓
Response to User
```

## 🔐 Security Features

- **Whitelist-based Access** - Only pre-approved Telegram User IDs can interact
- **OAuth 2.0** - Secure authorization with Revolut
- **Encrypted Secrets** - All credentials stored in Cloudflare Workers secrets
- **Token Rotation** - Automatic refresh of expired access tokens
- **HTTPS Only** - All communications encrypted in transit
- **Audit Logging** - All access attempts logged for security monitoring

## 🔧 Development

> 🚧 **Work in Progress** - Development setup and scripts are not yet implemented. This section will be updated once the project structure is created.

### Local Development

```bash
# Run in development mode
pnpm dev

# Type checking
pnpm typecheck

# Format code
pnpm format

# Lint code
pnpm lint
```

### Project Structure

```
NamiVolt/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── handlers/             # Command handlers
│   ├── services/             # External API services
│   ├── middleware/           # Authentication & validation
│   └── utils/                # Helper functions
├── wrangler.toml             # Cloudflare Workers config
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies
```

## 📊 Cost Estimate

### Version 1: Business Account (Direct)

- **Cloudflare Workers**: FREE (up to 100,000 requests/day)
- **Cloudflare Workers KV**: FREE (up to 100,000 reads/day, 1,000 writes/day)
- **Telegram Bot API**: FREE (unlimited)
- **Revolut Open Banking API**: FREE (with Business account)

**Estimated Monthly Cost**: $0 for personal use 🎉

### Version 2: Personal Account (TrueLayer)

- **Cloudflare Workers**: FREE (up to 100,000 requests/day)
- **Cloudflare Workers KV**: FREE (up to 100,000 reads/day, 1,000 writes/day)
- **Telegram Bot API**: FREE (unlimited)
- **TrueLayer API**: FREE (up to 1,000 requests/month) or paid plans from ~$50/month

**Estimated Monthly Cost**: $0 (within free tier) or $50+ for higher usage

> ⚠️ **Disclaimer**: These estimates are based on free tier limits as of 2026. Always check the current pricing on [Cloudflare's pricing page](https://developers.cloudflare.com/workers/platform/pricing/), [TrueLayer's pricing](https://truelayer.com/pricing/), and [Revolut's API documentation](https://developer.revolut.com/) for the most up-to-date information. Usage beyond free tier limits will incur charges.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Powered by [Revolut Open Banking API](https://developer.revolut.com/docs/api/open-banking)
- Telegram integration via [Telegram Bot API](https://core.telegram.org/bots/api)

## ⚠️ Disclaimer

This bot is for personal use only. Always ensure you comply with:
- Revolut's Terms of Service
- Telegram's Terms of Service
- Your local financial data regulations
- GDPR and other privacy laws

**Never share your bot token, API credentials, or access tokens publicly.**

## 📚 Resources

### General
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

### Version 1: Business Accounts
- [Revolut Open Banking API Documentation](https://developer.revolut.com/docs/api/open-banking)

### Version 2: Personal Accounts
- [TrueLayer API Documentation](https://docs.truelayer.com/)
- [TrueLayer Getting Started Guide](https://docs.truelayer.com/docs/quickstart)
- Alternative providers: [Plaid](https://plaid.com/docs/), [Yapily](https://docs.yapily.com/)

## 📧 Support

If you encounter any issues or have questions:
- Open an [issue](https://github.com/KaizokuDigital/NamiVolt/issues)
- Check existing issues for solutions

---

<div align="center">

**Made with ⚡ by [@KaizokuDigital](https://github.com/KaizokuDigital)**

*Keep your beli safe with NamiVolt!* 🏴‍☠️💰

</div>

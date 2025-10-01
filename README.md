# RealtimeV2 - Google Analytics Stream Deck Plugin

A lightweight, real-time Google Analytics 4 (GA4) Stream Deck plugin that displays live statistics with custom-rendered tiles showing percentage changes and visual indicators.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Stream Deck SDK](https://img.shields.io/badge/Stream%20Deck%20SDK-2.0-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey)

## 🎯 Features

- **Real-time Active Users** - Live count of users currently on your site
- **Daily Pageviews** - Total pageviews in the last 24 hours
- **Weekly Pageviews** - Total pageviews in the last 7 days
- **Percentage Change Tracking** - Visual indicators showing increases/decreases
- **Custom Canvas Rendering** - Beautiful SVG-based tiles with:
  - Title at top
  - Large metric value in center
  - Percentage change with color-coded arrows at bottom
- **Auto-refresh** - Configurable polling interval (default: 10 seconds)
- **Debug Logging** - Comprehensive logging for troubleshooting

## 📸 Preview

Each tile displays:
```
┌─────────────────────┐
│   Active Users      │
│                     │
│        42           │
│                     │
│  ↑ +15.2%          │
└─────────────────────┘
```

- 🟢 **Green up arrow (▲)** - Metric increased
- 🔴 **Red down arrow (▼)** - Metric decreased
- **No arrow** - No change

## 🚀 Quick Start

### Prerequisites

- **Windows 11** or **macOS 12+**
- **Node.js 20.x** (required by Stream Deck SDK)
- **pnpm** package manager
- **Stream Deck Software** version 6.5 or higher
- **Google Cloud Project** with Analytics Data API enabled
- **GA4 Property** with service account access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/RealtimeV2.git
   cd RealtimeV2
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Google Analytics**
   
   Create `service-account.json` in the project root with your Google service account credentials:
   ```json
   {
     "type": "service_account",
     "project_id": "your-project-id",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "your-service-account@project.iam.gserviceaccount.com",
     ...
   }
   ```

4. **Configure the plugin**
   
   Create or update `config.json`:
   ```json
   {
     "gaPropertyId": "123456789",
     "pollIntervalMs": 10000,
     "logLevel": "debug"
   }
   ```

5. **Build the plugin**
   ```bash
   pnpm run build
   ```

6. **Install to Stream Deck**
   ```bash
   streamdeck link
   ```

## ⚙️ Configuration

### config.json

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `gaPropertyId` | string | (required) | Your GA4 property ID (numbers only) |
| `pollIntervalMs` | number | 10000 | Polling interval in milliseconds (min: 5000) |
| `logLevel` | string | "info" | Log level: trace, debug, info, warn, error |

### Google Analytics Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing

2. **Enable Analytics Data API**
   - Navigate to APIs & Services > Library
   - Search for "Google Analytics Data API"
   - Click "Enable"

3. **Create Service Account**
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key file
   - Save as `service-account.json` in project root

4. **Grant GA4 Access**
   - Open GA4 Admin
   - Go to Property Access Management
   - Add service account email as **Viewer**

## 🎨 Customization

### Color Themes

Edit `src/utils/canvas-renderer.ts` to customize colors:

```typescript
export const themes = {
  dark: {
    background: "#1a1a2e",
    text: "#ffffff",
    positive: "#16c784",  // Green for increases
    negative: "#ea3943",  // Red for decreases
  },
  blue: {
    background: "#0f3460",
    text: "#ffffff",
    positive: "#16c784",
    negative: "#ea3943",
  },
  modern: {
    background: "#2d3436",
    text: "#dfe6e9",
    positive: "#00b894",
    negative: "#d63031",
  },
};
```

### Action Themes

Current theme assignments:
- **Active Users**: Dark theme (`#1a1a2e`)
- **Daily Pageviews**: Blue theme (`#0f3460`)
- **Weekly Pageviews**: Modern theme (`#2d3436`)

## 📊 How It Works

1. **Authentication**: Plugin authenticates with Google Analytics using service account
2. **Data Fetching**: Polls GA4 API at configured intervals
3. **Change Tracking**: Compares current metrics with previous poll
4. **Rendering**: Generates custom SVG tiles with percentage changes
5. **Display**: Updates Stream Deck keys with rendered images

### Percentage Change Calculation

```
change = ((current - previous) / previous) × 100
```

First poll shows `0%` change (no previous value to compare).

## 🛠️ Development

### Project Structure

```
RealtimeV2/
├── src/
│   ├── actions/
│   │   ├── active-users.ts       # Real-time active users action
│   │   ├── daily-pageviews.ts    # Daily pageviews action
│   │   └── weekly-pageviews.ts   # Weekly pageviews action
│   ├── services/
│   │   ├── analytics.ts          # GA4 API client
│   │   └── config.ts             # Configuration loader
│   ├── utils/
│   │   ├── logger.ts             # Logging utility
│   │   └── canvas-renderer.ts    # SVG tile renderer
│   └── plugin.ts                 # Main entry point
├── com.samal.test.sdPlugin/
│   ├── bin/
│   │   └── plugin.js             # Compiled output
│   ├── imgs/                     # Action icons
│   ├── logs/                     # Runtime logs
│   └── manifest.json             # Plugin manifest
├── config.json                   # Configuration
├── service-account.json          # Google credentials (gitignored)
├── package.json
├── tsconfig.json
└── rollup.config.mjs
```

### Build Commands

```bash
# Build once
pnpm run build

# Watch mode (auto-rebuild and restart)
pnpm run watch

# Restart plugin
streamdeck restart com.samal.test

# Package for distribution
streamdeck pack com.samal.test.sdPlugin
```

### Viewing Logs

**Windows:**
```powershell
Get-Content "com.samal.test.sdPlugin\logs\com.samal.test.0.log" -Wait -Tail 50
```

**macOS/Linux:**
```bash
tail -f com.samal.test.sdPlugin/logs/com.samal.test.0.log
```

## 🐛 Troubleshooting

### "Error" Displayed on Key

**Possible causes:**
1. Invalid `service-account.json`
2. Service account lacks GA4 access
3. Analytics Data API not enabled
4. Wrong property ID in `config.json`

**Solution:**
- Check logs for detailed error messages
- Verify service account has Viewer permissions
- Ensure property ID is correct (numbers only)

### "Loading..." Never Changes

**Possible causes:**
1. Network connectivity issues
2. Firewall blocking Google API requests
3. First API call taking longer than expected

**Solution:**
- Wait 10-15 seconds
- Check logs for "Fetching..." messages
- Press key for manual refresh

### Numbers Not Updating

**Possible causes:**
1. Polling stopped due to error
2. All action instances removed from Stream Deck

**Solution:**
- Check logs for "Starting [Action] polling" messages
- Remove and re-add actions to Stream Deck
- Restart plugin: `streamdeck restart com.samal.test`

## 🔒 Security

- ⚠️ **Never commit** `service-account.json` to version control
- ⚠️ Service account should have **Viewer** permissions only
- ⚠️ Store credentials securely
- ✅ Add to `.gitignore`:
  ```
  service-account.json
  config.json
  node_modules/
  ```

## 📝 API Quotas

Google Analytics Data API has rate limits:
- **Default polling (10s)**: ~8,640 requests/day
- **Free tier limit**: 25,000 requests/day
- Adjust `pollIntervalMs` if needed to stay within limits

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Elgato Stream Deck SDK](https://docs.elgato.com/sdk)
- Uses [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- Inspired by the need for real-time analytics visibility

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/RealtimeV2/issues)
- **Documentation**: [Project-scope.md](Project-scope.md)
- **Stream Deck SDK**: [Elgato Documentation](https://docs.elgato.com/sdk)

## 🗺️ Roadmap

- [ ] Multi-property support
- [ ] Custom date range selection
- [ ] Additional metrics (bounce rate, session duration)
- [ ] Alert thresholds
- [ ] Historical trend graphs
- [ ] Export to CSV/JSON

---

**Made with ❤️ for Stream Deck enthusiasts**


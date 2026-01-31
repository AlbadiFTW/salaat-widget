# Salaat Widget 🕌

A beautiful, compact Islamic prayer times widget for Windows - inspired by Awqat Salaat WinUI.

## ✨ Features

### Compact Mode (Taskbar Style)
- Shows current/next prayer with countdown
- Amber highlighting when prayer time has entered
- Click to expand for full view
- Drag to position anywhere on screen

### Expanded Mode
- All 6 prayer times with visual states
- Live countdown to next prayer
- Hijri date display
- Elapsed time tracking with dismiss button
- Full settings panel

### Prayer States (Visual Indicators)
| State | Color | Icon | Description |
|-------|-------|------|-------------|
| Future | Default | - | Prayer hasn't started |
| Near | Blue | ⏰ | Within reminder time |
| Entered | Amber | ⚠️ | Prayer time started, showing elapsed |
| Elapsed | Gray | → | Past elapsed threshold |
| Passed | Dim | ✓ | Prayer time over |

### Notifications
1. **Pre-Prayer Reminder** - X minutes before (default: 10 min), with optional sound (Chime, Bell, Beep, or custom)
2. **Adhan Alert** - At prayer time
3. **Elapsed Reminder** - X minutes after prayer (default: 30 min), with optional sound (Chime, Bell, Beep, or custom)

### Reminder & Elapsed Sounds
- **3 built-in options**: Chime, Bell, Beep
- **Custom audio** - Use your own MP3/WAV file for each
- **Separate controls** - Choose different sounds for pre-prayer reminder vs. elapsed reminder, or set either to None

### Adhan Sounds
- **11 built-in options**: Makkah, Madina, Al-Aqsa, Egypt, Short, Modern 1, Modern 2, Turkish, Morocco, Malaysia, Saudi
- **Custom audio** - Use your own MP3 file
- **Stop adhan** - Stop button appears on the compact bar when adhan is playing; also available via tray menu (Right-click → Stop Adhan)

### Other Features
- 🎨 8 accent colors
- 📍 Any location worldwide  
- ⚙️ 10 calculation methods (Dubai, Makkah, MWL, etc.)
- 📌 Snap to taskbar & always on top
- 🌐 Arabic interface option
- 🪟 Transparency slider (compact bar)
- 💾 Persistent settings
- 🔄 System tray integration

## 🚀 Installation

### Run from Source
```bash
# Prerequisites: Node.js 18+

npm install
npm start
```

### Build for Windows

| Command | Output |
|--------|--------|
| `npm run build` | Both portable and installer |
| `npm run build:win` | Same as `build` |
| `npm run build:portable` | `dist/Salaat Widget 1.2.0.exe` (single EXE, no install) |
| `npm run build:installer` | `dist/Salaat Widget Setup 1.2.0.exe` (NSIS installer) |

All artifacts go to the `dist/` folder.

```bash
npm install
npm run build
```

## 📖 Usage

1. **Compact Mode**: Small bar showing prayer name + countdown
   - Drag to position anywhere
   - Click to expand

2. **Expanded Mode**: Full prayer times list
   - Click ▼ or footer button to collapse
   - Click ⚙️ for settings
   - Click ✕ to hide (runs in tray)

3. **System Tray**:
   - Click tray icon to show/hide
   - Right-click for menu (Show/Hide, Stop Adhan, Always on Top, Snap to Corner, Quit)

### Known issue: widget sometimes gets stuck

On some occasions the widget may become unresponsive (cannot click or drag), especially when snapped to the taskbar. To fix it:

- **Double‑click** the icon in the Windows **hidden icons** tray (▼ arrow next to the clock), or  
- **Close** the app from the tray (right‑click → Quit) and **reopen** it.

## ⚙️ Settings

### Location
- City, Country
- Latitude/Longitude  
- Timezone (e.g., Asia/Dubai)

### Calculation Methods
- Muslim World League
- ISNA
- Egyptian Authority
- Umm al-Qura (Makkah)
- University of Karachi
- Dubai (UAE)
- Kuwait, Qatar
- Singapore, Turkey

### Asr Juristic
- Standard (Shafi'i, Maliki, Hanbali)
- Hanafi

### Notifications
- Pre-prayer reminder (0-60 min before) + optional sound (Chime, Bell, Beep, custom, or none)
- Elapsed reminder (5-120 min after) + optional sound (Chime, Bell, Beep, custom, or none)
- Adhan sound (11 built-in + custom MP3)
- Stop adhan while playing

### Appearance
- 8 accent colors
- 12h/24h time format
- Show/hide seconds
- Arabic interface
- Transparency (compact bar, 0-100%)

## 📁 Project Structure

```
salaat-widget/
├── main.js          # Electron main process
├── index.html       # UI (HTML + CSS + JS)
├── package.json     # Dependencies & build config
├── icons/           # App icons
└── dist/            # Build output (after npm run build)
```

## 🛠️ Tech Stack

- Electron 33
- Vanilla JavaScript
- Native Windows notifications

---

**Made with ❤️ for the Muslim community**

حَافِظُوا عَلَى الصَّلَوَاتِ

# 📝 Sticky Todo Web Extension

<div align="center">
  
  ![Sticky Todo](icons/icon128.png)
  
  **Your browser's lightweight, persistent task management companion**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Mahdirni/Todo-Web-Extention/pulls)
  
</div>

## ✨ Features

- 📌 **Always-on-top** todo list widget that stays with you while browsing
- 🔄 **Site-specific task management** - different tasks for different domains
- 🔴 **Visual indicators** for pending tasks with notification dots
- 🔍 **Minimizable interface** - collapses to a tiny floating dot when not in use
- 🖱️ **Drag & drop positioning** - place it anywhere on your screen
- 🎨 **Modern, clean UI** with smooth animations and transitions
- 💾 **Persistent storage** - your tasks and preferences are saved between sessions
- 🔄 **Synchronization** across your browser sessions
- ⚡ **Lightweight** with minimal resource usage

## 🚀 Installation

### Method 1: Manual Installation
1. Download or clone this repository
   ```bash
   git clone https://github.com/Mahdirni/Todo-Web-Extention.git
   ```
2. Open your browser and navigate to the extensions page:
   - Edge: `edge://extensions/`
   - Chrome: `chrome://extensions/`
   - Firefox: `about:addons`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the downloaded extension folder

### Method 2: From Browser Store
*Coming soon!*

## 🔧 How to Use

1. **Activate** - Click the extension icon in your toolbar to show/hide the todo widget
2. **Position** - Drag the widget header to move it anywhere on your screen
3. **Minimize** - Click the minimize button (`−`) to collapse into a small floating dot
4. **Expand** - Click the dot to restore the widget to full size
5. **Add Tasks** - Type in the input field and press Enter or click the + button
6. **Complete Tasks** - Click the checkboxes to mark tasks as complete
7. **Remove Tasks** - Click the × button next to tasks to delete them
8. **Hide** - Click the close button (×) or click the extension icon again

## 💻 Technical Details

- Built with pure JavaScript, HTML, and CSS - no frameworks or dependencies
- Uses content scripts to inject the widget into web pages
- Local storage via `chrome.storage.local` for task persistence
- Custom animations for a smooth, responsive experience
- SVG icons for crisp visuals at any scale

## 🛠️ Development

Want to contribute? Great!

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit your changes:
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. Push to the branch:
   ```bash
   git push origin feature/amazing-feature
   ```
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- Custom SVG icons created in-house
- Inspired by modern productivity applications
- Thanks to all contributors who have helped shape this project

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/Mahdirnj">Mahdirnj</a>
</div>

## 📷 Preview

A few screenshots showing the extension in action. Click any image to view full-size on GitHub.

<div align="center">
   <a href="./Screenshot 2025-09-16 122913.png"><img src="./Screenshot 2025-09-16 122913.png" alt="Screenshot - main view" width="320" style="margin:6px;"/></a>
   <a href="./Screenshot 2025-09-16 123020.png"><img src="./Screenshot 2025-09-16 123020.png" alt="Screenshot - minimized dot" width="320" style="margin:6px;"/></a>
   <a href="./Screenshot 2025-09-16 123039.png"><img src="./Screenshot 2025-09-16 123039.png" alt="Screenshot - add task" width="320" style="margin:6px;"/></a>
   <a href="./Screenshot 2025-09-16 123053.png"><img src="./Screenshot 2025-09-16 123053.png" alt="Screenshot - settings" width="320" style="margin:6px;"/></a>
</div>

---

If images do not show on GitHub, ensure these files are committed and pushed to the repository root. Filenames contain spaces — GitHub will render them correctly but you can rename them (e.g. `screenshot1.png`) if you prefer cleaner URLs.

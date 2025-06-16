# Sticky Todo Browser Extension

A modern browser extension that provides a sticky todo list that stays on top of your browser window.

## Features

- Always-on-top todo list widget
- Minimizes to a small dot when not in use
- Red notification dot for incomplete tasks
- Drag and drop positioning
- Modern, clean UI with smooth animations
- Add, complete, and delete tasks
- Persists tasks and position between sessions

## Installation

1. Download or clone this repository
2. Open Edge browser and navigate to `edge://extensions/`
3. Enable "Developer mode" at the bottom-left corner
4. Click "Load unpacked" and select the downloaded extension folder

## How to Use

1. Click the extension icon in your toolbar to show/hide the todo widget
2. Drag the widget header to position it anywhere on your screen
3. Click the minimize button (`−`) to collapse into a small floating dot
4. Click the dot to expand the widget back to full size
5. Add new tasks by typing in the input field and pressing Enter or clicking the + button
6. Click the checkboxes to mark tasks as complete
7. Click the × button next to tasks to delete them
8. Hide the widget by clicking the close button (×) or by clicking the extension icon

## Technical Details

- Uses content scripts to inject the widget into all web pages
- Stores todos and preferences in `chrome.storage.local`
- Custom CSS animations make interactions smooth and engaging

## Credits

- Icons created using custom SVG
- Inspired by modern productivity apps
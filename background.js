// Initialize default settings when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  chrome.storage.local.set({
    isVisible: true,
    isMinimized: false,
    position: { x: 20, y: 20 },
    todos: [
      { id: 1, text: "Welcome to Sticky Todo!", completed: false },
      { id: 2, text: "Add your tasks here", completed: false },
      { id: 3, text: "Click to mark as completed", completed: true }
    ]
  });
});

// Handle browser action click - toggle visibility
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(['isVisible'], (result) => {
    const newVisibility = !result.isVisible;
    chrome.storage.local.set({ isVisible: newVisibility });
    
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { 
      action: "visibilityChanged", 
      isVisible: newVisibility 
    }).catch(() => {
      // Tab might not have content script loaded
    });
  });
});

// Listen for storage changes and broadcast to all tabs if needed
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.isVisible) {
    // Broadcast visibility changes to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: "visibilityChanged", 
          isVisible: changes.isVisible.newValue 
        }).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      });
    });
  }
});
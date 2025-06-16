// Initialize default settings when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("Todo Extension installed/updated");
  // Set default settings
  chrome.storage.local.set({
    isVisible: true,
    isMinimized: false,
    position: { x: 20, y: 20 },
    todos: [
      { id: 1, text: "Welcome to Sticky Todo!", completed: false },
      { id: 2, text: "Add your tasks here", completed: false },
      { id: 3, text: "Click to mark as completed", completed: true }
    ],
    timestamp: Date.now() // Add initial timestamp for sync
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error initializing storage:', chrome.runtime.lastError);
    } else {
      console.log('Storage initialized successfully');
    }
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
      console.log('Could not send visibility message to tab', tab.id);
    });
  });
});

// Listen for storage changes and broadcast to all tabs if needed
chrome.storage.onChanged.addListener((changes, namespace) => {
  console.log('Background detected storage changes:', namespace, changes);
  
  if (namespace === 'local') {
    // Broadcast visibility changes to all tabs
    if (changes.isVisible) {
      broadcastToAllTabs({
        action: "visibilityChanged", 
        isVisible: changes.isVisible.newValue
      });
    }
    
    // Broadcast todos changes to help with synchronization
    if (changes.todos) {
      console.log('Background detected todos changes, broadcasting sync notification');
      broadcastToAllTabs({
        action: "todosChanged",
        timestamp: changes.timestamp ? changes.timestamp.newValue : Date.now()
      });
    }
  }
});

// Helper function to broadcast messages to all tabs
function broadcastToAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      try {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      } catch (error) {
        // Ignore errors for restricted tabs
      }
    }
  });
}
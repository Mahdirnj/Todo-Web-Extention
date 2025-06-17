// Initialize default settings when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("Todo Extension installed/updated");
  // Set default settings
  chrome.storage.local.set({
    isVisible: true,
    isMinimized: false,
    syncStateAcrossTabs: true, // Enable widget state sync by default
    hideInFullscreen: true, // Enable auto-hide in fullscreen by default
    enableTransparency: true, // Enable transparency by default
    disableAnimations: false, // Don't disable animations by default
    darkMode: false, // Light mode by default
    siteSpecificEnabled: false,
    siteUrls: [],
    siteTodos: {},
    lastTaskMode: 'global',
    minimizedStateTimestamp: Date.now(),
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
    
    // Broadcast minimized state changes
    if (changes.isMinimized && changes.minimizedStateTimestamp) {
      broadcastToAllTabs({
        action: "minimizedStateChanged",
        isMinimized: changes.isMinimized.newValue,
        timestamp: changes.minimizedStateTimestamp.newValue
      });
    }
    
    // Broadcast global todos changes to help with synchronization
    if (changes.todos) {
      console.log('Background detected todos changes, broadcasting sync notification');
      broadcastToAllTabs({
        action: "todosChanged",
        timestamp: changes.timestamp ? changes.timestamp.newValue : Date.now()
      });
    }
    
    // Broadcast site-specific todos changes
    if (changes.siteTodos) {
      console.log('Background detected site todos changes, broadcasting sync notification');
      broadcastToAllTabs({
        action: "todosChanged",
        timestamp: changes.timestamp ? changes.timestamp.newValue : Date.now(),
        isSiteTodos: true
      });
    }
    
    // Broadcast hideInFullscreen setting changes
    if (changes.hideInFullscreen) {
      broadcastToAllTabs({
        action: "settingChanged",
        setting: "hideInFullscreen",
        value: changes.hideInFullscreen.newValue
      });
    }
    
    // Broadcast syncStateAcrossTabs setting changes
    if (changes.syncStateAcrossTabs) {
      broadcastToAllTabs({
        action: "settingChanged",
        setting: "syncStateAcrossTabs",
        value: changes.syncStateAcrossTabs.newValue
      });
    }
    
    // Broadcast dark mode setting changes
    if (changes.darkMode) {
      broadcastToAllTabs({
        action: "settingChanged",
        setting: "darkMode",
        value: changes.darkMode.newValue
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

// Set up error handling system
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "reportError") {
    console.error('Error from content script:', message.error);
    sendResponse({status: "Error logged"});
    return true;
  }
  
  // Handle graceful recovery from invalid extension context
  if (message.action === "checkAlive" || message.action === "ping") {
    sendResponse({status: "ok"});
    return true;
  }
  
  return false;
});

// Capture and log uncaught errors
function handleError(error) {
  console.error('Background script error:', error);
  // Could implement additional error reporting here
}

// Set up global error handling
self.onerror = handleError;
self.onunhandledrejection = function(event) {
  handleError(event.reason);
};

// Handle extension context invalidation
chrome.runtime.onSuspend.addListener(function() {
  console.log('Extension being suspended, cleaning up...');
  // Perform any cleanup needed
});

// Keep service worker alive for proper functioning
function keepAlive() {
  // Send a heartbeat to keep the service worker alive
  setTimeout(keepAlive, 25 * 1000); // 25 seconds
}

keepAlive();
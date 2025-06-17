// Create and inject the Todo widget
let todoWidget = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let todos = [];
let isMinimized = false;
let isVisible = true;
let lastUpdateTimestamp = Date.now(); // Track when tasks were last updated
let currentSiteMode = 'global'; // 'global' or domain-specific (e.g., 'youtube.com')
let siteTodos = {}; // Object to store site-specific todos
let isInFullscreen = false; // Track fullscreen state
let wasVisibleBeforeFullscreen = true; // Store visibility state before fullscreen

// Recovery mechanism for extension context invalidation
let recoveryAttempts = 0;
const MAX_RECOVERY_ATTEMPTS = 3;
let contextCheckInProgress = false;
let lastContextCheckTime = 0;

// Add these variables at the top of your file, near other global variables
let extensionContextValid = true;
let localStorageBackup = {};
let pendingOperations = [];
let reconnectionInterval = null;
let usingLocalMode = false;
let localModeInitialized = false;
let lastLocalSave = 0;
const LOCAL_SAVE_DEBOUNCE = 1000; // 1 second

// Add these variables at the top with other global variables
let inactivityTimer = null;
let lastInteractionTime = Date.now();
let transparencyEnabled = true;
let animationsDisabled = false;

// This function checks if the extension context is valid and sets up reconnection if needed
function ensureValidContext() {
  // If we're already in local mode, don't bother checking
  if (usingLocalMode) return false;
  
  // Check if chrome and chrome.runtime exist
  if (!window.chrome || !chrome.runtime) {
    console.warn('Chrome runtime not available');
    switchToLocalMode();
    return false;
  }
  
  // Additional check for extension availability
  try {
    // This will throw if context is invalid
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    console.warn('Extension context check failed:', e);
    switchToLocalMode();
    return false;
  }
}

// Switch to local mode when extension context is invalid
function switchToLocalMode() {
  if (usingLocalMode) return; // Already in local mode
  
  console.log('Switching to local backup mode due to invalid extension context');
  usingLocalMode = true;
  extensionContextValid = false;
  
  // Initialize local storage if not already done
  initializeLocalStorage();
  
  // Show a notification in the widget if it exists
  showLocalModeNotification();
  
  // Set up automatic reconnection attempts
  if (!reconnectionInterval) {
    reconnectionInterval = setInterval(attemptReconnection, 30000); // Try every 30 seconds
  }
}

// Show notification that we're in local mode
function showLocalModeNotification() {
  if (!todoWidget) return;
  
  // Remove any existing notifications first
  const existingNotification = todoWidget.querySelector('.sticky-todo-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = 'sticky-todo-notification';
  notification.innerHTML = `
    <div style="padding: 8px; background-color: #fff3cd; color: #856404; border-radius: 4px; margin-bottom: 8px; font-size: 12px; text-align: center;">
      Extension connection lost. Using local mode. 
      <button id="todo-reconnect-btn" style="background: #856404; color: white; border: none; border-radius: 3px; padding: 2px 8px; margin-left: 5px; cursor: pointer;">
        Reconnect
      </button>
    </div>
  `;
  
  // Insert at the top of the widget
  const firstChild = todoWidget.firstChild;
  if (firstChild) {
    todoWidget.insertBefore(notification, firstChild);
  } else {
    todoWidget.appendChild(notification);
  }
  
  // Add reconnect button functionality
  const reconnectBtn = document.getElementById('todo-reconnect-btn');
  if (reconnectBtn) {
    reconnectBtn.addEventListener('click', attemptReconnection);
  }
}

// Attempt to reconnect to the extension
function attemptReconnection() {
  if (!usingLocalMode) return; // No need to reconnect if we're not in local mode
  
  console.log('Attempting to reconnect to extension...');
  
  try {
    // Try to access chrome.runtime to check if context is restored
    if (window.chrome && chrome.runtime) {
      // Test with getURL first as it's synchronous
      try {
        chrome.runtime.getURL('');
        
        // If that worked, try a message
        chrome.runtime.sendMessage({action: "ping"}, response => {
          // Check for errors after sending
          if (chrome.runtime.lastError) {
            console.log('Reconnection failed:', chrome.runtime.lastError);
            return;
          }
          
          if (response && response.status === 'ok') {
            console.log('Successfully reconnected to extension!');
            restoreExtensionFunctionality();
          } else {
            console.log('Reconnection failed: Invalid response');
          }
        });
      } catch (e) {
        console.log('Reconnection test failed:', e);
      }
    }
  } catch (e) {
    console.log('Reconnection attempt failed:', e);
  }
}

// Restore extension functionality after reconnection
function restoreExtensionFunctionality() {
  usingLocalMode = false;
  extensionContextValid = true;
  
  // Remove notification if it exists
  const notification = todoWidget?.querySelector('.sticky-todo-notification');
  if (notification) {
    notification.remove();
  }
  
  // Clear reconnection interval
  if (reconnectionInterval) {
    clearInterval(reconnectionInterval);
    reconnectionInterval = null;
  }
  
  // Process any pending operations
  processPendingOperations();
  
  // Sync local changes back to chrome storage
  syncLocalChangesToChromeStorage();
  
  console.log('Extension functionality restored');
}

// Sync local changes back to Chrome storage
function syncLocalChangesToChromeStorage() {
  if (!extensionContextValid || usingLocalMode) return;
  
  console.log('Syncing local changes to Chrome storage');
  
  try {
    // Get all keys that we've modified locally
    const keys = Object.keys(localStorageBackup);
    
    // Batch updates to reduce Chrome API calls
    const updateBatch = {};
    keys.forEach(key => {
      updateBatch[key] = localStorageBackup[key];
    });
    
    // Only update if we have data
    if (Object.keys(updateBatch).length > 0) {
      chrome.storage.local.set(updateBatch, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to sync local changes:', chrome.runtime.lastError);
          switchToLocalMode();
        } else {
          console.log('Successfully synced local changes to Chrome storage');
        }
      });
    }
  } catch (e) {
    console.error('Error syncing to Chrome storage:', e);
    switchToLocalMode();
  }
}

// Process any operations that were queued during disconnection
function processPendingOperations() {
  if (pendingOperations.length === 0) return;
  
  console.log(`Processing ${pendingOperations.length} pending operations`);
  
  // Process each operation
  const operationsToProcess = [...pendingOperations];
  pendingOperations = [];
  
  operationsToProcess.forEach(operation => {
    try {
      if (operation.type === 'set') {
        tryChromeStorageSet(operation.data);
      }
    } catch (e) {
      console.error('Error processing pending operation:', e);
    }
  });
}

// Try to use Chrome storage, fall back to local if needed
function tryChromeStorageGet(keys, callback) {
  if (usingLocalMode) {
    // Use local backup data instead
    const result = {};
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        result[key] = localStorageBackup[key];
      });
    } else if (typeof keys === 'object') {
      Object.keys(keys).forEach(key => {
        result[key] = localStorageBackup[key] !== undefined ? localStorageBackup[key] : keys[key];
      });
    } else if (typeof keys === 'string') {
      result[keys] = localStorageBackup[keys];
    }
    
    setTimeout(() => {
      if (callback && typeof callback === 'function') {
        callback(result);
      }
    }, 0);
    return;
  }
  
  try {
    chrome.storage.local.get(keys, result => {
      if (chrome.runtime.lastError) {
        console.error('Chrome storage error:', chrome.runtime.lastError);
        switchToLocalMode();
        
        // Fall back to local data
        tryChromeStorageGet(keys, callback);
        return;
      }
      
      // Update our local backup
      Object.keys(result).forEach(key => {
        localStorageBackup[key] = result[key];
      });
      
      if (callback && typeof callback === 'function') {
        callback(result);
      }
    });
  } catch (e) {
    console.error('Error accessing Chrome storage:', e);
    switchToLocalMode();
    
    // Fall back to local data
    tryChromeStorageGet(keys, callback);
  }
}

// Try to use Chrome storage, fall back to local if needed
function tryChromeStorageSet(data, callback) {
  // Always update local backup immediately
  Object.keys(data).forEach(key => {
    localStorageBackup[key] = data[key];
  });
  
  // Save to localStorage if in local mode
  if (usingLocalMode) {
    saveToLocalStorage();
    
    // Queue for later sync
    pendingOperations.push({
      type: 'set',
      data: data
    });
    
    setTimeout(() => {
      if (callback && typeof callback === 'function') {
        callback();
      }
    }, 0);
    return;
  }
  
  try {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) {
        console.error('Chrome storage error:', chrome.runtime.lastError);
        switchToLocalMode();
        
        // Already updated local backup and will be queued for later
        if (callback && typeof callback === 'function') {
          callback();
        }
        return;
      }
      
      if (callback && typeof callback === 'function') {
        callback();
      }
    });
  } catch (e) {
    console.error('Error writing to Chrome storage:', e);
    switchToLocalMode();
    
    // Already updated local backup and will be queued for later
    if (callback && typeof callback === 'function') {
      callback();
    }
  }
}

// Replace the existing safeStorageGet and safeStorageSet with our new functions
function safeStorageGet(keys, callback) {
  tryChromeStorageGet(keys, callback);
}

function safeStorageSet(data, callback) {
  tryChromeStorageSet(data, callback);
}

// Check extension context - simplified version
function checkExtensionContext() {
  // Don't do anything if we're already in local mode
  if (usingLocalMode) return false;
  
  try {
    // Try to access a chrome.runtime method that will throw if context is invalid
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    console.warn('Extension context check failed:', e);
    switchToLocalMode();
    return false;
  }
}

// Handle context invalidation - simplified to use our new approach
function handleContextInvalidation() {
  switchToLocalMode();
}

// Handle invalid context - simplified to use our new approach
function handleInvalidContext() {
  switchToLocalMode();
}

// Initialize local storage from browser's localStorage if available
function initializeLocalStorage() {
  if (localModeInitialized) return;
  
  try {
    // Try to load data from browser's localStorage
    const localData = window.localStorage.getItem('todo-extension-backup');
    if (localData) {
      try {
        const parsedData = JSON.parse(localData);
        localStorageBackup = parsedData;
        console.log('Loaded data from localStorage backup:', parsedData);
      } catch (e) {
        console.error('Failed to parse localStorage backup:', e);
      }
    }
    
    // Set up periodic save to localStorage
    setInterval(() => {
      if (usingLocalMode) {
        saveToLocalStorage();
      }
    }, 30000); // Every 30 seconds
    
    localModeInitialized = true;
  } catch (e) {
    console.error('Failed to initialize localStorage backup:', e);
  }
}

// Save current state to localStorage
function saveToLocalStorage() {
  const now = Date.now();
  // Debounce saves to avoid excessive writes
  if (now - lastLocalSave < LOCAL_SAVE_DEBOUNCE) return;
  
  lastLocalSave = now;
  try {
    window.localStorage.setItem('todo-extension-backup', JSON.stringify(localStorageBackup));
    console.log('Saved to localStorage backup');
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// Function to extract domain from current URL
function getCurrentDomain() {
  const url = window.location.href;
  try {
    // Extract domain without protocol and www
    let domain = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i)[1];
    return domain.toLowerCase();
  } catch (error) {
    console.error('Error extracting domain:', error);
    return null;
  }
}

// Function to check if current site matches any configured site-specific domains
function checkSiteSpecificMatch() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['siteSpecificEnabled', 'siteUrls'], (result) => {
      if (!result.siteSpecificEnabled || !result.siteUrls || !Array.isArray(result.siteUrls) || result.siteUrls.length === 0) {
        resolve(null);
        return;
      }
      
      const currentDomain = getCurrentDomain();
      console.log('Current domain:', currentDomain);
      
      if (!currentDomain) {
        resolve(null);
        return;
      }
      
      // Check if current domain matches or is a subdomain of any configured site
      for (const siteUrl of result.siteUrls) {
        if (siteUrl && (currentDomain === siteUrl || currentDomain.endsWith('.' + siteUrl) || currentDomain.includes(siteUrl))) {
          console.log('Matched site-specific domain:', siteUrl);
          resolve(siteUrl);
          return;
        }
      }
      
      resolve(null);
    });
  });
}

// Add fullscreen change detection
function setupFullscreenDetection() {
  // Listen for fullscreen changes
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  
  // Initial check
  checkFullscreenState();
}

// Handle fullscreen changes
function handleFullscreenChange() {
  checkFullscreenState();
}

// Check if in fullscreen mode and show/hide widget accordingly
function checkFullscreenState() {
  const wasInFullscreen = isInFullscreen;
  
  // Check if currently in fullscreen
  isInFullscreen = !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
  
  console.log('Fullscreen state changed:', isInFullscreen);
  
  // Only act if the widget exists and fullscreen state changed
  if (todoWidget && wasInFullscreen !== isInFullscreen) {
    try {
      chrome.storage.local.get(['hideInFullscreen'], (result) => {
        const shouldHideInFullscreen = result.hideInFullscreen !== false; // Default to true
        
        if (shouldHideInFullscreen) {
          if (isInFullscreen) {
            // Entering fullscreen, hide widget if setting is enabled
            wasVisibleBeforeFullscreen = !todoWidget.classList.contains('sticky-todo-hidden');
            if (wasVisibleBeforeFullscreen) {
              todoWidget.classList.add('sticky-todo-hidden');
              console.log('Widget hidden due to fullscreen');
            }
          } else {
            // Exiting fullscreen, restore previous visibility if it was visible
            if (wasVisibleBeforeFullscreen) {
              todoWidget.classList.remove('sticky-todo-hidden');
              console.log('Widget restored after fullscreen exit');
            }
          }
        }
      });
    } catch (error) {
      console.error('Error handling fullscreen state change:', error);
    }
  }
}

// Function to create the Todo widget
function createTodoWidget() {
  // Create main container
  todoWidget = document.createElement('div');
  todoWidget.id = 'sticky-todo-widget';
  todoWidget.className = 'sticky-todo-widget';
  
  // Force LTR direction
  todoWidget.dir = 'ltr';
  todoWidget.style.direction = 'ltr';
  todoWidget.style.textAlign = 'left';
  
  // Set explicit position to fixed 
  todoWidget.style.position = 'fixed';
  
  // Set initial position - default to upper left corner if no saved position
  todoWidget.style.left = '20px';
  todoWidget.style.top = '20px';
  
  // Create header with title and controls
  const header = document.createElement('div');
  header.className = 'sticky-todo-header';
  header.dir = 'ltr';
  
  // Create title with sync indicator
  const title = document.createElement('div');
  title.className = 'sticky-todo-title';
  title.textContent = 'Sticky Todo';
  title.dir = 'ltr';
  title.style.position = 'relative';
  
  // Create sync indicator
  const syncIndicator = document.createElement('div');
  syncIndicator.className = 'sticky-todo-sync-indicator';
  syncIndicator.title = 'Syncing tasks with other tabs';
  title.appendChild(syncIndicator);
  
  // Create controls container
  const controls = document.createElement('div');
  controls.className = 'sticky-todo-controls';
  
  // Create site indicator (if site-specific mode)
  const siteIndicator = document.createElement('div');
  siteIndicator.className = 'sticky-todo-site-indicator';
  siteIndicator.id = 'siteIndicator';
  siteIndicator.style.fontSize = '11px';
  siteIndicator.style.opacity = '0.8';
  siteIndicator.style.marginRight = 'auto';
  siteIndicator.style.marginLeft = '5px';
  
  // Reload button
  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'sticky-todo-btn sticky-todo-reload';
  reloadBtn.innerHTML = '<span>↻</span>';
  reloadBtn.title = 'Reload Tasks';
  reloadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    forceReloadTasks();
  });
  
  // Delete All button
  const deleteAllBtn = document.createElement('button');
  deleteAllBtn.className = 'sticky-todo-btn sticky-todo-delete-all';
  deleteAllBtn.innerHTML = '<span>🗑</span>';
  deleteAllBtn.title = 'Delete All Tasks';
  deleteAllBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteAllTodos();
  });
  
  // Minimize button
  const minimizeBtn = document.createElement('button');
  minimizeBtn.className = 'sticky-todo-btn sticky-todo-minimize';
  minimizeBtn.innerHTML = '<span>−</span>';
  minimizeBtn.title = 'Minimize';
  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMinimize();
  });
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'sticky-todo-btn sticky-todo-close';
  closeBtn.innerHTML = '<span>×</span>';
  closeBtn.title = 'Hide';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTodoWidget();
  });
  
  // Add buttons to controls
  controls.appendChild(siteIndicator);
  controls.appendChild(reloadBtn);
  controls.appendChild(deleteAllBtn);
  controls.appendChild(minimizeBtn);
  controls.appendChild(closeBtn);
  
  // Add title and controls to header
  header.appendChild(title);
  header.appendChild(controls);
  
  // Make header draggable in both minimized and expanded states
  header.addEventListener('mousedown', startDrag);
  
  // Create content container
  const content = document.createElement('div');
  content.className = 'sticky-todo-content';
  content.dir = 'ltr';
  
  // Create todo list
  const todoList = document.createElement('ul');
  todoList.className = 'sticky-todo-list';
  todoList.dir = 'ltr';
  content.appendChild(todoList);
  
  // Create mode switcher container
  const modeSwitcher = document.createElement('div');
  modeSwitcher.className = 'sticky-todo-mode-switcher';
  modeSwitcher.style.padding = '8px 12px';
  modeSwitcher.style.borderTop = '1px solid rgba(0, 0, 0, 0.05)';
  modeSwitcher.style.display = 'flex';
  modeSwitcher.style.justifyContent = 'center';
  
  // Create mode buttons
  const globalModeBtn = document.createElement('button');
  globalModeBtn.id = 'globalModeBtn';
  globalModeBtn.textContent = 'Global Tasks';
  globalModeBtn.style.padding = '4px 8px';
  globalModeBtn.style.margin = '0 5px';
  globalModeBtn.style.border = 'none';
  globalModeBtn.style.borderRadius = '4px';
  globalModeBtn.style.backgroundColor = '#7F53AC';
  globalModeBtn.style.color = 'white';
  globalModeBtn.style.fontSize = '12px';
  globalModeBtn.style.cursor = 'pointer';
  
  const siteModeBtn = document.createElement('button');
  siteModeBtn.id = 'siteModeBtn';
  siteModeBtn.textContent = 'Site Tasks';
  siteModeBtn.style.padding = '4px 8px';
  siteModeBtn.style.margin = '0 5px';
  siteModeBtn.style.border = 'none';
  siteModeBtn.style.borderRadius = '4px';
  siteModeBtn.style.backgroundColor = '#e0e0e0';
  siteModeBtn.style.color = '#333';
  siteModeBtn.style.fontSize = '12px';
  siteModeBtn.style.cursor = 'pointer';
  siteModeBtn.style.display = 'none'; // Hide by default, will show if site-specific tasks are enabled
  
  // Add event listeners to mode buttons
  globalModeBtn.addEventListener('click', () => switchTaskMode('global'));
  siteModeBtn.addEventListener('click', () => switchTaskMode(currentSiteMode));
  
  // Add buttons to mode switcher
  modeSwitcher.appendChild(globalModeBtn);
  modeSwitcher.appendChild(siteModeBtn);
  
  // Create input area
  const inputArea = document.createElement('div');
  inputArea.className = 'sticky-todo-input-area';
  inputArea.dir = 'ltr';
  
  const todoInput = document.createElement('input');
  todoInput.type = 'text';
  todoInput.className = 'sticky-todo-input';
  todoInput.placeholder = 'Add new task';
  todoInput.dir = 'ltr';
  
  const addButton = document.createElement('button');
  addButton.className = 'sticky-todo-add-btn';
  addButton.innerHTML = '<span>+</span>';
  addButton.addEventListener('click', () => addTodo(todoInput.value));
  
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTodo(todoInput.value);
    }
  });
  
  inputArea.appendChild(todoInput);
  inputArea.appendChild(addButton);
  
  // Assemble the widget
  todoWidget.appendChild(header);
  todoWidget.appendChild(content);
  todoWidget.appendChild(modeSwitcher);
  todoWidget.appendChild(inputArea);
  
  // Add a global click handler for the minimized circle
  todoWidget.addEventListener('click', handleWidgetClick);
  
  // Set initial state before adding to DOM to prevent flashing
  // Get stored position and state synchronously to prevent flickering
  let storedMinimizedState = false;
  try {
    // Check localStorage first as it's synchronous
    const storageKey = 'stickyTodoWidgetState';
    const storedData = localStorage.getItem(storageKey);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      if (parsedData && parsedData.isMinimized !== undefined) {
        storedMinimizedState = parsedData.isMinimized;
        isMinimized = storedMinimizedState;
        if (isMinimized) {
          todoWidget.classList.add('sticky-todo-minimized');
        }
      }
    }
  } catch (e) {
    console.error('Error reading from localStorage:', e);
  }
  
  // Add to body with correct initial state
  document.body.appendChild(todoWidget);
  
  // Get stored position and state
  chrome.storage.local.get(['position', 'isMinimized', 'isVisible', 'syncStateAcrossTabs'], (result) => {
    // Apply saved position if available, otherwise keep default
    if (result.position && typeof result.position === 'object') {
      // Ensure we have valid numbers
      if (typeof result.position.x === 'number' && !isNaN(result.position.x) &&
          typeof result.position.y === 'number' && !isNaN(result.position.y)) {
        todoWidget.style.left = `${result.position.x}px`;
        todoWidget.style.top = `${result.position.y}px`;
        
        // Force a reflow to ensure position is applied immediately
        void todoWidget.offsetWidth;
      }
    }
    
    isVisible = result.isVisible !== false; // Default to visible
    
    // Apply minimized state from chrome storage (this should match our localStorage check)
    isMinimized = result.isMinimized === true;
    if (isMinimized !== storedMinimizedState) {
      // Update our state if localStorage and chrome.storage differ
      if (isMinimized) {
        todoWidget.classList.add('sticky-todo-minimized');
      } else {
        todoWidget.classList.remove('sticky-todo-minimized');
      }
    }
    
    if (!isVisible) {
      todoWidget.classList.add('sticky-todo-hidden');
    }
    
    // Now that the widget is fully initialized, make it visible (prevent flash of expanded state)
    setTimeout(() => {
      todoWidget.style.opacity = '1';
    }, 0);
    
    // Apply minimized state
    const shouldSyncState = result.syncStateAcrossTabs !== false; // Default to true
    
    if (shouldSyncState && result.isMinimized !== undefined) {
      isMinimized = result.isMinimized;
    } else if (result.isMinimized) {
      isMinimized = true;
    }
    
    if (isMinimized) {
      todoWidget.classList.add('sticky-todo-minimized');
      updateMinimizedState();
    }
  });
  
  // Check for site-specific match and load appropriate todos
  checkForSiteSpecificMode().then(() => {
    // Load and render todos
    loadTodos();
  });
  
  // Setup fullscreen detection
  setupFullscreenDetection();
  
  // After creating the widget, setup transparency and animations modes
  setupTransparencyMode();
  setupAnimationsMode();
  setupSettingsListener();
}

// Check if current site should use site-specific mode
async function checkForSiteSpecificMode() {
  const matchedSite = await checkSiteSpecificMatch();
  
  if (matchedSite) {
    // Enable site-specific mode
    currentSiteMode = matchedSite;
    
    // Update the site indicator if widget exists
    if (todoWidget) {
      const siteIndicator = document.getElementById('siteIndicator');
      if (siteIndicator) {
        siteIndicator.textContent = matchedSite;
        siteIndicator.style.display = 'block';
      }
      
      // Show site mode button
      const siteModeBtn = document.getElementById('siteModeBtn');
      if (siteModeBtn) {
        siteModeBtn.textContent = `${matchedSite} Tasks`;
        siteModeBtn.style.display = 'block';
      }
    }
    
    // Check if we should switch to site mode by default
    chrome.storage.local.get(['lastTaskMode', 'siteTodos'], (result) => {
      if (result.lastTaskMode === 'site' && result.siteTodos && result.siteTodos[matchedSite]) {
        switchTaskMode(matchedSite);
      }
    });
    
    return true;
  } else {
    // Use global mode
    currentSiteMode = 'global';
    
    // Hide site mode button
    if (todoWidget) {
      const siteIndicator = document.getElementById('siteIndicator');
      if (siteIndicator) {
        siteIndicator.textContent = '';
        siteIndicator.style.display = 'none';
      }
      
      const siteModeBtn = document.getElementById('siteModeBtn');
      if (siteModeBtn) {
        siteModeBtn.style.display = 'none';
      }
    }
    
    return false;
  }
}

// Switch between global and site-specific task modes
function switchTaskMode(mode) {
  if (mode === 'global') {
    // Switch to global mode
    const globalBtn = document.getElementById('globalModeBtn');
    const siteBtn = document.getElementById('siteModeBtn');
    
    if (globalBtn) globalBtn.style.backgroundColor = '#7F53AC';
    if (globalBtn) globalBtn.style.color = 'white';
    if (siteBtn) siteBtn.style.backgroundColor = '#e0e0e0';
    if (siteBtn) siteBtn.style.color = '#333';
    
    // Save the last mode
    chrome.storage.local.set({ lastTaskMode: 'global' });
    
    // Load and render global todos
    loadTodos('global');
  } else if (mode !== 'global' && currentSiteMode === mode) {
    // Switch to site mode
    const globalBtn = document.getElementById('globalModeBtn');
    const siteBtn = document.getElementById('siteModeBtn');
    
    if (globalBtn) globalBtn.style.backgroundColor = '#e0e0e0';
    if (globalBtn) globalBtn.style.color = '#333';
    if (siteBtn) siteBtn.style.backgroundColor = '#7F53AC';
    if (siteBtn) siteBtn.style.color = 'white';
    
    // Save the last mode
    chrome.storage.local.set({ lastTaskMode: 'site' });
    
    // Load and render site-specific todos
    loadTodos(mode);
  }
}

// Handle click on the widget
function handleWidgetClick(e) {
  // Only handle clicks if minimized and not dragging
  if (isMinimized && !isDragging) {
    // Don't expand if clicking on a button
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return;
    }
    
    // If it's a click on the widget or header, expand
    expandTodoWidget();
  }
}

// Expand the todo widget from minimized state
function expandTodoWidget() {
  if (!isMinimized) return;
  
  isMinimized = false;
  
  // Add animation class for expanding
  todoWidget.classList.add('sticky-todo-expanding');
  todoWidget.classList.remove('sticky-todo-minimized');
  
  // Remove transparency classes
  todoWidget.classList.remove('transparency-enabled');
  todoWidget.classList.remove('inactive');
  
  // Remove transparency event listeners
  document.removeEventListener('mousemove', handleUserInteraction);
  
  // Clear any inactivity timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  
  setTimeout(() => {
    todoWidget.classList.remove('sticky-todo-expanding');
  }, 400); // Match animation duration from CSS (0.4s)
  
  // Update visual state
  updateMinimizedState();
  
  // Save state
  chrome.storage.local.set({ isMinimized: false });
}

// Start dragging the widget - works in both minimized and expanded states
function startDrag(e) {
  // Don't drag if clicking on buttons
  if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
  
  // Prevent expansion if widget is minimized and we're starting to drag
  if (isMinimized) {
    e.stopPropagation(); // Stop propagation to prevent expansion on click
  }
  
  isDragging = true;
  
  // Ensure widget has fixed position style
  todoWidget.style.position = 'fixed';
  
  // Calculate offset
  const rect = todoWidget.getBoundingClientRect();
  dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  // Temporarily disable transitions during drag for smoother movement
  todoWidget.style.transition = 'none';
  
  // Add event listeners for dragging in a safer way
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  
  // Prevent text selection during drag
  e.preventDefault();
  e.stopPropagation();
}

// Handle drag movement
function onDrag(e) {
  if (isDragging && todoWidget) {
    try {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep widget within viewport bounds with a small margin
      const margin = 10; // 10px margin from edges
      const maxX = window.innerWidth - todoWidget.offsetWidth - margin;
      const maxY = window.innerHeight - todoWidget.offsetHeight - margin;
      
      // Apply new position with Math.max to ensure we don't go off-screen
      todoWidget.style.left = `${Math.max(margin, Math.min(maxX, newX))}px`;
      todoWidget.style.top = `${Math.max(margin, Math.min(maxY, newY))}px`;
      
      // Ensure widget stays visible by enforcing minimum visible area
      if (parseFloat(todoWidget.style.left) < -todoWidget.offsetWidth * 0.7) {
        todoWidget.style.left = `${-todoWidget.offsetWidth * 0.7}px`;
      }
      
      if (parseFloat(todoWidget.style.top) < -todoWidget.offsetHeight * 0.7) {
        todoWidget.style.top = `${-todoWidget.offsetHeight * 0.7}px`;
      }
    } catch (error) {
      console.error('Error during drag:', error);
      stopDrag();
    }
  }
}

// Stop dragging
function stopDrag(e) {
  if (!isDragging) return;
  
  // Remove event listeners
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  
  // Re-enable transitions
  todoWidget.style.transition = '';
  
  // Save position - ensure we have valid integers
  const left = parseFloat(todoWidget.style.left);
  const top = parseFloat(todoWidget.style.top);
  
  const position = {
    x: isNaN(left) ? 20 : Math.round(left),
    y: isNaN(top) ? 20 : Math.round(top)
  };
  
  // Save position to storage
  chrome.storage.local.set({ position: position });
  
  // Add a small delay before resetting isDragging to prevent accidental expansion
  setTimeout(() => {
    isDragging = false;
  }, 100);
}

// Toggle between minimized and expanded states
function toggleMinimize() {
  isMinimized = !isMinimized;
  
  // Store current position before minimizing/expanding
  const currentLeft = todoWidget.style.left;
  const currentTop = todoWidget.style.top;
  
  if (isMinimized) {
    todoWidget.classList.add('sticky-todo-minimizing');
    todoWidget.classList.add('sticky-todo-minimized');
    
    // Handle transparency when minimizing
    if (transparencyEnabled) {
      todoWidget.classList.add('transparency-enabled');
      // Reset last interaction time
      lastInteractionTime = Date.now();
      // Remove inactive state initially
      todoWidget.classList.remove('inactive');
      // Start inactivity timer
      startInactivityTimer();
      // Add mouse movement listener for transparency
      document.addEventListener('mousemove', handleUserInteraction);
    }
    
    setTimeout(() => {
      todoWidget.classList.remove('sticky-todo-minimizing');
      // Setup transparency mode when minimized
      setupTransparencyMode();
      
      // Ensure position is preserved after animation
      if (currentLeft && currentTop) {
        todoWidget.style.left = currentLeft;
        todoWidget.style.top = currentTop;
      }
    }, 400); // Match animation duration from CSS (0.4s)
  } else {
    // When expanding, remove transparency classes
    todoWidget.classList.remove('transparency-enabled');
    todoWidget.classList.remove('inactive');
    
    // Remove transparency-related event listeners
    document.removeEventListener('mousemove', handleUserInteraction);
    
    // Clear inactivity timer
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
    
    // Add animation class for expanding
    todoWidget.classList.add('sticky-todo-expanding');
    todoWidget.classList.remove('sticky-todo-minimized');
    
    setTimeout(() => {
      todoWidget.classList.remove('sticky-todo-expanding');
      
      // Ensure position is preserved after animation
      if (currentLeft && currentTop) {
        todoWidget.style.left = currentLeft;
        todoWidget.style.top = currentTop;
      }
    }, 400); // Match animation duration from CSS (0.4s)
  }
  
  updateMinimizedState();
  
  // Check if we should sync minimized state across tabs
  safeStorageGet(['syncStateAcrossTabs'], (result) => {
    const shouldSyncState = result.syncStateAcrossTabs !== false; // Default to true
    
    if (shouldSyncState) {
      // Save minimized state to storage for syncing across tabs
      safeStorageSet({ 
        isMinimized: isMinimized,
        minimizedStateTimestamp: Date.now() 
      });
      
      // Also save to localStorage for immediate access on page load
      try {
        const storageKey = 'stickyTodoWidgetState';
        const stateData = JSON.stringify({
          isMinimized: isMinimized,
          timestamp: Date.now()
        });
        localStorage.setItem(storageKey, stateData);
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
      
      console.log('Widget minimized state synced across tabs:', isMinimized);
    }
  });
}

// Update the visual state of minimized widget
function updateMinimizedState() {
  if (isMinimized) {
    const hasIncompleteTasks = todos.some(todo => !todo.completed);
    if (hasIncompleteTasks && !animationsDisabled) {
      todoWidget.classList.add('has-incomplete');
    } else {
      todoWidget.classList.remove('has-incomplete');
    }
    
    // Add a pulsing animation to the circle when minimized (if animations are enabled)
    if (!animationsDisabled) {
      todoWidget.style.animation = 'pulseScale 2s infinite alternate';
    } else {
      todoWidget.style.animation = '';
    }
    
    // Make sure the minimized circle is fully clickable
    todoWidget.style.pointerEvents = 'all';
    const header = todoWidget.querySelector('.sticky-todo-header');
    if (header) {
      header.style.pointerEvents = 'all';
      header.style.cursor = 'pointer';
    }
  } else {
    todoWidget.style.animation = '';
  }
}

// Hide the todo widget
function hideTodoWidget() {
  if (!todoWidget) return;
  
  if (animationsDisabled) {
    // Hide immediately without animation
    todoWidget.classList.add('sticky-todo-hidden');
    isVisible = false;
    chrome.storage.local.set({ isVisible: false });
  } else {
    // Add hide animation class
    todoWidget.classList.add('sticky-todo-hiding');
    
    // After animation completes, hide the widget
    setTimeout(() => {
      todoWidget.classList.add('sticky-todo-hidden');
      todoWidget.classList.remove('sticky-todo-hiding');
      
      isVisible = false;
      
      // Update storage
      chrome.storage.local.set({ isVisible: false });
    }, 300);
  }
}

// Show the widget (unhide)
function showTodoWidget() {
  if (!todoWidget) {
    createTodoWidget();
    setupCrossBrowserSync(); // Set up sync when creating widget
  } else {
    if (animationsDisabled) {
      // Show immediately without animation
      todoWidget.classList.remove('sticky-todo-hidden');
    } else {
      todoWidget.classList.add('sticky-todo-showing');
      todoWidget.classList.remove('sticky-todo-hidden');
      setTimeout(() => {
        todoWidget.classList.remove('sticky-todo-showing');
      }, 300);
    }
  }
  
  // Load latest tasks when showing
  loadTodos();
  
  isVisible = true;
  chrome.storage.local.set({ isVisible: true });
}

// Add a new todo
function addTodo(text) {
  text = text.trim();
  if (!text) return;
  
  const input = document.querySelector('.sticky-todo-input');
  input.value = '';
  input.focus();
  
  const newTodo = {
    id: Date.now(),
    text: text,
    completed: false
  };
  
  todos.push(newTodo);
  saveTodos();
  renderTodos();
  
  // Animate the new todo item if animations are enabled
  if (!animationsDisabled) {
    setTimeout(() => {
      const items = document.querySelectorAll('.sticky-todo-item');
      if (items.length > 0) {
        const newItem = items[items.length - 1];
        newItem.classList.add('sticky-todo-item-new');
        setTimeout(() => {
          newItem.classList.remove('sticky-todo-item-new');
        }, 500);
      }
    }, 10);
  }
}

// Toggle a todo's completion status
function toggleTodoCompletion(id) {
  todos = todos.map(todo => {
    if (todo.id === id) {
      return { ...todo, completed: !todo.completed };
    }
    return todo;
  });
  
  // Save todos but don't re-render
  saveTodos();
  
  // Update minimized state if needed
  if (isMinimized) {
    updateMinimizedState();
  }
}

// Delete a todo
function deleteTodo(id) {
  const index = todos.findIndex(todo => todo.id === id);
  if (index !== -1) {
    if (animationsDisabled) {
      // Remove immediately without animation
      todos = todos.filter(todo => todo.id !== id);
      saveTodos();
      renderTodos();
      
      // Update minimized state if needed
      if (isMinimized) {
        updateMinimizedState();
      }
    } else {
      // Animate removal
      const items = document.querySelectorAll('.sticky-todo-item');
      if (items[index]) {
        items[index].classList.add('sticky-todo-item-removing');
        setTimeout(() => {
          // Remove from array after animation
          todos = todos.filter(todo => todo.id !== id);
          saveTodos();
          renderTodos();
          
          // Update minimized state if needed
          if (isMinimized) {
            updateMinimizedState();
          }
        }, 300);
      }
    }
  }
}

// Save todos to storage
function saveTodos() {
  try {
    // Update timestamp for sync
    const newTimestamp = Date.now();
    lastUpdateTimestamp = newTimestamp;
    
    if (currentSiteMode === 'global') {
      // Save global todos
      safeStorageSet({
        todos: todos,
        timestamp: newTimestamp
      }, () => {
        console.log('Global todos saved successfully');
      });
    } else {
      // Save site-specific todos
      safeStorageGet(['siteTodos'], (result) => {
        if (!result) {
          console.warn('Could not retrieve site todos for saving');
          return;
        }
        
        const allSiteTodos = result.siteTodos || {};
        allSiteTodos[currentSiteMode] = todos;
        
        safeStorageSet({
          siteTodos: allSiteTodos,
          timestamp: newTimestamp
        }, () => {
          console.log('Site-specific todos saved successfully for', currentSiteMode);
        });
      });
    }
  } catch (error) {
    console.error('Error saving todos:', error);
    reportError(error);
    
    // Check extension context
    setTimeout(checkExtensionContext, 100);
  }
}

// Load todos from storage
function loadTodos(mode) {
  try {
    const currentMode = mode || currentSiteMode;
    console.log('Loading todos for mode:', currentMode);
    
    if (currentMode === 'global') {
      // Load global todos
      safeStorageGet(['todos', 'timestamp'], (result) => {
        if (!result) {
          console.warn('Could not load global todos, using empty array');
          todos = [];
          renderTodos();
          return;
        }
        
        todos = result.todos || [];
        if (result.timestamp) {
          lastUpdateTimestamp = result.timestamp;
        }
        renderTodos();
      });
    } else {
      // Load site-specific todos
      safeStorageGet(['siteTodos', 'timestamp'], (result) => {
        if (!result) {
          console.warn('Could not load site-specific todos, using empty array');
          todos = [];
          renderTodos();
          return;
        }
        
        const allSiteTodos = result.siteTodos || {};
        todos = allSiteTodos[currentMode] || [];
        if (result.timestamp) {
          lastUpdateTimestamp = result.timestamp;
        }
        renderTodos();
      });
    }
  } catch (error) {
    console.error('Error loading todos:', error);
    reportError(error);
    
    // Fallback to empty todos
    todos = [];
    renderTodos();
    
    // Check extension context
    setTimeout(checkExtensionContext, 100);
  }
}

// Render all todos
function renderTodos() {
  const todoList = todoWidget.querySelector('.sticky-todo-list');
  todoList.innerHTML = '';
  
  if (todos.length === 0) {
    // Show empty message
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'sticky-todo-empty';
    
    if (currentSiteMode !== 'global' && document.getElementById('siteModeBtn') && 
        window.getComputedStyle(document.getElementById('siteModeBtn')).backgroundColor === 'rgb(127, 83, 172)') {
      emptyMsg.textContent = `No tasks yet for ${currentSiteMode}. Add one below`;
    } else {
      emptyMsg.textContent = 'No tasks yet. Add one below';
    }
    
    emptyMsg.dir = 'ltr';
    emptyMsg.style.direction = 'ltr';
    emptyMsg.style.textAlign = 'center';
    todoList.appendChild(emptyMsg);
    todoWidget.classList.remove('has-incomplete');
    return;
  }
  
  todos.forEach(todo => {
    const li = createTodoElement(todo);
    todoList.appendChild(li);
  });
  
  // Update status dot when minimized
  if (isMinimized) {
    updateMinimizedState();
  }
}

// Create a todo item element
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = 'sticky-todo-item';
  li.dataset.id = todo.id;
  li.dir = 'ltr';
  
  if (todo.completed) {
    li.classList.add('completed');
  }
  
  // Add checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'sticky-todo-checkbox';
  checkbox.checked = todo.completed;
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    const listItem = e.target.closest('.sticky-todo-item');
    const todoText = listItem.querySelector('.sticky-todo-text');
    
    // Smoothly toggle the completed state with animation
    if (e.target.checked) {
      todoText.style.transition = 'all 0.3s ease';
      listItem.classList.add('completed');
    } else {
      todoText.style.transition = 'all 0.3s ease';
      listItem.classList.remove('completed');
    }
    
    toggleTodoCompletion(todo.id);
  });
  
  // Add the todo text
  const todoText = document.createElement('span');
  todoText.className = 'sticky-todo-text';
  todoText.textContent = todo.text;
  todoText.dir = 'ltr';
  todoText.style.direction = 'ltr';
  todoText.style.textAlign = 'left';
  todoText.title = "Double-click to toggle completion";
  
  // Add double-click functionality to toggle completion
  todoText.addEventListener('dblclick', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    checkbox.checked = !checkbox.checked;
    
    // Trigger the change event to handle the state update
    const changeEvent = new Event('change', { bubbles: true });
    checkbox.dispatchEvent(changeEvent);
  });
  
  // Add delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'sticky-todo-delete';
  deleteBtn.innerHTML = '×';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => deleteTodo(todo.id));
  
  // Assemble the item
  li.appendChild(checkbox);
  li.appendChild(todoText);
  li.appendChild(deleteBtn);
  
  return li;
}

// Delete all todos
function deleteAllTodos() {
  if (todos.length === 0) return;
  
  const confirmMessage = currentSiteMode !== 'global' && document.getElementById('siteModeBtn') && 
                         window.getComputedStyle(document.getElementById('siteModeBtn')).backgroundColor === 'rgb(127, 83, 172)' ?
                         `Are you sure you want to delete all tasks for ${currentSiteMode}?` :
                         'Are you sure you want to delete all tasks?';
  
  if (confirm(confirmMessage)) {
    todos = [];
    saveTodos();
    renderTodos();
  }
}

// Show sync animation
function showSyncAnimation() {
  if (!todoWidget || animationsDisabled) return;
  
  const syncIndicator = todoWidget.querySelector('.sticky-todo-sync-indicator');
  if (syncIndicator) {
    syncIndicator.classList.add('sticky-todo-sync-active');
    setTimeout(() => {
      syncIndicator.classList.remove('sticky-todo-sync-active');
    }, 1000);
  }
}

// Set up storage change listener to sync between tabs
function setupCrossBrowserSync() {
  // Listen for changes to storage from other tabs
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      console.log('Storage change detected:', namespace, changes);
      if (namespace === 'local') {
        // Sync minimized state
        if (changes.isMinimized && changes.minimizedStateTimestamp && todoWidget) {
          // Get the new minimized state
          const newMinimizedState = changes.isMinimized.newValue;
          const newTimestamp = changes.minimizedStateTimestamp.newValue;
          
          // Check if this is a recent change from another tab
          if (newTimestamp > lastUpdateTimestamp - 1000) { // Allow 1 second buffer for potential race conditions
            safeStorageGet(['syncStateAcrossTabs'], (result) => {
              const shouldSyncState = result.syncStateAcrossTabs !== false; // Default to true
              
              if (shouldSyncState && newMinimizedState !== isMinimized) {
                console.log('Syncing minimized state from another tab:', newMinimizedState);
                
                // Apply the minimized state without animation
                isMinimized = newMinimizedState;
                if (isMinimized) {
                  todoWidget.classList.add('sticky-todo-minimized');
                } else {
                  todoWidget.classList.remove('sticky-todo-minimized');
                }
                
                updateMinimizedState();
              }
            });
          }
        }
        
        // Global todos changed
        if (changes.timestamp && changes.todos && 
            (currentSiteMode === 'global' || !document.getElementById('siteModeBtn') || 
             document.getElementById('siteModeBtn').style.display === 'none' ||
             (document.getElementById('globalModeBtn') && 
              window.getComputedStyle(document.getElementById('globalModeBtn')).backgroundColor === 'rgb(127, 83, 172)'))) {
          
          const newTimestamp = changes.timestamp.newValue;
          const newTodos = changes.todos.newValue;
          
          // Only update if the incoming change is newer than our last update
          if (newTimestamp > lastUpdateTimestamp) {
            console.log('Sync: Detected newer global tasks from another tab', newTodos);
            
            // Only merge if we're in global mode
            if (currentSiteMode === 'global' || !document.getElementById('siteModeBtn') || 
                document.getElementById('siteModeBtn').style.display === 'none' ||
                (document.getElementById('globalModeBtn') && 
                 window.getComputedStyle(document.getElementById('globalModeBtn')).backgroundColor === 'rgb(127, 83, 172)')) {
              mergeTodos(newTodos);
              lastUpdateTimestamp = newTimestamp;
              showSyncAnimation(); // Show sync animation
            }
          }
        }
        
        // Site-specific todos changed
        if (changes.siteTodos && changes.timestamp) {
          const newTimestamp = changes.timestamp.newValue;
          const allSiteTodos = changes.siteTodos.newValue;
          
          // Only update if newer and we have a current site mode that matches
          if (newTimestamp > lastUpdateTimestamp && currentSiteMode !== 'global' && 
              allSiteTodos && allSiteTodos[currentSiteMode] && 
              document.getElementById('siteModeBtn') && 
              window.getComputedStyle(document.getElementById('siteModeBtn')).backgroundColor === 'rgb(127, 83, 172)') {
            
            console.log('Sync: Detected newer site-specific tasks from another tab', allSiteTodos[currentSiteMode]);
            mergeTodos(allSiteTodos[currentSiteMode]);
            lastUpdateTimestamp = newTimestamp;
            showSyncAnimation(); // Show sync animation
          }
        }
      }
    });
  } catch (error) {
    console.error('Error setting up storage listener:', error);
  }
  
  // Also set up a periodic check as backup (every 3 seconds)
  setInterval(checkForUpdates, 3000);
}

// Check for updates from storage with optional force parameter
function checkForUpdates(force = false) {
  try {
    // Determine which type of todos to check for updates
    if (currentSiteMode === 'global' || !document.getElementById('siteModeBtn') || 
        document.getElementById('siteModeBtn').style.display === 'none' ||
        (document.getElementById('globalModeBtn') && 
         window.getComputedStyle(document.getElementById('globalModeBtn')).backgroundColor === 'rgb(127, 83, 172)')) {
      
      // Check for global todos updates - use safeStorageGet instead of direct chrome.storage.local.get
      safeStorageGet(['todos', 'timestamp'], (result) => {
        if (!result) return; // Safety check
        
        // Debug logging
        console.log('Polling for global updates. Current timestamp:', lastUpdateTimestamp, 'Storage timestamp:', result.timestamp);
        
        // Only update if the storage data is newer than what we have or if forced
        if (result.todos && ((result.timestamp && result.timestamp > lastUpdateTimestamp) || force)) {
          console.log('Sync: Found newer global tasks via polling', result.todos);
          
          // Merge rather than replace
          mergeTodos(result.todos);
          
          if (result.timestamp) {
            lastUpdateTimestamp = result.timestamp;
          }
          showSyncAnimation(); // Show sync animation
        }
      });
    } else if (currentSiteMode !== 'global') {
      // Check for site-specific todos updates - use safeStorageGet instead of direct chrome.storage.local.get
      safeStorageGet(['siteTodos', 'timestamp'], (result) => {
        if (!result) return; // Safety check
        
        // Debug logging
        console.log('Polling for site-specific updates for', currentSiteMode, 'Current timestamp:', lastUpdateTimestamp, 'Storage timestamp:', result.timestamp);
        
        const allSiteTodos = result.siteTodos || {};
        
        // Only update if the storage data is newer than what we have or if forced
        if (allSiteTodos[currentSiteMode] && ((result.timestamp && result.timestamp > lastUpdateTimestamp) || force)) {
          console.log('Sync: Found newer site-specific tasks via polling', allSiteTodos[currentSiteMode]);
          
          // Merge rather than replace
          mergeTodos(allSiteTodos[currentSiteMode]);
          
          if (result.timestamp) {
            lastUpdateTimestamp = result.timestamp;
          }
          showSyncAnimation(); // Show sync animation
        }
      });
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    reportError(error);
    
    // If we catch an error here, it might be due to context invalidation
    // Trigger a check of the extension context
    setTimeout(checkExtensionContext, 100);
  }
}

// Intelligently merge todos from different tabs
function mergeTodos(incomingTodos) {
  if (!incomingTodos || !Array.isArray(incomingTodos)) return;
  
  // Create map of existing todos by ID for quick lookup
  const existingTodosMap = {};
  todos.forEach(todo => {
    existingTodosMap[todo.id] = todo;
  });
  
  // Track IDs from both sets
  const allIds = new Set();
  todos.forEach(todo => allIds.add(todo.id));
  incomingTodos.forEach(todo => allIds.add(todo.id));
  
  // Create new merged array
  const mergedTodos = [];
  
  // Process all IDs
  allIds.forEach(id => {
    const existingTodo = existingTodosMap[id];
    const incomingTodo = incomingTodos.find(t => t.id === id);
    
    // Case 1: Todo exists in both sets
    if (existingTodo && incomingTodo) {
      // If completion status different, prefer the completed one
      // This ensures a completed task in any tab is reflected everywhere
      if (existingTodo.completed !== incomingTodo.completed) {
        mergedTodos.push(incomingTodo.completed ? incomingTodo : existingTodo);
      } else {
        // If completion status same, keep the one with newer text if different
        mergedTodos.push(incomingTodo);
      }
    } 
    // Case 2: Todo only in incoming set (new todo from another tab)
    else if (incomingTodo) {
      mergedTodos.push(incomingTodo);
    } 
    // Case 3: Todo only in existing set (deleted in another tab)
    else if (existingTodo) {
      mergedTodos.push(existingTodo);
    }
  });
  
  // Update todos and render
  todos = mergedTodos;
  renderTodos();
}

// Check visibility setting and initialize
function initializeTodoWidget() {
  try {
    safeStorageGet(['isVisible', 'enableTransparency', 'disableAnimations'], (result) => {
      if (!result) {
        // If we can't get the result, assume visible by default
        isVisible = true;
        transparencyEnabled = true;
        animationsDisabled = false;
        console.warn('Could not retrieve settings, using defaults');
      } else {
        isVisible = result.isVisible !== false; // Default to visible
        transparencyEnabled = result.enableTransparency !== false; // Default to enabled
        animationsDisabled = result.disableAnimations === true; // Default to disabled
      }
      
      // Apply animations setting to document body
      if (animationsDisabled) {
        document.body.classList.add('animations-disabled');
      } else {
        document.body.classList.remove('animations-disabled');
      }
      
      if (isVisible) {
        createTodoWidget();
        setupCrossBrowserSync(); // Set up synchronization
      }
    });
  } catch (error) {
    console.error('Error initializing Todo widget:', error);
    reportError(error);
    
    // Fallback - create widget anyway with default settings
    isVisible = true;
    transparencyEnabled = true;
    animationsDisabled = false;
    setTimeout(() => {
      createTodoWidget();
      setupCrossBrowserSync();
    }, 500);
  }
}

// Listen for messages from background script
try {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    try {
      if (request.action === 'visibilityChanged') {
        if (request.isVisible) {
          if (!todoWidget) {
            createTodoWidget();
          } else {
            showTodoWidget();
          }
        } else if (todoWidget) {
          hideTodoWidget();
        }
        sendResponse({status: 'success'});
        return true;
      }
      
      // Handle minimized state changes from other tabs
      if (request.action === 'minimizedStateChanged' && todoWidget) {
        safeStorageGet(['syncStateAcrossTabs'], (result) => {
          const shouldSyncState = result.syncStateAcrossTabs !== false; // Default to true
          
          if (shouldSyncState && request.isMinimized !== isMinimized) {
            console.log('Received minimized state change:', request.isMinimized);
            
            // Apply the state without animation
            isMinimized = request.isMinimized;
            if (isMinimized) {
              todoWidget.classList.add('sticky-todo-minimized');
              // Remove any transition animations to prevent flashing
              todoWidget.classList.remove('sticky-todo-minimizing');
              todoWidget.classList.remove('sticky-todo-expanding');
            } else {
              todoWidget.classList.remove('sticky-todo-minimized');
              // Remove any transition animations to prevent flashing
              todoWidget.classList.remove('sticky-todo-minimizing');
              todoWidget.classList.remove('sticky-todo-expanding');
            }
            
            updateMinimizedState();
            
            // Save to localStorage for immediate access on next page load
            try {
              const storageKey = 'stickyTodoWidgetState';
              const stateData = JSON.stringify({
                isMinimized: isMinimized,
                timestamp: Date.now()
              });
              localStorage.setItem(storageKey, stateData);
            } catch (e) {
              console.error('Error saving to localStorage:', e);
            }
          }
          
          sendResponse({status: 'success'});
        });
        return true;
      }
      
      // Handle settings changes
      if (request.action === 'settingChanged' && todoWidget) {
        console.log('Setting changed:', request.setting, request.value);
        
        if (request.setting === 'hideInFullscreen') {
          // Check if we need to update visibility based on current fullscreen state
          if (isInFullscreen) {
            checkFullscreenState();
          }
        }
        
        sendResponse({status: 'success'});
        return true;
      }
      
      // Handle direct sync notifications from background
      if (request.action === 'todosChanged') {
        console.log('Received sync notification from background');
        if (todoWidget && request.timestamp) {
          // Force a sync check
          checkForUpdates(true);
          sendResponse({status: 'success'});
          return true;
        }
      }
      
      sendResponse({status: 'unknown_action'});
      return false;
    } catch (error) {
      console.error('Error handling message:', error);
      reportError(error);
      sendResponse({status: 'error', message: error.toString()});
      return false;
    }
  });
} catch (error) {
  console.error('Could not set up message listener:', error);
  reportError(error);
}

// Modify the initialization section of your code to add try-catch blocks
try {
  // Initialize the widget when DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTodoWidget);
  } else {
    initializeTodoWidget();
  }
} catch (error) {
  console.error('Error initializing Todo widget:', error);
  reportError(error);
}

// Function to force reload tasks from storage
function forceReloadTasks() {
  // Show loading indicator
  const reloadBtn = document.querySelector('.sticky-todo-reload span');
  if (reloadBtn) {
    reloadBtn.classList.add('sticky-todo-reload-spinning');
  }
  
  // Determine which mode we're in and reload the appropriate tasks
  const isGlobalMode = !document.getElementById('siteModeBtn') || 
                       document.getElementById('siteModeBtn').style.display === 'none' ||
                       (document.getElementById('globalModeBtn') && 
                        window.getComputedStyle(document.getElementById('globalModeBtn')).backgroundColor === 'rgb(127, 83, 172)');
  
  try {
    if (isGlobalMode) {
      // Load global tasks
      safeStorageGet(['todos'], (result) => {
        if (!result) {
          console.warn('Could not reload global tasks');
          todos = [];
        } else if (result.todos && Array.isArray(result.todos)) {
          todos = result.todos;
          console.log('Manually reloaded global tasks');
        }
        
        renderTodos();
        
        // Remove loading indicator after a short delay
        setTimeout(() => {
          if (reloadBtn) {
            reloadBtn.classList.remove('sticky-todo-reload-spinning');
          }
          showSyncAnimation(); // Show sync animation
        }, 300);
      });
    } else {
      // Load site-specific tasks
      safeStorageGet(['siteTodos'], (result) => {
        if (!result) {
          console.warn('Could not reload site-specific tasks');
          todos = [];
        } else if (result.siteTodos && result.siteTodos[currentSiteMode]) {
          todos = result.siteTodos[currentSiteMode];
          console.log(`Manually reloaded site-specific tasks for ${currentSiteMode}`);
        }
        
        renderTodos();
        
        // Remove loading indicator after a short delay
        setTimeout(() => {
          if (reloadBtn) {
            reloadBtn.classList.remove('sticky-todo-reload-spinning');
          }
          showSyncAnimation(); // Show sync animation
        }, 300);
      });
    }
  } catch (error) {
    console.error('Error during force reload:', error);
    reportError(error);
    
    // Stop the spinner even if there was an error
    setTimeout(() => {
      if (reloadBtn) {
        reloadBtn.classList.remove('sticky-todo-reload-spinning');
      }
    }, 300);
    
    // Check extension context
    setTimeout(checkExtensionContext, 100);
  }
}

// Clean up event listeners when the extension gets unloaded
function cleanupEventListeners() {
  if (todoWidget) {
    // Remove document-level event listeners
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    
    // Clean up this specific part in startDrag function
    try {
      const header = todoWidget.querySelector('.sticky-todo-header');
      if (header) {
        header.removeEventListener('mousedown', startDrag);
      }
    } catch (e) {
      console.error('Error removing header event listeners:', e);
    }
  }
}

// Listen for extension unload/context invalidation
window.addEventListener('unload', () => {
  cleanupEventListeners();
});

// Add special hook for Chrome's context invalidation
try {
  if (chrome.runtime && chrome.runtime.onSuspend) {
    chrome.runtime.onSuspend.addListener(() => {
      cleanupEventListeners();
    });
  }
} catch (error) {
  // This might throw if context is already invalid
  console.warn('Could not set up onSuspend listener:', error);
}

// Check extension context immediately on load
(function checkInitialContext() {
  // Try to detect if extension context is already invalid
  try {
    if (!window.chrome || !chrome.runtime) {
      console.warn('Chrome runtime not available at startup');
      switchToLocalMode();
      return;
    }
    
    try {
      // This will throw if context is invalid
      chrome.runtime.getURL('');
      console.log('Extension context valid at startup');
    } catch (e) {
      console.warn('Extension context invalid at startup:', e);
      switchToLocalMode();
    }
  } catch (e) {
    console.error('Error checking initial context:', e);
    switchToLocalMode();
  }
})();

// Set up periodic context checks
setInterval(() => {
  if (!usingLocalMode) {
    checkExtensionContext();
  } else {
    // If we're in local mode, try reconnecting periodically
    attemptReconnection();
  }
}, 30000); // Check every 30 seconds

// Add a periodic save to localStorage when in local mode
setInterval(() => {
  if (usingLocalMode) {
    saveToLocalStorage();
  }
}, 60000); // Save every minute

// Add this to report errors safely
function reportError(error) {
  console.error('Error:', error);
  
  if (!usingLocalMode) {
    try {
      chrome.runtime.sendMessage({
        action: "reportError",
        error: error.toString(),
        location: window.location.href,
        timestamp: Date.now()
      });
    } catch (e) {
      console.error('Could not report error:', e);
      // If we can't report the error, we might be in an invalid context
      switchToLocalMode();
    }
  }
}

// Function to handle transparency mode
function setupTransparencyMode() {
  if (!todoWidget) return;
  
  // Clear any existing timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  
  // Load transparency setting
  safeStorageGet(['enableTransparency'], (result) => {
    transparencyEnabled = result.enableTransparency !== false; // Default to enabled
    console.log('Transparency mode:', transparencyEnabled ? 'enabled' : 'disabled');
    
    if (transparencyEnabled && isMinimized) {
      // Add transparency class
      todoWidget.classList.add('transparency-enabled');
      
      // Reset interaction time and start timer
      lastInteractionTime = Date.now();
      startInactivityTimer();
      
      // Add mouse movement listener to detect interaction
      document.addEventListener('mousemove', handleUserInteraction);
      
      // Also add mouseover/mouseout for more reliable detection
      todoWidget.addEventListener('mouseover', function() {
        todoWidget.classList.remove('inactive');
        lastInteractionTime = Date.now();
        
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
        }
        startInactivityTimer();
      });
    } else {
      // Remove transparency classes
      todoWidget.classList.remove('transparency-enabled');
      todoWidget.classList.remove('inactive');
      
      // Remove event listeners
      document.removeEventListener('mousemove', handleUserInteraction);
    }
  });
}

// Function to handle user interaction
function handleUserInteraction(e) {
  if (!todoWidget || !transparencyEnabled || !isMinimized) return;
  
  // Get widget position
  const rect = todoWidget.getBoundingClientRect();
  
  // Check if mouse is near the widget (within 150px for better detection)
  const isNearWidget = 
    e.clientX >= rect.left - 150 && 
    e.clientX <= rect.right + 150 && 
    e.clientY >= rect.top - 150 && 
    e.clientY <= rect.bottom + 150;
  
  if (isNearWidget) {
    // Update last interaction time
    lastInteractionTime = Date.now();
    
    // Remove inactive class
    todoWidget.classList.remove('inactive');
    
    // Restart the timer
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    startInactivityTimer();
  }
}

// Function to start inactivity timer
function startInactivityTimer() {
  if (!transparencyEnabled || !isMinimized) return;
  
  // Clear any existing timer first
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  inactivityTimer = setTimeout(() => {
    if (todoWidget && isMinimized) {
      todoWidget.classList.add('inactive');
      console.log('Inactivity timer triggered - widget now semi-transparent');
    }
  }, 2000); // 2 seconds of inactivity
}

// Function to handle animations setting
function setupAnimationsMode() {
  // Load animations setting
  safeStorageGet(['disableAnimations'], (result) => {
    animationsDisabled = result.disableAnimations === true; // Default to false (animations enabled)
    
    // Add or remove the animations-disabled class from the document body
    if (animationsDisabled) {
      document.body.classList.add('animations-disabled');
    } else {
      document.body.classList.remove('animations-disabled');
    }
  });
}

// Listen for settings changes
function setupSettingsListener() {
  try {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        // Handle transparency setting change
        if (changes.enableTransparency) {
          transparencyEnabled = changes.enableTransparency.newValue !== false;
          setupTransparencyMode();
        }
        
        // Handle animations setting change
        if (changes.disableAnimations) {
          animationsDisabled = changes.disableAnimations.newValue === true;
          setupAnimationsMode();
        }
      }
    });
  } catch (error) {
    console.error('Error setting up settings listener:', error);
  }
}
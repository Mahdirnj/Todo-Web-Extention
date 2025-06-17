document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleButton');
  const enableSiteSpecificCheckbox = document.getElementById('enableSiteSpecific');
  const siteInputsContainer = document.getElementById('siteInputsContainer');
  const syncStateCheckbox = document.getElementById('syncStateAcrossTabs');
  const hideInFullscreenCheckbox = document.getElementById('hideInFullscreen');
  const enableTransparencyCheckbox = document.getElementById('enableTransparency');
  const disableAnimationsCheckbox = document.getElementById('disableAnimations');
  const darkModeCheckbox = document.getElementById('darkMode');
  const siteInputs = [
    document.getElementById('site1'),
    document.getElementById('site2'),
    document.getElementById('site3')
  ];
  
  // Update button text based on current visibility state
  chrome.storage.local.get(['isVisible'], function(result) {
    toggleButton.textContent = result.isVisible ? "Hide Todo Widget" : "Show Todo Widget";
  });
  
  // Load site-specific settings
  chrome.storage.local.get(['siteSpecificEnabled', 'siteUrls'], function(result) {
    // Default to disabled if not set
    const enabled = result.siteSpecificEnabled || false;
    enableSiteSpecificCheckbox.checked = enabled;
    
    // Show/hide site inputs based on checkbox state
    siteInputsContainer.style.display = enabled ? 'block' : 'none';
    
    // Fill in site URLs if they exist
    if (result.siteUrls && Array.isArray(result.siteUrls)) {
      result.siteUrls.forEach((url, index) => {
        if (index < siteInputs.length && url) {
          siteInputs[index].value = url;
        }
      });
    }
  });
  
  // Load all settings
  chrome.storage.local.get([
    'syncStateAcrossTabs', 
    'hideInFullscreen', 
    'enableTransparency', 
    'disableAnimations',
    'darkMode'
  ], function(result) {
    syncStateCheckbox.checked = result.syncStateAcrossTabs !== false; // Default to enabled
    hideInFullscreenCheckbox.checked = result.hideInFullscreen !== false; // Default to enabled
    enableTransparencyCheckbox.checked = result.enableTransparency !== false; // Default to enabled
    disableAnimationsCheckbox.checked = result.disableAnimations === true; // Default to disabled
    darkModeCheckbox.checked = result.darkMode === true; // Default to disabled
    
    // Apply dark mode to popup if enabled
    if (result.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  });
  
  // Add click event listener to toggle button
  toggleButton.addEventListener('click', function() {
    chrome.storage.local.get(['isVisible'], function(result) {
      const newVisibility = !result.isVisible;
      
      // Update storage directly
      chrome.storage.local.set({ isVisible: newVisibility }, function() {
        // Update button text
        toggleButton.textContent = newVisibility ? "Hide Todo Widget" : "Show Todo Widget";
      });
    });
  });
  
  // Add hover effect for better UX
  toggleButton.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.03)';
  });
  
  toggleButton.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
  });
  
  // Handle site-specific checkbox change
  enableSiteSpecificCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    
    // Show/hide site inputs
    siteInputsContainer.style.display = enabled ? 'block' : 'none';
    
    // Save the setting
    saveSiteSpecificSettings();
  });
  
  // Add event listeners to site inputs
  siteInputs.forEach(input => {
    input.addEventListener('blur', saveSiteSpecificSettings);
    input.addEventListener('keyup', function(e) {
      if (e.key === 'Enter') {
        saveSiteSpecificSettings();
      }
    });
  });
  
  // Handle sync state checkbox change
  syncStateCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ syncStateAcrossTabs: enabled }, function() {
      console.log('Sync widget state setting saved:', enabled);
    });
  });
  
  // Handle fullscreen hiding checkbox change
  hideInFullscreenCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ hideInFullscreen: enabled }, function() {
      console.log('Hide in fullscreen setting saved:', enabled);
    });
  });
  
  // Handle transparency checkbox change
  enableTransparencyCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ enableTransparency: enabled }, function() {
      console.log('Transparency setting saved:', enabled);
    });
  });
  
  // Handle disable animations checkbox change
  disableAnimationsCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ disableAnimations: enabled }, function() {
      console.log('Disable animations setting saved:', enabled);
    });
  });
  
  // Handle dark mode checkbox change
  darkModeCheckbox.addEventListener('change', function() {
    const enabled = this.checked;
    chrome.storage.local.set({ darkMode: enabled }, function() {
      console.log('Dark mode setting saved:', enabled);
      
      // Apply dark mode to popup immediately
      if (enabled) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    });
  });
  
  // Function to save site-specific settings
  function saveSiteSpecificSettings() {
    const enabled = enableSiteSpecificCheckbox.checked;
    const urls = siteInputs.map(input => input.value.trim().toLowerCase())
      .map(url => {
        // Remove protocol and www if present
        return url.replace(/^(https?:\/\/)?(www\.)?/i, '');
      })
      // Filter out empty values
      .filter(url => url.length > 0);
    
    // Save settings
    chrome.storage.local.set({
      siteSpecificEnabled: enabled,
      siteUrls: urls
    }, function() {
      console.log('Site-specific settings saved:', { enabled, urls });
      
      // Initialize empty site-specific todo lists if they don't exist
      chrome.storage.local.get(['siteTodos'], function(result) {
        const siteTodos = result.siteTodos || {};
        
        // Add empty todo lists for new sites
        let updated = false;
        urls.forEach(url => {
          if (!siteTodos[url]) {
            siteTodos[url] = [];
            updated = true;
          }
        });
        
        // Save if we added new sites
        if (updated) {
          chrome.storage.local.set({ siteTodos: siteTodos });
        }
      });
    });
  }
}); 
document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleButton');
  
  // Update button text based on current visibility state
  chrome.storage.local.get(['isVisible'], function(result) {
    toggleButton.textContent = result.isVisible ? "Hide Todo Widget" : "Show Todo Widget";
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
}); 
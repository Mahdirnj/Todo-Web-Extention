// Create and inject the Todo widget
let todoWidget = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let todos = [];
let isMinimized = false;
let isVisible = true;
let lastUpdateTimestamp = Date.now(); // Track when tasks were last updated

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
  todoWidget.appendChild(inputArea);
  
  // Add a global click handler for the minimized circle
  todoWidget.addEventListener('click', handleWidgetClick);
  
  // Add to body
  document.body.appendChild(todoWidget);
  
  // Get stored position and state
  chrome.storage.local.get(['position', 'isMinimized', 'isVisible'], (result) => {
    if (result.position) {
      todoWidget.style.left = `${result.position.x}px`;
      todoWidget.style.top = `${result.position.y}px`;
    }
    
    isVisible = result.isVisible !== false; // Default to visible
    
    if (!isVisible) {
      todoWidget.classList.add('sticky-todo-hidden');
    }
    
    if (result.isMinimized) {
      isMinimized = true;
      todoWidget.classList.add('sticky-todo-minimized');
      updateMinimizedState();
    }
  });
  
  // Load and render todos
  loadTodos();
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
  setTimeout(() => {
    todoWidget.classList.remove('sticky-todo-expanding');
  }, 300);
  
  // Update visual state
  updateMinimizedState();
  
  // Save state
  chrome.storage.local.set({ isMinimized: false });
}

// Start dragging the widget - works in both minimized and expanded states
function startDrag(e) {
  // Don't drag if clicking on buttons
  if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
  
  isDragging = true;
  
  // Calculate offset
  const rect = todoWidget.getBoundingClientRect();
  dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  
  // Add event listeners for dragging
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  
  // Prevent text selection during drag
  e.preventDefault();
  e.stopPropagation();
}

// Handle drag movement
function onDrag(e) {
  if (isDragging) {
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Keep widget within viewport bounds
    const maxX = window.innerWidth - todoWidget.offsetWidth;
    const maxY = window.innerHeight - todoWidget.offsetHeight;
    
    todoWidget.style.left = `${Math.max(0, Math.min(maxX, newX))}px`;
    todoWidget.style.top = `${Math.max(0, Math.min(maxY, newY))}px`;
  }
}

// Stop dragging
function stopDrag(e) {
  if (!isDragging) return;
  
  // Remove event listeners
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  
  // Save position
  const position = {
    x: parseInt(todoWidget.style.left),
    y: parseInt(todoWidget.style.top)
  };
  
  chrome.storage.local.set({ position: position });
  
  // Add a small delay before resetting isDragging to prevent accidental expansion
  setTimeout(() => {
    isDragging = false;
  }, 100);
}

// Toggle between minimized and expanded states
function toggleMinimize() {
  isMinimized = !isMinimized;
  
  if (isMinimized) {
    todoWidget.classList.add('sticky-todo-minimizing');
    todoWidget.classList.add('sticky-todo-minimized');
    setTimeout(() => {
      todoWidget.classList.remove('sticky-todo-minimizing');
    }, 300);
  } else {
    // Add animation class for expanding
    todoWidget.classList.add('sticky-todo-expanding');
    todoWidget.classList.remove('sticky-todo-minimized');
    setTimeout(() => {
      todoWidget.classList.remove('sticky-todo-expanding');
    }, 300);
  }
  
  // Update visual state
  updateMinimizedState();
  
  // Save state
  chrome.storage.local.set({ isMinimized: isMinimized });
}

// Update the visual state of minimized widget
function updateMinimizedState() {
  if (isMinimized) {
    const hasIncompleteTasks = todos.some(todo => !todo.completed);
    if (hasIncompleteTasks) {
      todoWidget.classList.add('has-incomplete');
    } else {
      todoWidget.classList.remove('has-incomplete');
    }
    
    // Add a pulsing animation to the circle when minimized
    todoWidget.style.animation = 'pulseScale 2s infinite alternate';
    
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

// Show the widget (unhide)
function showTodoWidget() {
  if (!todoWidget) {
    createTodoWidget();
    setupCrossBrowserSync(); // Set up sync when creating widget
  } else {
    todoWidget.classList.add('sticky-todo-showing');
    todoWidget.classList.remove('sticky-todo-hidden');
    setTimeout(() => {
      todoWidget.classList.remove('sticky-todo-showing');
    }, 300);
  }
  
  // Load latest tasks when showing
  loadTodos();
  
  isVisible = true;
  chrome.storage.local.set({ isVisible: true });
}

// Add a new todo
function addTodo(text) {
  if (!text.trim()) return;
  
  const todoInput = document.querySelector('.sticky-todo-input');
  todoInput.value = '';
  
  const newTodo = {
    id: Date.now(),
    text: text.trim(),
    completed: false
  };
  
  todos.push(newTodo);
  saveTodos();
  renderTodos();
  
  // Animate the new todo item
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

// Save todos to storage with timestamp
function saveTodos() {
  const saveData = {
    todos: todos,
    timestamp: Date.now()
  };
  lastUpdateTimestamp = saveData.timestamp;
  chrome.storage.local.set(saveData);
}

// Load todos from storage
function loadTodos() {
  chrome.storage.local.get(['todos', 'timestamp'], (result) => {
    if (result.todos && Array.isArray(result.todos)) {
      todos = result.todos;
      if (result.timestamp) {
        lastUpdateTimestamp = result.timestamp;
      }
      renderTodos();
    }
  });
}

// Render todos in the list
function renderTodos() {
  const todoList = todoWidget.querySelector('.sticky-todo-list');
  todoList.innerHTML = '';
  
  if (todos.length === 0) {
    // Show empty message
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'sticky-todo-empty';
    emptyMsg.textContent = 'No tasks yet. Add one below';
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
  
  if (confirm('Are you sure you want to delete all tasks?')) {
    todos = [];
    saveTodos();
    renderTodos();
  }
}

// Show sync indicator animation
function showSyncAnimation() {
  const syncIndicator = todoWidget.querySelector('.sticky-todo-sync-indicator');
  if (syncIndicator) {
    syncIndicator.classList.remove('sticky-todo-sync-active');
    // Force reflow
    void syncIndicator.offsetWidth;
    syncIndicator.classList.add('sticky-todo-sync-active');
    
    // Remove the class after animation completes
    setTimeout(() => {
      syncIndicator.classList.remove('sticky-todo-sync-active');
    }, 1000);
  }
}

// Set up storage change listener to sync between tabs
function setupCrossBrowserSync() {
  // Listen for changes to storage from other tabs
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.timestamp && changes.todos) {
      const newTimestamp = changes.timestamp.newValue;
      const newTodos = changes.todos.newValue;
      
      // Only update if the incoming change is newer than our last update
      if (newTimestamp > lastUpdateTimestamp) {
        console.log('Sync: Detected newer tasks from another tab');
        
        // Instead of completely replacing, merge intelligently
        mergeTodos(newTodos);
        
        lastUpdateTimestamp = newTimestamp;
        showSyncAnimation(); // Show sync animation
      }
    }
  });
  
  // Also set up a periodic check as backup (every 3 seconds)
  setInterval(checkForUpdates, 3000);
}

// Check for updates from storage
function checkForUpdates() {
  chrome.storage.local.get(['todos', 'timestamp'], (result) => {
    // Only update if the storage data is newer than what we have
    if (result.timestamp && result.timestamp > lastUpdateTimestamp && result.todos) {
      console.log('Sync: Found newer tasks via polling');
      
      // Merge rather than replace
      mergeTodos(result.todos);
      
      lastUpdateTimestamp = result.timestamp;
      showSyncAnimation(); // Show sync animation
    }
  });
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
  chrome.storage.local.get(['isVisible'], (result) => {
    isVisible = result.isVisible !== false; // Default to visible
    
    if (isVisible) {
      createTodoWidget();
      setupCrossBrowserSync(); // Set up synchronization
    }
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeTodoWidget();
});

// If document is already loaded, initialize now
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initializeTodoWidget();
}
javascript:(function() {
  // Blooket Bookmarklet - Answer Overlay
  // Intercepts game state and displays correct answers in a floating overlay
  
  const OVERLAY_ID = 'blooket-answer-overlay';
  
  // Remove existing overlay if present
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 999999;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    min-width: 280px;
    max-width: 350px;
    border: 2px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(10px);
  `;
  
  const header = document.createElement('div');
  header.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 12px;
    opacity: 0.9;
    border-bottom: 2px solid rgba(255,255,255,0.3);
    padding-bottom: 8px;
  `;
  header.textContent = '✓ ANSWER';
  overlay.appendChild(header);
  
  const answerBox = document.createElement('div');
  answerBox.style.cssText = `
    background: rgba(255,255,255,0.15);
    padding: 16px;
    border-radius: 8px;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.4;
    word-wrap: break-word;
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  `;
  answerBox.textContent = 'Loading...';
  overlay.appendChild(answerBox);
  
  const statusBox = document.createElement('div');
  statusBox.style.cssText = `
    margin-top: 12px;
    font-size: 12px;
    opacity: 0.85;
    text-align: center;
    border-top: 1px solid rgba(255,255,255,0.2);
    padding-top: 10px;
  `;
  statusBox.textContent = 'Scanning for questions...';
  overlay.appendChild(statusBox);
  
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    font-size: 24px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  `;
  closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.3)';
  closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
  closeBtn.onclick = () => overlay.remove();
  overlay.appendChild(closeBtn);
  
  document.body.appendChild(overlay);
  
  // Function to extract game state from window object
  function getGameState() {
    try {
      // Blooket stores game state in window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
      // or in React's fiber tree. We'll try multiple approaches.
      
      // Approach 1: Check window for game data
      if (window.__gameState) return window.__gameState;
      if (window.__blooketData) return window.__blooketData;
      
      // Approach 2: Look in React's root
      const rootElement = document.getElementById('app') || document.querySelector('[data-reactroot]');
      if (rootElement && rootElement.__reactInternalInstance) {
        const fiber = rootElement.__reactInternalInstance;
        return extractFromFiber(fiber);
      }
      
      // Approach 3: Search React Fiber Tree (modern React 18)
      const reactRoot = Object.keys(rootElement).find(key => 
        key.startsWith('__react')
      );
      if (reactRoot) {
        return extractFromFiber(rootElement[reactRoot]);
      }
      
      return null;
    } catch (e) {
      console.error('Error accessing game state:', e);
      return null;
    }
  }
  
  // Recursively search React fiber tree for game data
  function extractFromFiber(fiber, depth = 0, maxDepth = 50) {
    if (!fiber || depth > maxDepth) return null;
    
    // Check current fiber's props and state
    if (fiber.memoizedProps && fiber.memoizedProps.gameData) return fiber.memoizedProps.gameData;
    if (fiber.memoizedState) {
      for (let state of fiber.memoizedState) {
        if (state && state.questions) return { questions: state.questions };
      }
    }
    
    // Traverse children
    if (fiber.child) return extractFromFiber(fiber.child, depth + 1, maxDepth);
    if (fiber.sibling) return extractFromFiber(fiber.sibling, depth + 1, maxDepth);
    
    return null;
  }
  
  // Function to extract answer from DOM
  function getAnswerFromDOM() {
    try {
      // Look for question and answer elements in the DOM
      // Blooket uses various structures depending on game mode
      
      // Strategy 1: Look for buttons/divs that contain answer options
      const questionElements = document.querySelectorAll('[class*="question"], [class*="Question"]');
      if (questionElements.length > 0) {
        const questionText = questionElements[0].textContent;
        
        // Look for answer buttons (usually contain correct-answer class or data attributes)
        const answerButtons = document.querySelectorAll('[class*="answer"], [class*="Answer"], [data-answer], button');
        for (let btn of answerButtons) {
          if (btn.getAttribute('data-correct') === 'true' || 
              btn.className.includes('correct') ||
              btn.getAttribute('aria-label')?.includes('correct')) {
            return btn.textContent.trim();
          }
        }
      }
      
      // Strategy 2: Inspect network requests for answer data
      // This would require intercepting fetch/XHR, which we do below
      
      return null;
    } catch (e) {
      console.error('Error extracting from DOM:', e);
      return null;
    }
  }
  
  // Intercept fetch to capture game data
  const originalFetch = window.fetch;
  let gameDataCache = null;
  
  window.fetch = function(...args) {
    const result = originalFetch.apply(this, args);
    
    result.then(response => {
      // Check if this is a Blooket game API response
      if (args[0].includes('/api/') || args[0].includes('blooket')) {
        response.clone().json().then(data => {
          if (data.questions || data.gameData) {
            gameDataCache = data;
          }
        }).catch(() => {});
      }
    }).catch(() => {});
    
    return result;
  };
  
  // Main answer detection loop
  let lastQuestion = null;
  let updateInterval = setInterval(() => {
    try {
      // Try to get current question from DOM
      const questionText = document.evaluate(
        "//div[contains(@class, 'question') or contains(text(), '?')]",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      
      if (!questionText) {
        statusBox.textContent = 'No question detected';
        return;
      }
      
      const currentQuestion = questionText.textContent.trim();
      
      // If question changed, find new answer
      if (currentQuestion !== lastQuestion) {
        lastQuestion = currentQuestion;
        statusBox.textContent = 'Question detected...';
        
        // Try multiple methods to get answer
        let answer = null;
        
        // Method 1: Check cached game data
        if (gameDataCache && gameDataCache.questions) {
          for (let q of gameDataCache.questions) {
            if (q.question === currentQuestion) {
              answer = q.correctAnswers?.[0];
              break;
            }
          }
        }
        
        // Method 2: Extract from DOM attributes
        if (!answer) {
          const answerDivs = document.querySelectorAll('div[class*="choice"], div[class*="option"], button[class*="answer"]');
          for (let div of answerDivs) {
            if (div.getAttribute('data-correct') === 'true' || div.className.includes('correct')) {
              answer = div.textContent.trim();
              break;
            }
          }
        }
        
        // Method 3: Look for highlighted/styled elements that might indicate correct answer
        if (!answer) {
          const allOptions = document.querySelectorAll('[class*="choice"], [class*="option"], li[role="button"]');
          // Sometimes correct answers have specific styling - this is game-dependent
          if (allOptions.length > 0) {
            answer = allOptions[0].textContent.trim();
            statusBox.textContent = '⚠ Answer quality uncertain';
          }
        }
        
        if (answer) {
          answerBox.textContent = answer;
          statusBox.textContent = '✓ Answer found';
          answerBox.style.background = 'rgba(76, 175, 80, 0.3)';
          answerBox.style.borderLeft = '4px solid #4CAF50';
        } else {
          answerBox.textContent = 'Could not extract answer';
          statusBox.textContent = 'Check console for details';
          answerBox.style.background = 'rgba(255, 152, 0, 0.3)';
          answerBox.style.borderLeft = '4px solid #FF9800';
        }
      }
    } catch (e) {
      statusBox.textContent = 'Error: ' + e.message;
      console.error('Bookmarklet error:', e);
    }
  }, 500);
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => clearInterval(updateInterval));
  
  statusBox.textContent = '✓ Bookmarklet active - waiting for question...';
})();
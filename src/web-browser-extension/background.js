let lastTargetTabId = null

// Tracks the tab opened via "Go" that we are waiting to become capturable,
// and the Job Search Assistant tab that should be refocused and told to
// press Capture once that happens.
let pendingAutoCapture = null

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id) {
    throw new Error('No active tab found.')
  }

  return tab
}

async function captureTab(tabId) {
  const snapshot = await chrome.tabs.sendMessage(tabId, {
    type: 'JOB_SEARCH_ASSISTANT_CAPTURE_PAGE',
  })

  lastTargetTabId = tabId
  return snapshot
}

async function fillTab(tabId, fields) {
  const result = await chrome.tabs.sendMessage(tabId, {
    type: 'JOB_SEARCH_ASSISTANT_FILL_PAGE',
    fields,
  })

  lastTargetTabId = tabId
  return result
}

async function captureTabSnapshot(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title,
      url: location.href,
      html: document.documentElement?.outerHTML ?? '',
      text: document.body?.innerText ?? '',
    }),
  })

  if (!result?.result) {
    throw new Error('Unable to capture the tab content.')
  }

  return result.result
}

async function focusTab(tabId) {
  if (tabId == null) {
    return
  }

  await chrome.tabs.update(tabId, { active: true })
}

async function openVisibleTab(url) {
  const openedTab = await chrome.tabs.create({ url, active: true })

  if (!openedTab.id) {
    throw new Error('Unable to open the requested URL.')
  }

  lastTargetTabId = openedTab.id
  return {
    tabId: openedTab.id,
    url: openedTab.url ?? url,
  }
}

const AUTO_CAPTURE_TIMEOUT_MS = 10 * 60 * 1000

function armAutoCaptureWatch(tabId, originTabId) {
  pendingAutoCapture = {
    tabId,
    originTabId,
    expiresAt: Date.now() + AUTO_CAPTURE_TIMEOUT_MS,
  }

  // Kick off watching right away in case the tab is already loaded.
  void requestAutoCaptureWatch(tabId)
}

async function requestAutoCaptureWatch(tabId) {
  if (pendingAutoCapture?.tabId !== tabId) {
    return
  }

  if (Date.now() > pendingAutoCapture.expiresAt) {
    pendingAutoCapture = null
    return
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'JOB_SEARCH_ASSISTANT_START_AUTO_CAPTURE_WATCH',
    })
  } catch {
    // The content script may not be ready yet (e.g. the tab is mid-navigation).
    // onUpdated will trigger another attempt once the tab finishes loading.
  }
}

async function handleAutoCaptureReady(readyTabId) {
  if (pendingAutoCapture?.tabId !== readyTabId) {
    return
  }

  const { originTabId } = pendingAutoCapture
  pendingAutoCapture = null
  lastTargetTabId = readyTabId

  if (originTabId == null) {
    return
  }

  try {
    await focusTab(originTabId)
    await chrome.tabs.sendMessage(originTabId, {
      type: 'JOB_SEARCH_ASSISTANT_AUTO_CAPTURE_TRIGGER',
    })
  } catch (error) {
    console.warn('Unable to notify the origin tab to auto-capture.', error)
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete' && pendingAutoCapture?.tabId === tabId) {
    void requestAutoCaptureWatch(tabId)
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  if (pendingAutoCapture?.tabId === tabId) {
    pendingAutoCapture = null
  }
})

async function getTargetTabId() {
  if (lastTargetTabId != null) {
    return lastTargetTabId
  }

  const tab = await getActiveTab()
  if (!tab?.id) {
    throw new Error('No target tab available.')
  }

  return tab.id
}

function mostRecentlyUsed(tabs) {
  // Suspended/discarded tabs report a stale lastAccessed, so prefer tabs that
  // are still active in memory before falling back to recency.
  return tabs.reduce((best, tab) => {
    if (!best) {
      return tab
    }

    if (best.discarded !== tab.discarded) {
      return tab.discarded ? best : tab
    }

    return (tab.lastAccessed ?? 0) > (best.lastAccessed ?? 0) ? tab : best
  }, null)
}

async function findTabByUrl(url) {
  const allTabs = await chrome.tabs.query({})
  let parsedTarget
  try {
    parsedTarget = new URL(url)
  } catch {
    return null
  }

  // Exact match first — when multiple tabs share the URL (e.g. duplicates
  // or a suspended tab left open from a previous capture), prefer the most
  // recently used one so a stale/asleep tab isn't captured instead.
  const exactMatches = allTabs.filter((tab) => tab.url === url)
  if (exactMatches.length > 0) {
    return mostRecentlyUsed(exactMatches)
  }

  // Same origin + pathname prefix match (handles query-string variants)
  const closeMatches = allTabs.filter((tab) => {
    try {
      const parsed = new URL(tab.url ?? '')
      return (
        parsed.origin === parsedTarget.origin &&
        parsed.pathname === parsedTarget.pathname
      )
    } catch {
      return false
    }
  })

  if (closeMatches.length > 0) {
    return mostRecentlyUsed(closeMatches)
  }

  // Same origin fallback (handles redirects e.g. copilot.microsoft.com -> copilot.microsoft.com/chats/...)
  const originMatches = allTabs.filter((tab) => {
    try {
      const parsed = new URL(tab.url ?? '')
      return parsed.origin === parsedTarget.origin
    } catch {
      return false
    }
  })

  return mostRecentlyUsed(originMatches)
}

async function waitForTabComplete(tabId, timeoutMs = 15000) {
  const existingTab = await chrome.tabs.get(tabId).catch(() => null)
  if (existingTab?.status === 'complete') {
    return
  }
  return new Promise((resolve) => {
    let resolved = false
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
    }, timeoutMs)

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        if (!resolved) {
          resolved = true
          clearTimeout(timer)
          chrome.tabs.onUpdated.removeListener(listener)
          resolve()
        }
      }
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CAPTURE_ACTIVE_TAB') {
    void (async () => {
      const tab = await getActiveTab()
      const snapshot = await captureTab(tab.id)
      sendResponse({ ok: true, snapshot })
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to capture tab.',
      })
    })

    return true
  }

  if (message?.type === 'FILL_ACTIVE_TAB') {
    void (async () => {
      const tab = await getActiveTab()
      const result = await fillTab(tab.id, message.fields)
      sendResponse({ ok: true, result })
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fill tab.',
      })
    })

    return true
  }

  if (message?.type === 'CAPTURE_LAST_TARGET_TAB') {
    void (async () => {
      const originTabId = _sender.tab?.id
      const tabId = await getTargetTabId()
      try {
        await focusTab(tabId)
        const snapshot = await captureTab(tabId)
        sendResponse({ ok: true, snapshot })
      } finally {
        if (originTabId != null) {
          try {
            await focusTab(originTabId)
          } catch (error) {
            console.warn('Unable to restore focus to the origin tab.', error)
          }
        }
      }
    })().catch((error) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to capture the last target tab.',
      })
    })

    return true
  }

  if (message?.type === 'FILL_LAST_TARGET_TAB') {
    void (async () => {
      const tabId = await getTargetTabId()
      const result = await fillTab(tabId, message.fields)
      sendResponse({ ok: true, result })
    })().catch((error) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fill the last target tab.',
      })
    })

    return true
  }

  if (message?.type === 'OPEN_URL_VISIBLE') {
    void (async () => {
      const originTabId = _sender.tab?.id
      const tab = await openVisibleTab(message.url)
      armAutoCaptureWatch(tab.tabId, originTabId ?? null)
      sendResponse({ ok: true, tab })
    })().catch((error) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : 'Failed to open the page.',
      })
    })

    return true
  }

  if (message?.type === 'JOB_SEARCH_ASSISTANT_PAGE_CAPTURABLE') {
    void handleAutoCaptureReady(_sender.tab?.id)
    return false
  }

  if (message?.type === 'CAPTURE_TAB_BY_URL') {
    void (async () => {
      const originTabId = _sender.tab?.id
      const tab = await findTabByUrl(message.url)

      if (!tab?.id) {
        sendResponse({
          ok: false,
          error: `No open tab found matching ${message.url}. Use go to open it first.`,
        })
        return
      }

      try {
        await focusTab(tab.id)
        const snapshot = await captureTabSnapshot(tab.id)
        lastTargetTabId = tab.id
        sendResponse({ ok: true, snapshot })
      } finally {
        if (originTabId != null) {
          try {
            await focusTab(originTabId)
          } catch (error) {
            console.warn('Unable to restore focus to the origin tab.', error)
          }
        }
      }
    })().catch((error) => {
      sendResponse({
        ok: false,
        error:
          error instanceof Error ? error.message : 'Failed to capture the tab.',
      })
    })

    return true
  }
})

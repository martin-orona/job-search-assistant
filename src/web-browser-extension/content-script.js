(() => {
  const PAGE_BRIDGE_SOURCE = 'job-search-assistant-web-ui'
  const EXTENSION_BRIDGE_SOURCE = 'job-search-assistant-extension'

function getLabelText(element) {
  if (!element.id) {
    return ''
  }

  const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
  return label?.textContent?.trim() ?? ''
}

function snapshotField(element, index) {
  return {
    index,
    tagName: element.tagName.toLowerCase(),
    type: element.getAttribute('type') ?? '',
    id: element.id ?? '',
    name: element.getAttribute('name') ?? '',
    placeholder: element.getAttribute('placeholder') ?? '',
    label: getLabelText(element),
    value: 'value' in element ? element.value : '',
  }
}

function capturePage() {
  const fields = Array.from(
    document.querySelectorAll('input, textarea, select'),
  ).map(snapshotField)

  return {
    title: document.title,
    url: location.href,
    html: document.documentElement?.outerHTML ?? '',
    text: document.body?.innerText ?? '',
    fields,
  }
}

function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element)
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')

  descriptor?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

function findFieldElement(field) {
  if (field.selector) {
    return document.querySelector(field.selector)
  }

  if (field.id) {
    return document.getElementById(field.id)
  }

  if (field.name) {
    return document.querySelector(`[name="${CSS.escape(field.name)}"]`)
  }

  if (field.placeholder) {
    return document.querySelector(
      `[placeholder="${CSS.escape(field.placeholder)}"]`,
    )
  }

  if (field.label) {
    const labels = Array.from(document.querySelectorAll('label'))
    const label = labels.find(
      (item) => item.textContent?.trim() === field.label,
    )

    if (label?.htmlFor) {
      return document.getElementById(label.htmlFor)
    }
  }

  if (typeof field.index === 'number') {
    return document.querySelectorAll('input, textarea, select')[field.index] ?? null
  }

  return null
}

function fillPage(fields) {
  const results = []

  for (const field of fields ?? []) {
    const element = findFieldElement(field)

    if (!element) {
      results.push({
        ok: false,
        field,
        error: 'Field not found.',
      })
      continue
    }

    if ('value' in element) {
      setNativeValue(element, field.value ?? '')
      results.push({
        ok: true,
        field,
      })
      continue
    }

    results.push({
      ok: false,
      field,
      error: 'Field is not editable.',
    })
  }

  return results
}

// Phrases commonly shown by anti-robot / interstitial challenge pages (Cloudflare,
// reCAPTCHA, PerimeterX, login walls, etc). If any of these are present the page is
// treated as not yet capturable and we keep polling instead of auto-capturing.
const ANTI_ROBOT_PATTERNS = [
  /just a moment/i,
  /checking your browser/i,
  /verify you are human/i,
  /verify you'?re human/i,
  /are you a robot/i,
  /i'?m not a robot/i,
  /captcha/i,
  /attention required/i,
  /access denied/i,
  /please enable javascript and cookies/i,
  /ddos protection by/i,
  /cloudflare/i,
  /sign in to continue/i,
  /please log in/i,
  /please sign in/i,
]

function looksLikeAntiRobotChallenge() {
  const title = document.title ?? ''
  const bodyText = (document.body?.innerText ?? '').slice(0, 2000)
  const haystack = `${title}\n${bodyText}`

  return ANTI_ROBOT_PATTERNS.some((pattern) => pattern.test(haystack))
}

function pageLooksCapturable() {
  if (document.readyState !== 'complete') {
    return false
  }

  if (!document.body || document.body.innerText.trim().length < 40) {
    return false
  }

  return !looksLikeAntiRobotChallenge()
}

let autoCaptureWatchTimer = null

function stopAutoCaptureWatch() {
  if (autoCaptureWatchTimer != null) {
    clearInterval(autoCaptureWatchTimer)
    autoCaptureWatchTimer = null
  }
}

function startAutoCaptureWatch() {
  stopAutoCaptureWatch()

  const checkNow = () => {
    if (!pageLooksCapturable()) {
      return
    }

    stopAutoCaptureWatch()
    try {
      chrome.runtime.sendMessage({ type: 'JOB_SEARCH_ASSISTANT_PAGE_CAPTURABLE' })
    } catch (error) {
      console.warn('[JobSearchAssistant ContentScript] Unable to report capturable page:', error)
    }
  }

  checkNow()
  autoCaptureWatchTimer = setInterval(checkNow, 1000)
}

if (window.__JOB_SEARCH_ASSISTANT_ON_MESSAGE_LISTENER__) {
  try {
    chrome.runtime.onMessage.removeListener(window.__JOB_SEARCH_ASSISTANT_ON_MESSAGE_LISTENER__)
  } catch {
    // Ignore invalid context
  }
}

window.__JOB_SEARCH_ASSISTANT_ON_MESSAGE_LISTENER__ = (message, _sender, sendResponse) => {
  if (message?.type === 'JOB_SEARCH_ASSISTANT_CAPTURE_PAGE') {
    sendResponse(capturePage())
    return
  }

  if (message?.type === 'JOB_SEARCH_ASSISTANT_FILL_PAGE') {
    sendResponse({
      results: fillPage(message.fields),
    })
    return
  }

  if (message?.type === 'JOB_SEARCH_ASSISTANT_START_AUTO_CAPTURE_WATCH') {
    startAutoCaptureWatch()
    sendResponse({ ok: true })
    return
  }

  if (message?.type === 'JOB_SEARCH_ASSISTANT_AUTO_CAPTURE_TRIGGER') {
    // This tab is the Job Search Assistant web UI tab; relay the trigger to
    // the page so it can invoke the Capture button.
    window.postMessage(
      {
        source: EXTENSION_BRIDGE_SOURCE,
        type: 'AUTO_CAPTURE_TRIGGER',
      },
      '*',
    )
    sendResponse({ ok: true })
    return
  }
}

try {
  chrome.runtime.onMessage.addListener(window.__JOB_SEARCH_ASSISTANT_ON_MESSAGE_LISTENER__)
} catch (err) {
  console.warn('[JobSearchAssistant ContentScript] Unable to register chrome.runtime.onMessage listener:', err)
}

if (!window.__JOB_SEARCH_ASSISTANT_PAGE_BRIDGE_LISTENER_ADDED__) {
  window.__JOB_SEARCH_ASSISTANT_PAGE_BRIDGE_LISTENER_ADDED__ = true

  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return
    }

    const message = event.data
    if (!message || message.source !== PAGE_BRIDGE_SOURCE) {
      return
    }

    console.log('[JobSearchAssistant ContentScript] Received bridge message from page:', message.type, message)

    void (async () => {
      if (message.type === 'PING_EXTENSION') {
        window.postMessage(
          {
            source: EXTENSION_BRIDGE_SOURCE,
            requestId: message.requestId,
            response: { ok: true },
          },
          '*',
        )
        return
      }

      if (message.type === 'CAPTURE_LAST_TARGET_TAB') {
        const response = await chrome.runtime.sendMessage({
          type: 'CAPTURE_LAST_TARGET_TAB',
        })

        window.postMessage(
          {
            source: EXTENSION_BRIDGE_SOURCE,
            requestId: message.requestId,
            response,
          },
          '*',
        )
        return
      }

      if (message.type === 'FILL_LAST_TARGET_TAB') {
        const response = await chrome.runtime.sendMessage({
          type: 'FILL_LAST_TARGET_TAB',
          fields: message.fields,
        })

        window.postMessage(
          {
            source: EXTENSION_BRIDGE_SOURCE,
            requestId: message.requestId,
            response,
          },
          '*',
        )
        return
      }

      if (message.type === 'OPEN_URL_VISIBLE') {
        const response = await chrome.runtime.sendMessage({
          type: 'OPEN_URL_VISIBLE',
          url: message.url,
        })

        window.postMessage(
          {
            source: EXTENSION_BRIDGE_SOURCE,
            requestId: message.requestId,
            response,
          },
          '*',
        )
        return
      }

      if (message.type === 'CAPTURE_TAB_BY_URL') {
        const response = await chrome.runtime.sendMessage({
          type: 'CAPTURE_TAB_BY_URL',
          url: message.url,
        })

        window.postMessage(
          {
            source: EXTENSION_BRIDGE_SOURCE,
            requestId: message.requestId,
            response,
          },
          '*',
        )
      }
    })()
  })
}
})()

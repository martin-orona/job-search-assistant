const pageBridgeSource = 'job-search-assistant-web-ui'
const extensionBridgeSource = 'job-search-assistant-extension'

type BridgeResponse<T> = {
  ok: boolean
  snapshot?: T
  result?: T
  error?: string
}

function createRequestId() {
  return crypto.randomUUID()
}

function postBridgeMessage(message: Record<string, unknown>) {
  window.postMessage(
    {
      source: pageBridgeSource,
      ...message,
    },
    '*',
  )
}

export function requestCaptureFromExtension<T = unknown>() {
  return requestBridge<BridgeResponse<T>>('CAPTURE_LAST_TARGET_TAB')
}

export function requestCaptureByUrlFromExtension<T = unknown>(url: string) {
  return requestBridge<BridgeResponse<T>>('CAPTURE_TAB_BY_URL', { url })
}

export function requestFillFromExtension(fields: unknown[]) {
  return requestBridge<BridgeResponse<unknown>>('FILL_LAST_TARGET_TAB', {
    fields,
  })
}

/**
 * Subscribes to the extension's notification that the tab opened via "Go" is
 * now loaded and free of anti-robot challenges, so the caller can auto-press
 * Capture. Returns an unsubscribe function.
 */
export function onAutoCaptureTrigger(callback: () => void) {
  const handleMessage = (event: MessageEvent) => {
    const message = event.data
    if (
      !message ||
      message.source !== extensionBridgeSource ||
      message.type !== 'AUTO_CAPTURE_TRIGGER'
    ) {
      return
    }

    callback()
  }

  window.addEventListener('message', handleMessage)
  return () => window.removeEventListener('message', handleMessage)
}

export function requestOpenUrlFromExtension(url: string) {
  return requestBridge<BridgeResponse<{ tabId?: number; url?: string }>>(
    'OPEN_URL_VISIBLE',
    {
      url,
    },
  )
}

function requestBridge<TResponse>(
  type:
    | 'PING_EXTENSION'
    | 'CAPTURE_LAST_TARGET_TAB'
    | 'CAPTURE_TAB_BY_URL'
    | 'FILL_LAST_TARGET_TAB'
    | 'OPEN_URL_VISIBLE',
  extra?: Record<string, unknown>,
  timeoutMs = 60000,
) {
  const requestId = createRequestId()

  return new Promise<TResponse>((resolve, reject) => {
    console.log(`[JobSearchAssistant Bridge] Requesting '${type}' (ID: ${requestId}):`, extra)

    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('message', handleMessage)
      console.warn(`[JobSearchAssistant Bridge] '${type}' timed out after ${timeoutMs}ms`)
      reject(
        new Error(
          'The browser extension did not respond. Make sure it is installed and the Web UI page has been reloaded.',
        ),
      )
    }, timeoutMs)

    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (!message || message.source !== extensionBridgeSource) {
        return
      }

      if (message.requestId !== requestId) {
        return
      }

      window.removeEventListener('message', handleMessage)
      window.clearTimeout(timeoutId)

      const response = message.response as BridgeResponse<unknown> | undefined
      console.log(`[JobSearchAssistant Bridge] Received response for '${type}':`, response)

      if (!response) {
        reject(new Error('Extension returned an empty response.'))
        return
      }

      if (!response.ok) {
        reject(new Error(response.error ?? 'Extension request failed.'))
        return
      }

      resolve(response as TResponse)
    }

    window.addEventListener('message', handleMessage)
    postBridgeMessage({
      type,
      requestId,
      ...(extra ?? {}),
    })
  })
}

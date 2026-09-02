async function sendMessage(message) {
  return chrome.runtime.sendMessage(message)
}

function renderOutput(element, value) {
  element.textContent =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

document.addEventListener('DOMContentLoaded', async () => {
  const captureButton = document.getElementById('capture-button')
  const captureOutput = document.getElementById('capture-output')
  const fillInput = document.getElementById('fill-input')
  const fillButton = document.getElementById('fill-button')
  const fillOutput = document.getElementById('fill-output')

  const stored = await chrome.storage.local.get(['lastSnapshot', 'lastFill'])
  if (stored.lastSnapshot) {
    renderOutput(captureOutput, stored.lastSnapshot)
  }
  if (stored.lastFill) {
    renderOutput(fillOutput, stored.lastFill)
  }

  captureButton.addEventListener('click', async () => {
    renderOutput(captureOutput, 'Capturing...')
    const response = await sendMessage({ type: 'CAPTURE_ACTIVE_TAB' })

    if (!response?.ok) {
      renderOutput(captureOutput, response?.error ?? 'Capture failed.')
      return
    }

    await chrome.storage.local.set({ lastSnapshot: response.snapshot })
    renderOutput(captureOutput, response.snapshot)
  })

  fillButton.addEventListener('click', async () => {
    let fields

    try {
      fields = JSON.parse(fillInput.value)
    } catch (error) {
      renderOutput(fillOutput, error instanceof Error ? error.message : 'Invalid JSON.')
      return
    }

    renderOutput(fillOutput, 'Filling...')
    const response = await sendMessage({ type: 'FILL_ACTIVE_TAB', fields })

    if (!response?.ok) {
      renderOutput(fillOutput, response?.error ?? 'Fill failed.')
      return
    }

    await chrome.storage.local.set({ lastFill: response.result })
    renderOutput(fillOutput, response.result)
  })
})

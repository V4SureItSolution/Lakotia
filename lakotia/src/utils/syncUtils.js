const SYNC_CHANNEL_NAME = "lakhotia_app_data_sync";

let broadcastChannel = null;
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  try {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
  } catch (e) {
    console.warn("BroadcastChannel not supported or failed to initialize:", e);
  }
}

/**
 * Broadcast a data change event to all open browser tabs/windows.
 * @param {string} type - Event type e.g. 'TASK_UPDATED', 'QUOTATION_UPDATED', 'STOCK_UPDATED'
 * @param {object} payload - Optional extra details
 */
export const notifyDataChange = (type = "DATA_UPDATED", payload = {}) => {
  const timestamp = Date.now();
  
  // 1. Broadcast via BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, payload, timestamp });
    } catch (e) {
      console.warn("Error broadcasting message:", e);
    }
  }

  // 2. Broadcast via localStorage (triggers window 'storage' event across tabs)
  try {
    localStorage.setItem("lakhotia_sync_event", JSON.stringify({ type, payload, timestamp }));
  } catch (e) {
    // Ignore quota or security errors
  }
};

/**
 * Subscribe a component to data change notifications across tabs and window focus.
 * @param {function} callback - Function to run when a data change is received
 * @param {number} pollIntervalMs - Optional periodic polling interval (default 5000ms = 5s)
 * @returns {function} Cleanup function to unsubscribe
 */
export const subscribeToDataSync = (callback, pollIntervalMs = 5000) => {
  if (typeof window === "undefined") return () => {};

  // 1. BroadcastChannel listener
  const handleBroadcast = (event) => {
    if (event && event.data && callback) {
      callback(event.data);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", handleBroadcast);
  }

  // 2. Storage event listener (for cross-tab storage changes)
  const handleStorage = (event) => {
    if (event.key === "lakhotia_sync_event" && event.newValue && callback) {
      try {
        const data = JSON.parse(event.newValue);
        callback(data);
      } catch (e) {
        callback({ type: "DATA_UPDATED" });
      }
    }
  };
  window.addEventListener("storage", handleStorage);

  // 3. Window focus listener (re-sync when switching back to tab)
  const handleFocus = () => {
    if (callback) callback({ type: "WINDOW_FOCUSED" });
  };
  window.addEventListener("focus", handleFocus);

  // 4. Polling timer for real-time background sync
  let intervalId = null;
  if (pollIntervalMs > 0) {
    intervalId = setInterval(() => {
      if (document.visibilityState === "visible" && callback) {
        callback({ type: "POLL_SYNC" });
      }
    }, pollIntervalMs);
  }

  // Cleanup function
  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("focus", handleFocus);
    if (intervalId) clearInterval(intervalId);
  };
};

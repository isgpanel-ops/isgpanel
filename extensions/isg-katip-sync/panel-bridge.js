const PANEL_BRIDGE_SOURCE = "ISG_PANEL_PAGE";
const EXTENSION_BRIDGE_SOURCE = "ISG_PANEL_ISG_KATIP_EXTENSION";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const message = event.data;
  if (!message || message.source !== PANEL_BRIDGE_SOURCE) return;
  if (message.type !== "ISG_KATIP_SYNC_REQUEST") return;

  chrome.runtime.sendMessage(
    {
      type: "PANEL_ISG_KATIP_SYNC",
      apiBase: message.apiBase,
      token: message.token,
    },
    (response) => {
      window.postMessage(
        {
          source: EXTENSION_BRIDGE_SOURCE,
          requestId: message.requestId,
          type: "ISG_KATIP_SYNC_RESPONSE",
          response,
        },
        window.location.origin
      );
    }
  );
});

const PANEL_BRIDGE_SOURCE = "ISG_PANEL_PAGE";
const EXTENSION_BRIDGE_SOURCE = "ISG_PANEL_ISG_KATIP_EXTENSION";

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const message = event.data;
  if (!message || message.source !== PANEL_BRIDGE_SOURCE) return;
  if (message.type !== "ISG_KATIP_SYNC_REQUEST" && message.type !== "ISG_KATIP_RUN_JOB_REQUEST") return;

  chrome.runtime.sendMessage(
    {
      type: message.type === "ISG_KATIP_RUN_JOB_REQUEST" ? "PANEL_ISG_KATIP_RUN_NEXT_JOB" : "PANEL_ISG_KATIP_SYNC",
      apiBase: message.apiBase,
      token: message.token,
      gorevTuru: message.gorevTuru,
      firmaId: message.firmaId,
    },
    (response) => {
      const runtimeError = chrome.runtime.lastError?.message;
      window.postMessage(
        {
          source: EXTENSION_BRIDGE_SOURCE,
          requestId: message.requestId,
          type: message.type === "ISG_KATIP_RUN_JOB_REQUEST" ? "ISG_KATIP_RUN_JOB_RESPONSE" : "ISG_KATIP_SYNC_RESPONSE",
          response: runtimeError ? { ok: false, message: runtimeError } : response,
        },
        window.location.origin
      );
    }
  );
});

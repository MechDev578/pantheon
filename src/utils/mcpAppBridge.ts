import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';

let connected = false;

/**
 * Connects to the Antigravity MCP App host when embedded in an MCP App iframe.
 * Safely no-ops when running standalone in a browser or Electron desktop window.
 */
export function connectMcpAppHostIfEmbedded(): void {
  if (connected || typeof window === 'undefined') {
    return;
  }

  // Only attempt the postMessage MCP App handshake when hosted inside an iframe
  if (window.parent === window) {
    return;
  }

  connected = true;
  const app = new App({ name: 'Pantheon', version: '2.2.1' }, {});

  app.ontoolinput = () => {};
  app.ontoolresult = () => {};
  app.onhostcontextchanged = (ctx) => {
    if (ctx.theme) {
      applyDocumentTheme(ctx.theme);
    }
    if (ctx.styles?.variables) {
      applyHostStyleVariables(ctx.styles.variables);
    }
  };

  void app
    .connect()
    .then(() => {
      const ctx = app.getHostContext();
      if (ctx?.theme) {
        applyDocumentTheme(ctx.theme);
      }
      if (ctx?.styles?.variables) {
        applyHostStyleVariables(ctx.styles.variables);
      }
    })
    .catch(() => {
      // Ignore if embedded in a non-MCP iframe
    });
}

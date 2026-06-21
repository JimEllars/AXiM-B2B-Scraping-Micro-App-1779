export const logError = (anomalyType, errorDetails) => {
  const payload = {
    telemetry_envelope: {
      project_id: "AXIM_B2B_SCRAPER",
      environment: import.meta.env.MODE,
      timestamp: new Date().toISOString()
    },
    event_payload: {
      event_type: anomalyType,
      severity: "HIGH",
      error_message: errorDetails?.message || String(errorDetails),
      stack_trace: errorDetails?.stack || "",
      metadata: { route: window.location.pathname }
    }
  };

  // Fire to the Core Telemetry Ingest Endpoint
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      try {
        navigator.sendBeacon('https://api.axim.us.com/v1/telemetry/ingest', JSON.stringify(payload));
      } catch (e) {
        console.error("Telemetry dispatch failed", e);
      }
    });
  } else {
    // Fallback for older browsers
    fetch('https://api.axim.us.com/v1/telemetry/ingest', {
        method: 'POST',
        keepalive: true,
        body: JSON.stringify(payload)
    }).catch(console.error);
  }
};
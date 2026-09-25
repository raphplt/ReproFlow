// Serialized into Chromium by Playwright; keep this function self-contained.
export function installCapture(config: { origin: string }) {
  if (window.top !== window || location.origin !== config.origin) return;
  const bridge = window as unknown as {
    __reproflowEvent: (data: unknown) => Promise<void>;
    __reproflowControl: (action: string) => Promise<{ state: string }>;
  };
  const targets = [
    "edit-address",
    "postal-code",
    "save-address",
    "address-form",
    "checkout",
  ];
  const paths = ["/cart", "/checkout", "/api/checkout"];
  const path = () =>
    paths.includes(location.pathname) ? location.pathname : "[REDACTED]";
  let queue = Promise.resolve();
  const enqueue = (operation: () => Promise<unknown>) => {
    queue = queue
      .then(operation)
      .then(() => undefined)
      .catch(() => undefined);
    return queue;
  };
  const send = (data: unknown) => enqueue(() => bridge.__reproflowEvent(data));
  for (const type of ["click", "input", "submit"]) {
    document.addEventListener(
      type,
      (event) => {
        const element = event.target;
        if (
          !(element instanceof Element) ||
          element.closest("#reproflow-controls")
        )
          return;
        const candidate = element.closest("[data-testid]");
        const id = candidate?.getAttribute("data-testid");
        const target = id && targets.includes(id) ? id : "unknown";
        if (type === "input") {
          let value = "[REDACTED]";
          // Only two explicitly synthetic demo values can leave the page.
          if (
            element instanceof HTMLInputElement &&
            element.type !== "password" &&
            !element.closest("[data-sensitive]") &&
            target === "postal-code" &&
            ["75001", "69001"].includes(element.value)
          )
            value = element.value;
          void send({ type, pagePath: path(), target, value });
        } else if (target !== "unknown") {
          void send({ type, pagePath: path(), target });
        }
      },
      true,
    );
  }
  // Observe SPA URL changes as well as full-document navigation handled by Playwright.
  for (const name of ["pushState", "replaceState"] as const) {
    const original = history[name].bind(history);
    history[name] = (...args: Parameters<History[typeof name]>) => {
      original(args[0], args[1], args[2]);
      void send({ type: "navigation", pagePath: path() });
    };
  }
  window.addEventListener("popstate", () => {
    void send({ type: "navigation", pagePath: path() });
  });
  window.addEventListener("hashchange", () => {
    void send({ type: "navigation", pagePath: path() });
  });

  document.addEventListener("DOMContentLoaded", async () => {
    const host = document.createElement("aside");
    host.id = "reproflow-controls";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:2147483647;width:min(900px,calc(100% - 32px));color:#edf3ff;font:13px system-ui;box-sizing:border-box}
      *{box-sizing:border-box}.panel{padding:18px 20px;background:#202c3cf5;border:1px solid #5e7693;border-radius:12px;box-shadow:0 12px 60px #0008;backdrop-filter:blur(12px)}
      .top{display:flex;gap:12px;align-items:center;margin-bottom:10px}.label{font-weight:750;letter-spacing:1px;font-size:11px}.state{color:#a9c8ff;font-size:12px}p{margin:0 0 12px;line-height:1.5;color:#b6c4d7;font-size:12px}.actions{display:flex;gap:8px;flex-wrap:wrap}button{border:1px solid #617899;border-radius:5px;background:#2b3e59;color:white;padding:9px 13px;font:600 12px system-ui;cursor:pointer}button:first-child{background:#aacbff;color:#132744}button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:3px solid #aacbff;outline-offset:3px}label{font-size:12px;display:flex;align-items:center;gap:8px;margin-bottom:12px}input{accent-color:#aacbff}
    </style><div class="panel"><div class="top"><span class="label">● REPROFLOW</span><span class="state" role="status">Prêt à enregistrer</span></div><p>Capture locale de cette démo. Seuls les codes postaux fictifs 75001 / 69001 sont conservés. Aucun texte libre, header ou corps réseau.</p><label><input type="checkbox" data-testid="confirm-expected">Comportement attendu : atteindre /checkout après la commande.</label><div class="actions"><button data-testid="start-recording">Démarrer la capture</button><button data-testid="mark-broken" disabled>Marquer cet état comme cassé</button><button data-testid="stop-recording" disabled>Arrêter et exporter</button></div></div>`;
    const start = root.querySelector<HTMLButtonElement>(
      '[data-testid="start-recording"]',
    );
    const mark = root.querySelector<HTMLButtonElement>(
      '[data-testid="mark-broken"]',
    );
    const stop = root.querySelector<HTMLButtonElement>(
      '[data-testid="stop-recording"]',
    );
    const confirm = root.querySelector<HTMLInputElement>("input");
    const status = root.querySelector<HTMLElement>(".state");
    if (!start || !mark || !stop || !confirm || !status) return;
    const update = (state: string) => {
      const recording = state === "recording" || state === "marked";
      start.disabled = state !== "ready";
      mark.disabled = !recording || !confirm.checked;
      stop.disabled = !recording;
      status.textContent =
        state === "recording"
          ? "Enregistrement en cours"
          : state === "marked"
            ? "État cassé marqué · attendu confirmé"
            : state === "stopped"
              ? "Capture terminée"
              : "Prêt à enregistrer";
    };
    let state = (await bridge.__reproflowControl("status")).state;
    if (state === "marked") confirm.checked = true;
    update(state);
    confirm.addEventListener("change", () => update(state));
    for (const [button, action] of [
      [start, "start"],
      [mark, "mark"],
      [stop, "stop"],
    ] as const) {
      button.addEventListener("click", () => {
        button.disabled = true;
        void enqueue(async () => {
          try {
            state = (await bridge.__reproflowControl(action)).state;
            update(state);
            if (action === "start") location.assign("/cart");
          } catch {
            status.textContent = "Capture indisponible. Consulter le terminal.";
          }
        });
      });
    }
    document.body.append(host);
  });
}

import { startDemoShop } from "@reproflow/demo-shop";
import { exportTrace } from "./export.js";
import { launchRecorder } from "./recorder.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--fixed"))
    throw new Error("Usage: pnpm demo [--fixed]");
  const shop = await startDemoShop({ fixed: args.includes("--fixed") });
  let recorder: Awaited<ReturnType<typeof launchRecorder>> | undefined;
  const cancel = () => {
    void recorder?.close();
  };
  try {
    recorder = await launchRecorder({ baseUrl: shop.url });
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    console.info(`Demo Shop : ${shop.url}/cart`);
    console.info(
      "Dans Chromium : démarrer, modifier le code postal en 69001, enregistrer, passer commande, confirmer /checkout, marquer puis exporter.",
    );
    const trace = await recorder.finished;
    if (!trace) {
      console.info("Capture annulée, aucun export.");
      return;
    }
    const path = await exportTrace(trace, "artifacts/recordings");
    console.info(`Trace ${trace.status} : ${path}`);
    console.info(
      `${trace.events.length} événements. Capture enregistrée ; aucun test généré ni verdict de reproduction à ce stade.`,
    );
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
    await recorder?.close();
    await shop.close();
  }
}

main().catch(() => {
  console.error(
    "Impossible de terminer la capture. Vérifie Chromium (pnpm browser:install), la session graphique et les droits sur artifacts/. Aucun détail de page n’est journalisé.",
  );
  process.exitCode = 1;
});

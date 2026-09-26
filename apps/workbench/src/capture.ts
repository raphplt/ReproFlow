import { startDemoShop } from "@reproflow/demo-shop";
import { launchRecorder } from "@reproflow/recorder";

export async function captureDemo(automated: boolean, signal?: AbortSignal) {
  const shop = await startDemoShop();
  let recorder: Awaited<ReturnType<typeof launchRecorder>> | undefined;
  const cancel = () => {
    void recorder?.close().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    recorder = await launchRecorder({ baseUrl: shop.url, headless: automated });
    if (signal?.aborted) {
      await recorder.close();
      return null;
    }
    if (automated) {
      const { page } = recorder;
      await page.getByTestId("start-recording").click();
      await page
        .getByText("Enregistrement en cours", { exact: true })
        .waitFor();
      await page.getByTestId("edit-address").click();
      await page.getByTestId("postal-code").fill("69001");
      await page.getByTestId("save-address").click();
      await page.getByTestId("checkout").click();
      await page.getByRole("alert").waitFor({ state: "visible" });
      // Automated acceptance uses the explicitly specified synthetic fixture oracle.
      await page.getByTestId("confirm-expected").check();
      await page.getByTestId("mark-broken").click();
      await page.getByText("État cassé marqué · attendu confirmé").waitFor();
      await page.getByTestId("stop-recording").click();
    }
    return await recorder.finished;
  } finally {
    signal?.removeEventListener("abort", cancel);
    await recorder?.close();
    await shop.close();
  }
}

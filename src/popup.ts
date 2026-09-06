import { gatewayStorageKey, normalizeGateway } from "./gateway-settings.js";

const form = document.querySelector<HTMLFormElement>("#gateway-form")!;
const input = document.querySelector<HTMLInputElement>("#gateway")!;
const save = document.querySelector<HTMLButtonElement>("#save")!;
const remove = document.querySelector<HTMLButtonElement>("#remove")!;
const show = document.querySelector<HTMLButtonElement>("#show")!;
const message = document.querySelector<HTMLParagraphElement>("#status")!;

function busy(value: boolean) {
  input.disabled = value;
  save.disabled = value;
  remove.disabled = value;
}

show.addEventListener("click", () => {
  const visible = input.type === "password";
  input.type = visible ? "text" : "password";
  show.textContent = visible ? "Hide" : "Show";
  show.setAttribute("aria-pressed", String(visible));
});

async function persist(value: string) {
  let gateway: string | undefined;
  try {
    gateway = normalizeGateway(value);
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "Invalid gateway URL.";
    input.focus();
    return;
  }
  busy(true);
  try {
    if (gateway) {
      await chrome.storage.local.set({ [gatewayStorageKey]: gateway });
    } else {
      await chrome.storage.local.remove(gatewayStorageKey);
    }
    input.value = gateway ?? "";
    message.textContent = gateway
      ? "Saved. Used on your next IPFS request."
      : "Removed. Using the three public gateways.";
  } catch {
    message.textContent = "Could not save settings. Please try again.";
  } finally {
    busy(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void persist(input.value);
});
remove.addEventListener("click", () => void persist(""));

void chrome.storage.local.get(gatewayStorageKey).then((stored) => {
  const value: unknown = stored[gatewayStorageKey];
  input.value = typeof value === "string" ? value : "";
  message.textContent = input.value ? "Custom gateway saved." : "Using the three public gateways.";
  busy(false);
}).catch(() => {
  message.textContent = "Could not load settings. Close this popup and try again.";
});

const jsonDataUrlPrefix = "data:application/json;base64,";
const jsonDataUrlPattern = /^data:application\/json;base64,[A-Za-z0-9+/]+={0,2}$/i;

export function dataUrlMediaType(value: string): string | undefined {
  const match = /^data:((?:image|application)\/[a-z0-9!#$&^_.+-]+)((?:;[a-z0-9!#$&^_.+-]+=[^;,\s]+)*)(;base64)?,([^\s]*)$/i.exec(value);
  if (!match || /%(?![a-f0-9]{2})/i.test(match[4])) {
    return undefined;
  }
  if (match[3]) {
    try {
      if (!isValidBase64Payload(decodeURIComponent(match[4]))) {
        return undefined;
      }
    } catch {
      return undefined;
    }
  }
  return match[1].toLowerCase();
}

export function isJSONDataUrl(value: string) {
  return jsonDataUrlPattern.test(value) && isValidBase64Payload(value.slice(jsonDataUrlPrefix.length));
}

export function decodeJSONDataUrl(value: string) {
  const dataUrl = value.trim();
  if (!dataUrl.toLowerCase().startsWith(jsonDataUrlPrefix)) {
    return null;
  }

  const payload = dataUrl.slice(jsonDataUrlPrefix.length);
  if (payload === "") {
    throw new Error("JSON data URI is missing a base64 payload");
  }
  if (!isValidBase64Payload(payload)) {
    throw new Error("JSON data URI contains invalid base64");
  }

  let binaryString = "";
  try {
    binaryString = atob(normalizeBase64Payload(payload));
  } catch {
    throw new Error("JSON data URI contains invalid base64");
  }

  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("JSON data URI payload is not valid UTF-8");
  }
}

function isValidBase64Payload(payload: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    return false;
  }

  const unpaddedPayload = payload.replace(/=+$/, "");
  return unpaddedPayload.length % 4 !== 1;
}

function normalizeBase64Payload(payload: string) {
  const unpaddedPayload = payload.replace(/=+$/, "");
  const paddingLength = (4 - (unpaddedPayload.length % 4)) % 4;
  return unpaddedPayload + "=".repeat(paddingLength);
}

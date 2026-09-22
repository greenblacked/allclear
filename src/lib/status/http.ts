const USER_AGENT = "AllClear/1.0 (status board; official sources only)";
const DEFAULT_TIMEOUT_MS = 9000;

export class SourceError extends Error {
  // Declared as a field rather than a constructor parameter property:
  // parameter properties are not erasable, so they break Node's type
  // stripping and TypeScript's own `erasableSyntaxOnly`.
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "SourceError";
    this.status = status;
  }
}

export async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number; binary?: boolean } = {},
): Promise<{ body: string; bytes: ArrayBuffer; contentType: string; status: number }> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, binary, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        Accept: "application/json, application/xml, text/xml, text/javascript, */*",
        "User-Agent": USER_AGENT,
        ...(rest.headers ?? {}),
      },
      cache: "no-store",
    });
    const bytes = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      throw new SourceError(`${response.status} ${response.statusText} from ${url}`, response.status);
    }
    let body: string;
    if (binary) {
      const bom = new Uint8Array(bytes.slice(0, 2));
      if (bom[0] === 0xfe && bom[1] === 0xff) {
        body = new TextDecoder("utf-16be").decode(bytes.slice(2));
      } else if (bom[0] === 0xff && bom[1] === 0xfe) {
        body = new TextDecoder("utf-16le").decode(bytes.slice(2));
      } else {
        body = new TextDecoder("utf-16le").decode(bytes);
      }
    } else {
      body = new TextDecoder("utf-8").decode(bytes);
    }
    return { body, bytes, contentType, status: response.status };
  } catch (error) {
    if (error instanceof SourceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SourceError(`Timed out fetching ${url}`);
    }
    throw new SourceError(error instanceof Error ? error.message : `Failed to fetch ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit & { timeoutMs?: number; binary?: boolean }): Promise<T> {
  const { body } = await fetchText(url, init);
  const trimmed = body.replace(/^\uFEFF/, "").trim();
  const jsonPayload = unwrapJsonp(trimmed);
  return JSON.parse(jsonPayload) as T;
}

function unwrapJsonp(payload: string): string {
  const match = payload.match(/^[A-Za-z_$][\w$]*\(([\s\S]*)\)\s*;?\s*$/);
  return match?.[1] ? match[1] : payload;
}

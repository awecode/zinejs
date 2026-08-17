type MapUpsert = {
  getOrInsert?: (key: unknown, defaultValue: unknown) => unknown;
  getOrInsertComputed?: (key: unknown, callbackfn: (key: unknown) => unknown) => unknown;
};

const mapProto = Map.prototype as typeof Map.prototype & MapUpsert;

/**
 * pdf.js 6 uses Map/WeakMap getOrInsert and getOrInsertComputed (Chrome 135+, Firefox 136+,
 * Node 23+). Samsung Internet and other lagged Chromium forks throw
 * `this[#methodPromises].getOrInsertComputed is not a function` while rasterizing.
 *
 * Capture the gap before we patch the main thread, so the pdf.js worker (a separate realm)
 * still gets a blob wrapper that installs the same shim.
 */
const workerNeedsUpsertShim =
  typeof Map === 'undefined' || typeof mapProto.getOrInsertComputed !== 'function';

type UpsertProto = {
  has(key: unknown): boolean;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): unknown;
};

function patchUpsert(proto: UpsertProto): void {
  const p = proto as UpsertProto & {
    getOrInsert?: (key: unknown, defaultValue: unknown) => unknown;
    getOrInsertComputed?: (key: unknown, callbackfn: (key: unknown) => unknown) => unknown;
  };
  if (typeof p.getOrInsert !== 'function') {
    Object.defineProperty(p, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function (this: UpsertProto, key: unknown, defaultValue: unknown) {
        if (this.has(key)) return this.get(key);
        this.set(key, defaultValue);
        return defaultValue;
      },
    });
  }
  if (typeof p.getOrInsertComputed !== 'function') {
    Object.defineProperty(p, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function (
        this: UpsertProto,
        key: unknown,
        callbackfn: (key: unknown) => unknown,
      ) {
        if (this.has(key)) return this.get(key);
        const value = callbackfn(key);
        this.set(key, value);
        return value;
      },
    });
  }
}

/** Same body as patchUpsert, inlined so the worker blob has no imports. */
const WORKER_SHIM = `(function(){function p(o){if(typeof o.getOrInsert!=="function"){Object.defineProperty(o,"getOrInsert",{configurable:true,writable:true,value:function(k,d){if(this.has(k))return this.get(k);this.set(k,d);return d}})}if(typeof o.getOrInsertComputed!=="function"){Object.defineProperty(o,"getOrInsertComputed",{configurable:true,writable:true,value:function(k,f){if(this.has(k))return this.get(k);var v=f(k);this.set(k,v);return v}})}}if(typeof Map!=="undefined")p(Map.prototype);if(typeof WeakMap!=="undefined")p(WeakMap.prototype)})();`;

const wrappedWorkers = new Map<string, string>();

export function installMapUpsertPolyfill(): void {
  if (typeof Map !== 'undefined') patchUpsert(Map.prototype);
  if (typeof WeakMap !== 'undefined') patchUpsert(WeakMap.prototype);
}

installMapUpsertPolyfill();

/** When the engine lacks upsert, point pdf.js at a module-worker blob that shims, then imports `src`. */
export function wrapPdfWorkerSrc(src: string): string {
  if (!workerNeedsUpsertShim || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return src;
  }
  const cached = wrappedWorkers.get(src);
  if (cached) return cached;
  const abs =
    typeof location !== 'undefined' && location.href ? new URL(src, location.href).href : src;
  const blob = URL.createObjectURL(
    new Blob([`${WORKER_SHIM}import ${JSON.stringify(abs)};`], { type: 'text/javascript' }),
  );
  wrappedWorkers.set(src, blob);
  return blob;
}

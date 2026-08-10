import { afterEach, beforeEach } from 'vitest';
import { releaseHash } from './src/engine/deeplink';

/**
 * Every test file shares one window, so a book that writes its page into the URL leaves that
 * page behind for whatever is constructed next — which would then open on it instead of its own
 * `startPage`. Reset the hash, and the single-owner claim that goes with it, around each test.
 */
function reset(): void {
  releaseHash();
  if (typeof location !== 'undefined' && location.hash) {
    history.replaceState(history.state, '', location.pathname + location.search);
  }
}

beforeEach(reset);
afterEach(reset);

import { afterEach, beforeEach } from 'vitest';

/**
 * Every test file shares one window, so a book that writes its page into the URL leaves that page
 * behind for whatever is constructed next — which would then open on it instead of its own
 * `startPage`. Clear the hash around each test.
 *
 * Deliberately does *not* release the single-owner claim. Most suites never destroy their books,
 * so those stay bound and keep writing the URL as they turn; handing the claim to each new book
 * as well would leave several live books fighting over the hash, and each other's writes would
 * arrive as navigations. Leaving the claim held reproduces what a real page does with more than
 * one book: the first owns the URL, the rest ignore it.
 */
function clearHash(): void {
  if (typeof location !== 'undefined' && location.hash) {
    history.replaceState(history.state, '', location.pathname + location.search);
  }
}

beforeEach(clearHash);
afterEach(clearHash);

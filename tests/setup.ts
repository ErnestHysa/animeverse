/**
 * Test setup file for Vitest
 * Global test configuration and mocks
 */

import { vi } from 'vitest';

// Mock WebRTC for WebTorrent tests
global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
  createDataChannel: vi.fn(),
  createOffer: vi.fn(),
  createAnswer: vi.fn(),
  setLocalDescription: vi.fn(),
  setRemoteDescription: vi.fn(),
  close: vi.fn(),
})) as any;

global.RTCDataChannel = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as any;

// Mock MediaSource for video player tests
global.MediaSource = vi.fn().mockImplementation(() => ({
  addSourceBuffer: vi.fn(),
  endOfStream: vi.fn(),
  readyState: 'open',
})) as any;

// Mock TextTrack for subtitle tests
global.TextTrack = vi.fn().mockImplementation(() => ({
  addCue: vi.fn(),
  removeCue: vi.fn(),
  mode: 'showing',
})) as any;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock navigator
Object.defineProperty(global.navigator, 'serviceWorker', {
  value: {
    register: vi.fn(),
    ready: Promise.resolve({}),
  },
  writable: true,
});

// Mock fetch if not already available
if (!global.fetch) {
  global.fetch = vi.fn();
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(callback, 0) as unknown as number;
};

global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// Suppress console errors in tests unless debugging
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('Warning: componentWillMount') || args[0]?.includes?.('Warning: componentWillReceiveProps')) return;
  originalError(...args);
};

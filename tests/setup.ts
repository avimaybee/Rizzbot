import { GlobalWindow } from 'happy-dom';
import { expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";

// Initialize happy-dom
const window = new GlobalWindow();
global.window = window as any;
global.document = window.document as any;
global.navigator = window.navigator as any;
global.Node = window.Node as any;
global.Element = window.Element as any;
global.HTMLElement = window.HTMLElement as any;

// Add jest-dom matchers
expect.extend(matchers);

class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }

  get length() {
    return Object.keys(this.store).length;
  }

  key(index: number) {
    return Object.keys(this.store)[index] || null;
  }
}

global.localStorage = new LocalStorageMock() as any;

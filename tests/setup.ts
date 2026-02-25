import { GlobalWindow } from 'happy-dom';
import { expect } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";

// Initialize happy-dom
const window = new GlobalWindow();
const document = window.document;

// @ts-ignore
global.window = window;
// @ts-ignore
global.document = document;
// @ts-ignore
global.navigator = window.navigator;
// @ts-ignore
global.Node = window.Node;
// @ts-ignore
global.Element = window.Element;
// @ts-ignore
global.HTMLElement = window.HTMLElement;
// @ts-ignore
global.HTMLAnchorElement = window.HTMLAnchorElement;
// @ts-ignore
global.HTMLButtonElement = window.HTMLButtonElement;
// @ts-ignore
global.HTMLInputElement = window.HTMLInputElement;
// @ts-ignore
global.HTMLTextAreaElement = window.HTMLTextAreaElement;
// @ts-ignore
global.HTMLSelectElement = window.HTMLSelectElement;
// @ts-ignore
global.HTMLFormElement = window.HTMLFormElement;
// @ts-ignore
global.HTMLDivElement = window.HTMLDivElement;
// @ts-ignore
global.HTMLSpanElement = window.HTMLSpanElement;
// @ts-ignore
global.HTMLHeadingElement = window.HTMLHeadingElement;
// @ts-ignore
global.HTMLParagraphElement = window.HTMLParagraphElement;
// @ts-ignore
global.HTMLUListElement = window.HTMLUListElement;
// @ts-ignore
global.HTMLLIElement = window.HTMLLIElement;
// @ts-ignore
global.HTMLImageElement = window.HTMLImageElement;

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

// @ts-ignore
global.localStorage = new LocalStorageMock();

import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test";
import { render, cleanup, act } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { LoadingScreen } from "./LoadingScreen";
import "../tests/setup";

describe("LoadingScreen", () => {
  test("renders initial state with tactical labels", () => {
    const { getByText } = render(<LoadingScreen />);
    expect(getByText(/System Diagnostics/i)).toBeTruthy();
    expect(getByText(/Protocol Status/i)).toBeTruthy();
    expect(getByText(/INITIALIZING SCAN/i)).toBeTruthy();
  });

  test("renders progress percentage", () => {
    const { getByText } = render(<LoadingScreen />);
    // Initial progress might be 0% or slightly more
    const progressElement = getByText(/%/i);
    expect(progressElement).toBeTruthy();
  });

  test("renders system identifier", () => {
    const { getByText } = render(<LoadingScreen />);
    expect(getByText(/RIZZBOT_OS_V2.0/i)).toBeTruthy();
  });
});

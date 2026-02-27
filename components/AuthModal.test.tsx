import { mock } from "bun:test";

// Mock firebaseService MUST be before other imports
const mockSignInWithEmail = mock((email, password) => Promise.resolve({ uid: '123', email, displayName: 'Test User' }));
const mockSignUpWithEmail = mock((email, password, displayName) => Promise.resolve({ uid: '123', email, displayName }));
const mockSignInWithGoogle = mock(() => Promise.resolve({ uid: '123', email: 'google@test.com', displayName: 'Google User' }));
const mockResetPassword = mock((email) => Promise.resolve());

mock.module("../services/firebaseService", () => ({
  signInWithEmail: mockSignInWithEmail,
  signUpWithEmail: mockSignUpWithEmail,
  signInWithGoogle: mockSignInWithGoogle,
  resetPassword: mockResetPassword,
}));

import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { render, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { AuthModal } from "./AuthModal";
import "../tests/setup";

describe("AuthModal", () => {
  beforeEach(() => {
    mockSignInWithEmail.mockClear();
    mockSignUpWithEmail.mockClear();
    mockSignInWithGoogle.mockClear();
    mockResetPassword.mockClear();
  });

  test("renders sign in mode by default", () => {
    const { getByText, getByPlaceholderText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    expect(getByText("Sign In")).toBeTruthy();
    expect(getByPlaceholderText("USER@EXAMPLE.COM")).toBeTruthy();
    expect(getByPlaceholderText("••••••••")).toBeTruthy();
    expect(getByText("ACCESS SYSTEM")).toBeTruthy();
  });

  test("switches to signup mode", () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    const initializeBtn = getByText("Initialize");
    fireEvent.click(initializeBtn);
    
    expect(getByPlaceholderText("ENTER DISPLAY NAME")).toBeTruthy();
    expect(getByText("INITIALIZE")).toBeTruthy();
    expect(queryByPlaceholderText("••••••••")).toBeTruthy();
  });

  test("switches to reset password mode", () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    const forgotBtn = getByText("Forgot password?");
    fireEvent.click(forgotBtn);
    
    expect(getByText("Reset Credentials")).toBeTruthy();
    expect(queryByPlaceholderText("••••••••")).toBeNull();
    expect(getByText("SEND LINK")).toBeTruthy();
  });

  test("calls signInWithEmail on sign in form submission", async () => {
    const onAuthSuccess = mock(() => {});
    const { getByLabelText, getByText } = render(<AuthModal onAuthSuccess={onAuthSuccess} />);
    
    const emailInput = getByLabelText(/EMAIL ADDRESS/i) as HTMLInputElement;
    const passwordInput = getByLabelText(/PASSWORD/i) as HTMLInputElement;
    
    act(() => {
      emailInput.value = "test@example.com";
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      passwordInput.value = "password123";
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    // Check if value updated in DOM
    expect(emailInput.value).toBe("test@example.com");
    
    const submitBtn = getByText("ACCESS SYSTEM");
    act(() => {
      fireEvent.click(submitBtn);
    });
    
    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalled();
    });

    const calls = mockSignInWithEmail.mock.calls;
    expect(calls[0][0]).toBe("test@example.com");
    expect(calls[0][1]).toBe("password123");
    
    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalled();
    });
  });

  test("calls signUpWithEmail on sign up form submission", async () => {
    const onAuthSuccess = mock(() => {});
    const { getByLabelText, getByText } = render(<AuthModal onAuthSuccess={onAuthSuccess} />);
    
    // Switch to signup
    act(() => {
      fireEvent.click(getByText("Initialize"));
    });
    
    const nameInput = getByLabelText(/CODENAME/i) as HTMLInputElement;
    const emailInput = getByLabelText(/EMAIL ADDRESS/i) as HTMLInputElement;
    const passwordInput = getByLabelText(/PASSWORD/i) as HTMLInputElement;
    
    act(() => {
      fireEvent.input(nameInput, { target: { value: "Agent Smith" } });
      fireEvent.input(emailInput, { target: { value: "smith@example.com" } });
      fireEvent.input(passwordInput, { target: { value: "password123" } });
    });
    
    act(() => {
      fireEvent.click(getByText("INITIALIZE"));
    });
    
    await waitFor(() => {
      expect(mockSignUpWithEmail).toHaveBeenCalled();
    });

    const calls = mockSignUpWithEmail.mock.calls;
    expect(calls[0][0]).toBe("smith@example.com");
    expect(calls[0][1]).toBe("password123");
    expect(calls[0][2]).toBe("Agent Smith");
    
    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalled();
    });
  });

  test("calls resetPassword on reset form submission", async () => {
    const onAuthSuccess = mock(() => {});
    const { getByLabelText, getByText } = render(<AuthModal onAuthSuccess={onAuthSuccess} />);
    
    // Switch to reset
    act(() => {
      fireEvent.click(getByText("Forgot password?"));
    });
    
    const emailInput = getByLabelText(/EMAIL ADDRESS/i) as HTMLInputElement;
    act(() => {
      fireEvent.input(emailInput, { target: { value: "reset@example.com" } });
    });
    
    act(() => {
      fireEvent.click(getByText("SEND LINK"));
    });
    
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith("reset@example.com");
    });
    
    await waitFor(() => {
      expect(getByText("Reset link sent! Check your email.")).toBeTruthy();
    });
  });

  test("displays error message from firebase service", async () => {
    mockSignInWithEmail.mockImplementation(() => Promise.reject({ code: 'auth/wrong-password' }));
    
    const { getByLabelText, getByText, findByText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    const emailInput = getByLabelText(/EMAIL ADDRESS/i) as HTMLInputElement;
    const passwordInput = getByLabelText(/PASSWORD/i) as HTMLInputElement;
    
    act(() => {
      fireEvent.input(emailInput, { target: { value: "test@example.com" } });
      fireEvent.input(passwordInput, { target: { value: "wrong" } });
    });
    
    act(() => {
      fireEvent.click(getByText("ACCESS SYSTEM"));
    });
    
    const errorMsg = await findByText(/Wrong password/i);
    expect(errorMsg).toBeTruthy();
  });

  test("calls signInWithGoogle", async () => {
    const onAuthSuccess = mock(() => {});
    const { getByText } = render(<AuthModal onAuthSuccess={onAuthSuccess} />);
    
    fireEvent.click(getByText("Continue with Google"));
    
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalled();
    });
  });
});

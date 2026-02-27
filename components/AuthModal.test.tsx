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
    
    expect(getByText("Login")).toBeTruthy();
    expect(getByPlaceholderText("user@system.secure")).toBeTruthy();
    expect(getByPlaceholderText("••••••••••••")).toBeTruthy();
    expect(getByText("Sign In")).toBeTruthy();
  });

  test("switches to signup mode", () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    const initializeBtn = getByText("Register");
    fireEvent.click(initializeBtn);
    
    expect(getByPlaceholderText("e.g. AGENT_007")).toBeTruthy();
    expect(getByText("Initiate System")).toBeTruthy();
    expect(queryByPlaceholderText("••••••••••••")).toBeTruthy();
  });

  test("switches to reset password mode", () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    const forgotBtn = getByText("Forgot Security Keyphrase?");
    fireEvent.click(forgotBtn);
    
    expect(getByText("Password Reset")).toBeTruthy();
    expect(queryByPlaceholderText("••••••••••••")).toBeNull();
    expect(getByText("Dispatch Link")).toBeTruthy();
  });

  test("calls signInWithEmail on sign in form submission", async () => {
    const onAuthSuccess = mock(() => {});
    const { getByLabelText, getByText } = render(<AuthModal onAuthSuccess={onAuthSuccess} />);
    
    const emailInput = getByLabelText(/Comm Address/i) as HTMLInputElement;
    const passwordInput = getByLabelText(/Security Keyphrase/i) as HTMLInputElement;
    
    act(() => {
      emailInput.value = "test@example.com";
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      passwordInput.value = "password123";
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    const submitBtn = getByText("Sign In");
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
      fireEvent.click(getByText("Register"));
    });
    
    const nameInput = getByLabelText(/Operator Codename/i) as HTMLInputElement;
    const emailInput = getByLabelText(/Comm Address/i) as HTMLInputElement;
    const passwordInput = getByLabelText(/Security Keyphrase/i) as HTMLInputElement;
    
    act(() => {
      nameInput.value = "Agent Smith";
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      emailInput.value = "smith@example.com";
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      passwordInput.value = "password123";
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    act(() => {
      fireEvent.click(getByText("Initiate System"));
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
      fireEvent.click(getByText("Forgot Security Keyphrase?"));
    });
    
    const emailInput = getByLabelText(/Comm Address/i) as HTMLInputElement;
    act(() => {
      emailInput.value = "reset@example.com";
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    act(() => {
      fireEvent.click(getByText("Dispatch Link"));
    });
    
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith("reset@example.com");
    });
    
    await waitFor(() => {
      expect(getByText(/RECOVERY PROTOCOLS DISPATCHED/i)).toBeTruthy();
    });
  });

  test("displays error message from firebase service", async () => {
    mockSignInWithEmail.mockImplementation(() => Promise.reject({ code: 'auth/wrong-password' }));
    
    const { getByLabelText, getByText, findByText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    const emailInput = getByLabelText(/Comm Address/i) as HTMLInputElement;
    const passwordInput = getByLabelText(/Security Keyphrase/i) as HTMLInputElement;
    
    act(() => {
      emailInput.value = "test@example.com";
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      passwordInput.value = "wrong";
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    act(() => {
      fireEvent.click(getByText("Sign In"));
    });
    
    const errorMsg = await findByText(/ACCESS DENIED/i);
    expect(errorMsg).toBeTruthy();
  });

  test("calls signInWithGoogle", async () => {
    const onAuthSuccess = mock(() => {});
    const { getByText } = render(<AuthModal onAuthSuccess={onAuthSuccess} />);
    
    fireEvent.click(getByText(/Continue with Google/i));
    
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalled();
    });
  });
});

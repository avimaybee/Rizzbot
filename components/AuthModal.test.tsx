import { expect, test, describe, mock, beforeEach, afterEach, spyOn } from "bun:test";
import { render, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import React from "react";
// @ts-ignore
import { AuthModal } from "./AuthModal";
import "../tests/setup";

// Mock firebaseService
const mockSignInWithEmail = mock(() => Promise.resolve({ uid: '123' }));
const mockSignUpWithEmail = mock(() => Promise.resolve({ uid: '123' }));
const mockSignInWithGoogle = mock(() => Promise.resolve({ uid: '123' }));
const mockResetPassword = mock(() => Promise.resolve());

mock.module("../services/firebaseService", () => ({
  signInWithEmail: mockSignInWithEmail,
  signUpWithEmail: mockSignUpWithEmail,
  signInWithGoogle: mockSignInWithGoogle,
  resetPassword: mockResetPassword,
}));

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
    act(() => {
      fireEvent.click(initializeBtn);
    });
    
    expect(getByPlaceholderText("ENTER DISPLAY NAME")).toBeTruthy();
    expect(getByText("INITIALIZE")).toBeTruthy();
    expect(queryByPlaceholderText("••••••••")).toBeTruthy();
  });

  test("switches to reset password mode", () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(<AuthModal onAuthSuccess={() => {}} />);
    
    const forgotBtn = getByText("Forgot password?");
    act(() => {
      fireEvent.click(forgotBtn);
    });
    
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
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
    });
    
    act(() => {
      fireEvent.click(getByText("ACCESS SYSTEM"));
    });
    
    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith("test@example.com", "password123");
    });
    
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
      fireEvent.change(nameInput, { target: { value: "Agent Smith" } });
      fireEvent.change(emailInput, { target: { value: "smith@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "password123" } });
    });
    
    act(() => {
      fireEvent.click(getByText("INITIALIZE"));
    });
    
    await waitFor(() => {
      expect(mockSignUpWithEmail).toHaveBeenCalledWith("smith@example.com", "password123", "Agent Smith");
    });
    
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
      fireEvent.change(emailInput, { target: { value: "reset@example.com" } });
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
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
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
    
    act(() => {
      fireEvent.click(getByText("Continue with Google"));
    });
    
    await waitFor(() => {
      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalled();
    });
  });
});

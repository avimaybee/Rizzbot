from playwright.sync_api import sync_playwright

def verify_auth_modal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a mobile device
        context = browser.new_context(
            viewport={"width": 375, "height": 667},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"
        )
        page = context.new_page()
        page.goto("http://localhost:3000/")

        # Wait for the AuthModal to be visible
        page.wait_for_selector("text=THE RIZZBOT")

        # Take a screenshot
        page.screenshot(path="auth_modal_mobile.png")
        print("Screenshot saved to auth_modal_mobile.png")
        browser.close()

if __name__ == "__main__":
    verify_auth_modal()

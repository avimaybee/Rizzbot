from playwright.sync_api import sync_playwright
import time

def verify_internal_screens():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Emulate a mobile device
        context = browser.new_context(
            viewport={"width": 375, "height": 667},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"
        )
        page = context.new_page()
        page.goto("http://localhost:3000/")

        # Login
        page.fill('input[type="email"]', "testuser_12345@example.com")
        page.fill('input[type="password"]', "Password123")
        page.click('button:has-text("ACCESS SYSTEM")')

        # Wait for navigation to complete (Standby screen)
        try:
            page.wait_for_selector("text=COMMAND CENTER", timeout=10000)
        except:
            print("Login timeout or failure. Taking debug screenshot.")
            page.screenshot(path="login_debug.png")
            browser.close()
            return

        page.screenshot(path="standby_mobile.png")
        print("Standby screen saved.")

        # Navigate to Quick Mode using bottom tab
        # Using a more specific selector to target the mobile bottom bar
        page.locator('.fixed.bottom-0 button:has-text("QUICK")').first.click()
        time.sleep(1) # Animation wait
        page.screenshot(path="quick_advisor_mobile.png")
        print("Quick Advisor screen saved.")

        browser.close()

if __name__ == "__main__":
    verify_internal_screens()

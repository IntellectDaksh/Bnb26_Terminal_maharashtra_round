import { expect, test, type Page } from "@playwright/test";

// Mock mode. ?scenario= jumps one event's in-browser backend to a state.
const EV = "bit-n-build-2026";
const base = `/events/${EV}`;
const scenario = (page: Page, name: string, step = "status") => page.goto(`${base}/${step}?scenario=${name}`);

test("browse catalog, open an event, register, queue, reserve, confirm", async ({ page }) => {
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("drop");
  await expect(page.locator(`a[href="${base}"]`)).toBeVisible();
  await scenario(page, "registration_open", "");
  await page.getByRole("link", { name: /join the drop/i }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/register`));
  await page.getByRole("button", { name: /continue with google/i }).click();
  await expect(page.getByText(/demo account/i)).toBeVisible();
  await page.getByLabel("College / organization").selectOption({ index: 1 });
  await page.getByLabel(/i confirm i am eligible/i).check();
  const go = page.getByRole("button", { name: /^continue/i });
  await expect(go).toBeEnabled({ timeout: 20_000 }); // Turnstile test key passes on its own
  await go.click();
  await expect(page).toHaveURL(new RegExp(`${base}/queue`));
  await expect(page.getByRole("heading", { name: /in the pool/i })).toBeVisible();

  await scenario(page, "admitted", "queue");
  await expect(page).toHaveURL(new RegExp(`${base}/reservation`));
  await page.getByRole("button", { name: /reserve my seat/i }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/confirmed`));
  await expect(page.getByTestId("ticket-id")).toBeVisible();

  await page.goto("/my-tickets");
  await expect(page.getByText("Confirmed").first()).toBeVisible();
});

test("refresh and second tab keep the same position", async ({ page, context }) => {
  await scenario(page, "queued");
  await expect(page).toHaveURL(/\/queue/);
  await expect(page.getByText("Position restored")).toBeVisible();
  await expect(page.getByText("142", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("142", { exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${base}/register`);
  await expect(second).toHaveURL(/\/queue/);
  await expect(second.getByText("142", { exact: true })).toBeVisible();
});

test("refresh on reservation and ticket lands on the same screen", async ({ page }) => {
  await scenario(page, "admitted");
  await expect(page).toHaveURL(/\/reservation/);
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText("Reservation restored")).toBeVisible();
  await scenario(page, "confirmed");
  await expect(page).toHaveURL(/\/confirmed/);
  const id = await page.getByTestId("ticket-id").textContent();
  await page.getByRole("link", { name: /view my ticket/i }).click();
  await expect(page).toHaveURL(/\/ticket/);
  await page.reload();
  await expect(page.getByTestId("ticket-id")).toHaveText(id!);
});

test("double submit yields one ticket", async ({ page }) => {
  await scenario(page, "admitted");
  await page.getByRole("button", { name: /reserve my seat/i }).dblclick();
  await expect(page).toHaveURL(/\/confirmed/);
  const id = await page.getByTestId("ticket-id").textContent();
  await page.goto(`${base}/reservation`);
  await expect(page).toHaveURL(/\/confirmed/);
  await expect(page.getByTestId("ticket-id")).toHaveText(id!);
});

test("reservation expiring while open moves to a calm end state", async ({ page }) => {
  await scenario(page, "expiring");
  await expect(page).toHaveURL(/\/reservation/);
  await expect(page).toHaveURL(/\/status/, { timeout: 35_000 });
  await expect(page.getByRole("heading", { name: /your reservation expired/i })).toBeVisible();
});

test("429 shows a retry-after state, not a crash", async ({ page }) => {
  await scenario(page, "admitted");
  await expect(page).toHaveURL(/\/reservation/);
  await scenario(page, "rate_limited", "reservation");
  await page.getByRole("button", { name: /reserve my seat/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: /try again in \d+s/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /try again in/i })).toBeDisabled();
});

test("connection drop shows reconnecting, then recovers", async ({ page }) => {
  await scenario(page, "queued");
  await expect(page).toHaveURL(/\/queue/);
  await scenario(page, "offline", "queue");
  // fresh load during the outage: calm restoring state, then the same position once the server answers
  await expect(page.getByText(/restoring your queue position/i)).toBeVisible();
  await expect(page.getByText("142", { exact: true })).toBeVisible({ timeout: 40_000 });
});

test("other events are independent", async ({ page }) => {
  await scenario(page, "confirmed");
  await page.goto("/events/courtyard-comedy");
  await expect(page.getByText("Sold out").first()).toBeVisible();
  await page.goto("/events/monsoon-sessions");
  await expect(page.getByText(/registration closed/i).first()).toBeVisible();
});

test("non-admin is blocked from /admin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /admins only/i })).toBeVisible();
});

test("admin queue fairness renders evidence", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: /continue as demo admin/i }).click();
  await page.goto(`/admin/queue?event=${EV}`);
  await expect(page.getByText(/FIFO/).first()).toBeVisible();
  await expect(page.getByText(/jain/i).first()).toBeVisible();
});

test("no horizontal scroll on key pages", async ({ page }) => {
  for (const path of ["/", "/events", base, "/my-tickets"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

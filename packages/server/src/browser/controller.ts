import { chromium, Browser, BrowserContext, Page, Route, Request as PwRequest } from 'playwright';
import { FormField, FormInfo, ButtonInfo, CapturedRequest, CapturedResponse } from '../types.js';

export class PlaywrightController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private capturedRequests: { request: CapturedRequest; response: CapturedResponse }[] = [];
  private isIntercepting = false;

  async launch(headless = true): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    this.page = await this.context.newPage();
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Give a brief moment for any JS-driven rendering
    await this.page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  }

  async screenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    const buffer = await this.page.screenshot({ fullPage: true });
    return buffer.toString('base64');
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    return this.page.url();
  }

  async getPageTitle(): Promise<string> {
    if (!this.page) throw new Error('Browser not launched');
    return this.page.title();
  }

  async getPageLinks(): Promise<string[]> {
    if (!this.page) throw new Error('Browser not launched');
    const links = await this.page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map((a) => (a as HTMLAnchorElement).href).filter((href) => href && !href.startsWith('javascript:'));
    });
    return [...new Set(links)];
  }

  async getPageForms(): Promise<FormInfo[]> {
    if (!this.page) throw new Error('Browser not launched');
    const pageUrl = this.page.url();

    const forms = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('form')).map((form) => {
        const fields = Array.from(form.querySelectorAll('input, select, textarea'))
          .filter((el) => {
            const input = el as HTMLInputElement;
            return input.type !== 'hidden' && input.name;
          })
          .map((el) => {
            const input = el as HTMLInputElement;
            return {
              name: input.name || '',
              type: input.type || 'text',
              id: input.id || '',
              placeholder: input.placeholder || '',
              value: input.value || '',
            };
          });

        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        const submitText = submitBtn?.textContent?.trim() || submitBtn?.getAttribute('value') || 'Submit';

        return {
          action: form.action || '',
          method: (form.method || 'GET').toUpperCase(),
          fields,
          submitText,
        };
      });
    });

    return forms.map((f) => ({ ...f, pageUrl }));
  }

  async getButtons(): Promise<ButtonInfo[]> {
    if (!this.page) throw new Error('Browser not launched');
    const pageUrl = this.page.url();

    const buttons = await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('button:not([type="submit"]), a.btn, [role="button"]')).map(
        (el, index) => {
          const text = el.textContent?.trim() || '';
          const type = el.getAttribute('type') || 'button';
          return {
            text,
            type,
            selector: el.id ? `#${el.id}` : `button:nth-of-type(${index + 1})`,
          };
        }
      );
    });

    return buttons.map((b) => ({ ...b, pageUrl }));
  }

  async loginWithCredentials(username: string, password: string): Promise<boolean> {
    if (!this.page) throw new Error('Browser not launched');

    try {
      // Find email/username field
      const emailSelector = 'input[type="email"], input[name="email"], input[name="username"]';
      const passwordSelector = 'input[type="password"], input[name="password"]';

      await this.page.waitForSelector(emailSelector, { timeout: 5000 });
      await this.page.fill(emailSelector, username);
      await this.page.fill(passwordSelector, password);

      // Click submit button
      const submitSelector = 'button[type="submit"], input[type="submit"]';
      await this.page.click(submitSelector);

      // Wait for navigation away from login page
      await this.page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async fillAndSubmit(formSelector: string, fields: { name: string; value: string }[]): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');

    for (const field of fields) {
      const selector = `${formSelector} [name="${field.name}"]`;
      await this.page.fill(selector, field.value);
    }

    const submitBtn = await this.page.$(`${formSelector} button[type="submit"], ${formSelector} input[type="submit"]`);
    if (submitBtn) {
      await submitBtn.click();
    } else {
      // Try pressing Enter on the last field
      const lastField = fields[fields.length - 1];
      await this.page.press(`${formSelector} [name="${lastField.name}"]`, 'Enter');
    }

    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }

  async startIntercepting(): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    this.capturedRequests = [];
    this.isIntercepting = true;

    await this.page.route('**/api/**', async (route: Route) => {
      const request = route.request();

      if (this.isIntercepting) {
        const reqData: CapturedRequest = {
          method: request.method(),
          url: request.url(),
          headers: await request.allHeaders(),
          body: request.postData() || null,
        };

        // Continue the route and capture the response
        const response = await route.fetch();
        const resBody = await response.text();

        const resData: CapturedResponse = {
          status: response.status(),
          headers: response.headers(),
          body: resBody,
        };

        this.capturedRequests.push({ request: reqData, response: resData });

        await route.fulfill({
          status: response.status(),
          headers: response.headers(),
          body: resBody,
        });
      } else {
        await route.continue();
      }
    });
  }

  async stopIntercepting(): Promise<{ request: CapturedRequest; response: CapturedResponse }[]> {
    this.isIntercepting = false;
    if (this.page) {
      await this.page.unroute('**/api/**');
    }
    const captured = [...this.capturedRequests];
    this.capturedRequests = [];
    return captured;
  }

  async makeApiRequest(
    url: string,
    method: string,
    body?: Record<string, string>
  ): Promise<{ status: number; body: string; request: CapturedRequest; response: CapturedResponse }> {
    if (!this.page) throw new Error('Browser not launched');

    // Execute fetch from within the browser context (uses existing cookies)
    const result = await Promise.race([
      this.page.evaluate(
        async ({ url, method, body }) => {
          const opts: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          };
          if (body && method !== 'GET') {
            opts.body = JSON.stringify(body);
          }
          const res = await fetch(url, opts);
          const text = await res.text();
          return {
            status: res.status,
            body: text,
            headers: Object.fromEntries(res.headers.entries()),
          };
        },
        { url, method, body }
      ),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('API request timeout')), 15000)),
    ]);

    const capturedReq: CapturedRequest = {
      method,
      url,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : null,
    };

    const capturedRes: CapturedResponse = {
      status: result.status,
      headers: result.headers,
      body: result.body,
    };

    return {
      status: result.status,
      body: result.body,
      request: capturedReq,
      response: capturedRes,
    };
  }

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

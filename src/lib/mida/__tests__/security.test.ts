// Assert-based tests for the security primitives (run: npm run test:mida).
import assert from "node:assert";
import { isPrivateAddress, assertPublicUrl } from "../net";
import { detectFormat } from "../images";
import { registrableDomain } from "../scraper/sizeguide";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

async function main() {
  await test("isPrivateAddress blocks loopback, private and metadata ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
    ]) {
      assert.strictEqual(isPrivateAddress(ip), true, `${ip} must be blocked`);
    }
  });

  await test("isPrivateAddress allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"]) {
      assert.strictEqual(isPrivateAddress(ip), false, `${ip} must be allowed`);
    }
  });

  await test("assertPublicUrl rejects internal targets and bad schemes/ports", async () => {
    const blocked = [
      "http://127.0.0.1/admin",
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/",
      "http://[::1]/",
      "file:///etc/passwd",
      "ftp://example.com/x",
      "http://example.com:22/",
    ];
    for (const url of blocked) {
      await assert.rejects(
        () => assertPublicUrl(url),
        `${url} must be rejected`
      );
    }
  });

  await test("assertPublicUrl accepts a normal public product URL", async () => {
    const url = await assertPublicUrl("https://example.com/product/1");
    assert.strictEqual(url.hostname, "example.com");
  });

  await test("detectFormat identifies real image bytes, not claimed types", () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(16),
    ]);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16),
    ]);
    const webp = Buffer.concat([
      Buffer.from("RIFF"),
      Buffer.alloc(4),
      Buffer.from("WEBP"),
      Buffer.alloc(8),
    ]);
    const script = Buffer.from("<script>alert(1)</script>            ");

    assert.strictEqual(detectFormat(jpeg), "jpeg");
    assert.strictEqual(detectFormat(png), "png");
    assert.strictEqual(detectFormat(webp), "webp");
    assert.strictEqual(detectFormat(script), "unknown");
    assert.strictEqual(detectFormat(Buffer.alloc(4)), "unknown");
  });

  await test("registrableDomain handles multi-part suffixes like co.il", () => {
    assert.strictEqual(
      registrableDomain("www.maniajeans.co.il"),
      "maniajeans.co.il"
    );
    // The old two-label rule collapsed this to "co.il", making every Israeli
    // store look like the same site.
    assert.notStrictEqual(registrableDomain("evil.co.il"), "co.il");
    assert.strictEqual(registrableDomain("shop.example.com"), "example.com");
    assert.strictEqual(registrableDomain("example.com"), "example.com");
  });

  console.log(`\n${passed} security tests passed`);
}

main();

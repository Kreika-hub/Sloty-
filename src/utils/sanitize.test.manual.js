import { html, escapeHTML } from './sanitize.js';

console.log("=== MANUAL TEST: HTML SANITIZATION ===");

const testCases = [
    {
        name: "1. Basic String",
        template: (v) => html`<div>${v}</div>`,
        input: "Hello World"
    },
    {
        name: "2. Script Injection",
        template: (v) => html`<p>User: ${v}</p>`,
        input: "<script>alert('xss')</script>"
    },
    {
        name: "3. Quotes and Ampersands",
        template: (v) => html`<div class="user-desc">${v}</div>`,
        input: 'John "The Boss" & Jane <Doe>'
    },
    {
        name: "4. Multiple Variables",
        template: (v1, v2) => html`<div><h1>${v1}</h1><p>${v2}</p></div>`,
        input: ["<Title>", "Tom & Jerry's Place"]
    },
    {
        name: "5. Non-string variables (numbers, booleans)",
        template: (v) => html`<span>Count: ${v}</span>`,
        input: 42
    }
];

testCases.forEach((tc, i) => {
    console.log(`\n--- Test Case ${tc.name} ---`);
    if (Array.isArray(tc.input)) {
        console.log("Input:", tc.input);
        console.log("Output:", tc.template(...tc.input));
    } else {
        console.log("Input:", tc.input);
        console.log("Output:", tc.template(tc.input));
    }
});

console.log("\n=== TEST COMPLETE ===");

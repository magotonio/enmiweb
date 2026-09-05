# Browser Interaction and Verification Rules

## Strict Policy on Browser Usage
- **DO NOT** use the `browser_subagent` or launch browser sessions to test or verify UI/code changes unless the user **explicitly** asks to do so in their prompt (e.g., "haz una prueba en el navegador").
- **DO NOT** hijack the user's mouse, keyboard, or screen for automated browser recordings.
- The development server (`npm run start`) runs continuously with Live Reload / HMR. The user verifies UI results directly in their own open browser window.

## How to Verify Changes
- Verify code through static analysis, TypeScript compilation checks, or linting.
- If automated tests are needed, run headless unit tests (e.g., `npm test`) or verify compilation output without opening visual browser windows.
- Once code edits are done, simply inform the user so they can observe the updated view immediately in their browser.

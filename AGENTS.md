# Project Guidelines

## Browser Verification Policy
- **Never open the browser or run `browser_subagent` automatically** to test UI modifications.
- The user has `npm run start` running with hot reload and tests the UI directly.
- Only run browser interactions if the user explicitly requests it in the prompt.

# Playground community counter

The footer uses the same Cloudflare Worker and D1 approach as the workshop, with separate playground tables and `/playground/v1/` routes. It counts one visit per browser tab session and one like per stored browser identity. These are lightweight anonymous counts, not protection against deliberate manipulation. Offline likes are queued in browser storage; the count is marked as saved when it cannot be refreshed. Direct `file://` use keeps the playground working but cannot send counter requests.

## Worker deployment and maintenance

The playground route and migration were deployed to the existing `xinzelee-counter` Worker on November 20, 2026. The updated frontend must also be published to GitHub Pages for visitors to see the footer. The Worker source is maintained in the personal website's `hosting/cloudflare-counter` folder and the workshop's private full-release copy. Keep both copies aligned when updating either service.

For a fresh setup or redeployment, use the following steps in the maintained Worker checkout:

1. Copy `playground-counter.js` into `src/` and `playground-schema.sql` into the Worker folder. Preserve its existing files, routes, bindings and secrets.
2. In `src/index.js`, add `import { playgroundCounter } from './playground-counter.js';` and add `if (new URL(request.url).pathname.startsWith('/playground/v1/')) return playgroundCounter(request, env);` before the existing workshop and website routing.
3. The existing `ALLOWED_ORIGINS` already includes `https://xinzelee.github.io`. Optionally set `PLAYGROUND_ALLOWED_ORIGINS` in the existing `[vars]` to a comma-separated list including that origin and any trusted local preview origins. Origin checks limit browser access but are not authentication.
4. From the Worker folder, run `npx wrangler d1 execute xinzelee-counter --remote --file=playground-schema.sql`, then `npx wrangler deploy`. Review the current Worker configuration before deployment. Keep all Worker source checkouts aligned.
5. Deploy the updated playground to GitHub Pages. Confirm the footer loads the separate counts and a like can be saved.

The migration only adds playground-prefixed tables and a trigger. Its action tokens do not contain names, IP addresses, or location data. No Cloudflare secrets belong in the frontend or this repository.

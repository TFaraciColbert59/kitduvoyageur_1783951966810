---
name: stripe-integration
description: Use when building Stripe integrations for payments, subscriptions, webhooks, or checkout sessions.
---

# Stripe Integration

## When to Use This Skill
- Creating checkout sessions or payment intents
- Handling webhooks for payment events
- Managing subscriptions and invoices
- Implementing idempotency for safe retries

## Workflow
1. Inspect the project's installed Stripe SDK and API version; use the matching SDK documentation
2. Initialize the server-side client using a secret key from the environment
3. Create a checkout session associated with your internal order identifier
4. Redirect the user to the checkout URL
5. Handle webhooks: verify signatures against raw request bytes and select events appropriate to your checkout or subscription flow
6. For subscriptions: define the price, subscription lifecycle, and business state transitions using the SDK version installed in the project
7. Use stable idempotency keys for retried supported POST requests; make webhook business effects resistant to duplicate and out-of-order delivery
8. Test with Stripe CLI: `stripe listen --forward-to localhost:4242/webhook`

## Rules
- Never expose the secret key in client-side code — use publishable key
- Always verify webhook signatures before processing
- Reuse an idempotency key only for a retry of the same logical API request, not for a different order
- Test with Stripe test cards, not real cards
- Handle webhook failures — retry logic and dead-letter queues
- Use Stripe's hosted or embedded payment collection components; this checklist is not a compliance assessment
- Do not fulfill orders solely from a browser redirect; confirm the payment state server-side
- Persist event processing durably and test recovery from failure between receipt and the business update

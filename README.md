# SPORTSPHERE

**Every sport. Every gear. One destination.**

SPORTSPHERE is a MERN sports-commerce application with a React/TypeScript storefront and an Express/TypeScript REST API backed by MongoDB.

## Requirements

- Node.js 20.19+ or 22.12+ (Node 24 is supported) and npm
- MongoDB locally or a MongoDB Atlas connection string
- Git is optional for local development

## Run locally

1. Open a terminal in the `SPORTSPHERE` folder and install dependencies:

   ```powershell
   npm install
   npm --prefix server install
   npm --prefix client install
   ```

2. Copy `server\.env.example` to `server\.env`, then set `MONGODB_URI` and a long random `JWT_SECRET`. To provision the first admin, set `SEED_ADMIN_EMAIL` and a strong `SEED_ADMIN_PASSWORD` before seeding. If the catalogue has already been seeded, running the seed command again is safe and creates the admin account when those variables are set. Do not commit `.env`.
3. Seed the sample catalogue:

   ```powershell
   npm run seed
   ```

4. Start both applications:

   ```powershell
   npm run dev
   ```

The storefront runs at `http://localhost:5173`, the API at `http://localhost:5000`, and its health endpoint is `http://localhost:5000/api/health`.

Run the API smoke tests and production builds with `npm test` and `npm run build`.

The server refuses to start without a valid MongoDB connection and a non-placeholder JWT secret. Razorpay, Cloudinary and SMTP are optional until their features are configured; payment is never treated as successful without server-side signature verification.

If PowerShell reports that `C:\hackathon\npm` cannot be found when running npm scripts, repair the current terminal session first:

```powershell
$env:ComSpec = "$env:SystemRoot\System32\cmd.exe"
```

## Environment

See `server\.env.example`. `VITE_API_URL` may be set in `client\.env.local`; the default API URL is `http://localhost:5000/api`.

## Current implementation

The project is organized as a single repository with separate client and server packages. It includes a responsive storefront; a 40-item MongoDB seed catalogue; search, filters and sorting; cookie/JWT authentication, optional email verification, password reset and saved addresses; product reviews, cart, wishlist, coupons and sports-kit bundles; COD and Razorpay checkout with server-side signature verification; order history/cancellation, customer-visible shipment tracking and downloadable PDF invoices; local recently viewed products with sport/category-based recommendations; per-size/color variant inventory with admin stock controls and order-time reservation/restocking; product comparison; newsletter signup; and role-protected admin product, category, order, customer, coupon and review tools. Admins can update carrier and tracking details. Cloudinary product-image uploads use a server-signed upload request.

## Required configuration and scope

- This development workspace has a local MongoDB service and the sample catalogue is seeded. For a different computer, install/start MongoDB or configure MongoDB Atlas in `server\.env`, then run the seed command.
- Razorpay is configured only when test keys are supplied. No payments are simulated or marked paid without signature verification.
- Cloudinary uploads need Cloudinary credentials. SMTP is optional; when configured, it sends expiring verification and password-reset links. Without SMTP, new accounts are considered verified and password reset reports that email is unavailable.
- Shipment tracking is manually managed by admins; carrier APIs and payment refunds are not integrated. Recently viewed IDs stay in the customer's browser. Seeded products start with shared product-level inventory; admins can enable and configure per-size/color inventory from the product inventory controls. This is an academic-project baseline, not a production deployment.

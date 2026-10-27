# Cracker Catalogue

A mobile-first digital catalogue for a cracker shop. Customers browse items, pick what they want, set quantities, and see a bill **estimate** grouped by category. There is no payment flow. On submit they give their name and phone number, receive a unique **4-digit token**, and get a **PDF** they can share on WhatsApp. The shop owner looks up any order by that token in the admin portal.

- `client/` — React + Vite + TypeScript. The customer catalogue is at `/` and the admin portal at `/admin`. The item list is an [AG Grid](https://www.ag-grid.com/) (Community edition) table with a heading row per category. Phones get a compact 3-column layout; screens 900px and wider get the full 7-column layout.
- `server/` — Node.js + Express + SQLite (`better-sqlite3`). In production it also serves the built client.

## What customers can do

1. Browse the catalogue, search by name or code, and jump to a category from the chip bar.
2. Tick items, set quantities, and open the order sheet for a total grouped by category.
3. Submit a name and a 10-digit Indian mobile number. The server assigns a 4-digit token and the customer can download or share a PDF.
4. Open **My orders** to see orders placed on this device, copy the token, and download the PDF again.
5. Call the shop, open WhatsApp, or open the address in Google Maps when the shop has filled those in.
6. Watch a product video, or tap a product photo to see it larger.

Out-of-stock items stay visible but cannot be selected. Prices are in INR and per unit (box, packet, and so on). Totals are estimates only. No payment data is collected.

**My orders** is stored in the browser (`localStorage`), newest first, up to 30 orders. It is not an account: clearing site data, or using another phone, hides that list. The shop can still find the order from the token.

## What the shop owner can do

The admin portal at `/admin` is protected by a password. Sessions are signed JWTs.

- **Orders** — look up by 4-digit token, browse and search recent orders, and download or share the PDF again.
- **Products** — add, edit, and delete products (code, brand, name, category, price, unit, optional video URL and image, show/hide, in stock / out of stock). Select several rows to show, hide, mark in or out of stock, or delete them together.
- **Categories** — add, rename, reorder, and delete categories.
- **Shop details** — name, phone, WhatsApp number (with country code, e.g. `919876543210`), address, Google Maps link, and logo. These appear at the top of the catalogue and on every PDF.

### Bulk upload (CSV)

In **Products**, press **Bulk upload (CSV)**, download the template, fill it in, and upload it. The first row is a header.

Required columns: `code`, `name`, `price`. Optional: `category`, `brand`, `unit` (default `box`), `video_url`, `image_url`, `out_of_stock` (`yes` / `no`, default no).

- Each item code must be unique, both inside the file and against products already in the catalogue.
- Price cannot be less than 0.
- A blank category puts the item in **Misc**. Categories that do not exist yet are created automatically.
- Every uploaded product is shown in the catalogue.
- If any row fails validation, nothing is uploaded. The pop-up lists each problem with its line number.

### Product codes

Every product has a **code** (for example `SPA001`). Leave *Product code* blank when adding a product and one is generated from the brand (or the item name) plus a running number.

### Logo and product images

The shop logo and each product image can be a **web link** or a file **uploaded from the device** (PNG, JPG, GIF, or WebP, up to 5 MB; large photos are shrunk automatically). Uploaded files live in an `uploads/` folder next to the database (`server/data/uploads/` by default) and are served from `/uploads`. Include that folder in backups. In a bulk CSV, `image_url` accepts web links only.

### Product videos

Paste a YouTube, Vimeo, Google Drive, or direct `.mp4` link in a product's **Video URL**. Items with a video show a **Watch video** button that plays it in a pop-up. Other links open in a new tab.

### Google Maps

In **Shop details**, paste a share link from `maps.google.com`, `google.com/maps`, `goo.gl/maps`, or `maps.app.goo.gl`. A map button then appears next to the address on the catalogue.

## How tokens work

Every submitted order gets a random 4-digit token (1000–9999) that is unique among orders from the last `TOKEN_REUSE_DAYS` days (default 30). Older tokens can be reused, because there are only 9,000 possible values. In **Admin → Orders**, type the token to see the customer's name, phone, items grouped by category, and total. If an old token matches several orders, they are all listed (newest first) with their name and date.

Order prices are copied into the order when it is submitted, so later price changes never alter old orders. The server recalculates prices and totals itself and does not trust the browser. Hidden and out-of-stock products cannot be ordered. Order submissions are rate-limited (30 per 10 minutes per IP).

## Quick start (development)

Requires Node.js 20+.

```bash
npm install
cp server/.env.example server/.env   # then edit the values (Windows: copy)
npm run dev
```

- Catalogue: http://localhost:5173
- Admin: http://localhost:5173/admin
- API: http://localhost:4000

The first run creates `server/data/catalogue.db` and fills it with a sample shop (Sri Lakshmi Crackers), categories, and products. Change `ADMIN_PASSWORD` in `server/.env` before logging in.

To test on a phone while developing, open `http://<your-computer-ip>:5173` on the same Wi-Fi. Sharing a PDF through the phone's share sheet needs HTTPS, so test that on the deployed site.

## Production

```bash
npm install
npm run build      # builds client/dist
npm start          # serves API + client on PORT (default 4000)
```

### Environment variables (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `4000`) |
| `ADMIN_PASSWORD` | Password for `/admin` — **change it** |
| `JWT_SECRET` | Long random string used to sign admin sessions — **change it** |
| `DB_PATH` | SQLite file location (put it on a persistent disk) |
| `TOKEN_REUSE_DAYS` | A 4-digit token can be reused after this many days (default `30`) |

### Deploying

Any host that runs Node works (Render, Railway, Fly.io, a VPS). Important points:

1. Build command `npm install && npm run build`, start command `npm start`.
2. Mount a **persistent disk** and point `DB_PATH` at it. Otherwise orders, product edits, and uploaded images are lost on redeploy. Uploads are stored beside the database.
3. Serve over **HTTPS**. The WhatsApp / PDF share sheet only works on HTTPS.
4. Set `ADMIN_PASSWORD` and `JWT_SECRET`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (port 4000, restarts on change) and Vite dev server (port 5173) together |
| `npm run build` | Type-checks and builds the client into `client/dist` |
| `npm start` | Runs the production server, which serves the API and `client/dist` |

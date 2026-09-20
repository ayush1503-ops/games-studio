# Security Policy & Architecture Documentation

## 1. Authentication Architecture

- **Token Storage**: Authentication is handled via JSON Web Tokens (JWT) stored exclusively in server-signed, `HttpOnly`, `SameSite=Lax/Strict`, `Secure` (in production) cookies (`accessToken` & `refreshToken`).
- **No Plaintext Passwords**: Passwords are hashed server-side using `bcrypt` with a cost factor of **12 salt rounds**.
- **Password Reset Flow**: Cryptographically secure 32-byte tokens generated via `crypto.randomBytes(32)` are hashed (`sha256`) and stored in the database with a strict 1-hour expiration timestamp (`expiresAt`). Once used, tokens are marked invalid.
- **Session Protection**: Server verifies token validity and checks user active status in the database on every request. Tokens are invalidated upon logout.

---

## 2. Authorization Model (Role-Based Access Control)

Access control is strictly enforced on the server-side via `authMiddleware`, `requireRole`, and `superAdminOnly` middlewares. The client UI hiding buttons is treated purely as UX enhancement, **never as a security boundary**.

| Role | Administrative Scope |
|---|---|
| **SUPER_ADMIN** | Full system control: Manage admins/users, assign roles, change security settings, view activity audit logs, and trigger database backups. |
| **ADMIN** | Manage published/draft games, price changes, news posts, categories, subscribers, and website content. Restricted from user management & security settings. |
| **EDITOR** | Create and edit draft/published games and news posts. Restricted from deleting content, user management, and security settings. |

---

## 3. Database Security & SQL Injection Protection

- **ORM Parameter Binding**: All database interactions utilize **Prisma ORM**, which generates safe, parameterized SQL queries under the hood. Raw string concatenation in SQL queries (`"SELECT * FROM games WHERE title = '" + input + "'"` ) is strictly prohibited.
- **Relational Constraints**: Enforces primary keys, foreign keys (`onDelete: Cascade` / `Restrict`), unique constraints on emails/slugs/tokenHashes, and explicit column types.
- **Indexed Fields**: Performance and lookup paths are indexed on `email`, `slug`, `status`, `role`, and timestamps.

---

## 4. Input Validation & Mass Assignment Protection

- **Server-Side Schema Validation**: Every incoming request payload is validated against strict **Zod** schemas.
- **Mass Assignment Defense**: Controllers explicitly pick permitted field names (e.g. `title`, `description`, `price`, `salePrice`, `status`). Protected fields such as `id`, `role`, `createdAt`, `passwordHash`, and `permissions` cannot be injected or modified through mass body assignment.
- **Numeric & Price Constraints**: Prices must be non-negative numeric strings or valid currency representations. Negative values and invalid currencies are rejected.

---

## 5. XSS & HTML Sanitization

- **HTML Encoding**: React automatically escapes rendered strings in JSX.
- **Rich Text Sanitization**: Server-side HTML inputs (news content, game descriptions) are sanitized using `sanitize-html` to strip dangerous elements (`<script>`, `<iframe>`, `on*` event handlers, `javascript:` URLs).
- **Safe Rendering**: Direct use of `dangerouslySetInnerHTML` is avoided unless data has passed through server-side sanitization.

---

## 6. CSRF & Same-Site Protections

- Cookies enforce `SameSite=Lax` (or `SameSite=Strict` where applicable) and `HttpOnly` attributes, ensuring third-party sites cannot perform cross-site request forgery attacks.
- State-changing API endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) require authenticated session context and custom header checks (`Content-Type: application/json` / `X-Requested-With`).
- Requests are additionally rejected when `Sec-Fetch-Site: cross-site`, or when the `Origin` is neither the request host nor an allow-listed studio origin. The double-submit token (`bc_csrf` cookie + `X-CSRF-Token` header) is the third layer and remains required for cookie-authenticated mutations.

### 6.1 Header transport (embedded consoles)

Cookies cannot be used when the console is embedded in a cross-site iframe: browsers
withhold `SameSite=Lax` cookies from cross-site requests and block third-party cookies
outright, so every API call would arrive unauthenticated. The console detects this
(`window.self !== window.top`, or a failed cookie probe) and switches to the header
transport — the same short-lived JWT returned in the `/api/auth/login` response body and
sent back as `Authorization: Bearer`, kept in memory (plus `sessionStorage` when the
browser allows it).

This does not weaken the model:

- The token is identical to the cookie token and is still validated against a live,
  unrevoked `admin_sessions` row on every request; lockouts, RBAC, session revocation,
  logout-everywhere and the audit log are unchanged.
- CSRF does not apply: a cross-site attacker cannot attach an `Authorization` header
  (it is not CORS-safelisted, so a browser preflights it and unknown origins are
  refused), and a plain form post cannot set headers at all. The `Sec-Fetch-Site` and
  `Origin` guards stay in force for every request in this mode.
- The token cannot be read cross-origin, so another site cannot obtain one from the
  victim's session.
- Cookie mode remains the default wherever cookies work (including production), and a
  request carrying a Bearer token is the only case where the cookie double-submit is
  skipped; invalid or expired tokens are still rejected by the auth middleware (401),
  which is what prompts the console to refresh.

---

## 7. File Upload Security

- **Multer Handler**: Uploads are restricted to `/api/upload/image`.
- **MIME & Extension Whitelist**: Only `image/jpeg`, `image/png`, `image/webp`, and `image/gif` are accepted.
- **Size Limitation**: File uploads are capped at a maximum of **5 MB**.
- **Sanitized Filenames**: User-supplied filenames are ignored. Uploaded files are renamed using `uuid.v4()` / timestamp hashes to prevent path traversal (`../../`) and overwrites.
- **No Server Execution**: Uploads directory serves static media files with restricted execution headers.

---

## 8. Rate Limiting & Brute-Force Defenses

- **Global API Rate Limit**: 100 requests per 15 minutes per IP address.
- **Authentication Endpoint Rate Limit**: `/api/auth/login`, `/api/auth/forgot-password`, and `/api/auth/reset-password` are throttled to **10 requests per 15 minutes** to prevent brute-force credential stuffing.
- **Generic Error Messages**: Authentication failures return generic messages (`Invalid credentials`) to prevent user email enumeration.

---

## 9. Security Headers & Transport Security

Powered by `helmet` middleware:
- `X-Frame-Options: DENY` (Clickjacking defense)
- `X-Content-Type-Options: nosniff` (MIME sniffing defense)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HTTPS enforcement in production)
- `Content-Security-Policy`: Configured to permit trusted assets and block unauthorized script execution.

---

## 10. Audit Logging & Destruction Safeguards

- **Admin Activity Log**: Every privileged operation (login, create/edit/delete game, price change, user creation, settings update, backup export) logs an event to `admin_activity` with `adminUserId`, `action`, `entityType`, `entityId`, `metadata`, `ipAddress`, `userAgent`, and timestamp.
- **Destruction Safeguards**: Destructive actions (delete game, delete user, delete article) require explicit interactive confirmation through `DeleteConfirmModal`.

---

## 11. Production Backup & Recovery

- Super Admins can export a full, structured JSON backup of the entire database via `GET /api/settings/backup`.
- Automated PostgreSQL database dumps (`pg_dump`) should be scheduled daily in production environments.

---

## 12. Deployment Checklist

Before deploying to production:
- [ ] Set strong, unique secrets in `server/.env`: `JWT_SECRET`, `JWT_REFRESH_SECRET` (min 32 characters).
- [ ] Change the temporary Super Admin password from `Brainchild@2026` (or whatever `ADMIN_PASSWORD` / `TEMPORARY_ADMIN_PASSWORD` you seeded with). The console warns with a banner and the API reports `temporaryPasswordInUse: true` until it is changed — see `TEMPORARY_PASSWORD.md`.
- [ ] Verify `NODE_ENV=production` so secure cookies require HTTPS.
- [ ] Ensure HTTPS SSL/TLS certificate is active.
- [ ] Verify CORS `FRONTEND_URL` is set strictly to your production domain.
- [ ] Test `/api/health` endpoint.
- [ ] Run `npx tsx server/src/scripts/security-test.ts` to verify security assertions.

---

## Vulnerability Reporting

To report security vulnerabilities, please contact the Brainchild Games security team at **security@brainchild.games**.

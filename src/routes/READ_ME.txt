=============================================================================
API ROUTES DOCUMENTATION
=============================================================================

PURPOSE:
Defines the API endpoints (URL paths) and maps them to Controllers.
This is where Access Control (Auth Middleware) is applied.

-----------------------------------------------------------------------------
1. auth.routes.js
-----------------------------------------------------------------------------
- POST /login             (Public) - Logs in Owner or Staff.
- POST /refresh-token     (Public) - Rotates the refresh token.
- POST /register-staff    (Protected - OWNER Only) - Creates staff accounts.

-----------------------------------------------------------------------------
2. product.routes.js
-----------------------------------------------------------------------------
- GET /                   (Public) - For Customers. Supports query params 
                          (?search=...&category=...).
- POST /                  (Protected - Staff/Owner) - Create new product.
- DELETE /:id             (Protected - Staff/Owner) - Delete product.

-----------------------------------------------------------------------------
3. transaction.routes.js
-----------------------------------------------------------------------------
- POST /sale              (Protected - Staff/Owner) - Record a sale.
- POST /expense           (Protected - Staff/Owner) - Record store expense.

-----------------------------------------------------------------------------
4. image.routes.js
-----------------------------------------------------------------------------
- GET /sign-upload        (Protected) - Returns signature for Cloudinary.
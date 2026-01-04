=============================================================================
SERVICES LAYER DOCUMENTATION
=============================================================================

PURPOSE:
Contains "Pure Business Logic" and External Integrations. 
Keeps the Controllers clean by handling heavy calculations or 3rd party APIs here.

-----------------------------------------------------------------------------
1. auth.service.js
-----------------------------------------------------------------------------
- Responsible for Cryptography.
- Generates random secure strings for Refresh Tokens.
- Hashes the token using Argon2 before passing it to the Model.
- Returns the composite token "DB_ID.RANDOM_STRING" to the controller.

-----------------------------------------------------------------------------
2. image.service.js
-----------------------------------------------------------------------------
- Interface for Cloudinary (Image Cloud Provider).
- generateUploadSignature(): Creates a timestamped, HMAC-SHA1 signature 
  using the API Secret. This allows the frontend to upload directly.
- deleteImageFromCloud(): Cleanup utility used when products are deleted.
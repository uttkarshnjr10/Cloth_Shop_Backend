=============================================================================
DATABASE MODELS DOCUMENTATION - MONGODB (MONGOOSE)
=============================================================================

PURPOSE:
Defines the structure, validation rules, and relationships of our data.
We use strictly typed Schemas to ensure data integrity.

-----------------------------------------------------------------------------
1. user.model.js
-----------------------------------------------------------------------------
KEY CONCEPTS:
- SPARSE INDEXING: The 'email' and 'staffId' fields have { sparse: true }.
  This allows 'Owner' to have an email (but no staffId) and 'Staff' to 
  have a staffId (but no email) without causing Unique Constraint errors.
- SECURITY: Uses a 'pre-save' hook to hash passwords/pins using Argon2.
  Includes methods to generate JWT Access Tokens.

-----------------------------------------------------------------------------
2. product.model.js
-----------------------------------------------------------------------------
KEY CONCEPTS:
- INDEXING: Text Indexes on 'name' and 'subCategory' for fast search.
  Standard Indexes on 'category' and 'price' for filtering.
- EMBEDDED SCHEMA: Uses 'productImageSchema' (url, public_id) to ensure
  we always have the public_id needed for deletion.
- FLAGS: 'isOnline' controls visibility to customers. 'isNewArrival' and 
  'isBestSeller' are manual toggles for the UI.

-----------------------------------------------------------------------------
3. transaction.model.js
-----------------------------------------------------------------------------
KEY CONCEPTS:
- ANALYTICS OPTIMIZED: Designed for Aggregation pipelines.
- SNAPSHOTTING: Contains a 'productSnapshot' object. We do NOT rely solely
  on the 'productId' reference, because products might be deleted. 
  The snapshot preserves the history.
- INDEX: Indexed on 'createdAt' to make Weekly/Monthly charts fast.

-----------------------------------------------------------------------------
4. refreshToken.model.js
-----------------------------------------------------------------------------
KEY CONCEPTS:
- SECURITY: We store the HASH of the token, not the raw token. 
  If the DB is hacked, attackers cannot use these tokens.
- TTL: Has a Time-To-Live index to auto-delete expired tokens.
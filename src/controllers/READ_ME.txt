=============================================================================
CONTROLLER DOCUMENTATION - ANUPRIYA FASHION HUB (AFH)
=============================================================================

PURPOSE:
This folder contains the core logic for handling incoming HTTP requests. 
The controllers validate input, interact with the Database (Models), 
and return standardized API responses.

-----------------------------------------------------------------------------
1. auth.controller.js
-----------------------------------------------------------------------------
LOGIC: Dual Authentication System.
- LOGIN: Handles two types of credentials in a single flow:
  a) Owner: Uses 'email' and 'password'.
  b) Staff: Uses 'staffId' and 'pin' (mapped to password field).
- TOKEN MANAGEMENT:
  - Generates an Access Token (15 mins) -> Sent in HttpOnly Cookie.
  - Generates a Refresh Token (Long lived) -> Hashed & stored in DB.
- REFRESH LOGIC: Implements "Token Rotation". If a refresh token is used, 
  it is invalidated and replaced. If a revoked token is reused, 
  ALL tokens for that user are deleted (Security Alert).

-----------------------------------------------------------------------------
2. product.controller.js
-----------------------------------------------------------------------------
LOGIC: The Catalog & Search Engine.
- GET (getProducts): Not a simple find(). It builds a complex query:
  - Text Search (Regex on Name/Subcategory).
  - Filtering (Category, Price Range, Online Status).
  - Sorting (Newest, Price, Bestseller).
  - Pagination (Skip/Limit).
- DELETE (deleteProduct): **CRITICAL**
  - Before deleting the product from MongoDB, it loops through the 
    'images' array and calls Cloudinary to delete the actual files. 
  - Prevents "Orphaned Images" (files taking up space but not used).

-----------------------------------------------------------------------------
3. transaction.controller.js
-----------------------------------------------------------------------------
LOGIC: Point of Sale (POS) & Analytics Data.
- RECORD SALE:
  - Checks if product is In Stock.
  - Creates a Transaction Record (Type: SALE).
  - **SNAPSHOTS** the product details (Name, Category, Image) into the 
    transaction. This ensures that even if the Product is deleted later, 
    the Owner's financial reports remain accurate.
  - Updates Product status to 'OUT_OF_STOCK' and 'isOnline: false'.

-----------------------------------------------------------------------------
4. image.controller.js
-----------------------------------------------------------------------------
LOGIC: Security Gatekeeper.
- Does NOT upload files.
- Generates a "Signed Upload URL" for the frontend. 
- Allows the frontend to upload directly to Cloudinary (saving server RAM), 
  but ensures they can only upload to the allowed folder with specific 
  file types (jpg, png).
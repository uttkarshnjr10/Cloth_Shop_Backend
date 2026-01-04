=============================================================================
SOURCE CODE OVERVIEW - ANUPRIYA FASHION HUB
=============================================================================

PROJECT STRUCTURE:
- /config       : DB Connection & Env Var setups.
- /controllers  : Request Logic (Input -> Logic -> Response).
- /middlewares  : Interceptors (Auth Check, Error Handling).
- /models       : Database Schema Definitions.
- /routes       : API URL Definitions.
- /services     : Business Logic & External Tools.
- /utils        : Helpers (ApiError class, AsyncHandler wrapper).

KEY UTILITIES (in /utils):
1. ApiError.js: 
   Standardized Error Class. Use this to throw errors.
   Example: throw new ApiError(404, "Product not found");

2. ApiResponse.js:
   Standardized Success Class. Use this for all 200/201 responses.
   Ensures frontend always receives { success: true, data: ..., message: ... }

3. asyncHandler.js:
   A wrapper function. It automatically catches errors in async routes 
   and passes them to the Global Error Handler. 
   Removes the need for try-catch blocks in every controller.

GLOBAL ERROR HANDLING:
Check app.js. There is a middleware at the end that catches any 
ApiError thrown anywhere in the app and formats it safely for the client.
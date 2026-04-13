## 🐞 Problem
React.Children.only expected to receive a single React element child

## 🔍 Why it happened
Use of Comp = asChild ? Slot : 'button' in Button UI.
When asChild: true -> <Comp>...</Comp> → actually <Slot>.{multiple elements}.</Slot> 

## 🧪 What I tried
1. Using <span> to wrap content
2. Store content in variable: const content = (<>...</>) ; then use as: <Comp ...>{asChild ? children : content}</Comp>

## ✅ Final Solution
Store content in variable: const content = (<>...</>) ; then use as: <Comp ...>{asChild ? children : content}</Comp>

## 📚 Learning
This error occurs because Radix UI’s Slot component enforces a single-child constraint using React.Children.only. When asChild is enabled, the Button renders multiple children (icons, text), violating this constraint. The fix is to ensure a single wrapper element or conditionally render only one child.



## 🐞 Problem
Mixed responsibilities in Metadata (layout.tsx): putting rendering config inside SEO config.

## 🔍 Why it happened
Defining the viewport and theme-color in Metadata

## 🧪 What I tried
Read Nextjs docs and separated concerns by using metadata for SEO and viewport for rendering.

## ✅ Final Solution
metadata → WHAT your app is (SEO, identity)
viewport → HOW your app renders (device behavior)

## 📚 Learning
Next.js App Router enforces separation between semantic metadata and device rendering configuration by introducing a dedicated viewport API.



## 🐞 Problem
Logged-in user able to access the auth routes.

## 🔍 Why it happened
No checks using cookies.

## 🧪 What I tried
Including cookie check in the (auth) layout.tsx and redirecting to homepage if cookie exists. Middleware verifies it.

## ✅ Final Solution
Cookie check in auth layout.tsx

## 📚 Learning
The useEffect fires only after the component has mounted and useAuth has finished its GET /api/users/me fetch. On a fast connection this is 200–400ms. During that window the login form is fully rendered and interactive. A logged-in user sees the form flash before being redirected.
But worse — useAuth itself may return isLoggedIn: false initially because TanStack Query starts with no cached data. 
The flow is:
Page renders → authLoading: true, isLoggedIn: false
useEffect runs → condition !authLoading && isLoggedIn is FALSE → no redirect
Fetch completes → authLoading: false, isLoggedIn: true
useEffect runs again → now redirects
So the form always renders for at least one render cycle. On slow connections (UP Tier-2 2G) this is 2–4 seconds of showing the login form to a logged-in user.
The actual fix is to guard at the layout level, server-side.


1. If prisma expects a model's field to have JSON type value, use Prisma.InputJsonValue when calling the model in repo layer.

2. Cookie path scoping was too narrow: Browser never stored Admin cookie.
→ No cookie on next request
→ Proxy → 401
→ Redirect loop

Earlier I set:
path: "/api/admin"
What this means (strictly): “Browser, only store & send this cookie for requests under /api/admin/*”

But my app flow is:
Step 1: POST /api/admin/auth/login   ✅
Step 2: Navigate → /admin/sellers    ❗
Step 3: React → calls /api/admin/sellers

The subtle issue:
When the browser receives the cookie:
It evaluates context of response + future usage
Because the app immediately transitions to /admin/* (non-API route),
The cookie becomes effectively “unusable” in navigation context
👉 Result: browser silently does not persist it.

Learning:
Cookies are not just stored blindly.
Browser checks: Is this cookie usable for future requests in this context?
If the answer is “barely / restricted / edge-case” → 👉 Browser may drop it
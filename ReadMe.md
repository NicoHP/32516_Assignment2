# Tech Gadget Store: E-Commerce Shopping Cart SPA

## 1. Project Overview
Tech Gadget Store is a single-page e-commerce shopping cart application for browsing products, registering or logging in, managing a personal cart, and viewing user carts through an admin account. The app solves the common shopping flow problem of letting customers search products and update cart quantities without page reloads.

## 2. Technical Stack
**Frontend**
* React with Vite
* Vanilla CSS with responsive Grid/Flexbox layouts
* React Hooks for local state and API-driven rendering

**Backend**
* Node.js
* Express
* MongoDB
* Mongoose
* Node `crypto` module for PBKDF2 password hashing and HMAC-SHA256 JWTs

**API**
* REST endpoints returning JSON
* CORS enabled for the Vite development server
* JWT bearer tokens for authenticated cart and admin requests

## 3. Core Features
* **Single-page app behavior:** React dynamically redraws the current page instead of loading separate HTML pages.
* **Registration and login:** Users can create accounts and log in. Passwords are salted and hashed before storage.
* **JWT authentication:** Login and registration return a JWT used to protect personal cart and admin endpoints.
* **Live product search:** The product grid filters immediately while the user types.
* **User-owned carts:** Each cart item belongs to the logged-in user.
* **Admin cart overview:** Admin users can view all users and the contents/totals of their shopping carts.
* **CRUD operations on MongoDB:**
  * **Create:** Register users and add products to a cart.
  * **Read:** Fetch products, user carts, login profile data, and admin cart summaries.
  * **Update:** Change cart item quantities.
  * **Delete:** Remove cart items.

## 4. Database Entities
* **User:** name, email, password hash, password salt, role.
* **Product:** name, price, image.
* **CartItem:** user reference, product reference, quantity.

## 5. Folder Structure
```text
32516_Assignment2/
|-- backend/
|   |-- .env                  # Local environment variables
|   |-- package.json          # Backend dependencies and scripts
|   |-- seed.js               # Product seed script and optional admin seed
|   `-- server.js             # Express API, models, auth, cart, admin routes
|-- database_export/
|   |-- shopping-cart.cartitems.json
|   |-- shopping-cart.products.json
|   `-- shopping-cart.users.json
|-- Frontend/
|   |-- index.html            # Single HTML entry point
|   |-- package.json          # Frontend dependencies and scripts
|   |-- public/
|   |   `-- images/           # Product images
|   `-- src/
|       |-- App.jsx           # Main React SPA logic
|       |-- App.css           # Application styling
|       `-- main.jsx          # React DOM rendering
|-- package.json
`-- ReadMe.md
```

## 6. Installation and Setup
### Prerequisites
* Node.js v18 or newer
* MongoDB Community Server or a MongoDB Atlas connection string

### Backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/shopping-cart
JWT_SECRET=replace-with-a-long-random-secret
```

Optional seeded admin account:
```env
ADMIN_NAME=Store Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password
```

Seed products:
```bash
node seed.js
```

Start the API:
```bash
npm run dev
```

### Frontend
```bash
cd Frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## 7. API Endpoints
**Authentication**
* `POST /api/auth/register` - create a user or admin account and return a JWT.
* `POST /api/auth/login` - log in and return a JWT.
* `GET /api/auth/me` - read the current user from a JWT.

**Products**
* `GET /api/products` - read all products.
* `GET /api/products?q=keyboard` - server-side product search support.

**User Cart**
* `GET /api/cart` - read the logged-in user's cart.
* `POST /api/cart` - add a product to the logged-in user's cart.
* `PUT /api/cart/:id` - update a cart item quantity.
* `DELETE /api/cart/:id` - remove a cart item.

**Admin**
* `GET /api/admin/users/carts` - admin-only view of every user's cart and total.

## 8. Workload Allocation
This project was completed individually. All design, implementation, testing, and documentation work was completed by the sole student contributor.

| Contributor | Main responsibility | Main files |
| --- | --- | --- |
| Sole student contributor | Backend API, MongoDB models, password hashing, JWT authentication, user/admin roles, protected cart CRUD, admin cart overview, product seeding, React SPA interface, live search, cart interactions, responsive styling, testing, and documentation | `backend/server.js`, `backend/seed.js`, `Frontend/src/App.jsx`, `Frontend/src/App.css`, `ReadMe.md`, `database_export/` |

## 9. Troubleshooting
**MongoDB connection error:** Make sure MongoDB is running and `MONGO_URI` points to the correct database.

**JWT/session errors after server restart:** Set a persistent `JWT_SECRET` in `.env`. Without it, the backend creates a temporary development secret each time it starts.

**No products showing:** Run `node seed.js` inside `backend/`.

**Admin panel not visible:** Register with the "Sign up as admin" toggle enabled, or seed an admin by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running `node seed.js`.

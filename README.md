# ShareBite – Food Sharing and Redistribution Platform

A clean, responsive, and functional web application connecting surplus food donors (restaurants, caterers, mess halls, households) with individuals, shelters, and volunteers who need food.

Built directly for **B.Tech Major Project Submissions** with pure HTML5, CSS3, Vanilla JavaScript (ES6 Modules), and Firebase (Modular SDK v10).

---

## 🚀 Key Features

1. **Role-Based Authentication & Authorization**
   - Firebase Email/Password Authentication.
   - Dual User Roles: **Donor** and **Receiver**.
   - Profile persistence in Cloud Firestore (`users` collection).
   - Strict role-based navigation guards and route protection.

2. **Donor Management**
   - **Dashboard**: Live KPI metrics (Total Listings, Active Food, Pending Requests, Completed Donations).
   - **Create Food Listing**: Specify food title, category, quantity, unit, preparation timestamp, safe pickup deadline, pickup location, and dietary handling instructions.
   - **Manage Listings**: Edit details and delete listings.
   - **Manage Requests**: Accept or reject incoming requests. Acceptance uses atomic Firestore transactions to deduct remaining quantity without over-allocation.
   - **Verify Handoff**: Mark accepted donations as collected.

3. **Receiver Portal**
   - **Surplus Food Feed**: Browse real-time food cards with category tags, quantity badges, pickup location, and safe deadline countdowns.
   - **Search & Filters**: Instant live filtering by keywords (food title, location, donor) and food category (Cooked Meals, Bakery, Produce, Packaged, Beverages, Dairy).
   - **Request Food Modal**: Select requested quantity (clamped to available stock) and attach an optional pickup note.
   - **My Requests History**: Track request lifecycle (`pending` → `accepted` → `collected` / `rejected`) and cancel pending requests.

4. **Real Firestore Impact Analytics**
   - Aggregated metrics queried directly from Firestore: Total Listings, Completed Donations, Total Portions Shared, and Total Members.
   - Interactive **Chart.js** doughnut chart displaying category distribution.
   - Aligned with UN Sustainable Development Goals (SDG 2: Zero Hunger & SDG 12: Responsible Consumption).

---

## 📂 Project Structure

```
Sharebite/
├── index.html                  # Landing page with hero, how-it-works, features, live impact
├── login.html                  # User login with role-based dashboard redirection
├── register.html               # User registration (Donor or Receiver role selection)
├── donor-dashboard.html        # Donor control panel with KPIs, listing manager, quick requests
├── receiver-dashboard.html     # Receiver portal to browse available food and submit requests
├── add-food.html               # Add surplus food listing form
├── requests.html               # Unified food requests management & tracking center
├── impact.html                 # Live impact dashboard with Chart.js visualization
├── firestore.rules             # Production security rules protecting role & data integrity
├── firebase.json               # Firebase Hosting and Firestore configuration
├── .firebaserc                 # Firebase project mapping (sharebite-ai)
├── css/
│   ├── style.css               # Global styles, landing page, auth forms, navigation, toasts
│   └── dashboard.css           # Sidebar layout, KPI cards, tables, food cards, modals
├── js/
│   ├── firebase-config.js      # Firebase Modular SDK initialization and exports
│   ├── auth.js                 # Authentication, role checking, route guards, UI user profile
│   ├── food.js                 # Add, edit, delete, browse and filter food listings
│   ├── requests.js             # Atomic request submission, donor accept/reject, mark collected
│   ├── dashboard.js            # Donor & Receiver dashboard controllers
│   └── analytics.js            # Real Firestore metric aggregation & Chart.js rendering
└── assets/
    └── images/
        └── logo.svg            # ShareBite SVG vector brand logo & favicon
```

---

## 💻 How to Run Locally

Because the project uses modern ES Modules (`import`/`export`), it should be served via a local HTTP server:

### Option 1: Python (Built-in)
Run the following in this folder:
```powershell
python -m http.server 5000
```
Open your browser at: [http://localhost:5000](http://localhost:5000)

### Option 2: Node.js (npx serve)
```powershell
npx serve .
```

---

## 🔒 Publishing Firestore Security Rules

The application includes `firestore.rules` preventing users from modifying their role and restricting food and request management to their respective owners.

To publish the security rules to your Firebase project `sharebite-ai`:

### Option A: Using Firebase CLI
```powershell
# 1. Login to Firebase (if not already logged in)
npx firebase-tools login

# 2. Deploy only Firestore Security Rules
npx firebase-tools deploy --only firestore:rules
```

### Option B: Firebase Console (Web UI)
1. Open [Firebase Console](https://console.firebase.google.com).
2. Select **sharebite-ai** → **Firestore Database** → **Rules** tab.
3. Paste the contents of `firestore.rules`.
4. Click **Publish**.

---

## 🌐 Deploying to Firebase Hosting

To deploy your live website to Firebase Hosting:

```powershell
# 1. Login
npx firebase-tools login

# 2. Deploy Hosting
npx firebase-tools deploy --only hosting
```
Your application will be live at: `https://sharebite-ai.web.app` and `https://sharebite-ai.firebaseapp.com`.

---

## 🧪 End-to-End Verification Workflow

1. **Register a Donor**:
   - Go to `register.html` and select **Food Donor**.
   - Fill in: Full Name: `College Canteen`, Email: `canteen@college.edu`, Password: `password123`.
   - Submit → redirected to `donor-dashboard.html`.

2. **Add a Food Listing**:
   - Click **Add Food** (or navigate to `add-food.html`).
   - Fill in: `50 Packets Veg Biryani`, Category: `Cooked Meals`, Quantity: `50`, Unit: `packets`, Location: `Central Dining Hall Gate 2`.
   - Submit → Listing appears in Donor Dashboard.

3. **Log Out**:
   - Click **Logout** from the sidebar.

4. **Register a Receiver**:
   - Go to `register.html` and select **Food Receiver**.
   - Fill in: Full Name: `Student Food Rescue Club`, Email: `volunteer@college.edu`, Password: `password123`.
   - Submit → redirected to `receiver-dashboard.html`.

5. **Browse and Request Food**:
   - Browse the newly posted `50 Packets Veg Biryani`.
   - Click **Request Food**, enter requested quantity: `20 packets`, and note: `Can pick up in 20 mins`.
   - Submit → Request created.

6. **Log Out and Log In as Donor**:
   - Log out from Receiver account.
   - Log in at `login.html` with `canteen@college.edu` / `password123`.
   - In Donor Dashboard (or `requests.html`), see the 20 packets request from `Student Food Rescue Club`.

7. **Accept Request**:
   - Click **Accept**. Available quantity on the listing automatically drops from `50` to `30`.

8. **Mark Donation as Collected**:
   - When food is handed over, click **Mark as Collected**.
   - Request transitions to `collected`.

9. **Verify Live Impact**:
   - Visit `impact.html` or `index.html` → Notice that live Firestore metrics for Meals Shared, Completed Collections, and Categories update in real-time.


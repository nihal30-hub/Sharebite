// ShareBite - Authentication and User Management Module
import { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp 
} from "./firebase-config.js";

// Global Toast System
export function showToast(type = 'info', title = '', message = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.innerHTML = `
    <i class="fa-solid ${iconMap[type] || 'fa-circle-info'}" style="margin-top:2px; font-size:1.1rem; color: ${
      type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'
    };"></i>
    <div class="toast-content">
      <div class="toast-title">${title || (type.charAt(0).toUpperCase() + type.slice(1))}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Register a new user (Donor or Receiver)
export async function registerUser(fullName, email, password, role) {
  try {
    // 1. Create auth user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Set display name in Auth profile
    await updateProfile(user, {
      displayName: fullName
    });

    // 3. Save user profile & role in Firestore
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      uid: user.uid,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role: role.toLowerCase(),
      createdAt: serverTimestamp()
    });

    // Save active role to sessionStorage for instant synchronous reads
    sessionStorage.setItem("sharebite_user_role", role.toLowerCase());
    sessionStorage.setItem("sharebite_user_name", fullName);

    showToast("success", "Account Created!", `Welcome to ShareBite, ${fullName}!`);
    return { success: true, user, role };
  } catch (error) {
    console.error("Registration error:", error);
    let msg = error.message;
    if (error.code === 'auth/email-already-in-use') {
      msg = "An account with this email address already exists.";
    } else if (error.code === 'auth/weak-password') {
      msg = "Password should be at least 6 characters long.";
    } else if (error.code === 'auth/invalid-email') {
      msg = "Please enter a valid email address.";
    }
    showToast("error", "Registration Failed", msg);
    return { success: false, error: msg };
  }
}

// Login an existing user
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Fetch user details and role from Firestore
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      throw new Error("User record not found in database. Please contact support.");
    }

    const userData = userSnap.data();
    sessionStorage.setItem("sharebite_user_role", userData.role);
    sessionStorage.setItem("sharebite_user_name", userData.fullName || user.displayName || "User");

    showToast("success", "Logged In", `Welcome back, ${userData.fullName || 'User'}!`);
    return { success: true, user, role: userData.role };
  } catch (error) {
    console.error("Login error:", error);
    let msg = error.message;
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      msg = "Invalid email or password. Please verify and try again.";
    } else if (error.code === 'auth/invalid-email') {
      msg = "Please provide a valid email address.";
    }
    showToast("error", "Login Failed", msg);
    return { success: false, error: msg };
  }
}

// Logout user
export async function logoutUser() {
  try {
    await signOut(auth);
    sessionStorage.clear();
    showToast("info", "Logged Out", "You have been logged out successfully.");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 600);
  } catch (error) {
    console.error("Logout error:", error);
    showToast("error", "Logout Failed", error.message);
  }
}

// Fetch current user doc from Firestore
export async function getCurrentUserProfile(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      return userSnap.data();
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

// Authentication guard for protected pages
export function requireAuth(allowedRoles = []) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not authenticated -> redirect to login
        sessionStorage.clear();
        window.location.href = "login.html";
        return;
      }

      // User is authenticated, check role
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          console.warn("User authenticated but document missing in Firestore.");
          await signOut(auth);
          window.location.href = "login.html";
          return;
        }

        const userData = userSnap.data();
        sessionStorage.setItem("sharebite_user_role", userData.role);
        sessionStorage.setItem("sharebite_user_name", userData.fullName);

        // Check if role is allowed on this page
        if (allowedRoles.length > 0 && !allowedRoles.includes(userData.role)) {
          showToast("warning", "Access Restricted", `This area is restricted to ${allowedRoles.join("/")}s.`);
          setTimeout(() => {
            if (userData.role === 'donor') {
              window.location.href = "donor-dashboard.html";
            } else {
              window.location.href = "receiver-dashboard.html";
            }
          }, 1000);
          return;
        }

        // Update UI headers / user cards if elements exist
        updateUserUI(userData);
        resolve({ user, userData });
      } catch (err) {
        console.error("Auth check error:", err);
        window.location.href = "login.html";
      }
    });
  });
}

// Update DOM elements that display user information
export function updateUserUI(userData) {
  const nameDisplays = document.querySelectorAll('.display-user-name');
  nameDisplays.forEach(el => el.textContent = userData.fullName || "User");

  const emailDisplays = document.querySelectorAll('.display-user-email');
  emailDisplays.forEach(el => el.textContent = userData.email || "");

  const roleDisplays = document.querySelectorAll('.display-user-role');
  roleDisplays.forEach(el => {
    el.textContent = userData.role ? (userData.role.charAt(0).toUpperCase() + userData.role.slice(1)) : "Member";
    el.className = `display-user-role user-role-badge role-badge-${userData.role}`;
  });

  const avatarDisplays = document.querySelectorAll('.user-avatar');
  avatarDisplays.forEach(el => {
    const initials = userData.fullName 
      ? userData.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
      : "U";
    el.textContent = initials;
  });
}

// Navbar dynamic authentication state handler for public pages (e.g. index.html)
export function initNavbarAuth() {
  const authContainer = document.getElementById('navbar-auth-container');
  if (!authContainer) return;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);
      const role = userSnap.exists() ? userSnap.data().role : "donor";
      const name = userSnap.exists() ? userSnap.data().fullName : "User";
      const dashboardUrl = role === 'donor' ? 'donor-dashboard.html' : 'receiver-dashboard.html';

      authContainer.innerHTML = `
        <a href="${dashboardUrl}" class="btn btn-outline btn-sm">
          <i class="fa-solid fa-gauge-high"></i> Dashboard
        </a>
        <button id="nav-logout-btn" class="btn btn-primary btn-sm">
          <i class="fa-solid fa-right-from-bracket"></i> Logout
        </button>
      `;

      document.getElementById('nav-logout-btn')?.addEventListener('click', logoutUser);
    } else {
      authContainer.innerHTML = `
        <a href="login.html" class="btn btn-outline btn-sm">Login</a>
        <a href="register.html" class="btn btn-primary btn-sm">Get Started</a>
      `;
    }
  });
}


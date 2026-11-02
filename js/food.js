// ShareBite - Food Listings Management Module
import { 
  db, 
  auth, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from "./firebase-config.js";
import { showToast } from "./auth.js";

// Add a new food listing
export async function addFoodListing(foodData) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("You must be logged in to add a listing.");

    const donorName = sessionStorage.getItem("sharebite_user_name") || user.displayName || "Anonymous Donor";

    const listingPayload = {
      donorId: user.uid,
      donorName: donorName,
      foodName: foodData.foodName.trim(),
      description: foodData.description.trim(),
      category: foodData.category,
      quantity: Number(foodData.quantity),
      originalQuantity: Number(foodData.quantity),
      unit: foodData.unit.trim().toLowerCase(),
      preparationDate: foodData.preparationDate,
      safePickupDeadline: foodData.safePickupDeadline,
      pickupLocation: foodData.pickupLocation.trim(),
      status: "available", // available | partially_requested | fully_requested | collected | cancelled
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "foodListings"), listingPayload);
    showToast("success", "Listing Created", "Your surplus food is now available for requests!");
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating food listing:", error);
    showToast("error", "Failed to Add Food", error.message);
    return { success: false, error: error.message };
  }
}

// Fetch all listings created by a specific donor
export async function getDonorListings(donorId) {
  try {
    const q = query(
      collection(db, "foodListings"),
      where("donorId", "==", donorId)
    );
    const querySnapshot = await getDocs(q);
    const listings = [];
    querySnapshot.forEach((doc) => {
      listings.push({ id: doc.id, ...doc.data() });
    });

    // Sort by createdAt desc in JavaScript (avoids Firestore composite index requirements)
    listings.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return listings;
  } catch (error) {
    console.error("Error fetching donor listings:", error);
    showToast("error", "Error", "Could not load your food listings.");
    return [];
  }
}

// Fetch single listing by ID
export async function getListingById(listingId) {
  try {
    const docRef = doc(db, "foodListings", listingId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching listing:", error);
    return null;
  }
}

// Update food listing details
export async function updateFoodListing(listingId, updatedFields) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const listingRef = doc(db, "foodListings", listingId);
    const existing = await getDoc(listingRef);

    if (!existing.exists()) {
      throw new Error("Listing not found.");
    }

    if (existing.data().donorId !== user.uid) {
      throw new Error("You do not have permission to modify this listing.");
    }

    // Determine status based on quantity
    const newQty = Number(updatedFields.quantity);
    let newStatus = existing.data().status;
    if (newStatus !== 'collected') {
      newStatus = newQty > 0 ? 'available' : 'fully_requested';
    }

    const payload = {
      foodName: updatedFields.foodName.trim(),
      description: updatedFields.description.trim(),
      category: updatedFields.category,
      quantity: newQty,
      unit: updatedFields.unit.trim().toLowerCase(),
      preparationDate: updatedFields.preparationDate,
      safePickupDeadline: updatedFields.safePickupDeadline,
      pickupLocation: updatedFields.pickupLocation.trim(),
      status: newStatus,
      updatedAt: serverTimestamp()
    };

    await updateDoc(listingRef, payload);
    showToast("success", "Listing Updated", "Food listing details updated successfully.");
    return { success: true };
  } catch (error) {
    console.error("Error updating listing:", error);
    showToast("error", "Update Failed", error.message);
    return { success: false, error: error.message };
  }
}

// Delete food listing
export async function deleteFoodListing(listingId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const listingRef = doc(db, "foodListings", listingId);
    const existing = await getDoc(listingRef);

    if (!existing.exists()) {
      throw new Error("Listing does not exist.");
    }

    if (existing.data().donorId !== user.uid) {
      throw new Error("You are not allowed to delete this listing.");
    }

    await deleteDoc(listingRef);
    showToast("success", "Deleted", "Listing removed successfully.");
    return { success: true };
  } catch (error) {
    console.error("Error deleting listing:", error);
    showToast("error", "Delete Failed", error.message);
    return { success: false, error: error.message };
  }
}

// Fetch all available listings for receivers to browse
export async function getAvailableFoodListings() {
  try {
    const q = query(collection(db, "foodListings"));
    const snapshot = await getDocs(q);
    const now = new Date();

    const listings = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // An item is browseable if quantity > 0 and status is available/partially_requested and not collected
      const deadline = new Date(data.safePickupDeadline);
      const isExpired = deadline < now;

      if (data.status !== "collected" && data.quantity > 0 && !isExpired) {
        listings.push({ id: docSnap.id, ...data });
      }
    });

    // Sort newest first
    listings.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return listings;
  } catch (error) {
    console.error("Error fetching available listings:", error);
    showToast("error", "Fetch Failed", "Could not load available food items.");
    return [];
  }
}

// Filter listings by keyword and category
export function filterListings(listings, searchKeyword = "", selectedCategory = "all") {
  return listings.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const term = searchKeyword.toLowerCase().trim();
    const matchesSearch = !term || 
      item.foodName.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.pickupLocation.toLowerCase().includes(term) ||
      (item.donorName && item.donorName.toLowerCase().includes(term));

    return matchesCategory && matchesSearch;
  });
}

// Helper to get category icons and css classes
export function getCategoryMeta(category) {
  const map = {
    "Cooked Meals": { icon: "fa-bowl-rice", class: "cat-cooked" },
    "Bakery & Breads": { icon: "fa-bread-slice", class: "cat-bakery" },
    "Fresh Produce": { icon: "fa-apple-whole", class: "cat-produce" },
    "Packaged Food": { icon: "fa-box-open", class: "cat-packaged" },
    "Beverages": { icon: "fa-bottle-water", class: "cat-beverages" },
    "Dairy": { icon: "fa-cheese", class: "cat-dairy" },
    "Others": { icon: "fa-utensils", class: "cat-cooked" }
  };
  return map[category] || { icon: "fa-utensils", class: "cat-cooked" };
}

// Helper to format deadline nicely
export function formatDeadline(dateStr) {
  if (!dateStr) return "Not specified";
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = Math.round((date - now) / (1000 * 60 * 60));

  const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  const formatted = date.toLocaleDateString(undefined, options);

  if (diffHours < 0) {
    return `<span class="text-danger"><i class="fa-solid fa-clock"></i> Expired</span>`;
  } else if (diffHours <= 3) {
    return `<span class="text-warning"><i class="fa-solid fa-triangle-exclamation"></i> Ends in ${diffHours}h (${formatted})</span>`;
  }
  return `<span><i class="fa-regular fa-clock"></i> ${formatted}</span>`;
}


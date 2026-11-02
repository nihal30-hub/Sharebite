// ShareBite - Request Management Module
import { 
  db, 
  auth, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  runTransaction,
  serverTimestamp 
} from "./firebase-config.js";
import { showToast } from "./auth.js";

// Receiver submits a food request
export async function createFoodRequest(foodId, requestedQuantity, note = "") {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Please log in to make a request.");

    const receiverName = sessionStorage.getItem("sharebite_user_name") || user.displayName || "Receiver";
    const receiverEmail = user.email || "";

    const qty = Number(requestedQuantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error("Please enter a valid requested quantity.");
    }

    // Read current food listing state
    const foodRef = doc(db, "foodListings", foodId);
    const foodSnap = await getDoc(foodRef);

    if (!foodSnap.exists()) {
      throw new Error("This food listing is no longer available.");
    }

    const foodData = foodSnap.data();

    // Prevent donor from requesting their own food
    if (foodData.donorId === user.uid) {
      throw new Error("You cannot request your own food listing.");
    }

    // Check if food has expired
    const deadline = new Date(foodData.safePickupDeadline);
    if (deadline < new Date()) {
      throw new Error("The safe pickup deadline for this food has passed.");
    }

    // Check if requested quantity exceeds available quantity
    if (qty > foodData.quantity) {
      throw new Error(`Only ${foodData.quantity} ${foodData.unit} currently available.`);
    }

    // Check if receiver already has a pending request for this item
    const existingReqQuery = query(
      collection(db, "foodRequests"),
      where("foodId", "==", foodId),
      where("receiverId", "==", user.uid),
      where("requestStatus", "==", "pending")
    );
    const existingSnap = await getDocs(existingReqQuery);
    if (!existingSnap.empty) {
      throw new Error("You already have an active pending request for this food item.");
    }

    // Create the request document
    const requestData = {
      foodId: foodId,
      donorId: foodData.donorId,
      receiverId: user.uid,
      receiverName: receiverName,
      receiverEmail: receiverEmail,
      foodName: foodData.foodName,
      category: foodData.category || "Cooked Meals",
      requestedQuantity: qty,
      unit: foodData.unit,
      pickupLocation: foodData.pickupLocation,
      safePickupDeadline: foodData.safePickupDeadline,
      note: note.trim(),
      requestStatus: "pending", // pending | accepted | rejected | collected | cancelled
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "foodRequests"), requestData);
    showToast("success", "Request Sent!", `Your request for ${qty} ${foodData.unit} has been submitted.`);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating request:", error);
    showToast("error", "Request Failed", error.message);
    return { success: false, error: error.message };
  }
}

// Donor accepts a request - uses transaction to deduct available food quantity atomically
export async function acceptFoodRequest(requestId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const requestRef = doc(db, "foodRequests", requestId);

    const result = await runTransaction(db, async (transaction) => {
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists()) {
        throw new Error("Request does not exist.");
      }

      const reqData = requestDoc.data();

      // Only the listing's donor can accept
      if (reqData.donorId !== user.uid) {
        throw new Error("Only the donor can accept this request.");
      }

      if (reqData.requestStatus !== "pending") {
        throw new Error(`Cannot accept request in '${reqData.requestStatus}' status.`);
      }

      const foodRef = doc(db, "foodListings", reqData.foodId);
      const foodDoc = await transaction.get(foodRef);

      if (!foodDoc.exists()) {
        throw new Error("Associated food listing was not found.");
      }

      const foodData = foodDoc.data();
      const currentAvailable = Number(foodData.quantity);
      const requestedQty = Number(reqData.requestedQuantity);

      if (currentAvailable < requestedQty) {
        throw new Error(`Insufficient quantity remaining (${currentAvailable} available, ${requestedQty} requested).`);
      }

      const remainingQty = currentAvailable - requestedQty;
      const newListingStatus = remainingQty === 0 ? "fully_requested" : "partially_requested";

      // 1. Update request status to accepted
      transaction.update(requestRef, {
        requestStatus: "accepted",
        updatedAt: serverTimestamp()
      });

      // 2. Update food listing quantity and status
      transaction.update(foodRef, {
        quantity: remainingQty,
        status: newListingStatus,
        updatedAt: serverTimestamp()
      });

      return { remainingQty, foodName: reqData.foodName };
    });

    showToast("success", "Request Accepted!", `Accepted request for ${result.foodName}. Remaining: ${result.remainingQty}`);
    return { success: true };
  } catch (error) {
    console.error("Error accepting request:", error);
    showToast("error", "Action Failed", error.message);
    return { success: false, error: error.message };
  }
}

// Donor rejects a request
export async function rejectFoodRequest(requestId, reason = "") {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const requestRef = doc(db, "foodRequests", requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) throw new Error("Request not found.");
    const reqData = requestDoc.data();

    if (reqData.donorId !== user.uid) {
      throw new Error("Unauthorized to reject this request.");
    }

    if (reqData.requestStatus !== "pending") {
      throw new Error(`Cannot reject request in '${reqData.requestStatus}' status.`);
    }

    await updateDoc(requestRef, {
      requestStatus: "rejected",
      rejectReason: reason.trim(),
      updatedAt: serverTimestamp()
    });

    showToast("info", "Request Rejected", "The food request has been rejected.");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting request:", error);
    showToast("error", "Action Failed", error.message);
    return { success: false, error: error.message };
  }
}

// Donor marks an accepted donation as collected
export async function markDonationCollected(requestId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const requestRef = doc(db, "foodRequests", requestId);

    await runTransaction(db, async (transaction) => {
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists()) throw new Error("Request not found.");

      const reqData = requestDoc.data();
      if (reqData.donorId !== user.uid) {
        throw new Error("Only the donor can mark this donation as collected.");
      }

      if (reqData.requestStatus !== "accepted") {
        throw new Error("Only accepted requests can be marked as collected.");
      }

      // Check food listing status (all reads must come before all writes in a Firestore transaction)
      const foodRef = doc(db, "foodListings", reqData.foodId);
      const foodDoc = await transaction.get(foodRef);

      // Now execute all writes
      transaction.update(requestRef, {
        requestStatus: "collected",
        collectedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (foodDoc.exists()) {
        const foodData = foodDoc.data();
        // If remaining quantity is 0, mark the entire listing as collected
        if (foodData.quantity === 0) {
          transaction.update(foodRef, {
            status: "collected",
            collectedAt: serverTimestamp()
          });
        }
      }
    });

    showToast("success", "Donation Collected!", "Great job! This donation is officially complete.");
    return { success: true };
  } catch (error) {
    console.error("Error marking collected:", error);
    showToast("error", "Action Failed", error.message);
    return { success: false, error: error.message };
  }
}

// Receiver cancels their own pending request
export async function cancelFoodRequest(requestId) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Unauthorized");

    const requestRef = doc(db, "foodRequests", requestId);
    const requestDoc = await getDoc(requestRef);
    if (!requestDoc.exists()) throw new Error("Request not found.");

    const reqData = requestDoc.data();
    if (reqData.receiverId !== user.uid) {
      throw new Error("You can only cancel your own requests.");
    }

    if (reqData.requestStatus !== "pending") {
      throw new Error("Only pending requests can be cancelled.");
    }

    await updateDoc(requestRef, {
      requestStatus: "cancelled",
      updatedAt: serverTimestamp()
    });

    showToast("info", "Request Cancelled", "Your request has been cancelled.");
    return { success: true };
  } catch (error) {
    console.error("Error cancelling request:", error);
    showToast("error", "Action Failed", error.message);
    return { success: false, error: error.message };
  }
}

// Fetch all requests received by a donor
export async function getRequestsForDonor(donorId) {
  try {
    const q = query(
      collection(db, "foodRequests"),
      where("donorId", "==", donorId)
    );
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort newest first
    list.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return list;
  } catch (error) {
    console.error("Error fetching donor requests:", error);
    return [];
  }
}

// Fetch all requests made by a receiver
export async function getRequestsForReceiver(receiverId) {
  try {
    const q = query(
      collection(db, "foodRequests"),
      where("receiverId", "==", receiverId)
    );
    const snapshot = await getDocs(q);
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Sort newest first
    list.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return list;
  } catch (error) {
    console.error("Error fetching receiver requests:", error);
    return [];
  }
}

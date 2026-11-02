// ShareBite - Dashboard Functionality Module (Donor & Receiver)
import { 
  getDonorListings, 
  getAvailableFoodListings, 
  filterListings, 
  getCategoryMeta, 
  formatDeadline,
  deleteFoodListing,
  updateFoodListing
} from "./food.js";
import { 
  getRequestsForDonor, 
  getRequestsForReceiver, 
  acceptFoodRequest, 
  rejectFoodRequest, 
  markDonationCollected, 
  createFoodRequest,
  cancelFoodRequest 
} from "./requests.js";
import { showToast } from "./auth.js";

/* ==========================================================================
   DONOR DASHBOARD LOGIC
   ========================================================================== */

let donorListingsCache = [];
let donorRequestsCache = [];

export async function initDonorDashboard(user) {
  try {
    await refreshDonorData(user.uid);
    setupDonorEventListeners(user);
  } catch (err) {
    console.error("Error initializing donor dashboard:", err);
  }
}

export async function refreshDonorData(donorId) {
  const [listings, requests] = await Promise.all([
    getDonorListings(donorId),
    getRequestsForDonor(donorId)
  ]);

  donorListingsCache = listings;
  donorRequestsCache = requests;

  updateDonorKPIs(listings, requests);
  renderDonorListings(listings);
  renderDonorRecentRequests(requests);
}

function updateDonorKPIs(listings, requests) {
  // KPI 1: Total listings
  const totalListingsEl = document.getElementById("donor-kpi-total");
  if (totalListingsEl) totalListingsEl.textContent = listings.length;

  // KPI 2: Available food (listings that are available and have quantity > 0)
  const availableListings = listings.filter(item => item.quantity > 0 && item.status !== 'collected');
  const availableEl = document.getElementById("donor-kpi-available");
  if (availableEl) availableEl.textContent = availableListings.length;

  // KPI 3: Pending requests count
  const pendingRequests = requests.filter(req => req.requestStatus === 'pending');
  const pendingEl = document.getElementById("donor-kpi-pending");
  if (pendingEl) pendingEl.textContent = pendingRequests.length;

  // Update pending badge in sidebar if present
  const sidebarPendingBadge = document.getElementById("sidebar-pending-badge");
  if (sidebarPendingBadge) {
    sidebarPendingBadge.textContent = pendingRequests.length;
    sidebarPendingBadge.style.display = pendingRequests.length > 0 ? 'inline-block' : 'none';
  }

  // KPI 4: Completed donations (collected requests)
  const completedDonations = requests.filter(req => req.requestStatus === 'collected');
  const completedEl = document.getElementById("donor-kpi-completed");
  if (completedEl) completedEl.textContent = completedDonations.length;
}

export function renderDonorListings(listings, filter = 'all') {
  const container = document.getElementById("donor-listings-table-body");
  if (!container) return;

  let filtered = listings;
  if (filter === 'available') {
    filtered = listings.filter(i => i.quantity > 0 && i.status !== 'collected');
  } else if (filter === 'completed') {
    filtered = listings.filter(i => i.status === 'collected' || i.quantity === 0);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state" style="padding: 2.5rem 1rem;">
          <div class="empty-icon"><i class="fa-solid fa-utensils"></i></div>
          <h4>No Listings Found</h4>
          <p>You haven't posted any food listings under this category yet.</p>
          <a href="add-food.html" class="btn btn-primary btn-sm"><i class="fa-solid fa-plus"></i> Add New Listing</a>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const meta = getCategoryMeta(item.category);
    const deadlineDisplay = formatDeadline(item.safePickupDeadline);

    let statusBadge = `<span class="badge-status pending">Available</span>`;
    if (item.status === 'collected' || item.quantity === 0) {
      statusBadge = `<span class="badge-status collected">Collected</span>`;
    } else if (item.status === 'partially_requested') {
      statusBadge = `<span class="badge-status accepted">Partial</span>`;
    }

    return `
      <tr data-id="${item.id}">
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div style="width:36px; height:36px; border-radius:8px; background:var(--primary-soft-bg); color:var(--primary-forest); display:flex; align-items:center; justify-content:center; font-size:1rem;">
              <i class="fa-solid ${meta.icon}"></i>
            </div>
            <div>
              <div style="font-weight:700; color:var(--primary-deep);">${escapeHtml(item.foodName)}</div>
              <small style="color:var(--text-muted);">${escapeHtml(item.category || 'General')}</small>
            </div>
          </div>
        </td>
        <td>
          <strong>${item.quantity}</strong> <span style="color:var(--text-muted); font-size:0.85rem;">${escapeHtml(item.unit)}</span>
          ${item.originalQuantity && item.originalQuantity !== item.quantity ? 
            `<div style="font-size:0.75rem; color:var(--text-muted);">of ${item.originalQuantity} orig</div>` : ''}
        </td>
        <td>
          <div style="font-size:0.85rem; color:var(--text-main);"><i class="fa-solid fa-location-dot" style="color:var(--primary-green); margin-right:4px;"></i> ${escapeHtml(item.pickupLocation)}</div>
        </td>
        <td>
          <div style="font-size:0.85rem;">${deadlineDisplay}</div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-secondary btn-sm action-edit-food" data-id="${item.id}" title="Edit Listing">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-secondary btn-sm action-delete-food" data-id="${item.id}" title="Delete Listing" style="color:#dc2626;">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Attach event handlers to buttons
  container.querySelectorAll('.action-delete-food').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Are you sure you want to delete this food listing? This action cannot be undone.")) {
        btn.disabled = true;
        const res = await deleteFoodListing(id);
        if (res.success) {
          const user = auth.currentUser;
          if (user) refreshDonorData(user.uid);
        } else {
          btn.disabled = false;
        }
      }
    });
  });

  container.querySelectorAll('.action-edit-food').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const listing = donorListingsCache.find(l => l.id === id);
      if (listing) {
        openEditListingModal(listing);
      }
    });
  });
}

function renderDonorRecentRequests(requests) {
  const container = document.getElementById("donor-recent-requests-body");
  if (!container) return;

  const pendingRequests = requests.filter(r => r.requestStatus === 'pending');

  if (pendingRequests.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-icon" style="width:50px; height:50px; font-size:1.4rem;"><i class="fa-solid fa-bell-slash"></i></div>
          <h4 style="font-size:1.1rem;">No Pending Requests</h4>
          <p style="font-size:0.85rem;">All food requests have been addressed.</p>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = pendingRequests.slice(0, 5).map(req => `
    <tr data-req-id="${req.id}">
      <td>
        <div style="font-weight:700;">${escapeHtml(req.foodName)}</div>
        <small style="color:var(--text-muted);"><i class="fa-solid fa-user" style="margin-right:4px;"></i> ${escapeHtml(req.receiverName || 'Receiver')}</small>
      </td>
      <td>
        <strong>${req.requestedQuantity}</strong> ${escapeHtml(req.unit || 'units')}
      </td>
      <td>
        <span style="font-size:0.82rem; color:var(--text-muted);">${formatDate(req.createdAt)}</span>
      </td>
      <td>
        <span class="badge-status pending"><i class="fa-solid fa-clock"></i> Pending</span>
      </td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-success btn-sm btn-accept-req" data-id="${req.id}" title="Accept Request">
            <i class="fa-solid fa-check"></i> Accept
          </button>
          <button class="btn btn-outline btn-sm btn-reject-req" data-id="${req.id}" title="Reject Request" style="color:#dc2626; border-color:#dc2626;">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  // Attach request action listeners
  container.querySelectorAll('.btn-accept-req').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>`;
      const res = await acceptFoodRequest(id);
      if (res.success) {
        const user = auth.currentUser;
        if (user) refreshDonorData(user.uid);
      } else {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Accept`;
      }
    });
  });

  container.querySelectorAll('.btn-reject-req').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const reason = prompt("Optional reason for rejecting this request:") || "";
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>`;
      const res = await rejectFoodRequest(id, reason);
      if (res.success) {
        const user = auth.currentUser;
        if (user) refreshDonorData(user.uid);
      } else {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-xmark"></i> Reject`;
      }
    });
  });
}

function setupDonorEventListeners(user) {
  // Listing filter tabs
  const tabBtns = document.querySelectorAll(".donor-filter-tab");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filterType = btn.getAttribute("data-filter");
      renderDonorListings(donorListingsCache, filterType);
    });
  });

  // Edit Listing Modal Setup
  const editModal = document.getElementById("editListingModal");
  const editForm = document.getElementById("editListingForm");
  const closeEditBtn = document.getElementById("closeEditModalBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  function closeEditModal() {
    if (editModal) editModal.classList.remove("show");
  }

  closeEditBtn?.addEventListener("click", closeEditModal);
  cancelEditBtn?.addEventListener("click", closeEditModal);

  editForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-food-id").value;
    const submitBtn = editForm.querySelector("button[type='submit']");
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Saving...`;

    const updatedData = {
      foodName: document.getElementById("edit-food-name").value,
      category: document.getElementById("edit-food-category").value,
      quantity: document.getElementById("edit-food-quantity").value,
      unit: document.getElementById("edit-food-unit").value,
      safePickupDeadline: document.getElementById("edit-food-deadline").value,
      pickupLocation: document.getElementById("edit-food-location").value,
      description: document.getElementById("edit-food-description").value,
      preparationDate: document.getElementById("edit-food-prep-date").value || new Date().toISOString()
    };

    const res = await updateFoodListing(id, updatedData);
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;

    if (res.success) {
      closeEditModal();
      refreshDonorData(user.uid);
    }
  });
}

function openEditListingModal(listing) {
  const modal = document.getElementById("editListingModal");
  if (!modal) return;

  document.getElementById("edit-food-id").value = listing.id;
  document.getElementById("edit-food-name").value = listing.foodName || "";
  document.getElementById("edit-food-category").value = listing.category || "Cooked Meals";
  document.getElementById("edit-food-quantity").value = listing.quantity || "";
  document.getElementById("edit-food-unit").value = listing.unit || "servings";
  document.getElementById("edit-food-deadline").value = listing.safePickupDeadline ? listing.safePickupDeadline.slice(0, 16) : "";
  document.getElementById("edit-food-location").value = listing.pickupLocation || "";
  document.getElementById("edit-food-description").value = listing.description || "";
  document.getElementById("edit-food-prep-date").value = listing.preparationDate ? listing.preparationDate.slice(0, 16) : "";

  modal.classList.add("show");
}

/* ==========================================================================
   RECEIVER DASHBOARD LOGIC
   ========================================================================== */

let receiverAvailableCache = [];

export async function initReceiverDashboard(user) {
  try {
    await refreshReceiverData(user.uid);
    setupReceiverEventListeners(user);
  } catch (err) {
    console.error("Error initializing receiver dashboard:", err);
  }
}

export async function refreshReceiverData(receiverId) {
  const [availableListings, myRequests] = await Promise.all([
    getAvailableFoodListings(),
    getRequestsForReceiver(receiverId)
  ]);

  receiverAvailableCache = availableListings;

  updateReceiverKPIs(availableListings, myRequests);
  renderReceiverFoodGrid(availableListings);
  renderReceiverRecentRequests(myRequests);
}

function updateReceiverKPIs(availableListings, myRequests) {
  const availableCountEl = document.getElementById("receiver-kpi-available");
  if (availableCountEl) availableCountEl.textContent = availableListings.length;

  const totalRequestedEl = document.getElementById("receiver-kpi-total-req");
  if (totalRequestedEl) totalRequestedEl.textContent = myRequests.length;

  const activeRequests = myRequests.filter(r => r.requestStatus === 'pending' || r.requestStatus === 'accepted');
  const activeReqEl = document.getElementById("receiver-kpi-active");
  if (activeReqEl) activeReqEl.textContent = activeRequests.length;

  const collectedRequests = myRequests.filter(r => r.requestStatus === 'collected');
  const collectedEl = document.getElementById("receiver-kpi-collected");
  if (collectedEl) collectedEl.textContent = collectedRequests.length;
}

export function renderReceiverFoodGrid(listings) {
  const container = document.getElementById("receiver-food-grid");
  if (!container) return;

  if (listings.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; background: var(--white); border-radius: var(--radius-lg); border: 1px solid var(--cream-border); padding: 3.5rem 1.5rem;">
        <div class="empty-icon"><i class="fa-solid fa-bowl-food"></i></div>
        <h4>No Food Listings Available Right Now</h4>
        <p>Check back soon! Food donors frequently post fresh surplus meals and groceries.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = listings.map(item => {
    const meta = getCategoryMeta(item.category);
    const deadlineDisplay = formatDeadline(item.safePickupDeadline);

    return `
      <div class="food-card" data-id="${item.id}">
        <div class="food-card-banner ${meta.class}">
          <span class="food-category-badge"><i class="fa-solid ${meta.icon}"></i> ${escapeHtml(item.category || 'Food')}</span>
          <span class="food-status-badge status-badge-available">Available</span>
          <i class="fa-solid ${meta.icon}"></i>
        </div>

        <div class="food-card-body">
          <h3 class="food-title">${escapeHtml(item.foodName)}</h3>
          <p class="food-desc">${escapeHtml(item.description || 'Nutritious surplus food ready for immediate pickup.')}</p>

          <div class="food-meta">
            <div class="meta-item">
              <i class="fa-solid fa-user-circle"></i>
              <span>Shared by <strong>${escapeHtml(item.donorName || 'Generous Donor')}</strong></span>
            </div>
            <div class="meta-item">
              <i class="fa-solid fa-location-dot"></i>
              <span>${escapeHtml(item.pickupLocation)}</span>
            </div>
            <div class="meta-item deadline">
              ${deadlineDisplay}
            </div>
          </div>

          <div class="food-card-footer">
            <div class="food-qty-pill">
              <i class="fa-solid fa-boxes-stacked"></i> ${item.quantity} ${escapeHtml(item.unit)} left
            </div>
            <button class="btn btn-primary btn-sm btn-open-request" data-id="${item.id}">
              <i class="fa-solid fa-hand-holding-heart"></i> Request Food
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Attach click listener to "Request Food" buttons
  container.querySelectorAll('.btn-open-request').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = receiverAvailableCache.find(f => f.id === id);
      if (item) {
        openRequestModal(item);
      }
    });
  });
}

function renderReceiverRecentRequests(myRequests) {
  const container = document.getElementById("receiver-recent-requests-body");
  if (!container) return;

  if (myRequests.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-icon" style="width:50px; height:50px; font-size:1.4rem;"><i class="fa-solid fa-list-check"></i></div>
          <h4 style="font-size:1.1rem;">No Requests Made Yet</h4>
          <p style="font-size:0.85rem;">Browse available food above and request what you need.</p>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = myRequests.slice(0, 5).map(req => {
    let statusClass = "pending";
    let statusIcon = "fa-clock";
    if (req.requestStatus === 'accepted') { statusClass = "accepted"; statusIcon = "fa-circle-check"; }
    else if (req.requestStatus === 'collected') { statusClass = "collected"; statusIcon = "fa-box-archive"; }
    else if (req.requestStatus === 'rejected') { statusClass = "rejected"; statusIcon = "fa-circle-xmark"; }

    return `
      <tr>
        <td>
          <div style="font-weight:700;">${escapeHtml(req.foodName)}</div>
          <small style="color:var(--text-muted);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(req.pickupLocation)}</small>
        </td>
        <td>
          <strong>${req.requestedQuantity}</strong> ${escapeHtml(req.unit)}
        </td>
        <td>
          <span style="font-size:0.82rem; color:var(--text-muted);">${formatDate(req.createdAt)}</span>
        </td>
        <td>
          <span class="badge-status ${statusClass}">
            <i class="fa-solid ${statusIcon}"></i> ${escapeHtml(req.requestStatus)}
          </span>
        </td>
        <td>
          ${req.requestStatus === 'pending' ? `
            <button class="btn btn-outline btn-sm btn-cancel-request" data-id="${req.id}" style="color:#dc2626; border-color:#dc2626; padding:0.25rem 0.6rem; font-size:0.8rem;">
              Cancel
            </button>
          ` : `
            <span style="font-size:0.8rem; color:var(--text-muted);">${req.requestStatus === 'accepted' ? 'Ready for pickup' : '-'}</span>
          `}
        </td>
      </tr>
    `;
  }).join("");

  container.querySelectorAll('.btn-cancel-request').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Are you sure you want to cancel this request?")) {
        btn.disabled = true;
        const res = await cancelFoodRequest(id);
        if (res.success) {
          const user = auth.currentUser;
          if (user) refreshReceiverData(user.uid);
        } else {
          btn.disabled = false;
        }
      }
    });
  });
}

function setupReceiverEventListeners(user) {
  // Search and category filtering
  const searchInput = document.getElementById("receiver-search-input");
  const categoryFilter = document.getElementById("receiver-category-filter");

  function applyFilters() {
    const term = searchInput ? searchInput.value : "";
    const cat = categoryFilter ? categoryFilter.value : "all";
    const filtered = filterListings(receiverAvailableCache, term, cat);
    renderReceiverFoodGrid(filtered);
  }

  searchInput?.addEventListener("input", applyFilters);
  categoryFilter?.addEventListener("change", applyFilters);

  // Request Food Modal
  const requestModal = document.getElementById("requestFoodModal");
  const requestForm = document.getElementById("requestFoodForm");
  const closeBtn = document.getElementById("closeRequestModalBtn");
  const cancelBtn = document.getElementById("cancelRequestModalBtn");

  function closeRequestModal() {
    if (requestModal) requestModal.classList.remove("show");
  }

  closeBtn?.addEventListener("click", closeRequestModal);
  cancelBtn?.addEventListener("click", closeRequestModal);

  requestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const foodId = document.getElementById("modal-food-id").value;
    const qty = document.getElementById("modal-request-qty").value;
    const note = document.getElementById("modal-request-note").value;
    const submitBtn = requestForm.querySelector("button[type='submit']");
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Submitting...`;

    const res = await createFoodRequest(foodId, qty, note);
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;

    if (res.success) {
      closeRequestModal();
      refreshReceiverData(user.uid);
    }
  });
}

function openRequestModal(foodItem) {
  const modal = document.getElementById("requestFoodModal");
  if (!modal) return;

  document.getElementById("modal-food-id").value = foodItem.id;
  document.getElementById("modal-food-title").textContent = foodItem.foodName;
  document.getElementById("modal-food-donor").textContent = foodItem.donorName || "Food Donor";
  document.getElementById("modal-food-available-qty").textContent = `${foodItem.quantity} ${foodItem.unit}`;
  document.getElementById("modal-food-location").textContent = foodItem.pickupLocation;
  document.getElementById("modal-food-deadline").textContent = foodItem.safePickupDeadline ? new Date(foodItem.safePickupDeadline).toLocaleString() : "Check details";

  const qtyInput = document.getElementById("modal-request-qty");
  qtyInput.max = foodItem.quantity;
  qtyInput.value = 1;
  document.getElementById("modal-request-unit-label").textContent = foodItem.unit;
  document.getElementById("modal-request-note").value = "";

  modal.classList.add("show");
}

/* Helper Utilities */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp) return "Recently";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}


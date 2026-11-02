// ShareBite - Real Firestore Impact & Analytics Module
import { 
  db, 
  collection, 
  getDocs 
} from "./firebase-config.js";

// Fetch real metrics from Firestore collections with resilient error handling
export async function getPlatformImpactData() {
  let totalUsers = 0;
  let totalListings = 0;
  let totalQuantityShared = 0;
  let completedDonations = 0;
  const categoryCounts = {};
  const statusCounts = {
    pending: 0,
    accepted: 0,
    collected: 0,
    rejected: 0,
    cancelled: 0
  };

  // 1. Food listings (Publicly readable)
  try {
    const listingsSnap = await getDocs(collection(db, "foodListings"));
    totalListings = listingsSnap.size;
    listingsSnap.forEach(docSnap => {
      const data = docSnap.data();
      const cat = data.category || "Cooked Meals";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      // If entire listing is marked collected
      if (data.status === "collected") {
        totalQuantityShared += Number(data.originalQuantity || data.quantity || 0);
      }
    });
  } catch (err) {
    console.warn("Could not query foodListings for impact:", err);
  }

  // 2. Users count
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    totalUsers = usersSnap.size;
  } catch (err) {
    console.warn("Could not query users for impact:", err);
  }

  // 3. Requests & donations
  try {
    const requestsSnap = await getDocs(collection(db, "foodRequests"));
    requestsSnap.forEach(docSnap => {
      const data = docSnap.data();
      const status = data.requestStatus || "pending";
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      } else {
        statusCounts[status] = 1;
      }

      if (status === "collected") {
        completedDonations++;
        totalQuantityShared += Number(data.requestedQuantity || 0);
      }
    });
  } catch (err) {
    console.warn("Could not query foodRequests for impact:", err);
  }

  return {
    totalUsers,
    totalListings,
    completedDonations,
    totalQuantityShared,
    categoryCounts,
    statusCounts
  };
}

// Render the Impact page with real KPI cards and Chart.js visualization
export async function renderImpactDashboard() {
  const data = await getPlatformImpactData();

  // Populate KPIs
  const listingsEl = document.getElementById("impact-total-listings");
  if (listingsEl) listingsEl.textContent = data.totalListings;

  const completedEl = document.getElementById("impact-completed-donations");
  if (completedEl) completedEl.textContent = data.completedDonations;

  const quantityEl = document.getElementById("impact-total-quantity");
  if (quantityEl) quantityEl.textContent = data.totalQuantityShared;

  const usersEl = document.getElementById("impact-total-users");
  if (usersEl) usersEl.textContent = data.totalUsers;

  // Render Chart.js
  renderCategoryChart(data.categoryCounts);
}

// Chart.js Category Distribution Chart
let categoryChartInstance = null;

function renderCategoryChart(categoryCounts) {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;

  // Default labels if no listings yet
  let labels = Object.keys(categoryCounts);
  let values = Object.values(categoryCounts);

  if (labels.length === 0) {
    labels = ["Cooked Meals", "Bakery & Breads", "Fresh Produce", "Packaged Food", "Beverages", "Dairy"];
    values = [0, 0, 0, 0, 0, 0];
  }

  const ctx = canvas.getContext("2d");
  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  // @ts-ignore
  if (typeof Chart !== 'undefined') {
    // @ts-ignore
    categoryChartInstance = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: [
            "#2d6a4f",
            "#d97706",
            "#15803d",
            "#2563eb",
            "#0284c7",
            "#7c3aed",
            "#64748b"
          ],
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 14,
              padding: 16,
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 13
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` ${context.label}: ${context.raw} listings`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}

// Update homepage counter preview
export async function updateHomeImpactPreview() {
  const data = await getPlatformImpactData();

  const homeListings = document.getElementById("home-kpi-listings");
  if (homeListings) homeListings.textContent = data.totalListings;

  const homeCompleted = document.getElementById("home-kpi-completed");
  if (homeCompleted) homeCompleted.textContent = data.completedDonations;

  const homeQuantity = document.getElementById("home-kpi-quantity");
  if (homeQuantity) homeQuantity.textContent = data.totalQuantityShared;

  const homeUsers = document.getElementById("home-kpi-users");
  if (homeUsers) homeUsers.textContent = data.totalUsers;
}

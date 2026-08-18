const state = { trips: [], selectedTripId: null };

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("en-CA", {
  style: "currency", currency: "CAD", maximumFractionDigits: 0
}).format(Number(value || 0));

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
};

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function selectedTrip() {
  return state.trips.find(t => t.id === state.selectedTripId) || state.trips[0] || null;
}

async function loadTrips() {
  state.trips = await api("/api/trips");
  if (!state.selectedTripId && state.trips.length) state.selectedTripId = state.trips[0].id;
  if (state.selectedTripId && !state.trips.some(t => t.id === state.selectedTripId)) {
    state.selectedTripId = state.trips[0]?.id || null;
  }
  renderAll();
}

function totals() {
  const budget = state.trips.reduce((sum, t) => sum + Number(t.budget || 0), 0);
  const spent = state.trips.reduce((sum, t) =>
    sum + t.activities.reduce((s, a) => s + Number(a.cost || 0), 0), 0);
  const activities = state.trips.reduce((sum, t) => sum + t.activities.length, 0);
  return { budget, spent, activities, remaining: budget - spent };
}

function renderDashboard() {
  const trip = selectedTrip();
  const t = totals();
  $("#stat-trips").textContent = state.trips.length;
  $("#stat-budget").textContent = money(t.budget);
  $("#stat-activities").textContent = t.activities;
  $("#stat-remaining").textContent = money(t.remaining);
  $("#snapshot-trips").textContent = state.trips.length;
  $("#snapshot-activities").textContent = t.activities;
  $("#snapshot-used").textContent = t.budget ? `${Math.round((t.spent / t.budget) * 100)}%` : "0%";

  if (trip) {
    $("#hero-destination").textContent = `Next stop: ${trip.destination}.`;
    $("#hero-text").textContent = `${trip.activities.length} activities planned. Keep everything from your itinerary to your budget in one beautiful place.`;
    $("#featured-title").textContent = trip.destination;
    $("#featured-content").innerHTML = `
      <div class="featured-details">
        <div class="featured-big">${trip.destination}</div>
        <div class="featured-dates">${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}</div>
        <div class="featured-pills">
          <span>${trip.activities.length} activities</span>
          <span>${money(trip.budget)} budget</span>
        </div>
      </div>`;
  } else {
    $("#hero-destination").textContent = "Your next adventure starts here.";
    $("#hero-text").textContent = "Build trips, organize every day, and keep your travel budget under control.";
    $("#featured-title").textContent = "No trip selected";
    $("#featured-content").innerHTML = `<div class="empty-state compact"><div class="empty-icon">✈</div><p>Create a trip and your next destination will appear here.</p></div>`;
  }
}

function renderTrips() {
  const grid = $("#trips-grid");
  if (!state.trips.length) {
    grid.innerHTML = `<div class="activity-empty"><div class="empty-icon">🧳</div><h3>No adventures yet.</h3><p>Start by planning your first trip.</p></div>`;
    return;
  }
  grid.innerHTML = state.trips.map(trip => `
    <article class="trip-card">
      <div class="trip-icon">✈</div>
      <h3>${escapeHtml(trip.destination)}</h3>
      <div class="trip-dates">${formatDate(trip.start_date)} → ${formatDate(trip.end_date)}</div>
      <div class="trip-meta">
        <span>${trip.activities.length} activities · ${money(trip.budget)}</span>
        <div class="card-actions">
          <button class="small-btn" onclick="openTrip('${trip.id}')">Open</button>
          <button class="small-btn delete" onclick="removeTrip('${trip.id}')">Delete</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderTripSelector() {
  const select = $("#trip-selector");
  select.innerHTML = state.trips.length
    ? state.trips.map(t => `<option value="${t.id}" ${t.id === state.selectedTripId ? "selected" : ""}>${escapeHtml(t.destination)}</option>`).join("")
    : `<option value="">No trips yet</option>`;
}

function renderItinerary() {
  const trip = selectedTrip();
  renderTripSelector();
  $("#itinerary-title").textContent = trip ? `${trip.destination} itinerary` : "Itinerary";
  $("#itinerary-subtitle").textContent = trip
    ? `${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}`
    : "Select a trip to start planning your days.";

  const list = $("#itinerary-list");
  if (!trip) {
    list.innerHTML = `<div class="activity-empty"><h3>No trip selected.</h3><p>Create a trip to build an itinerary.</p></div>`;
    return;
  }
  if (!trip.activities.length) {
    list.innerHTML = `<div class="activity-empty"><div class="empty-icon">☷</div><h3>Your itinerary is open.</h3><p>Add restaurants, attractions, tours, and anything else you want to do.</p></div>`;
    return;
  }

  const sorted = [...trip.activities].sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  list.innerHTML = sorted.map(a => `
    <article class="activity-card">
      <div class="activity-time">${a.time || "Anytime"}</div>
      <div><h3>${escapeHtml(a.name)}</h3><p>${formatDate(a.date)} ${a.category ? `· ${escapeHtml(a.category)}` : ""}</p></div>
      <span class="category-tag">${escapeHtml(a.category || "Experience")}</span>
      <div class="activity-cost">${money(a.cost)} <button class="small-btn delete" onclick="removeActivity('${trip.id}','${a.id}')">×</button></div>
    </article>
  `).join("");
}

function renderBudget() {
  const trip = selectedTrip();
  const container = $("#budget-content");
  if (!trip) {
    $("#budget-title").textContent = "Budget";
    container.innerHTML = `<div class="activity-empty"><h3>No budget to show yet.</h3><p>Create a trip first.</p></div>`;
    return;
  }
  $("#budget-title").textContent = `${trip.destination} budget`;
  const spent = trip.activities.reduce((s,a) => s + Number(a.cost || 0), 0);
  const remaining = Number(trip.budget || 0) - spent;
  const percent = trip.budget ? Math.min((spent / trip.budget) * 100, 100) : 0;

  const categories = {};
  trip.activities.forEach(a => categories[a.category || "Experience"] = (categories[a.category || "Experience"] || 0) + Number(a.cost || 0));

  container.innerHTML = `
    <div class="budget-grid">
      <div class="budget-card"><small>TOTAL BUDGET</small><strong>${money(trip.budget)}</strong></div>
      <div class="budget-card"><small>PLANNED SPENDING</small><strong>${money(spent)}</strong></div>
      <div class="budget-card"><small>REMAINING</small><strong>${money(remaining)}</strong></div>
    </div>
    <div class="progress-panel">
      <div class="panel-heading"><h3>Budget usage</h3><strong>${Math.round(percent)}%</strong></div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      <p class="trip-dates">${money(spent)} of ${money(trip.budget)} planned</p>
      <div class="budget-breakdown">
        ${Object.keys(categories).length ? Object.entries(categories).map(([name,value]) => `
          <div class="breakdown-row"><span>${escapeHtml(name)}</span><span>${money(value)}</span><strong>${trip.budget ? Math.round(value/trip.budget*100) : 0}%</strong></div>
        `).join("") : `<p class="trip-dates">Add activities with costs to see your spending breakdown.</p>`}
      </div>
    </div>`;
}

function renderAll() {
  renderDashboard();
  renderTrips();
  renderItinerary();
  renderBudget();
}

function formatDate(value) {
  if (!value) return "Date not set";
  const d = new Date(value + "T12:00:00");
  return isNaN(d) ? value : d.toLocaleDateString("en-CA", { month:"short", day:"numeric", year:"numeric" });
}

function escapeHtml(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  $(`#${page}-page`).classList.add("active-page");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  const titles = { dashboard:["Good to see you.","YOUR TRAVEL SPACE"], trips:["Your adventures.","TRIP LIBRARY"], itinerary:["Plan every moment.","YOUR ITINERARY"], budget:["Travel smarter.","MONEY OVERVIEW"] };
  $("#page-title").textContent = titles[page][0];
  $("#eyebrow").textContent = titles[page][1];
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => showPage(button.dataset.page)));
document.querySelectorAll("[data-page-jump]").forEach(button => button.addEventListener("click", () => showPage(button.dataset.pageJump)));

function openModal(id) { $(`#${id}`).classList.add("show"); }
function closeModal(id) { $(`#${id}`).classList.remove("show"); }
$("#new-trip-btn").addEventListener("click", () => openModal("trip-modal"));
$("#new-trip-btn-2").addEventListener("click", () => openModal("trip-modal"));
$("#hero-create").addEventListener("click", () => openModal("trip-modal"));
$("#add-activity-btn").addEventListener("click", () => {
  if (!selectedTrip()) return toast("Create a trip first.");
  openModal("activity-modal");
});
$("#open-featured").addEventListener("click", () => {
  if (!selectedTrip()) return toast("Create a trip first.");
  showPage("itinerary");
});
document.querySelectorAll(".modal-close").forEach(b => b.addEventListener("click", () => closeModal(b.dataset.close)));

$("#trip-form").addEventListener("submit", async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const trip = await api("/api/trips", { method:"POST", body:JSON.stringify(Object.fromEntries(f)) });
    state.selectedTripId = trip.id;
    e.target.reset(); closeModal("trip-modal");
    await loadTrips(); toast("Trip created! Your adventure is ready.");
  } catch (err) { toast(err.message); }
});

$("#activity-form").addEventListener("submit", async e => {
  e.preventDefault();
  const trip = selectedTrip();
  if (!trip) return;
  const f = new FormData(e.target);
  try {
    await api(`/api/trips/${trip.id}/activities`, { method:"POST", body:JSON.stringify(Object.fromEntries(f)) });
    e.target.reset(); closeModal("activity-modal");
    await loadTrips(); showPage("itinerary"); toast("Added to your itinerary.");
  } catch (err) { toast(err.message); }
});

$("#trip-selector").addEventListener("change", e => {
  state.selectedTripId = e.target.value;
  renderAll();
});

window.openTrip = function(id) {
  state.selectedTripId = id;
  renderAll();
  showPage("itinerary");
};

window.removeTrip = async function(id) {
  if (!confirm("Delete this trip? This cannot be undone.")) return;
  try { await api(`/api/trips/${id}`, {method:"DELETE"}); await loadTrips(); toast("Trip deleted."); }
  catch(err) { toast(err.message); }
};

window.removeActivity = async function(tripId, activityId) {
  try { await api(`/api/trips/${tripId}/activities/${activityId}`, {method:"DELETE"}); await loadTrips(); toast("Activity removed."); }
  catch(err) { toast(err.message); }
};

loadTrips().catch(err => toast(err.message));

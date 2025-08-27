// app.js
import { renderHome, renderSetup, renderScore } from "./ui.js";
import { getGames, putGame, deleteGame as deleteGameFromDB } from "./db.js";

// Simple router
const routes = {
  home: async () => renderHome(navigate),
  setup: async () => renderSetup(navigate),
  score: async (id) => renderScore(id, navigate),
};

function getRoute() {
  const hash = location.hash.replace("#", "");
  if (!hash) return { name: "home" };
  const parts = hash.split("/");
  return { name: parts[0] || "home", id: parts[1] || null };
}
function navigate(name, id) {
  if (name === "home") {
    location.hash = "";
  } else if (name === "setup") {
    location.hash = "setup";
  } else if (name === "score") {
    location.hash = `score/${id}`;
  }
  mountRoute();
}
async function mountRoute() {
  const r = getRoute();
  if (r.name === "home") await routes.home();
  else if (r.name === "setup") await routes.setup();
  else if (r.name === "score") await routes.score(r.id);
}

// wire global API for UI convenience
window.wiffAPI = {
  deleteGame: async (id) => {
    await deleteGameFromDB(id);
  },
};

// install prompt handling
let deferredPrompt = null;
let installArea = null;

window.addEventListener("beforeinstallprompt", (e) => {
  console.log("Install prompt received");
  e.preventDefault();
  deferredPrompt = e;

  // Get the install area element
  installArea = document.getElementById("install-area");
  if (installArea) {
    renderInstallButton();
  } else {
    console.warn("Install area element not found");
  }
});

function renderInstallButton() {
  if (!deferredPrompt || !installArea) {
    console.warn("Cannot render install button:", {
      deferredPrompt: !!deferredPrompt,
      installArea: !!installArea,
    });
    return;
  }

  console.log("Rendering install button");
  installArea.innerHTML = `<button id="install-btn" class="small">Install Wiff App</button>`;

  const installBtn = document.getElementById("install-btn");
  if (installBtn) {
    installBtn.onclick = async () => {
      console.log("Install button clicked");
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log("Install choice:", choice.outcome);
        deferredPrompt = null;
        installArea.innerHTML = "";
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    };
  }
}

// service worker registration
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .catch((err) => console.warn("SW failed", err));
}

// on load, route
window.addEventListener("hashchange", mountRoute);
window.addEventListener("load", mountRoute);

// Ensure install area is available after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  installArea = document.getElementById("install-area");
  if (installArea && deferredPrompt) {
    renderInstallButton();
  }
});

// export navigate for ui to use
export { navigate };

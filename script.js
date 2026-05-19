// ===== DOM REFERENCES =====
const searchInput    = document.getElementById("searchInput");
const searchBtn      = document.getElementById("searchBtn");
const recipeGrid     = document.getElementById("recipeGrid");
const loader         = document.getElementById("loader");
const sectionTitle   = document.getElementById("sectionTitle");
const toggleFavsBtn  = document.getElementById("toggleFavsBtn");
const favCount       = document.getElementById("favCount");
const categoryNav    = document.getElementById("categoryNav");
const sortSelect     = document.getElementById("sortSelect");
const recipeModal    = document.getElementById("recipeModal");
const closeModalBtn  = document.getElementById("closeModalBtn");
const modalTitle     = document.getElementById("modalTitle");
const modalBadge     = document.getElementById("modalBadge");
const modalImage     = document.getElementById("modalImage");
const modalIngredients = document.getElementById("modalIngredients");
const modalInstructions = document.getElementById("modalInstructions");
const modalYoutube   = document.getElementById("modalYoutube");
const youtubeLink    = document.getElementById("youtubeLink");
const toast          = document.getElementById("toast");

// ===== APPLICATION STATE =====
let currentRecipes   = [];     // Recipes returned by last API call
let displayedRecipes = [];     // Subset after category/sort filters applied
let favorites        = [];     // Saved favorites (persisted to localStorage)
let showingFavorites = false;  // Are we currently in favorites view?
let activeCategory   = "all";  // Currently selected category filter
let debounceTimer    = null;   // Timer ID for debounced search

// ===== INIT =====
function init() {
    loadPreferences();    // Restore favorites from localStorage
    fetchRecipes("rice"); // Load default results
    fetchCategories();    // Populate category nav bar from API
}

// ===== FETCH RECIPES =====
async function fetchRecipes(query) {
    const term = query.trim() || "rice";
    showLoader(true);
    activeCategory = "all"; // Reset category filter on new search
    updateActiveCategoryBtn("all");

    try {
        const res  = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${term}`);
        const data = await res.json();

        if (data.meals) {
            currentRecipes = data.meals;
            applyFilters();   // Apply current sort and category to the new data
            sectionTitle.textContent = `Results for "${term}"`;
        } else {
            currentRecipes = [];
            displayedRecipes = [];
            recipeGrid.innerHTML = "<p class='no-results'>No recipes found. Try another ingredient!</p>";
            sectionTitle.textContent = `No results for "${term}"`;
        }

    } catch (err) {
        console.error("Fetch error:", err);
        recipeGrid.innerHTML = "<p class='no-results'>Something went wrong. Check your connection.</p>";

    } finally {
        showLoader(false);
    }
}

// ===== FETCH CATEGORIES from API =====
async function fetchCategories() {
    try {
        const res  = await fetch("https://www.themealdb.com/api/json/v1/1/categories.php");
        const data = await res.json();

        if (data.categories) {
            // Build one button per category and append to the nav
            data.categories.forEach((cat) => {
                const btn = document.createElement("button");
                btn.className = "cat-btn";
                btn.dataset.category = cat.strCategory;  // Store category name in data attribute
                btn.textContent = cat.strCategory;
                btn.addEventListener("click", () => filterByCategory(cat.strCategory));
                categoryNav.appendChild(btn);
            });
        }
    } catch (err) {
        console.error("Category fetch error:", err);
    }
}

// ===== FILTER BY CATEGORY =====
function filterByCategory(category) {
    if (showingFavorites) return; // No category filter in favorites mode

    activeCategory = category;
    updateActiveCategoryBtn(category);
    applyFilters();
}

function updateActiveCategoryBtn(category) {
    document.querySelectorAll(".cat-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.category === category || (category === "all" && btn.dataset.category === "all"));
    });
}

// ===== APPLY FILTERS & SORT =====
// Called after fetch, category change, or sort change
function applyFilters() {
    let result = [...currentRecipes]; // Shallow copy to avoid mutating state

    // 1. Category filter
    if (activeCategory !== "all") {
        result = result.filter((r) => r.strCategory === activeCategory);
    }

    // 2. Sort
    const sort = sortSelect.value;
    // Simple string comparison using > and < operators (covered in Operators topic)
    if (sort === "az") {
        result.sort((a, b) => a.strMeal > b.strMeal ? 1 : -1);
    } else if (sort === "za") {
        result.sort((a, b) => a.strMeal < b.strMeal ? 1 : -1);
    }

    displayedRecipes = result;
    renderGrid(displayedRecipes);
}

// ===== RENDER GRID =====
function renderGrid(list) {
    recipeGrid.innerHTML = "";

    if (!list || list.length === 0) {
        recipeGrid.innerHTML = "<p class='no-results'>No recipes to display.</p>";
        return;
    }

    list.forEach((recipe, index) => {
        const isFav      = favorites.some((f) => f.idMeal === recipe.idMeal);
        const heartClass = isFav ? "active" : "";

        const card = document.createElement("div");
        card.className = "card";
        // Staggered animation delay: each card appears slightly after the previous
        card.style.animationDelay = `${index * 0.05}s`;

        card.innerHTML = `
            <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" loading="lazy">
            <div class="card-content">
                <h3>${recipe.strMeal}</h3>
                <div class="card-category">${recipe.strCategory} · ${recipe.strArea}</div>
                <div class="card-actions">
                    <button class="btn-view" onclick="openModal('${recipe.idMeal}')">View Recipe</button>
                    <button class="btn-fav ${heartClass}" 
                            onclick="toggleFavorite('${recipe.idMeal}')"
                            aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">♥</button>
                </div>
            </div>
        `;

        recipeGrid.appendChild(card);
    });
}

// ===== EXTRACT INGREDIENTS from MealDB format =====
// MealDB stores ingredients as strIngredient1…strIngredient20 + strMeasure1…20
function extractIngredients(recipe) {
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
        const ingredient = recipe[`strIngredient${i}`];
        const measure    = recipe[`strMeasure${i}`];
        if (ingredient && ingredient.trim()) {
            ingredients.push(`${measure ? measure.trim() + " " : ""}${ingredient.trim()}`);
        }
    }
    return ingredients;
}

// ===== FAVORITES =====
function loadPreferences() {
    // Favorites
    const saved = localStorage.getItem("flavordex_favs");
    if (saved) favorites = JSON.parse(saved);
    updateFavCount();
}

function saveFavorites() {
    localStorage.setItem("flavordex_favs", JSON.stringify(favorites));
    updateFavCount();
}

function updateFavCount() {
    favCount.textContent = favorites.length;
    // Restart bump animation by removing and re-adding the class
    // Using classList (DOM Manipulation — in syllabus)
    favCount.classList.remove("bump");
    // Small setTimeout (BOM timers — in syllabus) to let the class removal register before re-adding
    setTimeout(() => favCount.classList.add("bump"), 10);
}

function toggleFavorite(id) {
    // Find recipe in whichever array is currently shown
    const source = showingFavorites ? favorites : displayedRecipes.length ? displayedRecipes : currentRecipes;
    const recipe = source.find((r) => r.idMeal === id);

    const idx = favorites.findIndex((f) => f.idMeal === id);

    if (idx >= 0) {
        favorites.splice(idx, 1);
        showToast(`Removed from favorites`);
    } else if (recipe) {
        favorites.push(recipe);
        showToast(`❤️ "${recipe.strMeal}" saved!`);
    }

    saveFavorites();
    renderGrid(showingFavorites ? favorites : displayedRecipes.length ? displayedRecipes : currentRecipes);
}

function toggleFavoritesView() {
    showingFavorites = !showingFavorites;

    if (showingFavorites) {
        sectionTitle.textContent = "My Favorite Recipes";
        toggleFavsBtn.innerHTML  = `🏠 Back to Search <span id="favCount" class="fav-count">${favorites.length}</span>`;
        renderGrid(favorites);
    } else {
        sectionTitle.textContent = "Discover Recipes";
        toggleFavsBtn.innerHTML  = `❤️ Favorites <span id="favCount" class="fav-count">${favorites.length}</span>`;
        applyFilters();
    }
}

// ===== MODAL =====
function openModal(id) {
    // Search all possible sources for the recipe
    const allSources = [...currentRecipes, ...favorites];
    const recipe = allSources.find((r) => r.idMeal === id);
    if (!recipe) return;

    modalTitle.textContent  = recipe.strMeal;
    modalBadge.textContent  = `${recipe.strCategory} · ${recipe.strArea}`;
    modalImage.src          = recipe.strMealThumb;
    modalImage.alt          = recipe.strMeal;

    // Render ingredients as pill tags
    const ingredients = extractIngredients(recipe);
    modalIngredients.innerHTML = ingredients
        .map((ing) => `<li>${ing}</li>`)
        .join("");

    // Format instructions: split into paragraphs on newline characters
    // Using simple string split (covered in Strings topic) — no regex needed
    const paragraphs = recipe.strInstructions.split("\n");
    modalInstructions.innerHTML = paragraphs
        .filter((p) => p.trim())   // filter() — HOF in syllabus
        .map((p) => `<p style="margin-bottom:0.8rem">${p}</p>`)  // map() — HOF in syllabus
        .join("");

    // Show YouTube button if link exists
    if (recipe.strYoutube) {
        youtubeLink.href = recipe.strYoutube;
        modalYoutube.style.display = "block";
    } else {
        modalYoutube.style.display = "none";
    }

    recipeModal.classList.add("active");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    recipeModal.classList.remove("active");
    document.body.style.overflow = "";
}


// ===== TOAST NOTIFICATION =====
// Shows a brief message that disappears after 2.5 seconds
let toastTimer = null;
function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ===== HELPER =====
function showLoader(show) {
    loader.style.display      = show ? "flex" : "none";
    recipeGrid.style.display  = show ? "none"  : "grid";
}

// ===== DEBOUNCE HELPER =====
// A closure (Closures — in syllabus) that delays a function call
// until the user stops typing for `delay` milliseconds.
// Uses setTimeout/clearTimeout (BOM timers — in syllabus)
function debounce(fn, delay) {
    // The returned arrow function is a closure — it "closes over" the debounceTimer variable
    return function(value) {
        clearTimeout(debounceTimer);                         // Cancel previous timer
        debounceTimer = setTimeout(function() {             // Set a new timer
            fn(value);                                      // Call fn only after delay
        }, delay);
    };
}

const debouncedFetch = debounce((val) => {
    if (showingFavorites) toggleFavoritesView();
    fetchRecipes(val);
}, 500);

// ===== EVENT LISTENERS =====
searchBtn.addEventListener("click", () => {
    if (showingFavorites) toggleFavoritesView();
    fetchRecipes(searchInput.value);
});

searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        if (showingFavorites) toggleFavoritesView();
        fetchRecipes(searchInput.value);
    }
});

// Real-time search with debounce (types → waits 500ms → fetches)
searchInput.addEventListener("input", (e) => {
    if (e.target.value.length > 2) debouncedFetch(e.target.value);
});

toggleFavsBtn.addEventListener("click", toggleFavoritesView);
closeModalBtn.addEventListener("click", closeModal);

// Category "All" button
categoryNav.querySelector('[data-category="all"]').addEventListener("click", () => filterByCategory("all"));

// Sort dropdown change
sortSelect.addEventListener("change", () => {
    if (showingFavorites) return;
    applyFilters();
});

// Close modal on background click (event delegation)
recipeModal.addEventListener("click", (e) => {
    if (e.target === recipeModal) closeModal();
});

// Close modal with Escape key (keyboard accessibility)
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && recipeModal.classList.contains("active")) closeModal();
});

// ===== BOOT =====
init();

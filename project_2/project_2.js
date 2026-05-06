// Utility functions
const ENV = {
  OPENWEATHER_API_KEY: "",
  NEWS_API_KEY: "",
  NASA_API_KEY: "",
  TMDB_API_KEY: ""
};

const envReady = loadEnvFile();

async function loadEnvFile() {
  if (typeof window !== "undefined" && window.__ENV && typeof window.__ENV === "object") {
    hydrateEnvFromObject(window.__ENV);
    return;
  }

  try {
    const response = await fetch(".env", { cache: "no-store" });
    if (!response.ok) return;
    const text = await response.text();
    text.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const splitIndex = trimmed.indexOf("=");
      if (splitIndex === -1) return;
      const key = trimmed.slice(0, splitIndex).trim();
      let value = trimmed.slice(splitIndex + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (Object.prototype.hasOwnProperty.call(ENV, key)) {
        ENV[key] = value;
      }
    });
    if (typeof window !== "undefined") {
      window.__ENV = { ...ENV };
    }
  } catch (error) {
    // Ignore missing .env in production builds.
  }
}

function hydrateEnvFromObject(source) {
  Object.keys(ENV).forEach(key => {
    if (typeof source[key] === "string") {
      ENV[key] = source[key];
    }
  });
}

function getEnvValue(key) {
  return ENV[key] || "";
}

function showSection(sectionId) {
  document.getElementById("main-container").style.display = "none";

  const section = document.getElementById(sectionId);
  section.style.display = "block";

  if (sectionId === "movie-section") {
    document.body.classList.add("movies-mode");
  } else {
    document.body.classList.remove("movies-mode");
  }

}

function hideAllSections() {
  document.getElementById("main-container").style.display = "grid";
  document.body.classList.remove("movies-mode");

  document.querySelectorAll(".section").forEach(div => {
    div.style.display = "none";
  });

  document.getElementById("weatherResult").innerHTML = "";
  document.getElementById("newsResult").innerHTML = "";
  document.getElementById("spaceResult").innerHTML = "";
  document.getElementById("cityInput").value = "";

  closeMovieModal();
  setMovieError("");
  showMovieLoading(false);
  setMovieStatus("");
}


// Event Listeners
document.getElementById("weatherBtn").addEventListener("click", () => showSection("weather-section"));
document.getElementById("newsBtn").addEventListener("click", () => {
  showSection("news-section");
  getNews();
});
document.getElementById("spaceBtn").addEventListener("click", () => {
  showSection("space-section");
  getSpaceData();
});
document.getElementById("movieBtn").addEventListener("click", () => {
  showSection("movie-section");
  initMovies();
});
document.querySelectorAll(".backBtn").forEach(btn =>
  btn.addEventListener("click", hideAllSections)
)

// WEATHER API
async function getWeather() {
  await envReady;
  const city = document.getElementById("cityInput").value;
  const apiKey = getEnvValue("OPENWEATHER_API_KEY");
  if (!city) return alert("Enter a city name.");
  if (!apiKey) {
    document.getElementById("weatherResult").innerHTML = "❌ Missing OpenWeather API key.";
    return;
  }

  fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`)
    .then(res => res.json())
    .then(data => {
      if (data.cod !== 200) throw new Error(data.message);
      document.getElementById("weatherResult").innerHTML = `
        <ps>🌍 Location: ${data.name}</p>
        <p>🌡️ Temp: ${data.main.temp}°C</p>
        <p>☁️ Weather: ${data.weather[0].description}</p>
        <p>💨 Wind: ${data.wind.speed} m/s</p>`;
    })
    .catch(err => {
      document.getElementById("weatherResult").innerHTML = "❌ " + err.message;
    });
}

// NEWS API 
async function getNews() { 
  await envReady;
  const apiKey = getEnvValue("NEWS_API_KEY");
  if (!apiKey) {
    document.getElementById("newsResult").innerHTML = "❌ Missing News API key.";
    return;
  }
  const url = `https://newsapi.org/v2/top-headlines?language=en&pageSize=5&apiKey=${apiKey}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      return res.json();
    })
    .then(data => {
      const articles = data.articles;
      if (!articles || articles.length === 0) {
        document.getElementById("newsResult").innerHTML = "⚠️ No news articles found.";
        return;
      }

      const content = articles.map(article => {
        const description = article.description
          ? `<p class="news-desc">${article.description}</p>`
          : "";
        const source = article.source && article.source.name
          ? article.source.name
          : "News";

        return `
          <article class="news-item">
            <h4 class="news-title">${article.title}</h4>
            <div class="news-meta">${source}</div>
            ${description}
            <a class="news-link" href="${article.url}" target="_blank" rel="noopener noreferrer">Read more</a>
          </article>
        `;
      }).join("");

      document.getElementById("newsResult").innerHTML = content;
    })
    .catch(err => {
      document.getElementById("newsResult").innerHTML = "❌ " + err.message;
    });
}



// SPACE API (NASA APOD)
async function getSpaceData() {
  await envReady;
  const apiKey = getEnvValue("NASA_API_KEY");
  if (!apiKey) {
    document.getElementById("spaceResult").innerHTML = "❌ Missing NASA API key.";
    return;
  }
  fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      const mediaMarkup = data.media_type === "image"
        ? `<img class="space-image" src="${data.url}" alt="${data.title}">`
        : `<a class="space-link" href="${data.url}" target="_blank" rel="noopener noreferrer">View today's NASA media</a>`;

      document.getElementById("spaceResult").innerHTML = `
        <div class="space-card">
          <h4 class="space-title">${data.title}</h4>
          ${mediaMarkup}
          <p class="space-desc">${data.explanation}</p>
        </div>`;
    })
    .catch(err => {
      document.getElementById("spaceResult").innerHTML = "❌ Could not load space data";
    });
}

// MOVIES API (TMDb)
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
const FAVORITES_KEY = "vistaz_favorite_movies";

const movieElements = {
  section: document.getElementById("movie-section"),
  grid: document.getElementById("movieGrid"),
  status: document.getElementById("movieStatus"),
  loading: document.getElementById("movieLoading"),
  error: document.getElementById("movieError"),
  search: document.getElementById("movieSearch"),
  genre: document.getElementById("movieGenre"),
  chips: document.querySelectorAll(".movie-chip"),
  sentinel: document.getElementById("movieScrollSentinel"),
  modal: document.getElementById("movieModal"),
  modalImage: document.getElementById("movieModalImage"),
  modalTitle: document.getElementById("movieModalTitle"),
  modalOverview: document.getElementById("movieModalOverview"),
  modalMeta: document.getElementById("movieModalMeta"),
  modalTags: document.getElementById("movieModalTags"),
  modalFav: document.getElementById("movieModalFav"),
  modalClose: document.querySelector(".movie-modal__close"),
  modalBackdrop: document.querySelector(".movie-modal__backdrop")
};

const movieState = {
  initialized: false,
  category: "trending",
  query: "",
  genre: "all",
  page: 0,
  totalPages: 1,
  isLoading: false,
  favorites: new Set(),
  genreMap: new Map(),
  revealObserver: null,
  infiniteObserver: null
};

let movieSearchTimer;

async function initMovies() {
  if (movieState.initialized) return;
  movieState.initialized = true;
  movieState.favorites = loadFavorites();

  await envReady;
  if (!getEnvValue("TMDB_API_KEY")) {
    setMovieError("Missing TMDb API key.");
    return;
  }

  movieElements.grid.addEventListener("click", handleMovieGridClick);
  movieElements.search.addEventListener("input", handleMovieSearch);
  movieElements.genre.addEventListener("change", handleGenreChange);
  movieElements.chips.forEach(button =>
    button.addEventListener("click", handleCategoryChange)
  );
  movieElements.modalClose.addEventListener("click", closeMovieModal);
  movieElements.modalBackdrop.addEventListener("click", closeMovieModal);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMovieModal();
  });

  movieElements.modalFav.addEventListener("click", () => {
    const id = Number(movieElements.modalFav.dataset.movieId || 0);
    if (!id) return;
    toggleFavorite(id);
    updateModalFavorite(id);
  });

  setupInfiniteScroll();
  loadGenres();
  loadMovies({ reset: true });
}

function handleMovieSearch(event) {
  const value = event.target.value.trim();
  clearTimeout(movieSearchTimer);
  movieSearchTimer = setTimeout(() => {
    movieState.query = value;
    loadMovies({ reset: true });
  }, 400);
}

function handleGenreChange(event) {
  movieState.genre = event.target.value;
  loadMovies({ reset: true });
}

function handleCategoryChange(event) {
  const target = event.currentTarget;
  movieElements.chips.forEach(button => button.classList.remove("is-active"));
  target.classList.add("is-active");
  movieState.category = target.dataset.category;
  movieState.query = "";
  movieElements.search.value = "";
  loadMovies({ reset: true });
}

function handleMovieGridClick(event) {
  const favoriteButton = event.target.closest(".movie-fav");
  if (favoriteButton) {
    event.stopPropagation();
    const id = Number(favoriteButton.dataset.movieId || 0);
    toggleFavorite(id);
    updateFavoriteButtons();
    return;
  }

  const card = event.target.closest(".movie-card");
  if (!card) return;
  const movieId = Number(card.dataset.movieId || 0);
  if (movieId) openMovieModal(movieId);
}

async function loadGenres() {
  await envReady;
  if (!getEnvValue("TMDB_API_KEY")) {
    setMovieError("Missing TMDb API key.");
    return;
  }
  try {
    const data = await fetchTmdb(`${TMDB_BASE_URL}/genre/movie/list?${buildParams({})}`);
    movieState.genreMap = new Map((data.genres || []).map(genre => [String(genre.id), genre.name]));
    movieElements.genre.innerHTML = "<option value=\"all\">All genres</option>";
    (data.genres || []).forEach(genre => {
      const option = document.createElement("option");
      option.value = String(genre.id);
      option.textContent = genre.name;
      movieElements.genre.appendChild(option);
    });
  } catch (error) {
    setMovieError("Could not load genres.");
  }
}

async function loadMovies({ reset = false } = {}) {
  await envReady;
  if (!getEnvValue("TMDB_API_KEY")) {
    setMovieError("Missing TMDb API key.");
    showMovieLoading(false);
    return;
  }
  if (movieState.isLoading) return;
  const nextPage = reset ? 1 : movieState.page + 1;

  showMovieLoading(true);
  setMovieError("");
  if (reset) movieElements.grid.innerHTML = "";

  try {
    const url = buildMovieUrl(nextPage);
    const data = await fetchTmdb(url);
    const results = filterByGenre(data.results || []);

    if (reset && results.length === 0) {
      setMovieStatus("No movies found.");
    } else {
      setMovieStatus(buildMovieStatus());
    }

    renderMovies(results, { append: !reset });
    movieState.page = nextPage;
    movieState.totalPages = data.total_pages || 1;
    updateFavoriteButtons();
    initScrollReveal();
  } catch (error) {
    setMovieError(error.message || "Failed to load movies.");
  } finally {
    showMovieLoading(false);
  }
}

function buildMovieUrl(page) {
  const params = buildParams({ page });
  const hasQuery = movieState.query.length > 0;
  const hasGenre = movieState.genre !== "all";

  if (hasQuery) {
    params.set("query", movieState.query);
    return `${TMDB_BASE_URL}/search/movie?${params}`;
  }

  if (hasGenre) {
    params.set("with_genres", movieState.genre);
    params.set("sort_by", "popularity.desc");
    return `${TMDB_BASE_URL}/discover/movie?${params}`;
  }

  switch (movieState.category) {
    case "popular":
      return `${TMDB_BASE_URL}/movie/popular?${params}`;
    case "top_rated":
      return `${TMDB_BASE_URL}/movie/top_rated?${params}`;
    case "upcoming":
      return `${TMDB_BASE_URL}/movie/upcoming?${params}`;
    default:
      return `${TMDB_BASE_URL}/trending/movie/day?${params}`;
  }
}

function buildParams({ page = 1 } = {}) {
  const apiKey = getEnvValue("TMDB_API_KEY");
  const params = new URLSearchParams({
    api_key: apiKey,
    language: "en-US",
    page: String(page),
    include_adult: "false"
  });
  return params;
}

function filterByGenre(results) {
  if (movieState.genre === "all") return results;
  const genreId = Number(movieState.genre);
  return results.filter(movie => (movie.genre_ids || []).includes(genreId));
}

function renderMovies(movies, { append } = {}) {
  if (!append) movieElements.grid.innerHTML = "";
  if (!movies.length) return;

  const cards = movies.map(movie => {
    const posterUrl = movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : "";
    const title = movie.title || movie.name || "Untitled";
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
    const release = movie.release_date ? formatDate(movie.release_date) : "TBA";
    const favoriteClass = movieState.favorites.has(movie.id) ? "is-favorite" : "";

    const posterMarkup = posterUrl
      ? `<img src=\"${posterUrl}\" alt=\"${title}\" loading=\"lazy\">`
      : `<div class=\"movie-poster movie-poster--empty\">No Image</div>`;

    return `
      <article class=\"movie-card reveal\" data-movie-id=\"${movie.id}\">
        <div class=\"movie-poster-wrap\">
          ${posterMarkup}
          <button class=\"movie-fav ${favoriteClass}\" data-movie-id=\"${movie.id}\" type=\"button\" aria-label=\"Toggle watchlist\">❤</button>
        </div>
        <div class=\"movie-info\">
          <h4 class=\"movie-title\">${title}</h4>
          <div class=\"movie-details\">
            <span class=\"movie-rating\">⭐ ${rating}</span>
            <span class=\"movie-date\">${release}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");

  movieElements.grid.insertAdjacentHTML("beforeend", cards);
}

async function openMovieModal(movieId) {
  await envReady;
  if (!getEnvValue("TMDB_API_KEY")) {
    movieElements.modalTitle.textContent = "Missing TMDb API key.";
    return;
  }
  try {
    movieElements.modal.setAttribute("aria-hidden", "false");
    movieElements.modal.classList.add("is-open");
    document.body.classList.add("modal-open");
    movieElements.modalTitle.textContent = "Loading...";
    movieElements.modalOverview.textContent = "";
    movieElements.modalMeta.textContent = "";
    movieElements.modalTags.textContent = "";

    const data = await fetchTmdb(`${TMDB_BASE_URL}/movie/${movieId}?${buildParams({})}`);
    const backdrop = data.backdrop_path ? `${TMDB_BACKDROP_BASE}${data.backdrop_path}` : "";
    const poster = data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : "";
    const imageUrl = backdrop || poster;

    if (imageUrl) {
      movieElements.modalImage.src = imageUrl;
      movieElements.modalImage.style.display = "block";
    } else {
      movieElements.modalImage.removeAttribute("src");
      movieElements.modalImage.style.display = "none";
    }
    movieElements.modalImage.alt = data.title || "Movie backdrop";
    movieElements.modalTitle.textContent = data.title || "Untitled";
    movieElements.modalOverview.textContent = data.overview || "No overview available.";
    movieElements.modalMeta.innerHTML = buildModalMeta(data);
    movieElements.modalTags.innerHTML = buildGenreTags(data.genres || []);
    movieElements.modalFav.dataset.movieId = String(movieId);
    updateModalFavorite(movieId);
  } catch (error) {
    movieElements.modalTitle.textContent = "Could not load movie details.";
    movieElements.modalOverview.textContent = "";
  }
}

function closeMovieModal() {
  movieElements.modal.setAttribute("aria-hidden", "true");
  movieElements.modal.classList.remove("is-open");
  document.body.classList.remove("modal-open");
}

function buildModalMeta(movie) {
  const release = movie.release_date ? formatDate(movie.release_date) : "TBA";
  const runtime = movie.runtime ? `${movie.runtime} min` : "N/A";
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
  const language = movie.original_language ? movie.original_language.toUpperCase() : "N/A";

  return `
    <span>Release: ${release}</span>
    <span>Runtime: ${runtime}</span>
    <span>Rating: ${rating}</span>
    <span>Language: ${language}</span>
  `;
}

function buildGenreTags(genres) {
  if (!genres.length) return "";
  return genres
    .map(genre => `<span class=\"movie-tag\">${genre.name}</span>`)
    .join("");
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function buildMovieStatus() {
  const categoryLabels = {
    trending: "Trending Movies",
    popular: "Popular Movies",
    top_rated: "Top Rated Movies",
    upcoming: "Upcoming Movies"
  };

  let label = movieState.query
    ? `Search results for \"${movieState.query}\"`
    : categoryLabels[movieState.category] || "Movies";

  if (movieState.genre !== "all") {
    const genreName = movieState.genreMap.get(String(movieState.genre)) || "Genre";
    label = `${label} · ${genreName}`;
  }

  return label;
}

function showMovieLoading(show) {
  movieState.isLoading = show;
  movieElements.loading.style.display = show ? "flex" : "none";
  movieElements.loading.setAttribute("aria-hidden", String(!show));
}

function setMovieError(message) {
  movieElements.error.textContent = message;
}

function setMovieStatus(message) {
  movieElements.status.textContent = message;
}

async function fetchTmdb(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDb error: ${response.status}`);
  }
  return response.json();
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return new Set(saved);
  } catch (error) {
    return new Set();
  }
}

function toggleFavorite(id) {
  if (!id) return;
  if (movieState.favorites.has(id)) {
    movieState.favorites.delete(id);
  } else {
    movieState.favorites.add(id);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...movieState.favorites]));
}

function updateFavoriteButtons() {
  movieElements.grid.querySelectorAll(".movie-fav").forEach(button => {
    const id = Number(button.dataset.movieId || 0);
    if (movieState.favorites.has(id)) {
      button.classList.add("is-favorite");
    } else {
      button.classList.remove("is-favorite");
    }
  });
}

function updateModalFavorite(id) {
  const isFavorite = movieState.favorites.has(id);
  movieElements.modalFav.textContent = isFavorite ? "Remove from Watchlist" : "Add to Watchlist";
  movieElements.modalFav.classList.toggle("is-favorite", isFavorite);
}

function setupInfiniteScroll() {
  if (!movieElements.sentinel || !("IntersectionObserver" in window)) return;
  movieState.infiniteObserver = new IntersectionObserver(entries => {
    const entry = entries[0];
    if (!entry.isIntersecting) return;
    if (movieElements.section.style.display !== "block") return;
    if (movieState.isLoading) return;
    if (movieState.page >= movieState.totalPages) return;
    loadMovies({ reset: false });
  }, { rootMargin: "250px" });

  movieState.infiniteObserver.observe(movieElements.sentinel);
}

function initScrollReveal() {
  const items = movieElements.grid.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach(item => item.classList.add("in-view"));
    return;
  }

  if (!movieState.revealObserver) {
    movieState.revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          movieState.revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
  }

  items.forEach(item => movieState.revealObserver.observe(item));
}

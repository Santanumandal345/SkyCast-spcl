
        const API_KEY = "cf77b06aa73bb2908600a622a4400adc";
        let currentWeatherData = null;
        let tempChart = null;
        let currentCityName = "Kolkata";

        // DOM elements
        const cityInput = document.getElementById("cityInput");
        const searchBtn = document.getElementById("searchBtn");
        const refreshBtn = document.getElementById("refreshBtn");
        const locationBtn = document.getElementById("locationBtn");
        const cityNameEl = document.getElementById("cityName");
        const temperatureEl = document.getElementById("temperature");
        const conditionTextEl = document.getElementById("conditionText");
        const humidityValEl = document.getElementById("humidityVal");
        const windValEl = document.getElementById("windVal");
        const forecastGrid = document.getElementById("forecastGrid");
        const animatedIconContainer = document.getElementById("animatedIcon");
        const darkModeToggle = document.getElementById("darkModeToggle");
        const modal = document.getElementById("weatherModal");
        const modalDetails = document.getElementById("modalDetails");
        const closeModalBtn = document.querySelector(".close-modal");
        const suggestionsBox = document.getElementById("suggestionsBox");
        const favoritesContainer = document.getElementById("favoritesContainer");
        const addFavoriteBtn = document.getElementById("addFavoriteBtn");

        // ---------- FAVORITES MANAGEMENT ----------
        let favorites = JSON.parse(localStorage.getItem("skycast_favorites")) || ["Kolkata", "London", "Tokyo"];

        function saveFavorites() {
            localStorage.setItem("skycast_favorites", JSON.stringify(favorites));
            renderFavorites();
        }

        function renderFavorites() {
            favoritesContainer.innerHTML = "";
            favorites.forEach(city => {
                const wrapper = document.createElement("div");
                wrapper.style.display = "inline-flex";
                wrapper.style.alignItems = "center";
                wrapper.style.gap = "4px";

                const cityBtn = document.createElement("button");
                cityBtn.className = "fav-city";
                cityBtn.innerHTML = `<i class="fas fa-star" style="color: #FFD966;"></i> ${city}`;
                cityBtn.onclick = (e) => {
                    e.stopPropagation();
                    cityInput.value = city;
                    searchCityWeather();
                };

                const removeBtn = document.createElement("button");
                removeBtn.className = "remove-fav";
                removeBtn.innerHTML = "<i class='fas fa-times'></i>";
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    favorites = favorites.filter(c => c !== city);
                    saveFavorites();
                    showToast(`🗑️ Removed ${city}`);
                };

                wrapper.appendChild(cityBtn);
                wrapper.appendChild(removeBtn);
                favoritesContainer.appendChild(wrapper);
            });
        }

        function addCurrentToFavorites() {
            const city = cityNameEl.innerText;
            if (!favorites.includes(city)) {
                favorites.push(city);
                saveFavorites();
                showToast(`❤️ ${city} added to favorites!`);
            } else {
                showToast(`${city} already in favorites`, "warning");
            }
        }

        function showToast(msg, type = "info") {
            const toast = document.createElement("div");
            toast.textContent = msg;
            toast.style.position = "fixed";
            toast.style.bottom = "20px";
            toast.style.left = "50%";
            toast.style.transform = "translateX(-50%)";
            toast.style.backgroundColor = type === "warning" ? "rgba(255,100,50,0.9)" : "rgba(0,0,0,0.8)";
            toast.style.color = "white";
            toast.style.padding = "10px 20px";
            toast.style.borderRadius = "40px";
            toast.style.fontSize = "0.85rem";
            toast.style.zIndex = "999";
            toast.style.backdropFilter = "blur(8px)";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }

        // ---------- MY LOCATION (Geolocation) ----------
        async function getWeatherByCoords(lat, lon) {
            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
                const data = await res.json();
                if (data.cod !== 200) throw new Error();
                return data;
            } catch (err) {
                throw new Error("Location weather failed");
            }
        }

        function getMyLocation() {
            if (!navigator.geolocation) {
                showToast("Geolocation not supported", "warning");
                return;
            }

            // Show loading state on location button
            const originalText = locationBtn.innerHTML;
            locationBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Locating...';
            locationBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const weatherData = await getWeatherByCoords(latitude, longitude);
                        const cityNameFromLoc = weatherData.name;
                        cityInput.value = cityNameFromLoc;
                        await fetchWeather(cityNameFromLoc);
                        await fetchForecastAndGraph(cityNameFromLoc);
                        showToast(`📍 Showing weather for ${cityNameFromLoc}`);
                    } catch (err) {
                        showToast("Could not fetch weather for your location", "warning");
                        console.error(err);
                    } finally {
                        locationBtn.innerHTML = originalText;
                        locationBtn.disabled = false;
                    }
                },
                (error) => {
                    let errorMsg = "Location access denied or failed.";
                    if (error.code === 1) errorMsg = "Please allow location access to use this feature.";
                    else if (error.code === 2) errorMsg = "Location unavailable.";
                    showToast(errorMsg, "warning");
                    locationBtn.innerHTML = originalText;
                    locationBtn.disabled = false;
                }
            );
        }

        // ---------- SEARCH SUGGESTIONS (5 options) ----------
        const popularCities = ["New York", "London", "Tokyo", "Paris", "Berlin", "Sydney", "Mumbai", "Dubai", "Singapore", "Kolkata", "Delhi", "Shanghai", "Los Angeles", "Chicago", "Toronto", "Mexico City", "Rome", "Madrid", "Amsterdam", "Bangkok", "Seoul", "Istanbul", "Cairo", "Moscow"];

        function showSuggestions(query) {
            if (!query || query.trim() === "") { suggestionsBox.style.display = "none"; return; }
            const filtered = popularCities.filter(city => city.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5);
            if (filtered.length === 0) { suggestionsBox.style.display = "none"; return; }
            suggestionsBox.innerHTML = filtered.map(city => `
            <div onclick="selectCity('${city}')">
                <i class="fas fa-map-marker-alt"></i> ${city}
            </div>
        `).join('');
            suggestionsBox.style.display = "block";
        }

        window.selectCity = function (city) {
            cityInput.value = city;
            suggestionsBox.style.display = "none";
            searchCityWeather();
        };

        cityInput.addEventListener("input", (e) => showSuggestions(e.target.value));
        document.addEventListener("click", (e) => { if (!cityInput.contains(e.target) && !suggestionsBox.contains(e.target)) suggestionsBox.style.display = "none"; });

        // ---------- Animation Helpers ----------
        function updateAnimatedIcon(condition) {
            const cond = condition.toLowerCase();
            animatedIconContainer.innerHTML = "";
            if (cond.includes("clear") || cond.includes("sun")) {
                const div = document.createElement("div"); div.className = "sun-animation";
                animatedIconContainer.appendChild(div);
            } else if (cond.includes("cloud")) {
                animatedIconContainer.innerHTML = '<i class="fas fa-cloud-sun" style="font-size:4rem; animation: cloudDrift 3s infinite alternate;"></i>';
            } else if (cond.includes("rain")) {
                animatedIconContainer.innerHTML = '<i class="fas fa-cloud-rain" style="font-size:4rem; animation: rainDrop 1s infinite;"></i>';
            } else {
                const div = document.createElement("div"); div.className = "sun-animation";
                animatedIconContainer.appendChild(div);
            }
        }

        function updateBackgroundByCondition(condition) {
            const body = document.body;
            const cond = condition.toLowerCase();
            if (!body.classList.contains("dark-mode")) {
                if (cond.includes("clear")) body.style.background = "linear-gradient(135deg, #2193b0, #6dd5ed)";
                else if (cond.includes("cloud")) body.style.background = "linear-gradient(135deg, #4b6cb7, #182848)";
                else if (cond.includes("rain")) body.style.background = "linear-gradient(135deg, #2c3e50, #3498db)";
                else body.style.background = "linear-gradient(135deg, #1e3c72, #2a5298)";
            } else {
                body.style.background = "linear-gradient(135deg, #0f172a, #1e293b)";
            }
        }

        function renderTemperatureGraph(forecastArray) {
            const labels = forecastArray.map(d => d.day);
            const maxTemps = forecastArray.map(d => d.max);
            const minTemps = forecastArray.map(d => d.min);
            const ctx = document.getElementById('tempChart').getContext('2d');
            if (tempChart) tempChart.destroy();
            tempChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Max °C', data: maxTemps, borderColor: '#ff7e5e', backgroundColor: 'rgba(255,126,94,0.15)', borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: '#ff5722', pointRadius: 5 },
                        { label: 'Min °C', data: minTemps, borderColor: '#4facfe', backgroundColor: 'rgba(79,172,254,0.15)', borderWidth: 3, fill: true, tension: 0.3, pointBackgroundColor: '#00c6fb' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
            });
        }

        // ---------- API Calls ----------
        async function fetchWeather(city) {
            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`);
                const data = await res.json();
                if (data.cod !== 200) { showToast(`City "${city}" not found.`, "warning"); return false; }
                cityNameEl.textContent = data.name;
                currentCityName = data.name;
                temperatureEl.textContent = `${Math.round(data.main.temp)}°C`;
                const condition = data.weather[0].main;
                conditionTextEl.textContent = condition;
                humidityValEl.textContent = `${data.main.humidity}%`;
                const windKmh = (data.wind.speed * 3.6).toFixed(1);
                windValEl.textContent = `${windKmh} km/h`;
                currentWeatherData = { feelsLike: Math.round(data.main.feels_like), pressure: data.main.pressure, visibility: (data.visibility / 1000).toFixed(1), condition };
                updateAnimatedIcon(condition);
                updateBackgroundByCondition(condition);
                return true;
            } catch (e) { console.error(e); showToast("Network error", "warning"); return false; }
        }

        async function fetchForecastAndGraph(city) {
            try {
                const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`);
                const data = await res.json();
                if (data.cod !== "200") throw new Error();
                const dailyMap = new Map();
                data.list.forEach(item => {
                    const date = new Date(item.dt_txt);
                    const key = date.toLocaleDateString('en-US');
                    if (!dailyMap.has(key) || item.dt_txt.includes("12:00:00")) {
                        dailyMap.set(key, { min: item.main.temp_min, max: item.main.temp_max, condition: item.weather[0].main, date: date });
                    } else {
                        const ex = dailyMap.get(key);
                        ex.min = Math.min(ex.min, item.main.temp_min);
                        ex.max = Math.max(ex.max, item.main.temp_max);
                    }
                });
                const next5 = Array.from(dailyMap.values()).slice(0, 5);
                forecastGrid.innerHTML = "";
                const graphPoints = [];
                next5.forEach((day, idx) => {
                    const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });
                    const minC = Math.round(day.min);
                    const maxC = Math.round(day.max);
                    const cond = day.condition;
                    let icon = "fas fa-cloud-sun";
                    if (cond.toLowerCase().includes("clear")) icon = "fas fa-sun";
                    else if (cond.toLowerCase().includes("rain")) icon = "fas fa-cloud-rain";
                    const card = document.createElement("div");
                    card.className = "forecast-card";
                    card.style.animationDelay = `${idx * 0.07}s`;
                    card.innerHTML = `<h3>${dayName}</h3><i class="${icon}" style="font-size:2rem;"></i><p>${minC}° / ${maxC}°</p><span>${cond}</span>`;
                    card.onclick = () => { modalDetails.innerHTML = `<strong>${day.date.toDateString()}</strong><br>🌡️ ${minC}°C ~ ${maxC}°C<br>☁️ ${cond}<br>💧 Humidity ~ ${Math.floor(55 + Math.random() * 35)}%`; modal.style.display = "flex"; };
                    forecastGrid.appendChild(card);
                    graphPoints.push({ day: dayName, min: minC, max: maxC });
                });
                if (graphPoints.length) renderTemperatureGraph(graphPoints);
            } catch (e) { forecastGrid.innerHTML = "<p style='color:white;'>Forecast unavailable</p>"; }
        }

        async function searchCityWeather() {
            let city = cityInput.value.trim();
            if (!city) { showToast("Please enter a city name", "warning"); return; }
            temperatureEl.textContent = "🌡️ ...";
            const ok = await fetchWeather(city);
            if (ok) {
                await fetchForecastAndGraph(city);
            } else {
                temperatureEl.textContent = "--°C";
            }
            suggestionsBox.style.display = "none";
        }

        function refreshWeather() { if (!cityInput.value.trim()) cityInput.value = currentCityName; searchCityWeather(); }

        // Dark Mode
        function initDarkMode() {
            const isDark = localStorage.getItem("skycast-dark") === "true";
            if (isDark) document.body.classList.add("dark-mode");
            updateDarkButton();
        }
        function updateDarkButton() {
            const isDark = document.body.classList.contains("dark-mode");
            darkModeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i> <span>Light Mode</span>' : '<i class="fas fa-moon"></i> <span>Dark Mode</span>';
        }
        function toggleDarkMode() {
            document.body.classList.toggle("dark-mode");
            localStorage.setItem("skycast-dark", document.body.classList.contains("dark-mode"));
            updateDarkButton();
            if (currentWeatherData) updateBackgroundByCondition(currentWeatherData.condition);
        }

        // Modal logic
        function showModalDetail() {
            if (currentWeatherData) modalDetails.innerHTML = `🌡️ Feels like: ${currentWeatherData.feelsLike}°C<br>💨 Pressure: ${currentWeatherData.pressure} hPa<br>👁️ Visibility: ${currentWeatherData.visibility} km<br>⭐ Click any forecast card for daily info.`;
            else modalDetails.innerHTML = "🔍 Search a city first!";
            modal.style.display = "flex";
        }
        function closeModal() { modal.style.display = "none"; }
        window.onclick = (e) => { if (e.target === modal) closeModal(); };

        // Event listeners
        document.getElementById("weatherCard").addEventListener("click", (e) => { if (!e.target.closest(".stat-card")) showModalDetail(); });
        searchBtn.addEventListener("click", searchCityWeather);
        refreshBtn.addEventListener("click", refreshWeather);
        locationBtn.addEventListener("click", getMyLocation);
        darkModeToggle.addEventListener("click", toggleDarkMode);
        closeModalBtn.addEventListener("click", closeModal);
        addFavoriteBtn.addEventListener("click", addCurrentToFavorites);
        cityInput.addEventListener("keypress", (e) => { if (e.key === "Enter") searchCityWeather(); });

        // Initial load
        window.onload = async () => {
            initDarkMode();
            renderFavorites();
            cityInput.value = "Kolkata";
            await searchCityWeather();
        };
    
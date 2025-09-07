const MTR_URL = "localhost:8888";
const APP = document.getElementById("app");
const CANVAS = document.getElementById("myCanvas");
const RouteList = document.getElementById("routeList");
const StationList = document.getElementById("stationList");
var MINT = 0;
var MAXT = 1000 * 3600; // 1 hour

class Station {
    /**
     * Initializes a new Station instance.
     * @param {string} id 
     * @param {string} name 
     * @param {number} zone1 
     * @param {number} zone2 
     * @param {number} zone3 
     * @param {number} color 
     */
    constructor(id, name, zone1, zone2, zone3, color) {
        this.id = id;
        this.name = name;
        this.zone1 = zone1;
        this.zone2 = zone2;
        this.zone3 = zone3;
        this.color = color;
    }
    getColorStr() {
        return ("000000" + (0xFFFFFF & this.color).toString(16)).slice(-6);
    }
    createElement() {
        let element = document.createElement("div");
        element.className = "station-item";
        let colorCode = this.getColorStr();
        element.innerHTML = `<span class="station-color" style="background-color: #${colorCode};"></span>` +
            `<a class="station-item-link" href="javascript:setStation('${this.id}')">${this.name}</a>`;
        return element;
    }
}

class Platform {
    /**
     * Initializes a new Platform instance.
     * @param {string} id 
     * @param {string} name 
     * @param {number} x 
     * @param {number} y 
     * @param {number} dwellTime 
     */
    constructor(id, name, x, y, z, dwellTime) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.z = z;
        this.dwellTime = dwellTime;
    }
    createElement() {
        let element = document.createElement("div");
        element.className = "platform-item";
        element.innerText = this.name;
        return element;
    }
}

class Route {
    /**
     * Initializes a new Route instance.
     * @param {string} id
     * @param {string} name 
     * @param {string} number 
     * @param {number[]} durations 
     * @param {Platform[]} stations 
     * @param {number} color
     * @param {string[]} depots
     */
    constructor(id, name, number, type, durations, stations, color, depots) {
        this.id = id;
        this.name = name;
        this.number = number;
        this.type = type;
        this.durations = durations;
        this.stations = stations;
        this.color = color;
        this.depots = depots;
        this.setStartTime([0, 15 * 60 * 1000, 30 * 60 * 1000, 45 * 60 * 1000]); // Default start times: every 15 minutes
    }

    getColorStr() {
        return ("000000" + (0xFFFFFF & this.color).toString(16)).slice(-6);
    }

    /**
     * Set the departure time(s) for the route and calculate the timelines.
     * @param {number[]} time 
     */
    setStartTime(time) {
        this.startTime = [];
        this.timelines = [];
        time.forEach((t) => {
            let in_range = false;
            let currentTime = t;
            let timeline = [];
            this.stations.forEach((platform, index) => {
                let departureTime = currentTime + platform.dwellTime;
                if (departureTime > 86400000) {
                    departureTime %= 86400000;
                }
                timeline.push([currentTime, departureTime]);
                currentTime = departureTime;
                if (index < this.durations.length) {
                    currentTime += this.durations[index];
                    if (currentTime > 86400000) {
                        currentTime %= 86400000;
                    }
                }
                if (currentTime >= MINT && currentTime <= MAXT) {
                    in_range = true;
                }
            });
            if(in_range) {
                this.startTime.push(t);
                this.timelines.push(timeline);
            }
        });
    }

    createElement() {
        let element = document.createElement("div");
        element.className = "route-item";
        // Convert number to a color code (e.g., hash the number to hex)
        let colorCode = this.getColorStr();
        element.innerHTML = `<span class="route-color" style="background-color: #${colorCode};"></span>` +
            `<a class="route-item-link" href="javascript:setRoute('${this.id}')">${this.name} (${this.number})</a>`;
        return element;
    }
}

/**
 * @typedef {{[key: string]: Station}} StationDict
 */

/**
 * Initializes stations from raw data.
 * @param {*} data 
 * @returns {StationDict} Array of Station instances
 */
function initStations(data) {
    let stations = {};
    data.forEach((station) => {
        let newStation = new Station(
            station.id,
            station.name,
            station.zone1,
            station.zone2,
            station.zone3,
            station.color
        );
        stations[station.id] = newStation;
    });
    return stations;
}

/**
 * @typedef {{[key: string]: Route}} RouteDict
 */

/**
 * Initializes routes from raw data.
 * @param {*} data 
 * @returns {RouteDict} Array of Route instances
 */
function initRoutes(data) {
    let routes = {};
    let depots = {};
    data.forEach((route) => {
        let platforms = [];
        route.stations.forEach((platform) => {
            let newPlatform = new Platform(
                platform.id,
                platform.name,
                platform.x,
                platform.y,
                platform.z,
                platform.dwellTime
            );
            platforms.push(newPlatform);
        });
        route.depots.forEach((depot) => {
            if(!depots[depot]){
                depots[depot] = [route.id];
            }else{
                depots[depot].push(route.id);
            }
        });
        let newRoute = new Route(
            route.id,
            route.name,
            route.number,
            route.type,
            route.durations,
            platforms,
            route.color,
            route.depots
        );
        routes[route.id] = newRoute;
    });
    return [routes, depots];
}

/** @type {StationDict} */
var Stations = {};

/** @type {RouteDict} */
var Routes = {};

/** @type {{[key: string]: string[]}} */
var Depots = {};

function toggleRouteList() {
    const routeListToggle = document.getElementById("routeListToggle");
    if (RouteList.style.display === "none") {
        RouteList.style.display = "block";
        routeListToggle.innerText = "▲";
    } else {
        RouteList.style.display = "none";
        routeListToggle.innerText = "▼";
    }
}

function toggleStationList() {
    const stationListToggle = document.getElementById("stationListToggle");
    if (StationList.style.display === "none") {
        StationList.style.display = "block";
        stationListToggle.innerText = "▲";
    } else {
        StationList.style.display = "none";
        stationListToggle.innerText = "▼";
    }
}

function parseTime(timeInt) {
    const seconds = Math.floor(timeInt / 1000) % 60;
    const minutes = Math.floor(timeInt / (1000 * 60)) % 60;
    const hours = Math.floor(timeInt / (1000 * 60 * 60)) % 24;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const routeView = document.getElementById("route-view");
const stationView = document.getElementById("station-view");
const depotView = document.getElementById("depot-view");

/**
 * Sets the selected route and updates the UI.
 * @param {string} routeId 
 */
function setRoute(routeId) {
    routeView.style.display = "block";
    stationView.style.display = "none";
    depotView.style.display = "none";
    const route = Routes[routeId];
    const routeName = document.getElementById("route-name");
    const routeDepots = document.getElementById("route-depots");
    let routeDepotsHTML = "";
    route.depots.forEach((depot) => {
        routeDepotsHTML += `<li><a class="depot-item-link" href="javascript:setDepot('${depot}')">${depot}</a></li>`;
    });
    if (route.depots.length > 0) {
        routeDepots.innerHTML = `Depot(s): <ul>${routeDepotsHTML}</ul>`;
    } else {
        routeDepots.innerHTML = "Depot(s): (None)";
    }
    document.getElementById('route-id').innerHTML = routeId;
    routeName.innerHTML = `${route.name} (${route.number})`;
    const routeDeparture = document.getElementById("route-departure");
    const parsedTime = route.startTime.map((t) => parseTime(t)).join(", ")
    routeDeparture.innerHTML = `Departure Time: ${parsedTime}`;

    const routeTimelines = document.getElementById("route-timelines");
    
    let tabelHTML = "<table class='timeline-table'>";
    route.stations.forEach((platform, index) => {
        tabelHTML += `<tr>`;
        let stationName = Stations[platform.id] ? Stations[platform.id].name : "Unknown Station";
        tabelHTML += `<td><span class="timeline-platform-name">${stationName} (${platform.name})</span>` + 
            `<span><a class="toggle-button" href="javascript:setStation('${platform.id}')">▶</a></span></td>`;

        route.startTime.forEach((startTime, timelineIndex) => {
            const this_timeline = route.timelines[timelineIndex];
            let [currentTime, departureTime] = this_timeline[index];
            tabelHTML += `<td><span class="timeline-time">${parseTime(currentTime)} - ${parseTime(departureTime)}</span></td>`;
        });
        
        tabelHTML += `</tr>`

        if (index < route.durations.length) {
            const N = route.startTime.length + 1;
            tabelHTML += `<tr><td colspan='${N}'><span class="timeline-trip-duration">Travel: ${parseTime(route.durations[index])}</span></td></tr>`;
        }
    });

    tabelHTML += "</table>";

    routeTimelines.innerHTML = tabelHTML;
}

function setDepot(DepotName) {
    routeView.style.display = "none";
    stationView.style.display = "none";
    depotView.style.display = "block";
    const depotName = document.getElementById("depot-name");
    depotName.innerHTML = `Depot: ${DepotName}`;
    const depotRoutes = document.getElementById("depot-routes");
    let html = "";
    Depots[DepotName].forEach((routeId) => {
        const route = Routes[routeId];
        html += `<p><a class="route-item-link" href="javascript:setRoute('${route.id}')">${route.name} (${route.number})</a></p>`;
    });
    depotRoutes.innerHTML = html;
}

const cvs = document.getElementById("station-canvas");
var _cur_platforms = null;

function cvs_repaint(platforms = null) {
    if (platforms === null) {
        platforms = _cur_platforms;
    } else {
        _cur_platforms = platforms;
    }
    const ctx = cvs.getContext("2d");

    var devicePixelRatio = window.devicePixelRatio || 1;
    var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
    ctx.mozBackingStorePixelRatio ||
    ctx.msBackingStorePixelRatio ||
    ctx.oBackingStorePixelRatio ||
    ctx.backingStorePixelRatio || 1;
    var ratio = devicePixelRatio / backingStoreRatio;

    cvs.width = cvs.clientWidth * ratio;
    cvs.height = cvs.clientHeight * ratio;

    ctx.scale(ratio, ratio);

    let i = 1;
    const LENGTH = cvs.clientWidth - 100;
    const XBase = 50;
    const possible_intervals = [2, 5, 10, 15, 20, 30, 60];

    function scale(x) {
        return XBase + (x - MINT) / (MAXT - MINT) * LENGTH;
    }

    let bestd = 1000000000;
    let best_i = 60;
    possible_intervals.forEach(i => {
        let d = Math.abs((scale(1000 * 60 * i) - XBase) - 100)
        if (d < bestd)  {
            best_i = i;
            bestd = d;
        }
    });
    const interval = 1000 * 60 * best_i;    

    let t = MINT;
    while (t <= MAXT) {
        ctx.fillStyle = "rgb(100,100,100)";
        ctx.fillRect(scale(t), 0, 1, cvs.height);
        ctx.fillStyle = "rgb(0,0,0)";
        ctx.font = '14px Arial';
        ctx.fillText(parseTime(t), scale(t), 20)
        t += interval;
    }

    Object.keys(platforms).forEach((platformName) => {
        const Y = 50 * i;
        ctx.fillStyle = "rgb(0,0,0)";
        ctx.font = '28px Arial';
        ctx.fillText(platformName, 10, Y + 10);
        platforms[platformName].forEach((entry) => {
            const routeId = entry.routeId;
            const routeNumber = Routes[routeId].number;
            const times = entry.times;
            times.forEach((range) => {
                let l = scale(range[0]), r = scale(range[1]);
                if (range[0] < MAXT && range[1] > MINT) {
                    ctx.fillStyle = "#" + Routes[routeId].getColorStr();
                    ctx.fillRect(l, Y - 8, r - l, 8);
                    ctx.font = '14px Arial';
                    ctx.fillStyle = "rgb(0,0,0)";
                    ctx.fillText(routeNumber, l, Y + 14)
                }
            })
        });
        i += 1;
    });
}

/**
 * Sets the selected station and updates the UI.
 * @param {string} stationId 
 */
function setStation(stationId) {
    routeView.style.display = "none";
    stationView.style.display = "flex";
    depotView.style.display = "none";
    const station = Stations[stationId];
    const stationName = document.getElementById("station-name");
    stationName.innerHTML = `${station.name}`;

    const platforms = {};
    
    Object.values(Routes).forEach((route) => {
        route.stations.forEach((platform, index) => {
            if (platform.id === stationId) {
                if (!platforms[platform.name]) {
                    platforms[platform.name] = [];
                }
                platforms[platform.name].push({
                    routeId: route.id,
                    routeName: route.name,
                    times: route.timelines.map((timeline) => timeline[index]) // Arrival times at this platform
                })
            }
        });
    });

    cvs_repaint(platforms);
}

window.addEventListener("resize", () => {
    const stationViewStyle = window.getComputedStyle(stationView);
    if (stationViewStyle.display !== "none") {
        cvs_repaint();
    }
});

function translateTime(timestr) {
    hms = timestr.split(':');
    if(hms.length !== 3) {
        return -1;
    }
    const h = Number(hms[0]);
    if (!Number.isInteger(h) || h < 0 || h >= 24) {
        return -1;
    }
    const m = Number(hms[1]);
    if (!Number.isInteger(m) || m < 0 || m >= 60) {
        return -1;
    }
    const s = Number(hms[2]);
    if (!Number.isInteger(s) || s < 0 || s >= 60) {
        return -1;
    }
    return (h * 3600 + m * 60 + s) * 1000;
}

function onRouteDepartureEdited(ret) {
    const startTime = translateTime(ret["start"]);
    if(startTime < 0) {
        alert("Invalid start time! Must be hh:mm:ss.");
        return;
    }
    const interval = translateTime(ret["interval"]);
    if(interval <= 0) {
        alert("Invalid interval! Must be hh:mm:ss. Must be greater than 0.");
        return;
    }
    var repeats = Number(ret["repeat"]);
    if(repeats <= 0) {
        alert("Invalid interval! Must be a positive integer.");
        return;
    }
    const routeId = document.getElementById('route-id').innerHTML;
    const route = Routes[routeId];
    let st = [];
    let t = startTime;
    for(let i = 0; i < repeats; i++) {
        if(st.indexOf(t) === -1) {
            st.push(t);
        }
        t += interval;
        if (t >= 86400000) {
            t %= 86400000;
        }
    }
    route.setStartTime(st);
    askboxCancel();
    setRoute(routeId);
}

function editCurrentRouteDeparture() {
    const routeId = document.getElementById('route-id').innerHTML;
    const route = Routes[routeId];
    const title = "Edit departure: " + route.name;
    askboxShow(title, [{
        id: "start",
        name: "Start time",
        placeholder: "00:00:00",
        default: "00:00:00",
    }, {
        id: "interval",
        name: "Interval",
        placeholder: "00:10:00",
        default: "00:10:00",
    },{
        id: "repeat",
        name: "Repeat count",
        placeholder: "1000",
        default: "1000",
    }], onRouteDepartureEdited);
}

function onGlobalConfigEdited(ret) {
    const mint = translateTime(ret["mint"]);
    if(mint < 0) {
        alert("Invalid min time!");
        return;
    }
    const maxt = translateTime(ret["maxt"]);
    if(maxt < 0 || maxt < mint) {
        alert("Invalid max time! Max time must greater than min time!")
    }
    MINT = mint;
    MAXT = maxt;
    refreshT();
}

function editGlobalConfig() {
    askboxShow("Edit global config", [{
        id:"mint",
        name: "Min time:",
        placeholder:"00:00:00",
        default:"00:00:00",
    },{
        id:"maxt",
        name: "Max time:",
        placeholder:"01:00:00",
        default:"01:00:00",
    }], onGlobalConfigEdited);
}

function refreshT() {
    document.getElementById("cfg-mint").innerHTML="Min time: " + parseTime(MINT);
    document.getElementById("cfg-maxt").innerHTML="Max time: " + parseTime(MAXT);
}

function refreshAll(stations, routes) {
    refreshT();

    Stations = initStations(stations);
    [Routes, Depots] = initRoutes(routes);

    StationList.innerHTML = "";
    Object.values(Stations).sort((a, b) => a.name.localeCompare(b.name)).forEach((station) => {
        StationList.appendChild(station.createElement());
    });

    RouteList.innerHTML = "";
    Object.values(Routes).sort((a, b) => a.name.localeCompare(b.name)).forEach((route) => {
        RouteList.appendChild(route.createElement());
    });
}

function saveData() {
    const data = {
        "minT": MINT,
        "maxT": MAXT,
        "routes": Routes,
        "stations": Stations
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mtr-data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const ret = e.target.result;
            const data = JSON.parse(ret);
            MINT = Number(data.minT) || 0;
            MAXT = Number(data.maxT) || 3600 * 1000;
            refreshAll(Object.values(data.stations), Object.values(data.routes));
        };
        reader.readAsText(file);
    };
    input.click();
    return;
}

const shadow0 = document.getElementById('shadow');
shadow0.style.display = "block";
fetch(`http://${MTR_URL}/mtr/api/map/stations-and-routes?dimension=0`).then((response) => {
    return response.json();
}).then((data) => {
    if (data.code !== 200) {
        alert("Failed to fetch data from server.");
        return;
    }
    refreshAll(data.data.stations, data.data.routes);
    toggleStationList(); // Hide station list by default
    shadow0.style.display = "none";
}).catch(err=>{
    alert("Minecraft MTR server is not on, or the address is wrong.\nPlease load a file from your disk as an alternative.");
    shadow0.style.display = "none";
}).then(() => {
    // fetch(`http://${MTR_URL}/mtr/api/map/departures`).then((response) => {
    //     return response.json();
    // }).then((data) => {
    //     if (data.code !== 200) {
    //         alert("Failed to fetch data from server.");
    //         return;
    //     }
    //     const T = data.data.cachedResponseTime;
    //     data.data.departures.forEach((deps) => {
    //         const routeId = deps.id;
    //         const deptimes = [];
    //         deps.departures.forEach((dep) => {
    //             const deviation = dep.deviation || 0;
    //             const times = dep.departures.map((t) => (T + t) % 86400000);
    //             deptimes.push(...times);
    //         });
    //         deptimes.sort((a, b) => a - b);
    //         console.log(`Route ${Routes[routeId].name} has ${deptimes.map(parseTime)} departures.`);
    //         Routes[routeId].setStartTime(deptimes);
    //     });

    // });
});
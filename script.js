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
        this.setStartTime([0]); // Default start time at 00:00:00
    }

    getColorStr() {
        return ("000000" + (0xFFFFFF & this.color).toString(16)).slice(-6);
    }

    /**
     * Set the departure time(s) for the route and calculate the timelines.
     * @param {number[]} time 
     */
    setStartTime(time) {
        time.sort((a, b) => a % 86400000 - b % 86400000);
        this.startTime = [];
        this.timelines = [];
        time.forEach((t) => {
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
            });
            this.startTime.push(t);
            this.timelines.push(timeline);
        });
    }

    getArrivalTime() {
        if (this.timelines.length === 0) {
            return 0;
        }
        if (this.timelines[0].length === this.durations.length) {
            return this.timelines.map(timeline => timeline[timeline.length - 1][1] + this.stations[this.stations.length - 1].dwellTime);
        }else{
            return this.timelines.map(timeline => timeline[timeline.length - 1][0]);   
        }
    }

    getDuration() {
        let t = 0;
        for (let i = 0; i < this.durations.length; i++) {
            t += this.durations[i];
        }
        for (let i = 0; i < this.stations.length; i++) {
            t += this.stations[i].dwellTime;
        }
        return t;
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

var FollowRelations = [];

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
    timeInt /= 1000;
    const seconds = Math.floor(timeInt % 60);
    const minutes = Math.floor((timeInt / 60) % 60);
    const hours = Math.floor((timeInt / 3600) % 24);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const routeView = document.getElementById("route-view");
const stationView = document.getElementById("station-view");
const depotView = document.getElementById("depot-view");
const issueView = document.getElementById("issue-view");

/**
 * Sets the selected route and updates the UI.
 * @param {string} routeId 
 */
function setRoute(routeId) {
    routeView.style.display = "block";
    stationView.style.display = "none";
    depotView.style.display = "none";
    issueView.style.display = "none";
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
    
    const routeTimelines = document.getElementById("route-timelines");
    const filteredStartTime = [];
    var added = false;
    
    let tabelHTML = "<table class='timeline-table'>";
    route.stations.forEach((platform, index) => {
        tabelHTML += `<tr>`;
        let stationName = Stations[platform.id] ? Stations[platform.id].name : "Unknown Station";
        tabelHTML += `<td><span class="timeline-platform-name">${stationName} (${platform.name})</span>` + 
            `<span><a class="toggle-button" href="javascript:setStation('${platform.id}')">▶</a></span></td>`;

        route.startTime.forEach((startTime, timelineIndex) => {
            const this_timeline = route.timelines[timelineIndex];
            if(this_timeline[0][0] < MAXT && this_timeline[this_timeline.length - 1][1] > MINT) {
                let [currentTime, departureTime] = this_timeline[index];
                tabelHTML += `<td><span class="timeline-time">${parseTime(currentTime)} - ${parseTime(departureTime)}</span></td>`;
                if(!added) {filteredStartTime.push(startTime);}
            }
        });

        if(filteredStartTime.length > 0) {added = true;}
        
        tabelHTML += `</tr>`

        if (index < route.durations.length) {
            const N = route.startTime.length + 1;
            tabelHTML += `<tr><td colspan='${N}'><span class="timeline-trip-duration">Travel: ${parseTime(route.durations[index])}</span></td></tr>`;
        }
    });

    tabelHTML += "</table>";

    routeTimelines.innerHTML = tabelHTML;

    const routeDeparture = document.getElementById("route-departure");
    
    const following = FollowRelations.filter(rel => rel.to === routeId).map(rel => rel.from);
    const followedby = FollowRelations.filter(rel => rel.from === routeId).map(rel => rel.to);
    if (following.length > 0) {
        routeDeparture.innerHTML = `Following <a href="javascript:setRoute('${following[0]}')" class="route-item-link">${Routes[following[0]].name}</a>`;
    } else {
        const parsedTime = filteredStartTime.map((t) => parseTime(t)).join(", ")
        routeDeparture.innerHTML = `Departure Time: ${parsedTime}.`;
        if (followedby.length > 0) {
            routeDeparture.innerHTML += " Followed by ";
            followedby.forEach((routeId) => {
                routeDeparture.innerHTML += `<a href="javascript:setRoute('${routeId}')" class="route-item-link">${Routes[routeId].name}</a>`;
            });
        }
    }
    
}

function setDepot(DepotName) {
    routeView.style.display = "none";
    stationView.style.display = "none";
    depotView.style.display = "block";
    issueView.style.display = "none";
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
            const times = entry.times.filter(range => range[0] < MAXT && range[1] > MINT);
            const isFirstStop = entry.isFirstStop;
            const isLastStop = entry.isLastStop;
            var isFollowingRoute = FollowRelations.some(rel => rel.to === routeId);
            var isFollowedRoute = FollowRelations.some(rel => rel.from === routeId);
            if (isFirstStop && isFollowingRoute) {
                return;
            }
            times.forEach((range) => {
                if(isFollowingRoute && isFirstStop) {
                    return;
                }
                let l = scale(range[0]), r = scale(range[1]);
                ctx.fillStyle = "#" + Routes[routeId].getColorStr();
                ctx.fillRect(l, Y - 8, r - l, 8);
                ctx.font = '14px Arial';
                ctx.fillStyle = "rgb(0,0,0)";
                var text = routeNumber;
                if(isFollowedRoute && isLastStop) {
                    var followings = FollowRelations.filter(rel => rel.from === routeId).map(rel => Routes[rel.to].number);
                    text += "/" + followings.join("/");
                }
                ctx.fillText(text, l, Y + 14);
            })
        });
        i += 1;
    });
}


function gatherPlatforms(stationId) {
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
                    times: route.timelines.map((timeline) => timeline[index]), // Arrival times at this platform
                    isFirstStop: route.stations[0].id === platform.id && route.stations[0].name === platform.name,
                    isLastStop: route.stations[route.stations.length - 1].id === platform.id && route.stations[route.stations.length - 1].name === platform.name,
                })
            }
        });
    });
    return platforms;
}

function checkStation(stationId) {
    const platforms = gatherPlatforms(stationId);
    let issues = [];
    Object.keys(platforms).forEach((platformName) => {
        const entries = platforms[platformName];
        let allTimes = [];
        entries.forEach((entry) => {
            var isFollowingRoute = FollowRelations.some(rel => rel.to === entry.routeId);
            var isFollowedRoute = FollowRelations.some(rel => rel.from === entry.routeId);
            entry.times.forEach((range) => {
                if(isFollowingRoute && entry.isFirstStop) {
                    return;
                }
                if(range[0] < MAXT && range[1] > MINT) {
                    allTimes.push({
                        routeId: entry.routeId,
                        start: range[0],
                        end: range[1],
                    });
                }
            });
        });
        allTimes.sort((a, b) => a.start - b.start);
        for(let i = 1; i < allTimes.length; i++) {
            if(allTimes[i].start < allTimes[i - 1].end) {
                issues.push({
                    type: "error",
                    message: `Platform ${platformName} has conflict between route %${allTimes[i - 1].routeId}% (${parseTime(allTimes[i - 1].start)} - ${parseTime(allTimes[i - 1].end)})` +
                    ` and route %${allTimes[i].routeId}% (${parseTime(allTimes[i].start)} - ${parseTime(allTimes[i].end)})`,
                    stationId: stationId,
                });
            }else if(allTimes[i].start - allTimes[i - 1].end < 60000) {
                issues.push({
                    type: "warning",
                    message: `Platform ${platformName} has very short gap (<60s) between route %${allTimes[i - 1].routeId}% (${parseTime(allTimes[i - 1].start)} - ${parseTime(allTimes[i - 1].end)})` +
                        ` and route %${allTimes[i].routeId}% (${parseTime(allTimes[i].start)} - ${parseTime(allTimes[i].end)})`,
                    stationId: stationId,
                });
            }
        }
    });
    return issues;
}

/**
 * Sets the selected station and updates the UI.
 * @param {string} stationId 
 */
function setStation(stationId) {
    routeView.style.display = "none";
    stationView.style.display = "flex";
    depotView.style.display = "none";
    issueView.style.display = "none";
    const station = Stations[stationId];
    const stationName = document.getElementById("station-name");
    stationName.innerHTML = `${station.name}`;
    cvs_repaint(gatherPlatforms(stationId));
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

    FollowRelations.forEach(relation => {
        if(relation.from === routeId) {
            const toRoute = Routes[relation.to];
            toRoute.setStartTime(route.getArrivalTime());
        }
    });
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

function addFollowRelation(from, to) {
    FollowRelations = FollowRelations.filter(r => r.to !== from);
    FollowRelations.push({from: from, to: to});
    const fromRoute = Routes[from];
    const toRoute = Routes[to];
    toRoute.setStartTime(fromRoute.getArrivalTime());
    setRoute(toRoute.id);
}

function findRouteToFollow(routeID) {
    const route = Routes[routeID];
    return Object.values(Routes).filter(r => {
        return r.id !== route.id && r.depots.some(depot => route.depots.includes(depot)) && 
            r.stations[r.stations.length - 1].id === route.stations[0].id &&
            r.stations[r.stations.length - 1].name === route.stations[0].name
    }).map(route => route.id);
}

function onRouteDepartureEdited2(ret) {
    const followId = ret["follow"];
    if(!Routes[followId]) {
        alert("Invalid route selected!");
        return;
    }
    addFollowRelation(followId, document.getElementById('route-id').innerHTML);
}

function setDepartureFollows() {
    const routeId = document.getElementById('route-id').innerHTML;
    const route = Routes[routeId];
    const title = "Set departure follows: " + route.name;
    const options = findRouteToFollow(routeId).map(routeID => ({
            id: routeID,
            text: Routes[routeID].name
        }));

    if(options.length === 0) {
        alert("No available routes to follow!");
        return;
    }
        
    askboxShow(title, [{
        id: "follow",
        name: "Follow",
        type: "combo",
        options: options,
    }], onRouteDepartureEdited2);
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

function initFollowRelations() {
    FollowRelations = [];
    Object.values(Routes).forEach(route => {
        const followRoutes = findRouteToFollow(route.id);
        if(followRoutes.length > 0) {
            addFollowRelation(followRoutes[0], route.id);
        }
    });

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

/** 
 * Translate message 
 * @param {string} msg - The message to translate
*/
function transMsg(msg) {
    let tokenPos = msg.indexOf('%');
    while (tokenPos >= 0) {
        let nextTokenPos = msg.indexOf('%', tokenPos + 1);
        if (nextTokenPos < 0) {
            console.error(`Bad tokens ${msg}`);
        }
        let routeid = msg.substring(tokenPos + 1, nextTokenPos);
        msg = msg.replaceAll("%"+routeid+"%", `<a href="javascript:setRoute('${routeid}')" class='route-item-link'>${Routes[routeid].name}</a>`);
        tokenPos = msg.indexOf('%');
    }
    return msg;
}

function checkData() {
    routeView.style.display = "none";
    stationView.style.display = "none";
    depotView.style.display = "none";
    issueView.style.display = "block";

    let issues = [];
    Object.keys(Stations).forEach(stationId => {
        issues = issues.concat(checkStation(stationId));
    });
    const issueList = document.getElementById("issue-list");
    issueList.innerHTML = "";
    if(issues.length === 0) {
        issueList.innerHTML = "<li>(None)</li>";
    } else {
        issues.filter(issue => issue.type === "error").forEach(issue => {
            issueList.innerHTML += `<li class="issue-${issue.type}">` +
                `<a class="station-item-link" href="javascript:setStation('${issue.stationId}')">${Stations[issue.stationId].name}</a>` + 
                `   <span>${transMsg(issue.message)}</span></li>`;
        });
        issues.filter(issue => issue.type === "warning").forEach(issue => {
            issueList.innerHTML += `<li class="issue-${issue.type}">` +
                `<a class="station-item-link" href="javascript:setStation('${issue.stationId}')">${Stations[issue.stationId].name}</a>` + 
                `   <span>${transMsg(issue.message)}</span></li>`;
        });
        issues.filter(issue => issue.type !== "error" && issue.type !== "warning").forEach(issue => {
            issueList.innerHTML += `<li class="issue-${issue.type}">` +
                `<a class="station-item-link" href="javascript:setStation('${issue.stationId}')">${Stations[issue.stationId].name}</a>` + 
                `   <span>${transMsg(issue.message)}</span></li>`;
        });
    }

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
    fetch(`http://${MTR_URL}/mtr/api/map/departures`).then((response) => {
        return response.json();
    }).then((data) => {
        if (data.code !== 200) {
            alert("Failed to fetch data from server.");
            return;
        }
        const T = data.data.cachedResponseTime;
        data.data.departures.forEach((deps) => {
            const routeId = deps.id;
            const deptimes = [];
            deps.departures.forEach((dep) => {
                const deviation = dep.deviation || 0;
                const times = dep.departures.map((t) => (T + t - Routes[routeId].getDuration()) % 86400000);
                deptimes.push(...times);
            });
            deptimes.sort((a, b) => a - b);
            Routes[routeId].setStartTime(deptimes);
        });
        initFollowRelations();
        checkData();
    });
});
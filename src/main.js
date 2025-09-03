import {connectToFeed} from './mqtt.js';
import {liveConnsData, call_locs, purgeLiveConnections} from './conns-data.js';
import {loadConfig, myCall} from './store-cfg.js';
import {mhToLatLong} from './geo.js';
import Ribbon from './ribbon.js';

const ribbon = new Ribbon({
  onModeChange: refreshAll,
  onConfigChange: refreshAll,
});

let getMode = () => null;
let mode = null;
let band = null;
let homeCalls = null;
let leaderCall = null;
let	ocs_myCall1 = null;
let	ocs_Leader = null;
let	ocs_All = null;

let connsData = null;
let myCall1 = null;
let myCall2 = null;
let RxTx = 0;
let container = null;
let activeBands = ['160m','80m','40m','30m','20m','15m','10m','2m','70cm'];
let band_idx=0;
let charts={};

setInterval(() => purgeLiveConnections(), 5000);
setInterval(() => ribbon.writeModeButtons(), 5000);
setInterval(() => refreshBand(), 50);
setInterval(() => refreshAll(), 5000);


loadConfig();
connectToFeed();
writeGrid();

// event listeners for buttons 
document.addEventListener('click', (e) => {
	const action = e.target.dataset.action;
	if (!action) return;
	loadView(action,  e.target.dataset.band);
//	console.log("ui-core: clicked with action "+e.target.dataset.action+" and band "+e.target.dataset.band);
});

function wavelength(band) {
    let wl = parseInt(band.split("m")[0]);
    if (band.search("cm") > 0) {
        return wl / 100
    } else {
        return wl
    }
}
//"<button class='button button--table' data-action = 'benchmark' data-band='"+band+"'>" + band + "</button>";

function refreshAll(){
	ribbon.registerActiveModes();
	mode = ribbon.getWatchedMode();
    myCall1 = myCall.split(",")[0].trim();
	console.log("Refresh with mode = "+ mode+ " myCall1 = "+myCall1);
}

function writeGrid(){
	let html = "";
	html+="<div style = 'display:grid; grid-template-columns:max-content 1fr 1fr;'>";
	html+="<div></div><div class='directionHeading'>Receiving</div><div class='directionHeading'>Received By</div>"
	for (const band of activeBands) {
		html += "<div class = 'bandHeading' id="+band+"_heading>"+band+"</div><div class='receive' id="+band+"_rx><canvas id="+band+'_rx_canvas'+"></canvas></div><div class='transmit' id="+band+"_tx><canvas id="+band+'_tx_canvas'+"></canvas></div>";	
	}
	document.getElementById("mainView").innerHTML = html;
}

function analyseData(data){
	// data is subset of connectivity map e.g. data = connsData[band][mode].Tx
    let myCall1 = myCall.split(",")[0].trim();
	homeCalls = new Set();
	ocs_myCall1 = new Set();
	ocs_Leader = new Set();
	ocs_All = new Set();
	
	for (const hc in data) {
		homeCalls.add(hc);
        const ocs = new Set();
        for (const oc in data[hc]) {
			let ll = call_locs[oc];
			ocs.add(ll); ocs_All.add(ll); 
		}
        if (ocs.size > ocs_Leader.size) {
			ocs_Leader = ocs;
            leaderCall = hc;
        }
		if(hc == myCall1){
			ocs_myCall1 = ocs;
		}
    }
	homeCalls = Array.from(homeCalls);
	ocs_myCall1 = Array.from(ocs_myCall1);
	ocs_Leader = Array.from(ocs_Leader);
	ocs_All = Array.from(ocs_All);
}

function hideBand(band){
	document.getElementById(band+'_heading').classList.add("hidden");
	document.getElementById(band+'_rx').classList.add("hidden");
	document.getElementById(band+'_tx').classList.add("hidden");
}
function unhideBand(band){
	document.getElementById(band+'_heading').classList.remove("hidden");
	document.getElementById(band+'_rx').classList.remove("hidden");
	document.getElementById(band+'_tx').classList.remove("hidden");
}
function refreshBand(){
	if(activeBands.length==0) return;
	band_idx = (band_idx + 1) % activeBands.length; 
	let band = activeBands[band_idx];
	if(!liveConnsData[band]){
		hideBand(band);
		return;
	}
	if(!liveConnsData[band][mode]){
		hideBand(band);
		return;
	}
	unhideBand(band);
	doChart(band+'_rx_canvas', liveConnsData[band][mode]?.Rx);
	doChart(band+'_tx_canvas', liveConnsData[band][mode]?.Tx);	
}
		
function doChart(canvas, connsData){
	analyseData(connsData);
	const data = {
	  datasets: [	{label: myCall1 + ": "+ocs_myCall1.length+" spots", data: ocs_myCall1, backgroundColor: 'rgba(255, 99, 132, 1)', pointRadius:4},
					{label: leaderCall + ": "+ocs_Leader.length+" spots", data: ocs_Leader, backgroundColor: 'rgba(54, 162, 235, 0.7)', pointRadius:6},
					{label: homeCalls.size +" Home Calls: "+ocs_All.length+" spots", data: ocs_All, backgroundColor: 'rgba(200, 162, 235, 0.7)', pointRadius:10}],
	};
	if(charts[canvas]){
		charts[canvas].destroy()
	}
	charts[canvas] = new Chart(
	  document.getElementById(canvas),
		{type: 'scatter',data: data, options: {
			    animation: false, 
				plugins: {legend: {display:false, position:'top', labels:{boxWidth:10, padding:10}}},
				    scales: {
						x: {title: {display:false, text: 'Longitude'}, type: 'linear',position: 'bottom', max:180, min:-180},
						y: {title: {display:false, text: 'Lattitude'}, type: 'linear',position: 'left', max:80, min:-80}
					}
			}
		}
	);	
}
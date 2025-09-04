import {connectToFeed} from './mqtt.js';
import {liveConnsData, call_locs, purgeLiveConnections} from './conns-data.js';
import {loadConfig, myCall} from './store-cfg.js';
import {mhToLatLong} from './geo.js';
import Ribbon from './ribbon.js';


const colors = {myCall_tx:'rgba(255, 20, 20, 1)', leader_tx:'rgba(255, 99, 132, .5)', all_tx:'rgba(255, 99, 132, 0.3)',
				myCall_rx:'rgba(20, 20, 200, 1)', leader_rx:'rgba(54, 162, 200, 0.5)',all_rx:'rgba(54, 162, 200, 0.3)'};

const ribbon = new Ribbon({
  onModeChange: refreshAll,
  onConfigChange: refreshAll,
  onBandsChange: refreshAll
 });

let getMode = () => null;
let getBands = () => null;
let mode = null;
let bands = null;

let myCall1 = null;
let myCall2 = null;
let charts={};

setInterval(() => purgeLiveConnections(), 5000);
setInterval(() => ribbon.writeModeButtons(), 5000);
setInterval(() => refreshBands(), 1000);
setInterval(() => refreshAll(), 5000);

loadConfig();
myCall1 = myCall.split(",")[0].trim();
write_mainView();
connectToFeed();

function write_mainView(){
	let html = "<h3>Tx and Rx performance for all callsigns in home squares with band leader and "+myCall1+" overlaid</h3>";

	html +="<div id='canvasGrid'>";
	html +="<div class='gridHeader'><table><tr><td colspan='3'>Receive</td><td colspan='3'>Transmit</td></tr><tr>";
	html +="<td><span class = 'legendMarker' style='background:" +  colors.myCall_rx + "'></span>"+myCall1+"</td>";
	html +="<td><span class = 'legendMarker' style='background:" +  colors.leader_rx + "'></span>Band leader</td>";
	html +="<td><span class = 'legendMarker' style='background:" +  colors.all_rx + "'></span>All home  </td>";
	html +="<td><span class = 'legendMarker' style='background:" +  colors.myCall_tx + "'></span>"+myCall1+"</td>";
	html +="<td><span class = 'legendMarker' style='background:" +  colors.leader_tx + "'></span>Band leader</td>";
	html +="<td><span class = 'legendMarker' style='background:" +  colors.all_tx + "'></span>All home</td>";
	html +="</tr></table></div>";
 	for (let i =0;i<15;i++){
		html += "<div class = 'canvasHolder hidden' id = 'div_"+i+"'><canvas id='canvas_"+i+"'></canvas></div>";	
	}	
	html +="</div>";
	
	document.getElementById("mainView").innerHTML = html;
}

function wavelength(band) {
    let wl = parseInt(band.split("m")[0]);
    if (band.search("cm") > 0) {
        return wl / 100
    } else {
        return wl
    }
}

function refreshAll(){
	ribbon.registerActiveBandsAndModes();
	mode = ribbon.getWatchedMode();
	bands = Array.from(ribbon.getActiveBands()).sort((a, b) => wavelength(b) - wavelength(a));
//	console.log("Refresh with mode = "+ mode+ " myCall1 = "+myCall1 + " bands = "+bands);
	refreshBands();
}

function analyseData(data){
	// data is subset of connectivity map e.g. data = connsData[band][mode].Tx
    let myCall1 = myCall.split(",")[0].trim();
	let homeCalls = new Set();
	let ocs_myCall1 = new Set();
	let ocs_Leader = new Set();
	let ocs_All = new Set();
	let leaderCall = null;
	
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
	let dataset = {
	homeCalls:Array.from(homeCalls),
	myCall1:Array.from(ocs_myCall1),
	Leader:Array.from(ocs_Leader),
	All:Array.from(ocs_All),
	leaderCall:leaderCall
	}
	return dataset;
}

function refreshBands(){
	for (let i =0;i<15;i++){
		let div = 'div_'+i;
		document.getElementById(div).classList.add("hidden");	
		let canvas = 'canvas_'+i;
		if(charts[canvas]){
			charts[canvas].destroy()
		}
	}
	for (const bandIdx in bands){
		let div = 'div_'+bandIdx;
		document.getElementById(div).classList.remove("hidden");			
		let canvas = 'canvas_'+bandIdx;
		let band = bands[bandIdx];
		refreshBand(canvas,band);
	}
}

function refreshBand(canvas, band){

	let rx_data =analyseData(liveConnsData[band]?.[mode]?.['Rx']);
	let tx_data =analyseData(liveConnsData[band]?.[mode]?.['Tx']);
	
	const data = {
	  datasets: [	
				{	label:'All', 				data: rx_data.All, 		backgroundColor: colors.leader_rx, 	pointRadius:9	},
				{	label:'All', 				data: tx_data.All, 		backgroundColor: colors.all_tx, 	pointRadius:9	},
				{	label:rx_data.leaderCall, 	data: rx_data.Leader, 	backgroundColor: colors.leader_rx, 	pointRadius:5	},
				{	label:tx_data.leaderCall, 	data: tx_data.Leader,	backgroundColor: colors.leader_tx, 	pointRadius:5	},
				{	label:myCall1, 				data: rx_data.myCall1, 	backgroundColor: colors.myCall_rx, 	pointRadius:3	},
				{	label:myCall1, 				data: tx_data.myCall1, 	backgroundColor: colors.myCall_tx, 	pointRadius:3	}
				],
	};
	if(charts[canvas]){
		charts[canvas].destroy()
	}
	charts[canvas] = new Chart(
			document.getElementById(canvas),
			{type: 'scatter',data: data, options: {
				animation: false, 
				plugins: {	legend: {display:false},             
							title: {display: true, align:'start', text: " "+band}},
				scales: {
					x: {display:false, title: {display:false, text: 'Longitude'}, type: 'linear',position: 'bottom' , max:180, min:-180},
					y: {display:false, title: {display:false, text: 'Lattitude'}, type: 'linear',position: 'left', max:80, min: -80}
				}
			}
		}
	);	
}
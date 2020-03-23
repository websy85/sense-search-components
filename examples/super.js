let config = {
	schema: enigmaSchema,
	// url: "ws://ec2-35-171-16-134.compute-1.amazonaws.com/anon/app/7c45fa00-1cc2-40cb-8548-1c3d21606ac7"
	url: "wss://10.211.55.3/app/"
};

picasso.renderer.default('svg')

let appsProcessed = []
let sessions = {}
let results = {}
let resultsOrder = []

let globalConfig = Object.assign({}, config)
globalConfig.url += 'engineData'

let session = enigma.create(globalConfig)
session.open().then(function(qlik){
	qlik.getDocList().then(apps => {
		console.log(apps);
		connectToApps(0, apps, () => {
			console.log(sessions)
		})
	})
})

let inputEl = document.getElementById('superInput')
if (inputEl) {
	inputEl.addEventListener('keydown', event => {
		if (event.code === 'Enter') {
			goSuper(event.target.value)
		}
	})
}

let buttonEl = document.getElementById('searchButton')
if (buttonEl) {
	buttonEl.addEventListener('click', event => {
		let el = document.getElementById('superInput')
		if (el) {
			goSuper(el.value)
		}
	})
}

function connectToApps(index, apps, callbackFn) {
	let appConfig = Object.assign({}, config)
	let appInfo = apps[index]	
	appConfig.url += appInfo.qDocId
	let session = enigma.create(appConfig)
	let appSearch = new SenseSearch()
	session.open().then(function(qlik){		
		let app = qlik.openDoc(appInfo.qDocId).then(function(app){          							
			let i = new SenseSearchInput(`${app.id}_input`, {
				searchEntity: appSearch,
				mode: 'visualizations',
				includeMasterMeasures: true,
				showTimeSeriesAsLine: false
			});			
			appSearch.usePicasso = true
			appSearch.connectWithEnigma(app);
			appSearch.ready.subscribe(() => {
				i.object.attach({})						
			})
			// appSearch.onUnsupportedVisualization.subscribe(viz => {
			// 	console.log(`${viz} unsupported`);
				
			// })
			appSearch.noResults.subscribe(() => {
				console.log('no results');
				if (appsProcessed.indexOf(app.id) === -1) {
					appsProcessed.push(app.id)
				}
				if (appsProcessed.length === Object.keys(sessions).length) {
					// renderResults()
				}
			})
			appSearch.chartResults.subscribe(viz => {				
				console.log(viz)
				console.log(i.object.nlpTerms)				
				let html = `
					<h3>Matched in ${appInfo.qDocName}</h3>
					<div class='sense-search-input-container'>
						<div class='sense-search-lozenge-container'>
				`
				for (let key in i.object.nlpTerms) {
					if (i.object.nlpTerms[key].queryTag !== '!') {
						html += `
							<div class='lozenge' data-querytag='${i.object.nlpTerms[key].queryTag}'>${i.object.nlpTerms[key].text}</div>
						`
					}					
				}				
				html += `
						</div>
					</div>
					<div id='${normalizeText(viz.model.id)}' class='chart-result'></div>
				`
				document.getElementById('results').innerHTML += html
				i.object.setSearchText(i.object.searchText, true)
				i.object.buildLozenges()
				results[app.id] = {
					terms: i.object.nlpTerms,
					viz,
					validTerms: i.object.nlpTerms.filter(item => ['!', '!!'].indexOf(item.query) === -1)
				}
				resultsOrder.push(app.id)
				if (appsProcessed.indexOf(app.id) === -1) {
					appsProcessed.push(app.id)
				}
				if (appsProcessed.length === Object.keys(sessions).length) {
					// renderResults()
				}						
			})
			sessions[appInfo.qDocId] = {
				app,
				search: appSearch,
				input: i.object
			}			
			// let inputOptions = {
			// 	 includeMasterMeasures: true,
			// 	 showTimeSeriesAsLine: false
			// 	// "searchFields": ["title","username","tags","category","product","short_description"],
			// 	// "suggestFields": ["title","username","tags","category","product","short_description"]
			// }
			// senseSearch.inputs["myInput"].attach(inputOptions);
			// senseSearch.inputs["myInput"].addFieldTag("month", "$time");
			// appSearch.results["myResults"].onUnsupportedVisualization.subscribe(function(obj){
			// 	console.log("Viz type not supported");
			// })
			if (index === apps.length - 1) {
				callbackFn()
			}
			else {
				index++
				connectToApps(index, apps, callbackFn)
			}
		})
	});
}

function goSuper (text) {
	startOver()
	for (let key in sessions) {
		sessions[key].input.setSearchText(text)
	}
	setTimeout(renderResults, 1000)
}

function renderResults () {
	resultsOrder.sort((a, b) => results[b].validTerms.length - results[a].validTerms.length)
	for (let i = 0; i < resultsOrder.length; i++) {
		let r = results[resultsOrder[i]]
		if (sessions[resultsOrder[i]].search.usePicasso===true && typeof senseSearchPicasso!=="undefined") {
			if (senseSearchPicasso.isSupported(r.viz.model.genericType)) {
				senseSearchPicasso.render(normalizeText(r.viz.model.id), r.viz)
			}
			else {
				// this.onUnsupportedVisualization.deliver(r.viz)
				document.getElementById(normalizeText(r.viz.model.id)).innerHTML = `Unsupported Viz (${r.viz.model.genericType})`
			}
		}
		else if(appSearch.exchange.connectionType=="CapabilityAPI"){
			viz.show(normalizeText(viz.model.id));
		}	
	}	
}

function startOver () {
	appsProcessed = []
	results = {}
	resultsOrder = []
	document.getElementById('results').innerHTML = ''
}

function normalizeText (text) {
	return text.replace(/\-/g, '_')
}
import './components/range-slider.component.js';
import './components/sample-toggler.component.js';

let localConfigData; // will be populated with config.json data

const loadAllAtOnce = true

let sceneSamplesAudioData = [];



let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isStarted = true; // Flag to prevent re-initialization

const ctas = {
    exportJsonButton: document.getElementById('generateJsonButton'),
}

function onLoadingStarted(){
    for(let ctaKey in ctas){
        ctas[ctaKey].setAttribute("disabled", "disabled");
    }
}

function onLoadingFinished(){
    for(let ctaKey in ctas){
        ctas[ctaKey].removeAttribute("disabled");
    }
}



async function loadConfig() {
    onLoadingStarted();
    const config =  await loadJson(`/config.json`).catch(e => { throw e });
    onLoadingFinished();
    return config;
}

async function initScene(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {

    await loadAndParseNewSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);

}



async function loadAndParseDataForSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {

    const groupHTMLParent = document.createElement('div');
    const slidersContainer = [];
    const sceneObject = scenes[_selectedSceneIndex];
    for (let i = 0; i < sceneObject.samples.length; i++) {
        const sampleVariationsAudioData = [];

        
        const sampleSubsceneConfigParams = sceneObject.subscenes.map(scene => {
            return {
                label: scene.label,
                params: !scene.subsceneWindows[_selectedSubsceneWindowIndex] ? null : scene.subsceneWindows[_selectedSubsceneWindowIndex].config[i]
            }
        });
        
        const currentSubsceneParams = sampleSubsceneConfigParams[_selectedSubsceneIndex].params;

        let currentSceneSampleVol = 0; 
        if(typeof currentSubsceneParams.currentVol === "number"){
            currentSceneSampleVol = currentSubsceneParams.currentVol;
        } else if(typeof currentSubsceneParams.minVol === "number" && typeof currentSubsceneParams.maxVol === "number") {
            currentSceneSampleVol = Math.floor((currentSubsceneParams.minVol + currentSubsceneParams.maxVol) / 2 );
        }


        for (let j = 0; j < sceneObject.samples[i].variationNames.length; j++) {
            const variationFilePath = `${sceneObject.samples[i].variationNames[j]}`;
            const audioBuffer =  null;
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(currentSceneSampleVol, audioContext.currentTime);

            sampleVariationsAudioData.push({
                variationFilePath,
                audioBuffer,
                isAudioBufferLoading: false,
                gainNode,
            });
            
        }


        

        const stitchingMethd = sceneObject.samples[i].stitchingMethd;
        const concatOverlayMs = sceneObject.samples[i].concatOverlayMs;

        const sampleContainer = document.createElement('div');
        sampleContainer.classList.add("sample")
        groupHTMLParent.appendChild(sampleContainer);
        slidersContainer.push(groupHTMLParent);

    
        // add label to controls group
        const labelElement = document.createElement('label');
        labelElement.classList.add('sample-fields-groul-label');
        labelElement.innerText = `${sceneObject.sceneName} - ${sceneObject.samples[i].label}`;
        sampleContainer.appendChild(labelElement);


        const forCurrentSampleIndex = sceneSamplesAudioData.length;

        // setup sample toggler
        const sampleTogglerElement = document.createElement('sample-toggler');
        sampleTogglerElement.addEventListener('toggle', async (event) => {
            if(event.target.state === true){
                sampleContainer.classList.add("active");
                let wasLoadedAndNotPlayed = false;
                for(let k = 0; k < sampleVariationsAudioData.length; k++) {
                    const sampleVariationAudioData = sampleVariationsAudioData[k];
                    if(sampleVariationAudioData.audioBuffer === null && sampleVariationAudioData.isAudioBufferLoading === false ){
                        sampleVariationAudioData.isAudioBufferLoading = true;
                        sampleVariationAudioData.audioBuffer = await loadSound(sampleVariationAudioData.variationFilePath).catch(e => { throw e });
                        sampleVariationAudioData.isAudioBufferLoading = false;
                        if( k === sampleVariationsAudioData.length - 1){
                            // all variations loaded
                            wasLoadedAndNotPlayed = true;
                        }
                    }
                }
                if(wasLoadedAndNotPlayed){
                    wasLoadedAndNotPlayed = false;
                    try{

                        playRandomVariation(sceneSamplesAudioData[forCurrentSampleIndex]); // mark*
                    } catch(e){
                        console.error(e);
                    }
                    
                }
            } else {
                sampleContainer.classList.remove("active");
                stopSceneSampleVariations(sceneSamplesAudioData[forCurrentSampleIndex]);
                for(let k = 0; k < sampleVariationsAudioData.length; k++) {
                    const sampleVariationAudioData = sampleVariationsAudioData[k];
                    if(sampleVariationAudioData.audioBuffer !== null ){
                        sampleVariationAudioData.audioBuffer = null;
                    }
                }
            }
        });
        sampleContainer.appendChild(sampleTogglerElement);

        

        // setup volume slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
            const volElement = document.createElement('range-slider');
            volElement.label = 'Volume';
            volElement.value = currentSceneSampleVol;
            volElement.min = 0;
            volElement.max = 100;
            volElement.scaleUnitLabel = '%';
            volElement.addEventListener('valueChange', async (event) => {
                const value = event.target.value;

                if(maxVolElement && value > maxVolElement.value){
                    maxVolElement.value = event.target.value;
                    maxVolElement.dispatchEvent(new Event('input'));
                }

                if(minVolElement && value < minVolElement.value){
                    minVolElement.value = event.target.value;
                    minVolElement.dispatchEvent(new Event('input'));
                }
        
                for (let j = 0; j < sampleVariationsAudioData.length; j++) {
                    // we don't know which variation is playing so we should set the vorlume to all of them
                    sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(parseInt(event.target.value) / 100, audioContext.currentTime);
                }

                // persist value in state
                sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].currentVol = parseInt(event.target.value)

            });

            sampleContainer.appendChild(volElement);


        // setup volume min slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const minVolElement = document.createElement('range-slider');
        minVolElement.label = 'Volume Min';
        minVolElement.min = 0;
        minVolElement.max = 100;
        volElement.scaleUnitLabel = '%';
        minVolElement.value = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol;
        minVolElement.addEventListener('valueChange', (event) => {
            const value = parseInt(event.target.value, 10);

            if(volElement && value > volElement.value){
                volElement.value = event.target.value;
                volElement.dispatchEvent(new Event('valueChange'));
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].minVol = parseInt(event.target.value)

        });
        sampleContainer.appendChild(minVolElement);


        // setup volume max slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const maxVolElement = document.createElement('range-slider');
        maxVolElement.label = 'Volume Max';
        maxVolElement.min = 0;
        maxVolElement.max = 100;
        volElement.scaleUnitLabel = '%';
        maxVolElement.value = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol;
        maxVolElement.addEventListener('valueChange', (event) => {
            const value = parseInt(event.target.value, 10);

            if(volElement && value < volElement.value){
                volElement.value = event.target.value;
                volElement.dispatchEvent(new Event('valueChange'));
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].maxVol = parseInt(event.target.value)
            
        });
        sampleContainer.appendChild(maxVolElement);


        // setup variational timeframe min slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const minTimeframeElement = document.createElement('range-slider');
        minTimeframeElement.label = 'Timeframe Min';
        minTimeframeElement.min = 2;
        minTimeframeElement.max = 60 * 60;
        minTimeframeElement.scaleUnitLabel = 's';
        minTimeframeElement.step = 10;
        minTimeframeElement.value = Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength / 1000);
        minTimeframeElement.addEventListener('valueChange', (event) => {
            const value = parseInt(event.target.value, 10);

            const limitingValue = Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength / 1000) - 2;
            if(value >= limitingValue){
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength = limitingValue * 1000;
                event.target.value = limitingValue;
            } else {
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength = value * 1000;
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].minTimeframeLength = parseInt(event.target.value) * 1000

        });
        sampleContainer.appendChild(minTimeframeElement);


        // setup variational timeframe max slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const maxTimeframeElement = document.createElement('range-slider');
        maxTimeframeElement.label = 'Timeframe Max';
        maxTimeframeElement.min = 2;
        maxTimeframeElement.max = 60 * 60;
        maxTimeframeElement.scaleUnitLabel = 's';
        maxTimeframeElement.step = 10;
        maxTimeframeElement.value = Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength / 1000);
        maxTimeframeElement.addEventListener('valueChange', (event) => {
            const value = parseInt(event.target.value, 10);

            const limitingValue = Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength / 1000) + 2;
            if(value <= limitingValue){
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength = limitingValue * 1000;
                event.target.value = limitingValue;
            } else {
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength = value * 1000;
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].maxTimeframeLength = parseInt(event.target.value) * 1000

        });
        sampleContainer.appendChild(maxTimeframeElement);

        

        sceneSamplesAudioData.push({
            overlayTimeout: null,
            currentSource: null,
            stitchingMethd,
            concatOverlayMs,
            sampleSubsceneConfigParams,
            sampleVariationsAudioData,
            sampleTogglerElement,
            associatedCurrentVolumeSliderHtmlElement: volElement,
            minVolElement,
            maxVolElement,
            minTimeframeElement,
            maxTimeframeElement,
        });
    
    
    }
    return slidersContainer;
}

async function loadAndParseNewSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {

    onLoadingStarted();

    removeCurrentSliders();

    sceneSamplesAudioData = [];
    const slidersContainer = document.getElementById('sliders');

    if(loadAllAtOnce) {
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
            const groupHTMLParent = document.createElement('div');
            const groupLabel =  document.createElement('label');
            groupLabel.classList.add('group-label');
            groupLabel.innerText = scenes[sceneIndex].sceneName;
            
            groupLabel.addEventListener('click', (event)=>{
                if(event.target.classList.contains('group-label-open')){
                    event.target.classList.remove('group-label-open');
                } else{
                    event.target.classList.add('group-label-open');
                }
            })

            groupHTMLParent.appendChild(groupLabel);
            const groupSamplesWrapper = document.createElement('div');
            groupSamplesWrapper.classList.add('group-samples-wrapper');
            groupHTMLParent.appendChild(groupSamplesWrapper);
            
            
            const samplesGroupHtmlElement = await loadAndParseDataForSceneData(scenes, sceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);
            samplesGroupHtmlElement.forEach(sampleHTMLElement => {
                groupSamplesWrapper.appendChild(sampleHTMLElement);
            })
            
            slidersContainer.appendChild(groupHTMLParent);
        }
    } else{
        const samplesGroupHtmlElement = await loadAndParseDataForSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);
        slidersContainer.appendChild(samplesGroupHtmlElement);
    }

    onLoadingFinished();
}

// Function to populate the scene selector
function populateScenesSelector(scenes, selectedIndex) {
    const sceneSelector = ctas.sceneSelect;

    // Clear existing options
    sceneSelector.innerHTML = '';

    // Create an option for each scene
    scenes.forEach((scene, index) => {
        const option = document.createElement('option');
        option.value = index;  // Using the index as the value
        option.textContent = scene.sceneName;  // Displaying the scene label
        if(index === selectedIndex) {
            option.selected = "selected"
        }
        sceneSelector.appendChild(option);
    });
}

// Function to populate the subscene selector
function populateSubscenesSelector(subscenes, selectedIndex) {
    const subscenesSelector = ctas.subsceneSelect;

    // Clear existing options
    subscenesSelector.innerHTML = '';

    // Create an option for each scene
    subscenes.forEach((subscene, index) => {
        const option = document.createElement('option');
        option.value = index;  // Using the index as the value
        option.textContent = subscene.label;  // Displaying the scene label
        if(index === selectedIndex) {
            option.selected = "selected"
        }
        subscenesSelector.appendChild(option);
    });
}

// Function to populate the subscene windows selector
function populateSubscenesWindowsSelector(subscenes, selectedSubsceneIndex, selectedSubsceneWindowIndex) {
    const subscenesWindowSelector = ctas.subsceneWindowSelect;

    // Clear existing options
    subscenesWindowSelector.innerHTML = '';

    // Create an option for each scene
    subscenes[selectedSubsceneIndex].subsceneWindows.forEach((subsceneWindow, index) => {
        const option = document.createElement('option');
        option.value = index;  // Using the index as the value
        option.textContent = subsceneWindow.startAt;
        if(index === selectedSubsceneWindowIndex) {
            option.selected = "selected"
        }
        subscenesWindowSelector.appendChild(option);
    });
}





// Function to start the audio context and load sounds
async function startAudio(_selectedSubsceneIndex) {
    if (isStarted) return; // Prevents multiple initializations
    isStarted = true;


    // await loadSounds();
    await playAllSamples();
    
}


function stopAllAudio() {
    if (isStarted === false) return;
    isStarted = false;


    stopSceneSampleVariations(sceneSamplesAudioData)
        

}

function stopSceneSampleVariations(sceneSamplesAudio) {

    for (let i = 0; i < sceneSamplesAudioData.length; i++) {
        if(sceneSamplesAudio.overlayTimeout){

            clearTimeout(sceneSamplesAudio.overlayTimeout)
        }
        const currentSource = sceneSamplesAudio.currentSource;
        if (currentSource) {
            currentSource.stop();  // Stop the audio
            sceneSamplesAudio.currentSource = null;  // Clear the reference
        }
    }
}

// Function to fetch and decode an audio file
async function loadSound(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error(`Failed to load sound file at ${url}:`, error);
        return null; // Return null to prevent errors from breaking the whole program
    }
}

async function loadJson(url) {

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error fetching config file. Response status: ${response.status}`);
    }

    return await response.json();

}

function playRandomVariation(scenerySampleAudioData) {
    if (isStarted === false) return;

    const numberOfVariations = scenerySampleAudioData.sampleVariationsAudioData.length;
    const randomIndex = Math.floor(Math.random() * numberOfVariations);

    const audioBuffer = scenerySampleAudioData.sampleVariationsAudioData[randomIndex].audioBuffer;
    const gainNode = scenerySampleAudioData.sampleVariationsAudioData[randomIndex].gainNode;


    const audioBufferSource = audioContext.createBufferSource();
    audioBufferSource.buffer = audioBuffer;
    audioBufferSource.connect(gainNode).connect(audioContext.destination);

    // Store the buffer source for later stopping
    scenerySampleAudioData.currentSource = audioBufferSource;

    if(scenerySampleAudioData.stitchingMethd === "JOIN_WITH_CROSSFADE") {

        // this will only start immediately after one sample ended and does not really create a crossfade
        audioBufferSource.onended = () => {
            if (isStarted) playRandomVariation(scenerySampleAudioData);
        };

    } else if(scenerySampleAudioData.stitchingMethd === "JOIN_WITH_OVERLAY") {

        // Schedule the next variation to start before the current one ends
        let nextStartTime = audioBuffer.duration * 1000 - scenerySampleAudioData.concatOverlayMs; // mark*

        if(nextStartTime <= 0){
            console.warn(`
                The overlay duration must be higher than the sample duration.\n
                Will play the next variation after the current one ends:\n
                ${scenerySampleAudioData.sampleVariationsAudioData[randomIndex].variationFilePath}
            `);
            nextStartTime = audioBuffer.duration;
        }
        // Set a timeout to start the next variation before the current one ends
        scenerySampleAudioData.overlayTimeout = setTimeout(() => {
            if (isStarted) playRandomVariation(scenerySampleAudioData);
        }, nextStartTime);

    }
    
    audioBufferSource.start();
}

async function playAllSamples() {
    for (let i = 0; i < sceneSamplesAudioData.length; i++) {

        // Play one of the variations initially
        playRandomVariation(sceneSamplesAudioData[i]);
    }
}


function removeCurrentSliders() {
    const slidersContainer = document.getElementById('sliders');
    slidersContainer.innerHTML = '';
}


/**
 * @callback SampleVolumeChangeCallback
 * @param {CustomEvent<detail: {volumeValue: number}>} event
 */
/**
 * 
 * @param {*} currentValue 
 * @param {*} sampleVariationsAudioData 
 * @param {SampleVolumeChangeCallback} onChangeFunction 
 * @param {*} container 
 * @returns 
 */
function setupCurrentVolumeSlider(currentValue, onChangeFunction, container) {

    /**
   *  @type {RangeSliderHTMLElement} 
   */
    const volElement = document.createElement('range-slider');
    volElement.addEventListener('valueChange', (e) => onChangeFunction(e))
    volElement.value = currentValue;
    volElement.min = 0;
    volElement.max = 100;

    container.append(container.appendChild(volElement));

    return volElement

}

function setupScenePropertySlider(inputType, propertyName, min, max, currentValue, onChangeFunction, container) {


    /**
   *  @type {RangeSliderHTMLElement} 
   */
    const volElement = document.createElement('range-slider');
    volElement.addEventListener('valueChange', (e) => onChangeFunction(e))
    volElement.value = currentValue;

    container.append(container.appendChild(volElement));

    return volElement


    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = "property-slider-wrapper";



    const sliderLabel = document.createElement('label');
    sliderLabel.innerText = `${propertyName}: `;

    const input = document.createElement('input');
    input.type = inputType;
    input.min = min;
    input.max = max;
    input.value = currentValue

    input.addEventListener('input', (e) => onChangeFunction(e));

    sliderWrapper.appendChild(sliderLabel);
    sliderWrapper.appendChild(input);

    container.appendChild(sliderWrapper);
    return input;
}


function setupSubscenesWindowsSelectorCurrentEdit(subscenes, selectedSubsceneIndex, selectedSubsceneWindowIndex, min, max, currentValue) {
    const container = document.getElementById('subscene-window-selector-current-edit-wrapper');

    // empty the container to avoid previous inputs and their event listeners
    container.innerHTML = '';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.value = currentValue

    container.appendChild(input);

    input.addEventListener('input', (e) => {
        subscenes[selectedSubsceneIndex].subsceneWindows[selectedSubsceneWindowIndex].startAt = parseInt(e.target.value);
        for ( let option of ctas.subsceneWindowSelect.querySelectorAll('option')){
            if(option.selected){
                option.value = subscenes[selectedSubsceneIndex].subsceneWindows[selectedSubsceneWindowIndex].startAt;
                option.innerText =  subscenes[selectedSubsceneIndex].subsceneWindows[selectedSubsceneWindowIndex].startAt;
                return;
            }

        }

    });
    return input;
}

function addLabelToSampleControlsGroup(label, className, container) {

    

    const labelElement = document.createElement('label');
    labelElement.classList.add(className);
    labelElement.innerText = label;

    container.appendChild(labelElement);
    
}




function generateCurrentConfigJsonForScene (currentScene, currentSubscene){
    return currentScene.samples.map((sample, sampleIndex) => {

        const timingWindows = currentSubscene.subsceneWindows.map((subsceneWindow, i) => {
            if(i === 0 && subsceneWindow.startAt !== 0){
               throw new Error("The property 'startAt' needs to be 0 in the first timing window") 
            }
            return {
                startAt: subsceneWindow.startAt,
                
                params: {
                    
                    minVolRatio: subsceneWindow.config[sampleIndex].minVol/100,
                    maxVolRatio: subsceneWindow.config[sampleIndex].maxVol/100,
                    minTimeframeLengthMs: subsceneWindow.config[sampleIndex].minTimeframeLength,
                    maxTimeframeLengthMs: subsceneWindow.config[sampleIndex].maxTimeframeLength
                }
            }
        })

        const variationFilePath = sample.variationNames.map(variationName => `./${variationName}`);

        return {
            variationFilePath,
            stitchingMethod: sample.stitchingMethd,
            concatOverlayMs: sample.concatOverlayMs,
            timingWindows
        };
    })
    // do not add to export file the samples with max volume = 0
    .filter(mappedSample => mappedSample.timingWindows.some(timingWindow => timingWindow.params.maxVolRatio !== 0))
}

function generateCurrentConfigJson() {
    

    let sampleDataConfig = []

    if(loadAllAtOnce) {
        for(let sceneIndex = 0; sceneIndex < localConfigData.length; sceneIndex++){
            sampleDataConfig = [...sampleDataConfig, ...generateCurrentConfigJsonForScene(localConfigData[sceneIndex], localConfigData[sceneIndex].subscenes[0])]
        }
    } else {
        const selectedSceneIndex = parseInt(ctas.sceneSelect.value);
        const selectedSubsceneIndex = parseInt(ctas.subsceneSelect.value);
        const currentScene = localConfigData[selectedSceneIndex];
        const currentSubscene = currentScene.subscenes[selectedSubsceneIndex];
        sampleDataConfig = generateCurrentConfigJsonForScene(currentScene,currentSubscene)
    }

    const configData = {
        lengthMs: 60 * 60 * 1000,
        bitDepth: 16,
        sampleRate: 44100,
        format: 'wav', // aac = adts
        sampleDataConfig
    };

    const jsonString = JSON.stringify(configData, null, 2); // Pretty print the JSON
    downloadJsonFile(jsonString, 'currentConfig.json'); // Trigger download
}

function generateCurrentSubsceneJson() {

    console.log({
        label: "Subscene Label",
        subsceneWindows: [
            {
                startAt: 0,
                config: sceneSamplesAudioData.map(item => {
                    return {
                        minVol: parseInt(item.minVolElement.value),
                        maxVol: parseInt(item.maxVolElement.value),
                        minTimeframeLength: parseInt(item.minTimeframeElement.value), 
                        maxTimeframeLength: parseInt(item.maxTimeframeElement.value),
                    }
                })
            }
            
        ]
    })
    console.log(JSON.stringify({
        label: "Subscene Label",
        subsceneWindows: [
            {
                startAt: 0,
                config: sceneSamplesAudioData.map(item => {
                    return {
                        minVol: parseInt(item.minVolElement.value),
                        maxVol: parseInt(item.maxVolElement.value),
                        minTimeframeLength: parseInt(item.minTimeframeElement.value), 
                        maxTimeframeLength: parseInt(item.maxTimeframeElement.value),
                    }
                })
            }
            
        ]
    }, null, '    '))

        
}

function downloadJsonFile(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Free up memory
}

function addCtaEventListeners(){
    ctas.exportJsonButton.addEventListener('click', generateCurrentConfigJson);
}

function initApp(config){
    localConfigData = config;
    initScene(localConfigData, 0, 0, 0).then().catch(e => { throw e });
}

loadConfig().then((config) => {
    initApp(config)
    addCtaEventListeners(localConfigData);
    
}).catch(e => { throw e });




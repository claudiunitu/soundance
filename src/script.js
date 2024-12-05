let localConfigData; // will be populated with config.json data

const shouldAnimate = false;

const loadAllAtOnce = true

let sceneSamplesAudioData = [];



let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isStarted = true; // Flag to prevent re-initialization

const ctas = {
    startAudioButton: document.getElementById('startAudioButton'),
    stopAudioButton: document.getElementById('stopAudioButton'),
    exportJsonButton: document.getElementById('generateJsonButton'),
    exportCurrentSubscene: document.getElementById('exportCurrentSubscene'),
    sceneSelect: document.getElementById('scene-selector'),
    subsceneSelect: document.getElementById('subscene-selector'),
    subsceneWindowSelect: document.getElementById('subscene-window-selector'),
    animationToggle: document.getElementById('animation-toggle')
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

    const selectedScene = scenes[_selectedSceneIndex];
    await loadAndParseNewSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);


    // Populate the scene selector
    populateScenesSelector(scenes, _selectedSceneIndex);
    // Populate the subscene selector
    populateSubscenesSelector(selectedScene.subscenes, _selectedSubsceneIndex);

    populateSubscenesWindowsSelector(selectedScene.subscenes, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);
    setupSubscenesWindowsSelectorCurrentEdit(
        selectedScene.subscenes, 
        _selectedSubsceneIndex, 
        _selectedSubsceneWindowIndex, 
        0, 
        60*60*1000, 
        selectedScene.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].startAt
    )

}



async function loadAndParseDataForSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {


    const slidersContainer = document.getElementById('sliders');
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

        const shouldLoad = currentSceneSampleVol > 0;

        for (let j = 0; j < sceneObject.samples[i].variationNames.length; j++) {
            const variationFilePath = `${sceneObject.samples[i].variationNames[j]}`;

            const audioBuffer = shouldLoad ? await loadSound(variationFilePath).catch(e => { throw e }) : null;

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
        slidersContainer.appendChild(sampleContainer)

        
        addSeparatorToSlidersContainer('sample-fields-separator',sampleContainer);

        addLabelToSampleControlsGroup(`${sceneObject.sceneName} - ${sceneObject.samples[i].label}`, 'sample-fields-groul-label', sampleContainer);

        const forCurrentSampleIndex = sceneSamplesAudioData.length;
        const associatedCurrentVolumeSliderHtmlElement = setupCurrentVolumeSlider(
            currentSceneSampleVol,
            sampleVariationsAudioData,
            async (event) => {
                const value = parseInt(event.target.value);

                if(value > associatedMaxVolSliderHtmlElement.value){
                    associatedMaxVolSliderHtmlElement.value = event.target.value;
                    associatedMaxVolSliderHtmlElement.dispatchEvent(new Event('input'));
                }

                if(value < associatedMinVolSliderHtmlElement.value){
                    associatedMinVolSliderHtmlElement.value = event.target.value;
                    associatedMinVolSliderHtmlElement.dispatchEvent(new Event('input'));
                }
        
                for (let j = 0; j < sampleVariationsAudioData.length; j++) {
                    // we don't know which variation is playing so we should set the vorlume to all of them
                    sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(parseInt(event.target.value) / 100, audioContext.currentTime);
                }

                // persist value in state
                sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].currentVol = parseInt(event.target.value)

                

                if(parseInt(event.target.value) > 0){
                    let wasLoadedAndNotPlayed = false;
                    for(let k = 0; k < sampleVariationsAudioData.length; k++) {
                        const sampleVariationAudioData = sampleVariationsAudioData[k];
                        if(sampleVariationAudioData.audioBuffer === null && sampleVariationAudioData.isAudioBufferLoading === false ){
                            sampleVariationAudioData.isAudioBufferLoading = true;
                            sampleVariationAudioData.audioBuffer = await loadSound(sampleVariationAudioData.variationFilePath).catch(e => { throw e });
                            sampleVariationAudioData.isAudioBufferLoading = false;
                            if( k === sampleVariationsAudioData.length - 1){

                                wasLoadedAndNotPlayed = true;
                            }
                        }
                    }
                    if(wasLoadedAndNotPlayed){
                        wasLoadedAndNotPlayed = false;
                        playRandomVariation(sceneSamplesAudioData[forCurrentSampleIndex]); 
                        
                    }
                    
                } else {
                    stopSceneSampleVariations(sceneSamplesAudioData[forCurrentSampleIndex]);
                    for(let k = 0; k < sampleVariationsAudioData.length; k++) {
                        const sampleVariationAudioData = sampleVariationsAudioData[k];
                        if(sampleVariationAudioData.audioBuffer !== null ){
                            sampleVariationAudioData.audioBuffer = null;
                        }
                    }
                }
                
                // console.log(sceneSamplesAudioData[i].sampleVariationsAudioData)
                // // sceneSamplesAudioData[_selectedSceneIndex].sampleSubsceneConfigParams[]
                // sceneSamplesAudioData[i].sampleVariationsAudioData[randomIndex].audioBuffer

            },
            sampleContainer
        );

        const associatedMinVolSliderHtmlElement = setupScenePropertySlider(
            'range', 
            "minVol", 
            0, 
            100, 
            sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol,
            (event) => {
                const value = parseInt(event.target.value, 10);

                if(value > associatedCurrentVolumeSliderHtmlElement.value){
                    associatedCurrentVolumeSliderHtmlElement.value = event.target.value;
                    associatedCurrentVolumeSliderHtmlElement.dispatchEvent(new Event('input'));
                }

                // persist value in state
                sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].minVol = parseInt(event.target.value)

                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAllAudio();
                }
            },
            sampleContainer
        );

        const associatedMaxVolSliderHtmlElement = setupScenePropertySlider(
            'range',
            "maxVol", 
            0,
            100, 
            sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol,
            (event) => {
                const value = parseInt(event.target.value, 10);

                if(value < associatedCurrentVolumeSliderHtmlElement.value){
                    associatedCurrentVolumeSliderHtmlElement.value = event.target.value;
                    associatedCurrentVolumeSliderHtmlElement.dispatchEvent(new Event('input'));
                }

                // persist value in state
                sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].maxVol = parseInt(event.target.value)
                
                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAllAudio();
                }
            },
            sampleContainer
        );

        const associatedMinTimeframeLengthSliderHtmlElement = setupScenePropertySlider(
            'number',
            "minTimeframeLength", 
            2*1000, 
            60 * 60 *1000, 
            sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength,
            (event) => {
                const value = parseInt(event.target.value, 10);

                const limitingValue = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength;
                if(value >= limitingValue){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength = limitingValue;
                    event.target.value = limitingValue;
                } else {
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength = value;
                }

                // persist value in state
                sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].minTimeframeLength = parseInt(event.target.value)
                
                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAllAudio();
                }
            },
            sampleContainer
        );

        const associatedMaxTimeframeLengthSliderHtmlElement = setupScenePropertySlider(
            'number',
            "maxTimeframeLength", 
            2*1000, 
            60 * 60 *1000, 
            sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength,
            (event) => {
                const value = parseInt(event.target.value, 10);

                const limitingValue = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength;
                if(value <= limitingValue){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength = limitingValue;
                    event.target.value = limitingValue;
                } else {
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength = value;
                }

                // persist value in state
                sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].maxTimeframeLength = parseInt(event.target.value)

                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAllAudio();
                }
            },
            sampleContainer
        );

        

        sceneSamplesAudioData.push({
            overlayTimeout: null,
            currentSource: null,
            stitchingMethd,
            concatOverlayMs,
            sampleSubsceneConfigParams,
            sampleVariationsAudioData,
            associatedCurrentVolumeSliderHtmlElement,
            associatedMinVolSliderHtmlElement,
            associatedMaxVolSliderHtmlElement,
            associatedMinTimeframeLengthSliderHtmlElement,
            associatedMaxTimeframeLengthSliderHtmlElement,
        });
        addSeparatorToSlidersContainer('sample-fields-separator', sampleContainer);
    
    
    }
}

async function loadAndParseNewSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {

    onLoadingStarted();

    removeCurrentSliders();

    sceneSamplesAudioData = [];
    
    if(loadAllAtOnce) {
        for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
            
            await loadAndParseDataForSceneData(scenes, sceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);
        }
    } else{
        await loadAndParseDataForSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);
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

    const shouldAnimate = ctas.animationToggle.checked;
    if(shouldAnimate){
        // delay initSlidersAnimations(selectedSceneIndex) by a fraction of a second to ensure all sounds have started and prevent race conditions.
        setTimeout(() => initSlidersAnimations(_selectedSubsceneIndex), 100);
    }
    
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
        let nextStartTime = audioBuffer.duration * 1000 - scenerySampleAudioData.concatOverlayMs;

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

function setupCurrentVolumeSlider(currentValue, sampleVariationsAudioData, onChangeFunction, container) {

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = "property-slider-wrapper";
    const slider = document.createElement('input');
    // slider.id = `#slider-${i}`;
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value = currentValue;

    

    // set initial volume
    for (let j = 0; j < sampleVariationsAudioData.length; j++) {
        // we don't know which variation is playing so we should set the vorlume to all of them
        sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(currentValue / 100, audioContext.currentTime);
    }

    slider.addEventListener('input', onChangeFunction);

    const sliderLabel = document.createElement('label');
    sliderLabel.innerText =' current volume';

    sliderWrapper.append(sliderLabel)
    sliderWrapper.append(slider);
    container.append(sliderWrapper);

    return slider

}

function setupScenePropertySlider(inputType, propertyName, min, max, currentValue, onChangeFunction, container) {


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

function addSeparatorToSlidersContainer(className, container) {
    

    const separatorElement = document.createElement('hr');
    separatorElement.classList.add(className)

    container.appendChild(separatorElement);
}

function addLabelToSampleControlsGroup(label, className, container) {

    const labelElement = document.createElement('label');
    labelElement.classList.add(className);
    labelElement.innerText = label;

    container.appendChild(labelElement);
}



// Animate sliders over random timeframes to random positions
function initSlidersAnimations(_selectedSubsceneIndex) {
    if (isStarted === false) {
        return;
    }
    for (let i = 0; i < sceneSamplesAudioData.length; i++) {

        const selectedSceneConfigParams = sceneSamplesAudioData[i].sampleSubsceneConfigParams[_selectedSubsceneIndex].params;
        const volMin = selectedSceneConfigParams.minVol;
        const volMax = selectedSceneConfigParams.maxVol;
        const durationMin = selectedSceneConfigParams.minTimeframeLength;
        const durationMax = selectedSceneConfigParams.maxTimeframeLength;
        triggerAnimationLoopForSlider(sceneSamplesAudioData[i].associatedCurrentVolumeSliderHtmlElement, sceneSamplesAudioData[i].sampleVariationsAudioData, volMin, volMax, durationMin, durationMax);
    }

}


function triggerAnimationLoopForSlider(sliderHtmlElement, sampleVariationsAudioData, volMin, volMax, durationMin, durationMax) {
    if (isStarted === false) {
        return;
    }

    const targetVolume = Math.floor(Math.random() * (volMax - volMin + 1)) + volMin;
    const duration = Math.floor(Math.random() * (durationMax - durationMin + 1)) + durationMin;

    const startVolume = parseInt(sliderHtmlElement.value, 10);
    const volumeChange = targetVolume - startVolume;
    const steps = 100;
    let startTime = null;

    const animate = (timestamp) => {
        if (!isStarted) return;  // Check if `isStarted` is false and exit the animation loop
        if (!startTime) startTime = timestamp;
        const elapsedTime = timestamp - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        const newVolume = startVolume + volumeChange * progress;
        sliderHtmlElement.value = newVolume;

        sampleVariationsAudioData.forEach(data => {
            data.gainNode.gain.setValueAtTime(newVolume / 100, audioContext.currentTime);
        });

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Restart with a new target
            triggerAnimationLoopForSlider(sliderHtmlElement, sampleVariationsAudioData, volMin, volMax, durationMin, durationMax);
        }
    };

    requestAnimationFrame(animate);
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
                        minVol: parseInt(item.associatedMinVolSliderHtmlElement.value),
                        maxVol: parseInt(item.associatedMaxVolSliderHtmlElement.value),
                        minTimeframeLength: parseInt(item.associatedMinTimeframeLengthSliderHtmlElement.value), 
                        maxTimeframeLength: parseInt(item.associatedMaxTimeframeLengthSliderHtmlElement.value),
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
                        minVol: parseInt(item.associatedMinVolSliderHtmlElement.value),
                        maxVol: parseInt(item.associatedMaxVolSliderHtmlElement.value),
                        minTimeframeLength: parseInt(item.associatedMinTimeframeLengthSliderHtmlElement.value), 
                        maxTimeframeLength: parseInt(item.associatedMaxTimeframeLengthSliderHtmlElement.value),
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
    ctas.startAudioButton.addEventListener('click', () => startAudio(parseInt(ctas.subsceneSelect.value)));
    ctas.stopAudioButton.addEventListener('click', stopAllAudio);

    ctas.sceneSelect.addEventListener('change', (event) => {
        stopAllAudio();  // Stop the audio
        initScene(localConfigData, parseInt(event.target.value, 10), 0, 0).then().catch(e => { throw e });
    });

    ctas.subsceneSelect.addEventListener('change', (event) => {
        stopAllAudio();  // Stop the audio
        initScene(localConfigData, parseInt(ctas.sceneSelect.value), parseInt(event.target.value), 0, 0).then().catch(e => { throw e });
    });

    ctas.subsceneWindowSelect.addEventListener('change', (event) => {
        stopAllAudio();  // Stop the audio
        initScene(localConfigData, parseInt(ctas.sceneSelect.value), parseInt(ctas.subsceneSelect.value), parseInt(event.target.value)).then().catch(e => { throw e });
    });

    ctas.exportJsonButton.addEventListener('click', generateCurrentConfigJson);

    ctas.exportCurrentSubscene.addEventListener('click', generateCurrentSubsceneJson);

    
}

function initApp(config){
    localConfigData = config;
    initScene(localConfigData, 0, 0, 0).then().catch(e => { throw e });
    
}

loadConfig().then((config) => {
    initApp(config)
    addCtaEventListeners(localConfigData);
    
}).catch(e => { throw e });




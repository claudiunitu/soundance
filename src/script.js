const shouldAnimate = false;

const sceneSamplesAudioData = [];


let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isStarted = false; // Flag to prevent re-initialization

const ctas = {
    startAudioButton: document.getElementById('startAudioButton'),
    stopAudioButton: document.getElementById('stopAudioButton'),
    exportJsonButton: document.getElementById('generateJsonButton'),
    sceneSelect: document.getElementById('scene-selector'),
    subsceneSelect: document.getElementById('subscene-selector'),
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

async function initScene(scenes, _selectedSceneIndex, _selectedSubsceneIndex) {

    const selectedScene = scenes[_selectedSceneIndex];
    await loadAndParseNewSceneData(selectedScene, _selectedSubsceneIndex);


    // Populate the scene selector
    populateScenesSelector(scenes, _selectedSceneIndex);
    // Populate the subscene selector
    populateSubscenesSelector(selectedScene.subscenes, _selectedSubsceneIndex);

}

async function loadAndParseNewSceneData(sceneObject, _selectedSubsceneIndex) {

    onLoadingStarted();

    removeCurrentSliders();

    sceneSamplesAudioData.length = 0;

    for (let i = 0; i < sceneObject.samples.length; i++) {
        const sampleVariationsAudioData = [];

        for (let j = 0; j < sceneObject.samples[i].variationNames.length; j++) {
            const variationFilePath = `${sceneObject.directory}/${sceneObject.samples[i].variationNames[j]}`;

            const audioBuffer = await loadSound(variationFilePath).catch(e => { throw e });

            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

            if (audioBuffer) {
                sampleVariationsAudioData.push({
                    variationFilePath,
                    audioBuffer,
                    gainNode,
                });
            }
        }

        const sampleSubsceneConfigParams = sceneObject.subscenes.map(scene => {
            return {
                label: scene.label,
                params: scene.sceneSamplesConfig[i]
            }
        });

        const stitchingMethd = sceneObject.samples[i].stitchingMethd;
        const concatOverlayMs = sceneObject.samples[i].concatOverlayMs;


        addSeparatorToSlidersContainer('sample-fields-separator');

        addLabelToSampleControlsGroup(sceneObject.samples[i].label, 'sample-fields-groul-label');

        let currentSceneSampleVol = 0; 
        if(typeof sampleSubsceneConfigParams[_selectedSubsceneIndex].params.currentVol === "number"){
            currentSceneSampleVol = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.currentVol;
        } else if(typeof sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol === "number" && typeof sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol === "number") {
            currentSceneSampleVol = Math.floor((sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol + sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol) / 2 );
        }
        const associatedCurrentVolumeSliderHtmlElement = setupCurrentVolumeSlider(
            currentSceneSampleVol,
            sampleVariationsAudioData,
            (event) => {
                const value = parseInt(event.target.value);
                const upperLimit = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol;
                const lowerLimit = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol;

                if(value > upperLimit){
                    event.target.value = upperLimit;
                } else if(value < lowerLimit){
                    event.target.value = lowerLimit;
                }
        
                for (let j = 0; j < sampleVariationsAudioData.length; j++) {
                    // we don't know which variation is playing so we should set the vorlume to all of them
                    sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(parseInt(event.target.value) / 100, audioContext.currentTime);
                }
            }
        );

        const associatedMinVolSliderHtmlElement = setupScenePropertySlider(
            'range', 
            "minVol", 
            0, 
            100, 
            sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol,
            (event) => {
                const value = parseInt(event.target.value, 10);

                const limitingValue = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol;
                if(value >= limitingValue){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol = limitingValue;
                    event.target.value = limitingValue;
                } else {
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol = value;
                }

                if(value > associatedCurrentVolumeSliderHtmlElement.value){
                    associatedCurrentVolumeSliderHtmlElement.value = event.target.value;
                    associatedCurrentVolumeSliderHtmlElement.dispatchEvent(new Event('input'));
                }

                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAudio();
                }
            }
        );

        const associatedMaxVolSliderHtmlElement = setupScenePropertySlider(
            'range',
            "maxVol", 
            0,
            100, 
            sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol,
            (event) => {
                const value = parseInt(event.target.value, 10);

                const limitingValue = sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol;
                if(value <= limitingValue){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol = limitingValue;
                    event.target.value = limitingValue;
                } else {
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol = value;
                }

                if(value < associatedCurrentVolumeSliderHtmlElement.value){
                    associatedCurrentVolumeSliderHtmlElement.value = event.target.value;
                    associatedCurrentVolumeSliderHtmlElement.dispatchEvent(new Event('input'));
                }
                
                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAudio();
                }
            }
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
                
                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAudio();
                }
            }
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

                const shouldAnimate = ctas.animationToggle.checked;
                if(shouldAnimate){
                    stopAudio();
                }
            }
        );

        sceneSamplesAudioData.push({
            currentSource: null,
            stitchingMethd,
            concatOverlayMs,
            sampleSubsceneConfigParams,
            sampleVariationsAudioData,
            associatedCurrentVolumeSliderHtmlElement,
            associatedMinVolSliderHtmlElement,
            associatedMaxVolSliderHtmlElement,
            associatedMinTimeframeLengthSliderHtmlElement,
            associatedMaxTimeframeLengthSliderHtmlElement
        });
        addSeparatorToSlidersContainer('sample-fields-separator');
    }


    onLoadingFinished();
}

// Function to populate the scene selector
function populateScenesSelector(scenes, selectedIndex) {
    const sceneSelector = document.getElementById('scene-selector');

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
    const subscenesSelector = document.getElementById('subscene-selector');

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

// Function to start the audio context and load sounds
async function startAudio(_selectedSubsceneIndex) {
    if (isStarted) return; // Prevents multiple initializations
    isStarted = true;



    // Hide start button, show sliders
    // document.getElementById('startButton').style.display = 'none';
    // document.getElementById('sliders').style.display = 'block';

    // await loadSounds();
    await playAllSamples();

    const shouldAnimate = ctas.animationToggle.checked;
    if(shouldAnimate){
        // delay initSlidersAnimations(selectedSceneIndex) by a fraction of a second to ensure all sounds have started and prevent race conditions.
        setTimeout(() => initSlidersAnimations(_selectedSubsceneIndex), 100);
    }
    
}


function stopAudio() {
    if (isStarted === false) return;
    isStarted = false;

    for (let i = 0; i < sceneSamplesAudioData.length; i++) {
        const currentSource = sceneSamplesAudioData[i].currentSource;
        if (currentSource) {
            currentSource.stop();  // Stop the audio
            sceneSamplesAudioData[i].currentSource = null;  // Clear the reference
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
        setTimeout(() => {
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

function setupCurrentVolumeSlider(currentValue, sampleVariationsAudioData, onChangeFunction) {

    const slidersContainer = document.getElementById('sliders');

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
    slidersContainer.append(sliderWrapper);

    return slider

}

function setupScenePropertySlider(inputType, propertyName, min, max, currentValue, onChangeFunction) {
    const slidersContainer = document.getElementById('sliders');

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


    slidersContainer.appendChild(sliderWrapper);
    return input;
}

function addSeparatorToSlidersContainer(className) {
    const slidersContainer = document.getElementById('sliders');

    const separatorElement = document.createElement('hr');
    separatorElement.classList.add(className)

    slidersContainer.appendChild(separatorElement);
}

function addLabelToSampleControlsGroup(label, className) {
    const slidersContainer = document.getElementById('sliders');

    const labelElement = document.createElement('label');
    labelElement.classList.add(className);
    labelElement.innerText = label;

    slidersContainer.appendChild(labelElement);
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

function generateCurrentConfigJson() {
    const selectedSubsceneIndex = parseInt(document.getElementById('subscene-selector').value);
    

    const configData = {
        lengthMs: 60 * 60 * 1000,
        bitDepth: 16,
        sampleRate: 44100,
        format: 'wav', // aac = adts
        sampleDataConfig: sceneSamplesAudioData.map(sample => {

            const params = {
                stitchingMethod: sample.stitchingMethd,
                concatOverlayMs: sample.concatOverlayMs,
                minVolRatio: sample.sampleSubsceneConfigParams[selectedSubsceneIndex].params.minVol/100,
                maxVolRatio: sample.sampleSubsceneConfigParams[selectedSubsceneIndex].params.maxVol/100,
                minTimeframeLengthMs: sample.sampleSubsceneConfigParams[selectedSubsceneIndex].params.minTimeframeLength,
                maxTimeframeLengthMs: sample.sampleSubsceneConfigParams[selectedSubsceneIndex].params.maxTimeframeLength
            };

            const variationFilePath = sample.sampleVariationsAudioData.map(sampleVariationAudioData => sampleVariationAudioData.variationFilePath);

            return {
                variationFilePath,
                params
            };
        })
        // do not add to export file the samples with max volume = 0
        .filter(mappedSample => mappedSample.params.maxVolRatio !== 0)
    };

    const jsonString = JSON.stringify(configData, null, 2); // Pretty print the JSON
    downloadJsonFile(jsonString, 'currentConfig.json'); // Trigger download
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

function addCtaEventListeners(config){
    ctas.startAudioButton.addEventListener('click', () => startAudio(parseInt(ctas.subsceneSelect.value)));
    ctas.stopAudioButton.addEventListener('click', stopAudio);

    ctas.sceneSelect.addEventListener('change', (event) => {
        stopAudio();  // Stop the audio
        initScene(config, parseInt(event.target.value, 10), 0).then().catch(e => { throw e });
    });

    ctas.subsceneSelect.addEventListener('change', (event) => {
        stopAudio();  // Stop the audio
        initScene(config, parseInt(ctas.sceneSelect.value), parseInt(event.target.value), 0).then().catch(e => { throw e });
    });

    ctas.exportJsonButton.addEventListener('click', generateCurrentConfigJson);
}


loadConfig().then((config) => {
    addCtaEventListeners(config);
    initScene(config, 0, 0).then().catch(e => { throw e });
}).catch(e => { throw e });




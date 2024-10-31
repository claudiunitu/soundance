const shouldAnimate = false;

const sceneSamplesAudioData = [];

// let selectedSceneIndex = 0;
// let selectedSubsceneIndex = 0;


let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isStarted = false; // Flag to prevent re-initialization




async function loadConfig() {
    return await loadJson(`/config.json`).catch(e => { throw e });
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



        sceneSamplesAudioData.push({
            currentSource: null,
            stitchingMethd,
            concatOverlayMs,
            sampleSubsceneConfigParams,
            sampleVariationsAudioData,
            associatedCurrentVolumeSliderHtmlElement: setupCurrentVolumeSlider(
                sceneObject.samples[i].label, 
                Math.floor((sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol + sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol) / 2 ),
                sampleVariationsAudioData
            ),
            associatedMinVolSliderHtmlElement: setupScenePropertySlider(
                'range',
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params, 
                sceneObject.samples[i].label, 
                "minVol", 
                0, 
                100, 
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol
            ),
            associatedMaxVolSliderHtmlElement: setupScenePropertySlider(
                'range',
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params, 
                sceneObject.samples[i].label, 
                "maxVol", 
                0,
                100, 
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol
            ),
            associatedMinTimeframeLengthSliderHtmlElement: setupScenePropertySlider(
                'number',
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params, 
                sceneObject.samples[i].label, "minTimeframeLength", 
                2*1000, 
                60 * 60 *1000, 
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength
            ),
            associatedMaxTimeframeLengthSliderHtmlElement: setupScenePropertySlider(
                'number',
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params, 
                sceneObject.samples[i].label, 
                "maxTimeframeLength", 
                2*1000, 
                60 * 60 *1000, 
                sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength
            )
        });
    }


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

    const shouldAnimate = document.getElementById('animation-toggle').checked;
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

    audioBufferSource.onended = () => {
        if (isStarted) playRandomVariation(scenerySampleAudioData);
    };

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

function setupCurrentVolumeSlider(label, currentValue, sampleVariationsAudioData) {

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

    slider.addEventListener('input', (e) => {
        for (let j = 0; j < sampleVariationsAudioData.length; j++) {
            // we don't know which variation is playing so we should set the vorlume to all of them
            sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(e.target.value / 100, audioContext.currentTime);
        }
    });

    const sliderLabel = document.createElement('label');
    sliderLabel.innerText = label + ' current volume';

    sliderWrapper.append(sliderLabel)
    sliderWrapper.append(slider);
    slidersContainer.append(sliderWrapper);

    return slider

}

function setupScenePropertySlider(inputType, mutateStatePropertyHere, label, propertyName, min, max, currentValue) {
    const slidersContainer = document.getElementById('sliders');

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = "property-slider-wrapper";



    const sliderLabel = document.createElement('label');
    sliderLabel.innerText = `${label} ${propertyName}: `;

    const input = document.createElement('input');
    input.type = inputType;
    input.min = min;
    input.max = max;
    input.value = currentValue

    input.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        mutateStatePropertyHere[propertyName] = value
        stopAudio()
    });

    sliderWrapper.appendChild(sliderLabel);
    sliderWrapper.appendChild(input);


    slidersContainer.appendChild(sliderWrapper);
    return input;
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
        bitDepth: 32,
        sampleRate: 44100,
        format: 'adts', // aac
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


loadConfig().then((config) => {

    

    initScene(config, 0, 0).then().catch(e => { throw e });

    document.getElementById('startAudioButton').addEventListener('click', () => startAudio(parseInt(document.getElementById('subscene-selector').value)));
    document.getElementById('stopAudioButton').addEventListener('click', stopAudio);

    document.getElementById('scene-selector').addEventListener('change', (event) => {
        // selectedSceneIndex = parseInt(event.target.value, 10);
        stopAudio();  // Stop the audio
        initScene(config, parseInt(event.target.value, 10), 0).then().catch(e => { throw e });
    });

    document.getElementById('subscene-selector').addEventListener('change', (event) => {
        stopAudio();  // Stop the audio
        initScene(config, parseInt(document.getElementById('scene-selector').value), parseInt(event.target.value), 0).then().catch(e => { throw e });
    });

    document.getElementById('generateJsonButton').addEventListener('click', generateCurrentConfigJson);

}).catch(e => { throw e });





const sceneSamplesAudioData = [];

let selectedSceneIndex = 0;
let selectedSubsceneIndex = 0;


let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isStarted = false; // Flag to prevent re-initialization




async function loadConfig() {
    return await loadJson(`/config.json`).catch(e => {throw e});
}

async function initScene(scenes, selectedSceneIndex) {
    const selectedScene = scenes[selectedSceneIndex];
    await loadAndParseNewSceneData(selectedScene);

    

    // Populate the subscene selector
    populateSubscenesSelector(selectedScene.subscenes);

}

async function loadAndParseNewSceneData(sceneObject) {

    
    removeCurrentSliders();

    sceneSamplesAudioData.length = 0;

    for (let i = 0; i < sceneObject.samples.length; i++) {
        const sampleVariationsAudioData = [];
        
        for (let j = 0; j < sceneObject.samples[i].variationNames.length; j++) {

            const audioBuffer = await loadSound(`${sceneObject.directory}/${sceneObject.samples[i].variationNames[j]}`).catch(e => {throw e});

            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

            if (audioBuffer) {
                sampleVariationsAudioData.push({
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
        })

        sceneSamplesAudioData.push({
            currentSource: null,
            sampleSubsceneConfigParams, 
            sampleVariationsAudioData, 
            associatedSliderHtmlElement: setupSlider(sceneObject.samples[i].label, sampleVariationsAudioData)
        });
    }


}

// Function to populate the scene selector
function populateScenesSelector(scenes) {
    const sceneSelector = document.getElementById('scene-selector');

    // Clear existing options
    sceneSelector.innerHTML = '';

    // Create an option for each scene
    scenes.forEach((scene, index) => {
        const option = document.createElement('option');
        option.value = index;  // Using the index as the value
        option.textContent = scene.sceneName;  // Displaying the scene label
        sceneSelector.appendChild(option);
    });
}

// Function to populate the subscene selector
function populateSubscenesSelector(subscenes) {
    const subscenesSelector = document.getElementById('subscene-selector');

    // Clear existing options
    subscenesSelector.innerHTML = '';

    // Create an option for each scene
    subscenes.forEach((subscene, index) => {
        const option = document.createElement('option');
        option.value = index;  // Using the index as the value
        option.textContent = subscene.label;  // Displaying the scene label
        subscenesSelector.appendChild(option);
    });
}

// Function to start the audio context and load sounds
async function startAudio() {
    if (isStarted) return; // Prevents multiple initializations
    isStarted = true;

    

    // Hide start button, show sliders
    // document.getElementById('startButton').style.display = 'none';
    // document.getElementById('sliders').style.display = 'block';

    // await loadSounds();
    await playAllSamples();
    
    // delay initSlidersAnimations(selectedSceneIndex) by a fraction of a second to ensure all sounds have started and prevent race conditions.
    setTimeout(() => initSlidersAnimations(selectedSubsceneIndex), 100);
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


function removeCurrentSliders(){
    const slidersContainer = document.getElementById('sliders');
    slidersContainer.innerHTML = '';
}

function setupSlider(label, sampleVariationsAudioData) {

    const slidersContainer = document.getElementById('sliders');

    const sliderWrapper = document.createElement('div');
    const slider = document.createElement('input');
    // slider.id = `#slider-${i}`;
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.value =  "50";

    slider.addEventListener('input', (e) => {
        const volume = e.target.value / 100;
        for(let j = 0; j < sampleVariationsAudioData.length; j++) {
            // we don't know which variation is playing so we should set the vorlume to all of them
            sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        }
    });

    const sliderLabel = document.createElement('label');
    sliderLabel.innerText = label;

    sliderWrapper.append(slider);
    sliderWrapper.append(sliderLabel)
    slidersContainer.append(sliderWrapper);

    return slider

}

// Animate sliders over random timeframes to random positions
function initSlidersAnimations(selectedSubsceneIndex) {
    if(isStarted === false) {
        return;
    }
    for (let i = 0; i < sceneSamplesAudioData.length; i++) {

        const selectedSceneConfigParams = sceneSamplesAudioData[i].sampleSubsceneConfigParams[selectedSubsceneIndex].params;
        const volMin = selectedSceneConfigParams.minVol;
        const volMax = selectedSceneConfigParams.maxVol;
        const durationMin = selectedSceneConfigParams.minTimeframeLength;
        const durationMax = selectedSceneConfigParams.maxTimeframeLength;
        triggerAnimationLoopForSlider(sceneSamplesAudioData[i].associatedSliderHtmlElement, sceneSamplesAudioData[i].sampleVariationsAudioData, volMin, volMax, durationMin, durationMax);
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


loadConfig().then((config)=>{

    // Populate the scenery selector
    populateScenesSelector(config);

    initScene(config, selectedSceneIndex).then().catch(e=> {throw e});

    document.getElementById('startAudioButton').addEventListener('click', startAudio);
    document.getElementById('stopAudioButton').addEventListener('click', stopAudio);

    document.getElementById('scene-selector').addEventListener('change', (event) => {
        selectedSceneIndex = parseInt(event.target.value, 10);
        stopAudio();  // Stop the audio
        initScene(config, selectedSceneIndex).then().catch(e=> {throw e});
    });

    document.getElementById('subscene-selector').addEventListener('change', (event) => {
        selectedSubsceneIndex = parseInt(event.target.value, 10);
        stopAudio();  // Stop the audio
    });

}).catch(e=> {throw e});




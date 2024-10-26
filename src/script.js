
const scenerySamplesAudioData = [];



let audioContext = new (window.AudioContext || window.webkitAudioContext)();
let isStarted = false; // Flag to prevent re-initialization




async function loadConfig() {
    return await loadJson(`/config.json`).catch(e => {throw e});
}

async function initScenery(sceneryObject) {


    


    await loadAndParseNewSceneryData(sceneryObject);

    // setupSliders(selectedSceneIndex);

    
}

async function loadAndParseNewSceneryData(sceneryObject) {

    

    removeCurrentSliders();

    scenerySamplesAudioData.length = 0;

    for (let i = 0; i < sceneryObject.samples.length; i++) {
        const sampleVariationsAudioData = [];
        
        for (let j = 0; j < sceneryObject.samples[i].variationNames.length; j++) {

            const audioBuffer = await loadSound(`${sceneryObject.directory}/${sceneryObject.samples[i].variationNames[j]}`).catch(e => {throw e});

            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);



            sampleVariationsAudioData.push({
                audioBuffer,
                gainNode
            })
        }

        const sampleSceneConfig = sceneryObject.scenes.map(scene => {
            return {
                label: scene.label,
                params: scene.sceneSamplesConfig[i]
            }
        })

        scenerySamplesAudioData.push({
            sampleSceneConfig, 
            sampleVariationsAudioData, 
            associatedSliderHtmlElement: setupSlider(sceneryObject.samples[i].label, sampleVariationsAudioData)
        });
    }


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
    
    initSlidersAnimations(0)
}






function stopAudio() {
    if (isStarted === false) {
        return;
    } 
    isStarted = false;

    

    for(let i = 0; i < scenerySamplesAudioData.length; i++) {  
        for(let j = 0; j < scenerySamplesAudioData[i].sampleVariationsAudioData.length; j++) {
            scenerySamplesAudioData[i].sampleVariationsAudioData.bufferSource.stop();
            scenerySamplesAudioData[i].sampleVariationsAudioData.bufferSource.onended = null
        }
    }

    

    // Optionally reset sliders if needed
    sliders.forEach((slider) => (slider.value = 50)); // Reset slider to mid position

    // Hide stop button, show start button for replaying audio
    // document.getElementById('stopButton').style.display = 'none';
    // document.getElementById('startButton').style.display = 'inline-block';



    
}



// Function to fetch and decode an audio file
async function loadSound(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return audioContext.decodeAudioData(arrayBuffer);
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
    const randomIndex = Math.floor(Math.random() * numberOfVariations); // Choose a random variation index
    
    console.log('Chosen variation:', randomIndex);

    const audioBuffer = scenerySampleAudioData.sampleVariationsAudioData[randomIndex].audioBuffer;
    const gainNode = scenerySampleAudioData.sampleVariationsAudioData[randomIndex].gainNode;

    const audioBufferSource = audioContext.createBufferSource();
    audioBufferSource.buffer = audioBuffer;
    audioBufferSource.connect(gainNode).connect(audioContext.destination);

    // Set up the `onended` event to play the next random variation
    audioBufferSource.onended = () => {
        playRandomVariation(scenerySampleAudioData);
    };

    audioBufferSource.start();
}

async function playAllSamples() {
    for (let i = 0; i < scenerySamplesAudioData.length; i++) {

        // Play one of the variations initially
        playRandomVariation(scenerySamplesAudioData[i]);
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
function initSlidersAnimations(selectedSceneIndex) {
    if(isStarted === false) {
        return;
    }
    for (let i = 0; i < scenerySamplesAudioData.length; i++) {

        const selectedSceneConfigParams = scenerySamplesAudioData[i].sampleSceneConfig[selectedSceneIndex].params;
        const volMin = selectedSceneConfigParams.minVol;
        const volMax = selectedSceneConfigParams.maxVol;
        const durationMin = selectedSceneConfigParams.minTimeframeLength;
        const durationMax = selectedSceneConfigParams.maxTimeframeLength;
        triggerAnimationLoopForSlider(scenerySamplesAudioData[i].associatedSliderHtmlElement, scenerySamplesAudioData[i].sampleVariationsAudioData, volMin, volMax, durationMin, durationMax);
    }
    // sliders.forEach((slider, index) => {
    // });
}

function triggerAnimationLoopForSlider(sliderHtmlElement, sampleVariationsAudioData, volMin, volMax, durationMin, durationMax) {
    if(isStarted === false) {
        return;
    }


    const targetVolume = Math.floor(Math.random() * (volMax - volMin + 1)) + volMin;
    const duration = Math.floor(Math.random() * (durationMax - durationMin + 1)) + durationMin;


    const startVolume = parseInt(sliderHtmlElement.value, 10); // take only the gain value of the first sample as they are all set at the same value
    const volumeChange = targetVolume - startVolume;
    const steps = 100;
    const stepDuration = duration / steps;
    let step = 1;

    const animate = () => {
        if(isStarted === false) {
            return;
        }
        if (step <= steps) {
            const newVolume = startVolume + (volumeChange * (step / steps));
            sliderHtmlElement.value = newVolume;
            for(let j = 0; j < sampleVariationsAudioData.length; j++) {
                // we don't know which variation is playing so we should set the vorlume to all of them
                sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(newVolume / 100, audioContext.currentTime);
            }
            step++;
            setTimeout(animate, stepDuration);
        } else {
            return triggerAnimationLoopForSlider(sliderHtmlElement,  sampleVariationsAudioData, volMin, volMax, durationMin, durationMax)
        }
    };
    animate();
}


loadConfig().then((config)=>{

    initScenery(config[0]).then().catch(e=> {throw e});

    document.getElementById('startAudioButton').addEventListener('click', startAudio);
    document.getElementById('stopAudioButton').addEventListener('click', stopAudio);

}).catch(e=> {throw e});




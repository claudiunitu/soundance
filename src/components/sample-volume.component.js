const HTML_ELEMENT_NAME = 'sample-volume';
const HTML_ELEMENT_ON_CHANGE_EVENT_NAME = 'volumeChange';

class SampleVolumeHTMLElement extends HTMLElement {
    
    /**
   *  @type {ShadowRoot | null} 
   */
    shadowRoot = null;

    /**
   *  @type {HTMLInputElement | null} 
   */
    inputHTMLElement = null;

    /**
   *  @type {number} 
   */
    _volumeValue = 0;

    /**
   *  @type {number} 
   */
    get volumeValue() {
        return Number(this._volumeValue);
    }

    /**
   * @param {number | string} value
   */
    set volumeValue(value) {
        this._volumeValue = Number(value) || 0;
        this.render();
    }


    connectedCallback() {
        if (this.inputHTMLElement) {
            this.inputHTMLElement.addEventListener('input', this._onInputListenerOnCurrentContext);
        }
    }

    disconnectedCallback() {
        if (this.inputHTMLElement) {
            this.inputHTMLElement.removeEventListener('input', this._onInputListenerOnCurrentContext);
        }
    }

    _onInputListenerOnCurrentContext = (event) => {
        this._onInputListener(event);
    }

    /**
   * @param {InputEvent} event
   */
    _onInputListener(event) {
        this.volumeValue = event.target.value;
        this.dispatchEvent(
            new CustomEvent(HTML_ELEMENT_ON_CHANGE_EVENT_NAME, { 
                detail: { 
                    volumeValue: this.volumeValue 
                },
                bubbles: true, // Allow the event to bubble up
                composed: true, // Allow it to cross shadow DOM boundaries
            })
        );
    }

    render() {
        this.inputHTMLElement.value = this.volumeValue;
    }

    constructor() {
        super();


        this.shadowRoot = this.attachShadow({ mode: 'open' });

        const wrapper = document.createElement('div');
        wrapper.setAttribute('class', 'property-slider-wrapper');

        const label = document.createElement('label');
        label.textContent = 'Volume';

        this.inputHTMLElement = document.createElement('input');
        this.inputHTMLElement.type = "range";
        this.inputHTMLElement.min = "0";
        this.inputHTMLElement.max = "100";
        this.inputHTMLElement.value = this.volumeValue;

        wrapper.appendChild(label);
        wrapper.appendChild(this.inputHTMLElement);

        const style = document.createElement('style');
        style.textContent = `
            .property-slider-wrapper {
                display: flex;
                background: green;
            }
            .property-slider-wrapper label, 
            .property-slider-wrapper input {
                width: 50%;
            }
        `;

        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(wrapper);

    }
}

customElements.define(HTML_ELEMENT_NAME, SampleVolumeHTMLElement);
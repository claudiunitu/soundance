const HTML_ELEMENT_NAME = 'sample-toggler';
const HTML_ELEMENT_ON_CHANGE_EVENT_NAME = 'toggle';

class SampleTogglerHTMLElement extends HTMLElement {
    
    /**
   *  @type {ShadowRoot | null} 
   */
    shadowRoot = null;

    /**
   *  @type {HTMLInputElement | null} 
   */
    inputHTMLElement = null;

    /**
   *  @type {boolean} 
   */
    _state = false;

    /**
   *  @type {number} 
   */
    get state() {
        return this._state;
    }

    /**
   * @param {boolean} value
   */
    set state(value) {
        this._state = Boolean(value) || false;
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
        this.state = event.target.checked;
        this.dispatchEvent(
            new CustomEvent(HTML_ELEMENT_ON_CHANGE_EVENT_NAME, { 
                detail: { 
                    state: this.state 
                },
                bubbles: true, // Allow the event to bubble up
                composed: true, // Allow it to cross shadow DOM boundaries
            })
        );
    }

    render() {
        this.inputHTMLElement.checked = this.state;
    }

    constructor() {
        super();


        this.shadowRoot = this.attachShadow({ mode: 'open' });

        const togglerWrapper = document.createElement('div');
        togglerWrapper.className = "property-slider-wrapper";
        const togglerWrapperCheckbox = document.createElement('div');
        togglerWrapperCheckbox.className = "sample-toggler-checkbox";

        const togglerLabel = document.createElement('label');
        togglerLabel.innerText = `Activate sample`;

        this.inputHTMLElement = document.createElement('input');
        this.inputHTMLElement.type = 'checkbox';

        togglerWrapperCheckbox.appendChild(this.inputHTMLElement);
        togglerWrapper.appendChild(togglerLabel);
        togglerWrapper.appendChild(togglerWrapperCheckbox);

        const style = document.createElement('style');
        style.textContent = `
            .property-slider-wrapper {
                display: flex;
            }
            .property-slider-wrapper label, 
            .property-slider-wrapper .sample-toggler-checkbox {
                width: 50%;
            }
        `;

        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(togglerWrapper);

    }
}

customElements.define(HTML_ELEMENT_NAME, SampleTogglerHTMLElement);
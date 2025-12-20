/**
 * Manages the state and transitions of modal windows.
 */
export default class WindowManager {
	constructor() {
		this.windowOpen = new Event('gameWindowOpen')
		this.windowsClose = new Event('gameWindowsClosed');
		this.windows = new Map()
		this.modalOverlay = document.getElementById('modalOverlay')
		this.currentlyOpen = null

		// Add a keydown listener to close windows with the Escape key.
		document.addEventListener('keydown', (e) => {
			const currentWindowConfig = this.windows.get(this.currentlyOpen)
			if (e.key === 'Escape' && currentWindowConfig?.closeOnEscape) {
				this.close()
			}
		})
	}

	/**
	 * Adds a window element to be managed.
	 * @param {object} config - The window configuration.
	 * @param {string} config.id - A unique ID for this window.
	 * @param {HTMLElement} config.element - The window's root HTML element.
	 * @param {Function} [config.onOpen] - An optional callback to run when the window is opened.
	 * @param {boolean} [config.closeOnEscape=true] - Whether the window can be closed with the Escape key.
	 */
	add({ id, element, onOpen = () => {}, closeOnEscape = false }) {
		if (!element) {
			console.error(`WindowManager: Element for window with id "${id}" not found.`)
			return
		}
		this.windows.set(id, { element, onOpen, closeOnEscape })
	}

	/**
	 * Opens a specific window by its ID.
	 * @param {string} id - The ID of the window to open.
	 */
	open(id) {
		// First, close any currently open window without hiding the overlay.
		if (this.currentlyOpen) {
			this.windows.get(this.currentlyOpen)?.element.classList.remove('visible')
		}

		const config = this.windows.get(id)
		if (!config) {
			console.error(`WindowManager: Window with id "${id}" not found.`)
			return
		}

		const { element, onOpen } = config

		// Make the window visible.
		element.style.display = 'flex'
		// Use a timeout to allow the display property to apply before adding the class for transition.
		setTimeout(() => {
			element.classList.add('visible')
			this.currentlyOpen = id

			// Run the onOpen callback.
			onOpen()

			// Focus the first focusable element inside the window for accessibility.
			const focusable = element.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
			if (focusable.length > 0) {
				focusable[0].focus()
			}
		}, 10) // A small delay is sufficient.
		document.dispatchEvent(this.windowOpen)
	}

	/**
	 * Closes any currently open window.
	 */
	close() {
		if (!this.currentlyOpen) {
			return
		}

		const config = this.windows.get(this.currentlyOpen)
		if (config) {
			config.element.classList.remove('visible')

			// After the transition ends, set display to none to remove it from the layout.
			config.element.addEventListener(
				'transitionend',
				() => {
					// Only set display to none if it's still not visible.
					if (!config.element.classList.contains('visible')) {
						config.element.style.display = 'none'
					}
				},
				{ once: true }
			)
		}

		this.currentlyOpen = null

		if (!this.areAnyWindowsVisible()){
			document.dispatchEvent(this.windowsClose)
		}
		
	}

	areAnyWindowsVisible() {
		return Array.from(this.windows.values()).some(
			(config) => config.element.classList.contains('visible')
		)
	}

	

}
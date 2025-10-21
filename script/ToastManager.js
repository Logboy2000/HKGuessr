export default class ToastManager {
	constructor() {
		// Create div for holding notifications
		this.toastContainer = document.createElement('div')
		this.toastContainer.id = 'toast-container'
		document.body.appendChild(this.toastContainer)
	}
	/**
	 * General-purpose toast helper
	 * @param {string} message the displayed message in the toast
	 * @param {Number} durationMs the duration the toast is shown for in Ms
	 * @param {object} options - Additional options.
	 * @param {boolean} options.allowHTML - whether to allow HTML in the message input.
	 * @returns {HTMLElement} The created toast element.
	 */
	displayToast = (message, durationMs = 5000, { allowHTML = false } = {}) => {
		const toast = document.createElement('div')
		toast.className = 'hk_toast' // Use class instead of ID
		
		if (allowHTML) {
			toast.innerHTML = message
		} else {
			toast.textContent = message
		}

		this.toastContainer.appendChild(toast)

		// Force a reflow to enable the transition
		toast.offsetHeight

		// Fade in
		toast.style.opacity = '1'

		// If duration is provided and is not 0/null, set timeout to fade out and remove the toast
		if (durationMs) {
			setTimeout(() => {
				this.dismissToast(toast)
			}, durationMs)
		}

		return toast
	}

	/**
	 * Dismisses a specific toast element.
	 * @param {HTMLElement} toast - The toast element to dismiss.
	 */
	dismissToast = (toast) => {
		if (!toast || !toast.parentNode) {
			return // Already removed or invalid
		}
		toast.style.opacity = '0'

		// Remove the element from the DOM after the transition ends
		toast.addEventListener('transitionend', () => {
			toast.remove()
		})
	}
}
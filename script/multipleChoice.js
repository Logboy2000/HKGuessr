export class MultipleChoice {
	constructor(container, options = []) {
		this.container = container;
		this.options = options;
		this.selected = new Set(); // store selected option IDs
		this.render();
	}

	render() {
		this.container.innerHTML = '';
		this.container.classList.add('choices');

		this.options.forEach(option => {
			const choiceDiv = document.createElement('div');
			choiceDiv.className = 'choice';
			if (this.selected.has(option.id)) {
				choiceDiv.classList.add('selected');
			}

			const img = document.createElement('img');
			img.onerror = function() {
				// If the image fails to load, replace it with a default placeholder
				this.src = 'images/noThumbnail.svg';
				this.alt = 'No Thumbnail';
			};
			if (option.img) {
				img.src = option.img;
			} else {
				img.src = 'images/noThumbnail.svg';
				img.alt = 'No Thumbnail';
			}

			choiceDiv.appendChild(img); // Add image directly to choiceDiv

			const textContainer = document.createElement('div')
			textContainer.classList.add('choiceTextContainer')

			textContainer.appendChild(document.createTextNode(option.label));

			// Add author and image count
			const infoContainer = document.createElement('div');
			infoContainer.className = 'choice-info';

			if (option.author) {
				const authorSpan = document.createElement('span');
				authorSpan.className = 'choice-author';
				authorSpan.textContent = `By ${option.author}`;
				infoContainer.appendChild(authorSpan);
			}

			if (option.imageCount !== undefined) {
				const countSpan = document.createElement('span');
				countSpan.className = 'choice-image-count';
				countSpan.textContent = `${option.imageCount} images`;
				infoContainer.appendChild(countSpan);
			}
			textContainer.appendChild(infoContainer);
			choiceDiv.appendChild(textContainer); // Add text container directly to choiceDiv

			this.container.appendChild(choiceDiv);

			choiceDiv.addEventListener('click', () => {
				if (this.selected.has(option.id)) {
					this.selected.delete(option.id);
					choiceDiv.classList.remove('selected');
				} else {
					this.selected.add(option.id);
					choiceDiv.classList.add('selected');
				}
			});
		});
	}

	selectChoiceByIndex(index) {
		if (index >= 0 && index < this.options.length) {
			const option = this.options[index];
			this.selected.add(option.id);
			this.render();
		}
	}

	getSelected() {
		return Array.from(this.selected);
	}

	getSelectedOptions() {
		return this.options.filter(option => this.selected.has(option.id));
	}

	addChoice(option) {
		
		this.options.push(option);
		this.render();
	}

	removeChoiceById(id) {
		this.options = this.options.filter(option => option.id !== id);
		this.selected.delete(id);
		this.render();
	}

	clearChoices() {
		this.options = [];
		this.selected.clear();
		this.render();
	}
}

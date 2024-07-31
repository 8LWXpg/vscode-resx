// @ts-check

/**
 * @typedef {{'@_name': string, value: string, comment?: string}[]} WebviewState
 * @typedef {{obj: WebviewState}} State
 */

// @ts-ignore
const vscode = acquireVsCodeApi();

const container = /** @type {HTMLTableSectionElement} */ (document.querySelector('tbody'));

/**
 * Handle the input event for inputs, trickier because name must be unique
 */
function inputEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	const name = self.querySelector('#col0').value;
	const value = self.querySelector('#col1').value || undefined;
	const comment = self.querySelector('#col2').value || undefined;
	let current = obj.find((ele) => ele['value'] === value && ele['comment'] === comment);
	if (!current) {
		if (!value) {
			return;
		}
		current = { '@_name': name, value, comment };
		obj.push(current);
	} else {
		current['@_name'] = name;
	}
	setStateAndPostUpdate(obj);
}

/**
 * Handle the input event for textarea
 */
function textareaEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	const name = self.querySelector('#col0').value;
	const value = self.querySelector('#col1').value || undefined;
	const comment = self.querySelector('#col2').value || undefined;
	let current = obj.find((ele) => ele['@_name'] === name);
	if (!current) {
		current = { '@_name': name, value };
		obj.push(current);
	} else {
		current.value = value;
	}
	current.comment = comment;
	setStateAndPostUpdate(obj);
}

function deleteEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	const value = self.querySelector('#col0').value;
	obj = obj.filter((ele) => ele['@_name'] !== value);
	self.remove();
	updateContent(obj);
	setStateAndPostUpdate(obj);
}

function addContent() {
	const element = document.createElement('tr');
	container.appendChild(element);
	element.innerHTML = rowHtml('', '', '');
	element.scrollIntoView();
}

/**
 * Returns the html for a row
 * @param {string} name
 * @param {string} value
 * @param {string} comment
 * @returns {string} html
 */
function rowHtml(name, value, comment) {
	return /* html */ `
<td><input class="input" id="col0" oninput="inputEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()" value="${name}"></td>
<td><textarea class="input" id="col1" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()" rows="1">${value}</textarea></td>
<td><textarea class="input" id="col2" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()" rows="1">${comment}</textarea></td>
<td><div class="drop" onclick="deleteEvent(this.parentElement.parentElement)">✖</div></td>
`;
}

/**
 * Update content of the table
 * @param {WebviewState} obj
 */
function updateContent(obj) {
	container.innerHTML = '';
	obj.forEach((ele) => {
		const comment = (ele.comment || '').replaceAll('"', '&quot;');
		const value = (ele.value || '').replaceAll('"', '&quot;');
		const element = document.createElement('tr');
		container.appendChild(element);
		element.innerHTML = rowHtml(ele['@_name'], value, comment);
	});
}

/**
 * Handle keyboard navigation
 * @param {KeyboardEvent} e 
 * @param {HTMLElement} input 
 * @returns 
 */
function handleKeyEvent(e, input) {
	if (!e.ctrlKey) { return; }
	let /** @type {HTMLInputElement | HTMLTextAreaElement | null | undefined} */ next;
	switch (e.key) {
		case 'ArrowUp': {
			e.preventDefault();
			const tr = input.parentElement?.parentElement;
			next = tr?.previousElementSibling?.querySelector(`td #${input.id}`);
			break;
		}
		case 'Enter':
		case 'ArrowDown': {
			e.preventDefault();
			const tr = input.parentElement?.parentElement;
			next = tr?.nextElementSibling?.querySelector(`td #${input.id}`);
			break;
		}
		case 'ArrowLeft': {
			e.preventDefault();
			next = input.parentElement?.previousElementSibling?.querySelector('.input');
			break;
		}
		case 'ArrowRight': {
			e.preventDefault();
			next = input.parentElement?.nextElementSibling?.querySelector('.input');
			break;
		}
		default:
			break;
	}
	if (next) { next.focus(); }
}

let sortFlags = {
	'@_name': true,
	value: true,
	comment: true,
};

/**
 * @param { 'value' | 'comment' | '@_name' } key
 */
function sortObject(self, key) {
	/** @type {{value: string, comment?: string, '@_name': string}[]} obj */
	let obj = vscode.getState()?.obj;
	obj.sort((a, b) => (b[key] || '').localeCompare(a[key] || ''));

	if (sortFlags[key]) {
		self.setAttribute('aria-sort', 'descending');
	} else {
		obj.reverse();
		self.setAttribute('aria-sort', 'ascending');
	}
	sortFlags[key] = !sortFlags[key];
	updateContent(obj);
	setStateAndPostUpdate(obj);
}

// Functions used by <th> elements to sort the table
function sortName(self) {
	sortObject(self, '@_name');
}

function sortValue(self) {
	sortObject(self, 'value');
}

function sortComment(self) {
	sortObject(self, 'comment');
}

/**
 * Update webview state then post an update message
 * @param {WebviewState} obj
 */
function setStateAndPostUpdate(obj) {
	vscode.setState({ obj: obj });
	vscode.postMessage({
		// update text in the file
		type: 'update',
		obj: obj,
	});
}

// Handle messages sent from the extension to the webview
window.addEventListener('message', (event) => {
	const message = event.data; // The json data that the extension sent
	switch (message.type) {
		case 'update':
			// use the object that represents the document to track the state of the webview
			const obj = message.obj;
			updateContent(obj);
			vscode.setState({ obj });
			console.log('update', obj);
			return;
	}
});

// Webview is normally torn down when not visible and re-created when they become visible again.
// State lets us save information across these re-loads
const state = vscode.getState();
if (state) {
	updateContent(state.obj);
}

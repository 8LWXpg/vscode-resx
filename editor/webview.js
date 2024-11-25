// @ts-check

/**
 * @typedef {{ '@_name': string; value: string; comment?: string }[]} WebviewState
 *
 * @typedef {{ obj: WebviewState }} State
 */

// @ts-ignore
const vscode = acquireVsCodeApi();

const container = /** @type {HTMLTableSectionElement} */ (document.querySelector('tbody'));

/** Handle the input event for inputs, trickier because name must be unique */
function inputEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	const index = self.getAttribute('data-index');
	const name = self.querySelector('#name').value;
	obj[index]['@_name'] = name;
	setStateAndPostUpdate(obj);
}

/** Handle the input event for textarea */
function textareaEvent(self) {
	autoGrow(self);
	/** @type {State} */
	let { obj } = vscode.getState();
	const index = self.getAttribute('data-index');
	const value = self.querySelector('#value').value || undefined;
	const comment = self.querySelector('#comment').value || undefined;
	obj[index].value = value;
	obj[index].comment = comment;
	setStateAndPostUpdate(obj);
}

/**
 * Make elements in row grow with textarea height
 *
 * @param {HTMLTableRowElement} row
 */
function autoGrow(row) {
	/** @type {(HTMLInputElement | HTMLTextAreaElement)[]} */
	let inputs = Array.from(row.querySelectorAll('.input'));
	inputs.forEach((ele) => {
		ele.style.height = '5px';
	});
	let maxHeight = Math.max(...inputs.map((ele) => ele.scrollHeight));
	inputs.forEach((ele) => {
		ele.style.height = maxHeight + 'px';
	});
}

function deleteEvent(self) {
	/** @type {State} */
	let { obj } = vscode.getState();
	const value = self.querySelector('#name').value;
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
 *
 * @param {string} name
 * @param {string} value
 * @param {string} comment
 * @returns {string} Html
 */
function rowHtml(name, value, comment) {
	return /* html */ `
<td><input class="input" id="name" oninput="inputEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()" value="${name}"></td>
<td><textarea rows="1" class="input" id="value" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()">${value}</textarea></td>
<td><textarea rows="1" class="input" id="comment" oninput="textareaEvent(this.parentElement.parentElement)" onkeydown="handleKeyEvent(event, this)" onfocus="this.select()">${comment}</textarea></td>
<td><div class="drop" onclick="deleteEvent(this.parentElement.parentElement)">✖</div></td>
`;
}

/**
 * Update content of the table
 *
 * @param {WebviewState} obj
 */
function updateContent(obj) {
	container.innerHTML = '';
	obj.forEach((ele, i) => {
		const comment = (ele.comment || '').replaceAll('"', '&quot;');
		const value = (ele.value || '').replaceAll('"', '&quot;');
		const element = document.createElement('tr');
		container.appendChild(element);
		element.innerHTML = rowHtml(ele['@_name'], value, comment);
		element.setAttribute('data-index', i.toString());
		autoGrow(element);
	});
}

/**
 * Handle keyboard navigation
 *
 * @param {KeyboardEvent} e
 * @param {HTMLElement} input
 * @returns
 */
function handleKeyEvent(e, input) {
	if (!e.ctrlKey) {
		return;
	}
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
		default:
			break;
	}
	if (next) {
		next.focus();
	}
}

let sortFlags = {
	'@_name': true,
	value: true,
	comment: true,
};

/** @param {'value' | 'comment' | '@_name'} key */
function sortObject(self, key) {
	/** @type {WebviewState} */
	let obj = vscode.getState()?.obj;
	obj.sort((a, b) => (b[key] || '').localeCompare(a[key] || ''));

	// Reset all other th elements
	const allHeaders = self.parentElement?.getElementsByTagName('th');
	if (allHeaders) {
		Array.from(allHeaders).forEach((header) => {
			if (header !== self) {
				header.removeAttribute('aria-sort');
			}
		});
	}

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
 *
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
